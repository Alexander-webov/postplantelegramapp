// =============================================================================
// Postplan — update-views Edge Function
// =============================================================================
// Scheduled view-count snapshots for published posts.
//
// Implementation: scrape the public t.me embed widget. This is the only
// reliable way to read Telegram channel-post views in 2026 — the Bot API
// has no method for it, and the historical editMessageReplyMarkup trick
// destroys inline buttons on posts that have them.
//
// Snapshot windows: 1h / 6h / 24h / 48h after sent_at. Each column is
// written exactly once, the first time the worker runs after the window
// opens.
//
// Deploy:
//   supabase functions deploy update-views --no-verify-jwt
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const BATCH_SIZE = 50;
const TME_BASE = 'https://t.me';
const USER_AGENT = 'Mozilla/5.0 (compatible; PostplanBot/1.0; +https://postplan-tg.ru)';

type SnapshotColumn = 'views_1h' | 'views_6h' | 'views_24h' | 'views_48h';
type ChannelRef = { telegram_chat_id: string | null; username: string | null };

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

function parseViewsString(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return null;
  const base = parseFloat(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = match[2]?.toUpperCase();
  const multiplier =
    suffix === 'K' ? 1_000 :
    suffix === 'M' ? 1_000_000 :
    suffix === 'B' ? 1_000_000_000 :
    1;
  return Math.round(base * multiplier);
}

function extractViewsFromHtml(html: string): number | null {
  const match = html.match(
    /<span[^>]*class="[^"]*tgme_widget_message_views[^"]*"[^>]*>([^<]+)<\/span>/i,
  );
  if (!match) return null;
  return parseViewsString(match[1]);
}

async function fetchPublicPostViews(
  username: string | null,
  messageId: number,
): Promise<{ views: number | null; error: string | null }> {
  if (!username) return { views: null, error: 'Приватный канал — публичная страница недоступна' };

  const cleaned = username.replace(/^@/, '');
  const url = `${TME_BASE}/${cleaned}/${messageId}?embed=1&mode=tme`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { views: null, error: 'Пост не найден на t.me' };
    if (!res.ok) return { views: null, error: `t.me ответил статусом ${res.status}` };
    const html = await res.text();
    const views = extractViewsFromHtml(html);
    if (views === null) return { views: null, error: 'Просмотры не найдены на странице поста' };
    return { views, error: null };
  } catch (e) {
    return { views: null, error: e instanceof Error ? e.message : 't.me fetch failed' };
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
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing Supabase URL or service role key' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows, error: selectErr } = await supabase
    .from('scheduled_posts')
    .select(`
      id, user_id, sent_at, telegram_message_id,
      views_1h, views_6h, views_24h, views_48h,
      channels (telegram_chat_id, username)
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
    return new Response(
      JSON.stringify({
        ok: true,
        processed: 0,
        snapshotted: 0,
        failed: 0,
        reason: 'No due posts',
        ms: Date.now() - startedAt,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  let snapshotted = 0;
  let failed = 0;
  const errors: Array<{ scheduled_post_id: string; error: string }> = [];

  for (const { row, column } of due) {
    const channel = pickOne(row.channels);

    if (!channel || !row.telegram_message_id) {
      const error = 'Канал или message_id отсутствуют';
      await supabase
        .from('scheduled_posts')
        .update({ views_error: error })
        .eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error });
      continue;
    }

    const result = await fetchPublicPostViews(channel.username, row.telegram_message_id);
    const now = new Date().toISOString();

    if (result.views !== null) {
      const { error: updateErr } = await supabase
        .from('scheduled_posts')
        .update({
          [column]: result.views,
          views_latest: result.views,
          views_latest_at: now,
          views_error: null,
        })
        .eq('id', row.id);

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
      // Private channels / parse failures: record the error but leave the
      // snapshot column NULL. We don't want to permanently lock the column
      // to 0 — the post might become reachable later (channel made public,
      // t.me HTML format restored, etc.).
      await supabase
        .from('scheduled_posts')
        .update({ views_error: result.error })
        .eq('id', row.id);
      failed++;
      errors.push({ scheduled_post_id: row.id, error: result.error ?? 'unknown error' });
    }

    // Small delay to be gentle with t.me
    await new Promise((res) => setTimeout(res, 150));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: due.length,
      snapshotted,
      failed,
      errors: errors.slice(0, 10),
      ms: Date.now() - startedAt,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
