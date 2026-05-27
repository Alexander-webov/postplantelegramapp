// Lightweight client-side helper for firing Yandex.Metrika goals (reachGoal).
//
// Goals are configured in the Metrika dashboard (Настройки → Цели) with the
// matching identifiers. Firing a goal that isn't configured yet is harmless —
// it's simply ignored until you create it. Calling this on the server or before
// the counter has loaded is a safe no-op.
//
// Keep goal identifiers in one place so they can't drift between call sites.

const YM_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? 109409470);

export type MetrikaGoal =
  | 'signup_click'       // clicked a "try free / sign up" CTA
  | 'signup_success'     // completed registration
  | 'channel_connected'  // connected a Telegram channel
  | 'report_created'     // created a public report link (/r/...)
  | 'checkout_start';    // started a paid-plan checkout

export function trackGoal(goal: MetrikaGoal, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const ym = (window as unknown as { ym?: (...a: unknown[]) => void }).ym;
  if (typeof ym !== 'function') return;
  try {
    ym(YM_ID, 'reachGoal', goal, params);
  } catch {
    // Never let analytics break a user flow.
  }
}
