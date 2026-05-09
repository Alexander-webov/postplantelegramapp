/**
 * Subscription tier definitions and limits.
 *
 * Final pricing model (locked in after user decision):
 *  - Free:    0₽    | 1 channel  | 10 posts/mo | no crosspost | no templates
 *  - Базовый: 299₽  | 5 channels | ∞ posts     | crosspost ≤3 | ∞ templates
 *  - Профи:   690₽  | 50 channels| ∞ posts     | crosspost ≤50| ∞ templates
 *
 * Launch promo: 50% off paid plans for the first 3 months for all new signups.
 *  - Базовый: 149₽ first 3 months, then 299₽
 *  - Профи:   345₽ first 3 months, then 690₽
 *
 * No trial — new users land on Free immediately. Upgrade is opt-in via /dashboard/billing.
 */

export type SubscriptionTier = 'free' | 'start' | 'pro';

/** Months that the launch promo applies for, after which full price kicks in */
export const PROMO_DURATION_MONTHS = 3;

/** When the promo officially ends (informational — the per-user counter is what enforces it) */
export const PROMO_ENDS_NEW_SIGNUPS_AT: string | null = null; // null = ongoing

export interface TierLimits {
  maxChannels: number;
  maxPostsPerMonth: number;
  /** 1 = no crosspost (only single-channel send), N = up to N channels at once */
  maxCrosspostChannels: number;
  /** 0 = no templates, ∞ = unlimited */
  maxTemplates: number;
}

const INFINITY = Number.POSITIVE_INFINITY;

export const TIERS: Record<SubscriptionTier, {
  name: string;
  /** Regular monthly price in rubles */
  priceRub: number;
  /** Promo price for first 3 months — null for tiers without promo */
  promoPriceRub: number | null;
  limits: TierLimits;
}> = {
  free: {
    name: 'Free',
    priceRub: 0,
    promoPriceRub: null,
    limits: {
      maxChannels: 1,
      maxPostsPerMonth: 10,
      maxCrosspostChannels: 1,
      maxTemplates: 0,
    },
  },
  start: {
    name: 'Базовый',
    priceRub: 299,
    promoPriceRub: 149,
    limits: {
      maxChannels: 5,
      maxPostsPerMonth: INFINITY,
      maxCrosspostChannels: 3,
      maxTemplates: INFINITY,
    },
  },
  pro: {
    name: 'Профи',
    priceRub: 690,
    promoPriceRub: 345,
    limits: {
      maxChannels: 50,
      maxPostsPerMonth: INFINITY,
      maxCrosspostChannels: 50,
      maxTemplates: INFINITY,
    },
  },
};

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIERS[tier]?.limits ?? TIERS.free.limits;
}

export function isUnlimited(value: number): boolean {
  return value === INFINITY || !Number.isFinite(value);
}

export function formatLimit(value: number): string {
  return isUnlimited(value) ? '∞' : String(value);
}

/**
 * Check whether the given tier still permits a feature.
 * Used in server actions for early bail-out before doing work.
 */
export function tierAllowsCrosspost(tier: SubscriptionTier): boolean {
  return getTierLimits(tier).maxCrosspostChannels > 1;
}

export function tierAllowsTemplates(tier: SubscriptionTier): boolean {
  return getTierLimits(tier).maxTemplates > 0;
}

/**
 * Decide the price to charge a user right now. If they're within their first
 * 3 months since signup AND the tier has a promo price — return the promo
 * price. Otherwise the regular price.
 *
 * Pass `userCreatedAt` from the user's profile.created_at — Supabase auth
 * already gives this.
 */
export function getEffectivePrice(
  tier: SubscriptionTier,
  userCreatedAt: string | Date | null | undefined
): { priceRub: number; isPromo: boolean; promoEndsAt: Date | null } {
  const t = TIERS[tier];
  if (!t || !t.promoPriceRub) {
    return { priceRub: t?.priceRub ?? 0, isPromo: false, promoEndsAt: null };
  }
  if (!userCreatedAt) {
    // No signup date known — be safe and apply promo (better than charging full)
    return { priceRub: t.promoPriceRub, isPromo: true, promoEndsAt: null };
  }

  const created = userCreatedAt instanceof Date ? userCreatedAt : new Date(userCreatedAt);
  const promoEndsAt = new Date(created);
  promoEndsAt.setMonth(promoEndsAt.getMonth() + PROMO_DURATION_MONTHS);

  if (Date.now() < promoEndsAt.getTime()) {
    return { priceRub: t.promoPriceRub, isPromo: true, promoEndsAt };
  }
  return { priceRub: t.priceRub, isPromo: false, promoEndsAt: null };
}
