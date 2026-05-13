/**
 * Fetch Telegram channel-post views from the public t.me embed page.
 *
 * Why this exists: Bot API has no method to read a channel post's view count.
 * The old trick of calling editMessageReplyMarkup with an empty keyboard only
 * "works" for posts that already have inline buttons — and it destroys those
 * buttons in the process. For posts without buttons it returns
 * "message is not modified" and no views at all.
 *
 * Solution: scrape the public embed widget that Telegram exposes for every
 * public channel post at https://t.me/<username>/<id>?embed=1. This is the
 * same source TGStat, Telemetr and other analytics services use. Works for
 * any public channel without touching the post or spending Bot API quota.
 *
 * Limitation: private channels (no username) have no public page. Caller
 * should surface a clear error to the user — see `PublicViewsErrorCode`.
 */

export type PublicViewsErrorCode =
  | 'private_channel'   // channel has no username — public page doesn't exist
  | 'not_found'         // 404 from t.me — wrong username or message deleted
  | 'no_views_in_html'  // page loaded but views span missing (edited/restricted?)
  | 'fetch_failed';     // network/timeout/non-2xx response

export interface PublicViewsResult {
  views: number | null;
  errorCode: PublicViewsErrorCode | null;
  errorMessage: string | null;
}

const TME_BASE = 'https://t.me';
const USER_AGENT =
  'Mozilla/5.0 (compatible; PostplanBot/1.0; +https://postplan-tg.ru)';

/**
 * Parse Telegram-formatted view counts: "150", "1.2K", "1.5M", "2.3B".
 * Returns an integer count, or null if the format is unexpected.
 */
export function parseViewsString(raw: string): number | null {
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

/**
 * Extract the views number from the t.me embed HTML.
 * The relevant fragment looks like:
 *   <span class="tgme_widget_message_views">1.2K</span>
 * Sometimes with extra attributes — regex is tolerant of those.
 */
export function extractViewsFromHtml(html: string): number | null {
  const match = html.match(
    /<span[^>]*class="[^"]*tgme_widget_message_views[^"]*"[^>]*>([^<]+)<\/span>/i,
  );
  if (!match) return null;
  return parseViewsString(match[1]);
}

export async function fetchPublicPostViews(
  channelUsername: string | null | undefined,
  messageId: number,
): Promise<PublicViewsResult> {
  if (!channelUsername) {
    return {
      views: null,
      errorCode: 'private_channel',
      errorMessage: 'Аналитика просмотров доступна только для публичных каналов',
    };
  }

  // Strip leading @ if present
  const username = channelUsername.replace(/^@/, '');
  const url = `${TME_BASE}/${username}/${messageId}?embed=1&mode=tme`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      // Telegram is usually quick; cap the wait to avoid hanging the worker
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return {
      views: null,
      errorCode: 'fetch_failed',
      errorMessage: e instanceof Error ? e.message : 'Не удалось получить страницу поста',
    };
  }

  if (res.status === 404) {
    return {
      views: null,
      errorCode: 'not_found',
      errorMessage: 'Пост не найден на t.me (возможно удалён или канал переименован)',
    };
  }
  if (!res.ok) {
    return {
      views: null,
      errorCode: 'fetch_failed',
      errorMessage: `t.me ответил статусом ${res.status}`,
    };
  }

  const html = await res.text();
  const views = extractViewsFromHtml(html);
  if (views === null) {
    return {
      views: null,
      errorCode: 'no_views_in_html',
      errorMessage: 'Просмотры не найдены на странице поста',
    };
  }

  return { views, errorCode: null, errorMessage: null };
}
