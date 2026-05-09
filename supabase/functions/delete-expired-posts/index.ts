// =============================================================================
// Postplan — delete-expired-posts Edge Function
// =============================================================================
// Triggered every minute by cron-job.org. Picks rows in scheduled_posts where:
//   - status = 'sent'
//   - auto_delete_at IS NOT NULL AND auto_delete_at <= now()
//   - auto_deleted_at IS NULL
//   - auto_delete_error IS NULL
// For each, deletes the message(s) from Telegram via deleteMessage API.
//
// Authorization model:
//   - We do NOT check Authorization header in code — it's unreliable in
//     edge runtime (env var name conflicts with system reserved names).
//   - Instead, security is enforced by Supabase Gateway via the
//     "Verify JWT with legacy secret" toggle in function Settings:
//       * If ON: Supabase requires Authorization: Bearer <anon_or_service_role>
//                BEFORE the request reaches our code
//       * If OFF: function is publicly callable. Use this for cron pings.
//   - Both modes are fine for this function — pick based on your threat model.
//
// Re-deploy after editing:
//   Dashboard → Edge Functions → delete-expired-posts → paste this file
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const BATCH_SIZE = 30;
const TG_API = 'https://api.telegram.org';

interface ExpiredRow {
  id: string;
  user_id: string;
  telegram_message_id: number | null;
  telegram_message_ids: number[] | null;
  channels: {
    title: string;
    telegram_chat_id: string;
    bots: { token_encrypted: string } | null;
  } | null;
}

// ---- AES-256-GCM decryption (mirror of src/lib/crypto.ts) ----------------
async function decryptToken(encrypted: string): Promise<string> {
  const keyB64 = Deno.env.get('ENCRYPTION_KEY');
  if (!keyB64) throw new Error('ENCRYPTION_KEY env var missing');

  const buf = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = buf.slice(0, 12);
  const ciphertext = buf.slice(12);

  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

async function tgDelete(
  token: string,
  chatId: string,
  messageId: number
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${TG_API}/bot${token}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
  const data = await res.json();
  return { ok: data.ok === true, description: data.description };
}

Deno.serve(async (_req) => {
  const startedAt = Date.now();

  // Supabase Edge Functions inject SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  // automatically — we use those, not custom secrets. ENCRYPTION_KEY is OUR
  // custom secret that we set up in Project Settings → Edge Function Secrets.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Pick due rows
  const { data: rows, error: selectErr } = await supabase
    .from('scheduled_posts')
    .select(
      `
      id, user_id, telegram_message_id, telegram_message_ids,
      channels (title, telegram_chat_id, bots (token_encrypted))
      `
    )
    .eq('status', 'sent')
    .not('auto_delete_at', 'is', null)
    .lte('auto_delete_at', new Date().toISOString())
    .is('auto_deleted_at', null)
    .is('auto_delete_error', null)
    .limit(BATCH_SIZE);

  if (selectErr) {
    console.error('Select failed:', selectErr);
    return new Response(JSON.stringify({ error: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const expired = (rows ?? []) as unknown as ExpiredRow[];
  if (expired.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, ms: Date.now() - startedAt }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  let deleted = 0;
  let failed = 0;

  for (const row of expired) {
    const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
    const bot = channel?.bots
      ? Array.isArray(channel.bots) ? channel.bots[0] : channel.bots
      : null;

    if (!channel || !bot?.token_encrypted) {
      // Channel/bot deleted — mark as failed so we don't retry forever
      await supabase
        .from('scheduled_posts')
        .update({
          auto_delete_error: 'Канал или бот удалён — нечем удалять',
        })
        .eq('id', row.id);
      failed++;
      continue;
    }

    let token: string;
    try {
      token = await decryptToken(bot.token_encrypted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'decrypt failed';
      await supabase
        .from('scheduled_posts')
        .update({ auto_delete_error: `Ошибка расшифровки токена: ${msg}` })
        .eq('id', row.id);
      failed++;
      continue;
    }

    // Determine the list of message ids to delete. Prefer the array (set for
    // posts created after migration 006), fall back to the singular id.
    const ids =
      row.telegram_message_ids && row.telegram_message_ids.length > 0
        ? row.telegram_message_ids
        : row.telegram_message_id !== null
        ? [row.telegram_message_id]
        : [];

    if (ids.length === 0) {
      await supabase
        .from('scheduled_posts')
        .update({ auto_delete_error: 'Нет id сообщения для удаления' })
        .eq('id', row.id);
      failed++;
      continue;
    }

    // Delete each message — in albums each photo is a separate message.
    const errors: string[] = [];
    for (const messageId of ids) {
      const r = await tgDelete(token, channel.telegram_chat_id, messageId);
      if (!r.ok) {
        // Common reasons: "message can't be deleted" (>48h, no admin rights),
        // "message to delete not found" (already deleted manually).
        // Treat "not found" as soft-success — message already gone.
        if (r.description?.includes('not found')) {
          // already deleted by the user — proceed silently
        } else {
          errors.push(`msg ${messageId}: ${r.description ?? 'unknown'}`);
        }
      }
      // Pacing — Telegram tolerates many deletes, but be polite
      await new Promise((res) => setTimeout(res, 80));
    }

    const now = new Date().toISOString();
    if (errors.length > 0) {
      await supabase
        .from('scheduled_posts')
        .update({
          auto_delete_error: errors.join('; ').slice(0, 500),
          auto_deleted_at: now, // mark attempted so we don't retry forever
        })
        .eq('id', row.id);
      failed++;
    } else {
      await supabase
        .from('scheduled_posts')
        .update({ auto_deleted_at: now })
        .eq('id', row.id);
      deleted++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: expired.length,
      deleted,
      failed,
      ms: Date.now() - startedAt,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
