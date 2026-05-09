/**
 * Template variable substitution.
 *
 * Variables supported in template content:
 *   {{date}}          - "1 мая 2026"
 *   {{date_short}}    - "01.05"
 *   {{time}}          - "14:30"
 *   {{day_of_week}}   - "понедельник"
 *   {{channel_title}} - the destination channel's title
 *   {{channel_username}} - the @username (or "" if private)
 *
 * Substitution happens at SEND time (not at save time) so a post scheduled for
 * "tomorrow at 9:00 with {{date}}" actually shows tomorrow's date when posted.
 *
 * The same logic runs both in the Next server action (for Send-Now) and in the
 * Deno Edge Function (for scheduled sends). Keep the two implementations in sync.
 */

export interface SubstitutionContext {
  /** When the post is being sent (defaults to now) */
  sendAt?: Date;
  /** IANA timezone for date/time formatting (defaults to Europe/Moscow) */
  timezone?: string;
  channelTitle?: string;
  channelUsername?: string | null;
}

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const RU_WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
];

function formatInTz(d: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, ...opts }).format(d);
}

function getTzParts(d: Date, tz: string): { year: string; month: string; day: string; hour: string; minute: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  // Map weekday short label to index (en-CA emits "Mon", "Tue", ...)
  const wdShort = (parts.find((p) => p.type === 'weekday')?.value ?? 'Sun').slice(0, 3);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    weekday: map[wdShort] ?? 0,
  };
}

export function applyTemplateVariables(
  content: string,
  ctx: SubstitutionContext = {}
): string {
  const sendAt = ctx.sendAt ?? new Date();
  const tz = ctx.timezone ?? 'Europe/Moscow';
  const channelTitle = ctx.channelTitle ?? '';
  const channelUsername = ctx.channelUsername ?? '';

  const parts = getTzParts(sendAt, tz);
  const dayInt = parseInt(parts.day, 10);
  const monthInt = parseInt(parts.month, 10);

  const dateLong = `${dayInt} ${RU_MONTHS[monthInt - 1]} ${parts.year}`;
  const dateShort = `${parts.day}.${parts.month}`;
  const time = `${parts.hour}:${parts.minute}`;
  const dayOfWeek = RU_WEEKDAYS[parts.weekday];

  return content
    .replace(/\{\{\s*date\s*\}\}/g, dateLong)
    .replace(/\{\{\s*date_short\s*\}\}/g, dateShort)
    .replace(/\{\{\s*time\s*\}\}/g, time)
    .replace(/\{\{\s*day_of_week\s*\}\}/g, dayOfWeek)
    .replace(/\{\{\s*channel_title\s*\}\}/g, channelTitle)
    .replace(/\{\{\s*channel_username\s*\}\}/g, () => {
      // For HTML parse_mode (Postplan default) we render @username as a clickable link.
      // For private channels with no username, returns empty string.
      if (!channelUsername) return '';
      const clean = channelUsername.replace(/^@/, '');
      return `<a href="https://t.me/${clean}">@${clean}</a>`;
    });
}

/**
 * Apply a signature (footer) to post content. Signature can also use {{variables}}.
 * Joins with a blank line if both parts are non-empty.
 */
export function applySignature(
  content: string,
  signatureRaw: string | null | undefined,
  ctx: SubstitutionContext = {}
): string {
  if (!signatureRaw) return content;
  const sig = applyTemplateVariables(signatureRaw, ctx);
  if (!sig.trim()) return content;
  if (!content.trim()) return sig;
  return `${content}\n\n${sig}`;
}

/**
 * Append a hashtags string to content. Hashtags are joined by spaces.
 */
export function applyHashtags(content: string, hashtagsRaw: string): string {
  const tags = hashtagsRaw.trim();
  if (!tags) return content;
  if (!content.trim()) return tags;
  return `${content}\n\n${tags}`;
}

/**
 * The known variables, for the UI hint in the templates editor.
 */
export const TEMPLATE_VARIABLES = [
  { key: '{{date}}', description: 'дата отправки, "1 мая 2026"' },
  { key: '{{date_short}}', description: 'дата кратко, "01.05"' },
  { key: '{{time}}', description: 'время отправки, "14:30"' },
  { key: '{{day_of_week}}', description: 'день недели, "понедельник"' },
  { key: '{{channel_title}}', description: 'название канала' },
  { key: '{{channel_username}}', description: 'кликабельная ссылка @username канала' },
] as const;
