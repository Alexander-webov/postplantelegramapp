// =============================================================================
// Postplan — update-views Edge Function
// =============================================================================
// Triggered every minute by cron-job.org. Picks all scheduled_posts where:
//   - status = 'sent'
//   - sent_at is set
//   - One of views_{1h,6h,24h,48h} is null AND its target time has passed
// For each, calls Telegram editMessageReplyMarkup with the existing markup
// (a no-op edit) which returns the Message object including channel-post
// `views` field. We snapshot that into the right column.
//
// Authorization: same pattern as delete-expired-posts. We rely on Supabase
// Gateway's Verify JWT toggle for security, not on a code-level header check.
//
// Re-deploy after editing:
//   Dashboard → Edge Functions → update-views → paste this file
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const BATCH_SIZE = 50;
const TG_API = 'https://api.telegram.org';

interface ViewsRow {
  id: string;
  user_id: string;
  sent_at: string | null;
  telegram_message_id: number | null;
  views_1h: number | null;
  views_6h: number | null;
  views_24h: number | null;
  views_48h: number | null;
  channels: {
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
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, cryptoKey, ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Fetch the current views count for a channel post by calling
 * editMessageReplyMarkup with no actual change. Telegram returns the updated
 * Message which includes the `views` field for channel posts.
 */
async function fetchViews(
  token: string,
  chatId: string,
  messageId: number
): Promise<{ views: number | null; error: string | null }> {
  try {
    const res = await fetch(`${TG_API}/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    });
    const data = await res.json();

    if (!data.ok) {
      const desc: string = data.description ?? '';

      if (desc.includes('not modified')) {
        return { views: null, error: 'TG returned "not modified" — views unavailable for this post' };
      }
      if (desc.includes('not found') || desc.includes("can't be edited")) {
        return { views: null, error: desc };
      }
      return { views: null, error: desc || 'unknown TG error' };
    }

    const views = data.result?.views;
    if (typeof views === 'number') {
      return { views, error: null };
    }
    return { views: null, error: 'no views field in response' };
  } catch (e) {
    return { views: null, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}

function dueSnapshot(
  sentAt: string,
  row: ViewsRow
): 'views_1h' | 'views_6h' | 'views_24h' | 'views_48h' | null {
  const elapsedMs = Date.now() - new Date(sentAt).getTime();
  const hours = elapsedMs / (60 * 60 * 1000);

  if (hours >= 48 && row.views_48h === null) return 'views_48h';
  if (hours >= 24 && row.views_24h === null) return 'views_24h';
  if (hours >= 6 && row.views_6h === null) return 'views_6h';
  if (hours >= 1 && row.views_1h === null) return 'views_1h';
  return null;
}

Deno.serve(async (_req) => {
  const startedAt = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows, error: selectErr } = await supabase
    .from('scheduled_posts')
    .select(
      `
      id, user_id, sent_at, telegram_message_id,
      views_1h, views_6h, views_24h, views_48h,
      channels (telegram_chat_id, bots (token_encrypted))
      `
    )
    .eq('status', 'sent')
    .not('sent_at', 'is', null)
    .or('views_1h.is.null,views_6h.is.null,views_24h.is.null,views_48h.is.null')
    .gte('sent_at', new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString())
    .limit(BATCH_SIZE);

  if (selectErr) {
    console.error('Select failed:', selectErr);
    return new Response(JSON.stringify({ error: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const candidates = (rows ?? []) as unknown as ViewsRow[];

  const due: { row: ViewsRow; column: 'views_1h' | 'views_6h' | 'views_24h' | 'views_48h' }[] = [];
  for (const row of candidates) {
    if (!row.sent_at) continue;
    const column = dueSnapshot(row.sent_at, row);
    if (column) due.push({ row, column });
  }

  if (due.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, ms: Date.now() - startedAt }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  let snapshotted = 0;
  let failed = 0;

  for (const { row, column } of due) {
    const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
    const bot = channel?.bots
      ? Array.isArray(channel.bots) ? channel.bots[0] : channel.bots
      : null;

    if (!channel || !bot?.token_encrypted || !row.telegram_message_id) {
      await supabase
        .from('scheduled_posts')
        .update({
          [column]: 0,
          views_error: 'Канал, бот или message_id отсутствуют',
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
        .update({ [column]: 0, views_error: `decrypt: ${msg}` })
        .eq('id', row.id);
      failed++;
      continue;
    }

    const result = await fetchViews(
      token,
      channel.telegram_chat_id,
      row.telegram_message_id
    );

    const now = new Date().toISOString();

    if (result.views !== null) {
      await supabase
        .from('scheduled_posts')
        .update({
          [column]: result.views,
          views_latest: result.views,
          views_latest_at: now,
          views_error: null,
        })
        .eq('id', row.id);
      snapshotted++;
    } else {
      await supabase
        .from('scheduled_posts')
        .update({
          [column]: 0,
          views_error: result.error ?? 'unknown',
        })
        .eq('id', row.id);
      failed++;
    }

    await new Promise((res) => setTimeout(res, 50));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: due.length,
      snapshotted,
      failed,
      ms: Date.now() - startedAt,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
