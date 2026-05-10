/**
 * Subscription tier definitions and limits.
 *
 * Final pricing model (locked in after user decision):
 *  - Free:    0₽    | 1 channel  | 10 posts/mo | no crosspost | no templates
 *  - Базовый: 299₽  | 5 channels | ∞ posts     | crosspost ≤3 | ∞ templates
 *  - Профи:   690₽  | 50 channels| ∞ posts     | crosspost ≤50| ∞ templates
 *
 * No trial and no launch discount — new users land on Free immediately.
 * Upgrade is opt-in via /dashboard/billing.
 */

export type SubscriptionTier = 'free' | 'start' | 'pro';

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
    promoPriceRub: null,
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
    promoPriceRub: null,
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
 * Decide the price to charge a user right now.
 * Promo is disabled: YooKassa must always charge the regular monthly price.
 */
export function getEffectivePrice(
  tier: SubscriptionTier,
  _userCreatedAt?: string | Date | null
): { priceRub: number; isPromo: boolean; promoEndsAt: Date | null } {
  const t = TIERS[tier];
  return { priceRub: t?.priceRub ?? 0, isPromo: false, promoEndsAt: null };
}

