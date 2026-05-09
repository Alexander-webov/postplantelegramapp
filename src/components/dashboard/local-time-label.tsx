'use client';

import { useEffect, useState } from 'react';

const RU_MONTHS_SHORT = [
  'янв', 'февр', 'мар', 'апр', 'мая', 'июня',
  'июля', 'авг', 'сент', 'окт', 'нояб', 'дек',
];

/**
 * Renders a UTC ISO timestamp as a "30 апр., 22:00" label
 * in the user's browser timezone. Server-side rendering shows
 * a placeholder until the client mounts (avoids hydration mismatch
 * caused by the server having a different timezone).
 *
 * Forces 24-hour format by ASSEMBLING THE STRING MANUALLY rather
 * than trusting `hourCycle`, which some browsers/locales ignore.
 * We use Intl just to get the date parts (with hour12: false), then
 * compose the string ourselves with a guaranteed `HH:MM` shape.
 */
export function LocalTimeLabel({ utcIso }: { utcIso: string }) {
  const [label, setLabel] = useState<string>('—');

  useEffect(() => {
    const d = new Date(utcIso);
    if (Number.isNaN(d.getTime())) {
      setLabel('—');
      return;
    }

    // Use formatToParts so we get the parts in the BROWSER's timezone but
    // we control the final assembly. hour12: false belt + hourCycle suspenders.
    const parts = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(d);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = get('day').padStart(2, '0');
    const monthIdx = parseInt(get('month'), 10) - 1;
    const monthName = RU_MONTHS_SHORT[monthIdx] ?? '';
    let hour = get('hour').padStart(2, '0');
    // Final safety: some Chromium builds emit "12 PM" via formatToParts even
    // with hour12:false. Strip any letters and clamp 24 → 00.
    hour = hour.replace(/\D/g, '');
    if (hour === '24') hour = '00';
    if (hour.length === 1) hour = '0' + hour;
    if (hour === '') hour = '00';
    const minute = get('minute').padStart(2, '0').replace(/\D/g, '').slice(0, 2) || '00';

    setLabel(`${parseInt(day, 10)} ${monthName}, ${hour}:${minute}`);
  }, [utcIso]);

  return (
    <time dateTime={utcIso} suppressHydrationWarning>
      {label}
    </time>
  );
}
