/**
 * Timezone helpers for the post scheduler.
 *
 * Strategy:
 *  - The DB always stores `scheduled_at` as a UTC timestamp.
 *  - The UI lets the user pick a wall-clock time (YYYY-MM-DDTHH:mm) AND a target timezone.
 *  - We convert (wall-clock, tz) -> UTC ISO before sending to the server.
 *  - We convert UTC -> (wall-clock, tz) when displaying.
 */

export interface TimezoneOption {
  /** IANA name like "Europe/Moscow" */
  id: string;
  /** Human label shown in the dropdown */
  label: string;
}

/** Common timezones for the Russian-speaking + NYC audience. */
export const TIMEZONES: TimezoneOption[] = [
  { id: 'Europe/Moscow', label: 'Москва (MSK, UTC+3)' },
  { id: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { id: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { id: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { id: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { id: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { id: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { id: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { id: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { id: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { id: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  { id: 'Europe/Kyiv', label: 'Киев (UTC+2/+3)' },
  { id: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { id: 'Asia/Almaty', label: 'Алматы (UTC+5)' },
  { id: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
  { id: 'Asia/Tbilisi', label: 'Тбилиси (UTC+4)' },
  { id: 'Asia/Yerevan', label: 'Ереван (UTC+4)' },
  { id: 'Asia/Baku', label: 'Баку (UTC+4)' },
  { id: 'America/New_York', label: 'Нью-Йорк (ET, UTC-5/-4)' },
  { id: 'America/Los_Angeles', label: 'Лос-Анджелес (PT, UTC-8/-7)' },
  { id: 'America/Chicago', label: 'Чикаго (CT, UTC-6/-5)' },
  { id: 'Europe/London', label: 'Лондон (UTC+0/+1)' },
  { id: 'Europe/Berlin', label: 'Берлин (UTC+1/+2)' },
  { id: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
  { id: 'Asia/Bangkok', label: 'Бангкок (UTC+7)' },
];

/**
 * Detect the browser's IANA timezone, falling back to Europe/Moscow.
 * Use only on the client (typeof Intl is fine on server too, but the
 * resolved value will be the server's timezone).
 */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

/**
 * Format a Date in a specific IANA timezone as `YYYY-MM-DDTHH:mm`,
 * the format expected by `<input type="datetime-local">`. Always 24h.
 */
export function formatForDatetimeLocal(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Convert a wall-clock string like "2026-05-15T22:00" interpreted in `tz`
 * to a UTC ISO string like "2026-05-15T19:00:00.000Z".
 *
 * This is the inverse of formatForDatetimeLocal. We figure out the offset of `tz`
 * at the proposed instant by formatting the string twice (once as if it were UTC,
 * once as it actually displays in the target tz) and computing the delta.
 */
export function wallTimeToUTC(wall: string, tz: string): string {
  // Treat the wall string as if it were UTC -> get a "naive UTC" instant
  const naiveUtc = new Date(`${wall}:00.000Z`);
  if (Number.isNaN(naiveUtc.getTime())) {
    throw new Error(`Invalid datetime: ${wall}`);
  }

  // Format the naive instant in the target timezone, get back another wall string.
  // The difference between the two represents the timezone's offset at that moment.
  const reformatted = formatForDatetimeLocal(naiveUtc, tz);
  const reformattedUtc = new Date(`${reformatted}:00.000Z`);

  // Offset the timezone applies (positive for tz ahead of UTC, negative behind).
  const offsetMs = reformattedUtc.getTime() - naiveUtc.getTime();

  // True UTC instant: the wall time in tz IS reformattedUtc, so true UTC is naive - offset.
  return new Date(naiveUtc.getTime() - offsetMs).toISOString();
}

/**
 * Convert a UTC ISO string to a friendly localized label like
 * "30 апр., 22:00" in the given timezone, for display in the queue.
 * Always 24-hour format.
 */
export function utcToFriendlyLabel(utcIso: string, tz: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(utcIso));
}

/**
 * Compute the "preview" string shown under the datetime picker:
 * "Опубликуется 30 апреля в 22:00 МСК (= 15:00 в твоей таймзоне America/New_York)".
 */
export function formatScheduledPreview(
  wall: string,
  selectedTz: string,
  browserTz: string
): string {
  if (!wall) return '';
  let utc: string;
  try {
    utc = wallTimeToUTC(wall, selectedTz);
  } catch {
    return '';
  }

  const inSelected = utcToFriendlyLabel(utc, selectedTz);
  if (selectedTz === browserTz) {
    return `Опубликуется ${inSelected}`;
  }
  const inBrowser = utcToFriendlyLabel(utc, browserTz);
  const browserShort = browserTz.split('/').pop() ?? browserTz;
  return `Опубликуется ${inSelected} (= ${inBrowser} в твоей таймзоне ${browserShort})`;
}
