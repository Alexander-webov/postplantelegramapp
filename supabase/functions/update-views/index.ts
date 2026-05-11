// =============================================================================
// Postplan — update-views Edge Function
// =============================================================================
// Scheduled post view snapshots. Telegram has no stable public endpoint for
// channel-post views, so this keeps the existing no-op edit approach but fixes
// token decryption and gives detailed errors.
//
// Deploy:
//   supabase functions deploy update-views --no-verify-jwt
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const BATCH_SIZE = 50;
const TG_API = 'https://api.telegram.org';

type SnapshotColumn = 'views_1h' | 'views_6h' | 'views_24h' | 'views_48h';
type BotRef = { token_encrypted: string | null };
type ChannelRef = { telegram_chat_id: string | null; bots: BotRef | BotRef[] | null };

interface ViewsRow {
  id: string;
  user_id: string;
  sent_at: string | null;
  telegram_message_id: number | null;
  views_1h: number | null;
  views_6h: number | null;
  views_24h: number | null;
  views_48h: number | null;
  channels: ChannelRef | ChannelRef[] | null;
}

function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('POSTPLAN_SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('POSTPLAN_SERVICE_ROLE_KEY');
  return { supabaseUrl, serviceKey };
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function decryptToken(payload: string): Promise<string> {
  const keyB64 = Deno.env.get('ENCRYPTION_KEY');
  if (!keyB64) throw new Error('ENCRYPTION_KEY env var missing');

  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes');

  const data = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = data.slice(0, 12);
  const authTag = data.slice(12, 28);
  const ciphertext = data.slice(28);
  const ctWithTag = new Uint8Array(ciphertext.length + authTag.length);
  ctWithTag.set(ciphertext, 0);
  ctWithTag.set(authTag, ciphertext.length);

  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ctWithTag);
  return new TextDecoder().decode(decrypted);
}

async function fetchViews(token: string, chatId: string, messageId: number): Promise<{ views: number | null; error: string | null }> {
  try {
    const res = await fetch(`${TG_API}/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    });
    const data = await res.json();
    if (!data.ok) return { views: null, error: data.description ?? 'unknown Telegram error' };
    return typeof data.result?.views === 'number'
      ? { views: data.result.views, error: null }
      : { views: null, error: 'Telegram response has no views field' };
  } catch (e) {
    return { views: null, error: e instanceof Error ? e.message : 'Telegram fetch failed' };
  }
}

function dueSnapshot(sentAt: string, row: ViewsRow): SnapshotColumn | null {
  const hours = (Date.now() - new Date(sentAt).getTime()) / (60 * 60 * 1000);
  if (hours >= 48 && row.views_48h === null) return 'views_48h';
  if (hours >= 24 && row.views_24h === null) return 'views_24h';
  if (hours >= 6 && row.views_6h === null) return 'views_6h';
  if (hours >= 1 && row.views_1h === null) return 'views_1h';
  return null;
}

Deno.serve(async (_req) => {
  const startedAt = Date.now();
  const { supabaseUrl, serviceKey } = getSupabaseEnv();

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing Supabase URL or service role key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows, error: selectErr } = await supabase
    .from('scheduled_posts')
    .select(`
      id, user_id, sent_at, telegram_message_id,
      views_1h, views_6h, views_24h, views_48h,
      channels (telegram_chat_id, bots (token_encrypted))
    `)
    .eq('status', 'sent')
    .not('sent_at', 'is', null)
    .not('telegram_message_id', 'is', null)
    .or('views_1h.is.null,views_6h.is.null,views_24h.is.null,views_48h.is.null')
    .gte('sent_at', new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString())
    .limit(BATCH_SIZE);

  if (selectErr) {
    return new Response(JSON.stringify({ ok: false, error: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const due: { row: ViewsRow; column: SnapshotColumn }[] = [];
  for (const row of (rows ?? []) as unknown as ViewsRow[]) {
    if (!row.sent_at) continue;
    const column = dueSnapshot(row.sent_at, row);
    if (column) due.push({ row, column });
  }

  if (due.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, snapshotted: 0, failed: 0, reason: 'No due posts', ms: Date.now() - startedAt }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let snapshotted = 0;
  let failed = 0;
  const errors: Array<{ scheduled_post_id: string; error: string }> = [];

  for (const { row, column } of due) {
    const channel = pickOne(row.channels);
    const bot = pickOne(channel?.bots);

    if (!channel?.telegram_chat_id || !bot?.token_encrypted || !row.telegram_message_id) {
      const error = 'Канал, бот, токен или message_id отсутствуют';
      await supabase.from('scheduled_posts').update({ [column]: 0, views_error: error }).eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
      continue;
    }

    let token: string;
    try {
      token = await decryptToken(bot.token_encrypted);
    } catch (e) {
      const error = `decrypt: ${e instanceof Error ? e.message : 'decrypt failed'}`;
      await supabase.from('scheduled_posts').update({ [column]: 0, views_error: error }).eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
      continue;
    }

    const result = await fetchViews(token, channel.telegram_chat_id, row.telegram_message_id);
    const now = new Date().toISOString();

    if (result.views !== null) {
      const { error: updateErr } = await supabase.from('scheduled_posts').update({
        [column]: result.views,
        views_latest: result.views,
        views_latest_at: now,
        views_error: null,
      }).eq('id', row.id);

      if (updateErr) {
        failed++;
        errors.push({ scheduled_post_id: row.id, error: updateErr.message });
        continue;
      }

      const { error: insertErr } = await supabase.from('post_analytics').insert({
        scheduled_post_id: row.id,
        views: result.views,
        snapshot_at: now,
      });

      if (insertErr) {
        failed++;
        errors.push({ scheduled_post_id: row.id, error: insertErr.message });
        continue;
      }

      snapshotted++;
    } else {
      const error = result.error ?? 'unknown Telegram error';
      await supabase.from('scheduled_posts').update({ [column]: 0, views_error: error }).eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
    }

    await new Promise((res) => setTimeout(res, 50));
  }

  return new Response(JSON.stringify({ ok: true, processed: due.length, snapshotted, failed, errors: errors.slice(0, 10), ms: Date.now() - startedAt }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
