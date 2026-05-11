// =============================================================================
// Postplan — delete-expired-posts Edge Function
// =============================================================================
// Deletes Telegram messages whose auto_delete_at is due.
//
// Required secrets:
//   ENCRYPTION_KEY
// Optional custom secrets, if built-in SUPABASE_* are unavailable:
//   POSTPLAN_SUPABASE_URL
//   POSTPLAN_SERVICE_ROLE_KEY
//
// Deploy:
//   supabase functions deploy delete-expired-posts --no-verify-jwt
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const BATCH_SIZE = 30;
const TG_API = 'https://api.telegram.org';

type BotRef = { token_encrypted: string | null };
type ChannelRef = {
  title: string | null;
  telegram_chat_id: string | null;
  bots: BotRef | BotRef[] | null;
};

interface ExpiredRow {
  id: string;
  user_id: string;
  telegram_message_id: number | null;
  telegram_message_ids: number[] | null;
  channels: ChannelRef | ChannelRef[] | null;
}

function getSupabaseEnv() {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') ?? Deno.env.get('POSTPLAN_SUPABASE_URL');
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('POSTPLAN_SERVICE_ROLE_KEY');
  return { supabaseUrl, serviceKey };
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// AES-256-GCM decryption — exact mirror of src/lib/crypto.ts:
// base64(iv[12] | authTag[16] | ciphertext)
async function decryptToken(payload: string): Promise<string> {
  const keyB64 = Deno.env.get('ENCRYPTION_KEY');
  if (!keyB64) throw new Error('ENCRYPTION_KEY env var missing');

  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes');
  }

  const data = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = data.slice(0, 12);
  const authTag = data.slice(12, 28);
  const ciphertext = data.slice(28);

  const ctWithTag = new Uint8Array(ciphertext.length + authTag.length);
  ctWithTag.set(ciphertext, 0);
  ctWithTag.set(authTag, ciphertext.length);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ctWithTag,
  );

  return new TextDecoder().decode(decrypted);
}

async function tgDelete(
  token: string,
  chatId: string,
  messageId: number,
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
  const { supabaseUrl, serviceKey } = getSupabaseEnv();

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Missing Supabase URL or service role key',
        hint: 'Use built-in SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or custom POSTPLAN_SUPABASE_URL/POSTPLAN_SERVICE_ROLE_KEY',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows, error: selectErr } = await supabase
    .from('scheduled_posts')
    .select(
      `
      id, user_id, telegram_message_id, telegram_message_ids,
      channels (title, telegram_chat_id, bots (token_encrypted))
      `,
    )
    .eq('status', 'sent')
    .not('auto_delete_at', 'is', null)
    .lte('auto_delete_at', new Date().toISOString())
    .is('auto_deleted_at', null)
    .is('auto_delete_error', null)
    .limit(BATCH_SIZE);

  if (selectErr) {
    return new Response(JSON.stringify({ ok: false, error: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const expired = (rows ?? []) as unknown as ExpiredRow[];

  if (expired.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, deleted: 0, failed: 0, reason: 'No due posts', ms: Date.now() - startedAt }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  let deleted = 0;
  let failed = 0;
  const errors: Array<{ scheduled_post_id: string; error: string }> = [];

  for (const row of expired) {
    const channel = pickOne(row.channels);
    const bot = pickOne(channel?.bots);

    if (!channel?.telegram_chat_id || !bot?.token_encrypted) {
      const error = 'Канал, chat_id или бот отсутствуют';
      await supabase.from('scheduled_posts').update({ auto_delete_error: error }).eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
      continue;
    }

    let token: string;
    try {
      token = await decryptToken(bot.token_encrypted);
    } catch (e) {
      const error = `Ошибка расшифровки токена: ${e instanceof Error ? e.message : 'decrypt failed'}`;
      await supabase.from('scheduled_posts').update({ auto_delete_error: error }).eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
      continue;
    }

    const ids =
      row.telegram_message_ids && row.telegram_message_ids.length > 0
        ? row.telegram_message_ids
        : row.telegram_message_id !== null
          ? [row.telegram_message_id]
          : [];

    if (ids.length === 0) {
      const error = 'Нет id сообщения для удаления';
      await supabase.from('scheduled_posts').update({ auto_delete_error: error }).eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
      continue;
    }

    const deleteErrors: string[] = [];

    for (const messageId of ids) {
      const r = await tgDelete(token, channel.telegram_chat_id, messageId);
      if (!r.ok) {
        const desc = r.description ?? 'unknown Telegram error';
        if (!desc.toLowerCase().includes('not found')) {
          deleteErrors.push(`msg ${messageId}: ${desc}`);
        }
      }
      await new Promise((res) => setTimeout(res, 80));
    }

    const now = new Date().toISOString();

    if (deleteErrors.length > 0) {
      const error = deleteErrors.join('; ').slice(0, 500);
      await supabase
        .from('scheduled_posts')
        .update({ auto_delete_error: error, auto_deleted_at: now })
        .eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
    } else {
      await supabase
        .from('scheduled_posts')
        .update({ auto_deleted_at: now, auto_delete_error: null })
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
      errors: errors.slice(0, 10),
      ms: Date.now() - startedAt,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
