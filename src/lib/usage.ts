import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getTierLimits, isUnlimited, type SubscriptionTier } from '@/lib/tiers';

export interface UsageSnapshot {
  channels: number;
  postsThisMonth: number;
  templates: number;
}

/**
 * Compute the user's current usage across all metered resources.
 * Used both by the billing page (for display) and by server actions
 * (for limit enforcement before creating new resources).
 */
export async function getUsage(userId: string): Promise<UsageSnapshot> {
  const supabase = await createClient();

  // Channels — count all (active + inactive both occupy a slot)
  const { count: channelsCount } = await supabase
    .from('channels')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Posts this calendar month — count scheduled_posts created this month with
  // status that "consumes the quota": pending, processing, sent, failed.
  // Cancelled posts don't consume quota (the user pulled them).
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: postsCount } = await supabase
    .from('scheduled_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())
    .in('status', ['pending', 'processing', 'sent', 'failed']);

  // Templates — count all kinds together
  const { count: templatesCount } = await supabase
    .from('templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return {
    channels: channelsCount ?? 0,
    postsThisMonth: postsCount ?? 0,
    templates: templatesCount ?? 0,
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  /** User-facing reason — null if allowed */
  reason: string | null;
  /** Current usage of the limit being checked */
  current: number;
  /** The tier's cap on this resource */
  limit: number;
}

/** Check whether the user can connect one more channel. */
export async function checkChannelLimit(
  userId: string,
  tier: SubscriptionTier
): Promise<LimitCheckResult> {
  const limits = getTierLimits(tier);
  const usage = await getUsage(userId);

  if (isUnlimited(limits.maxChannels)) {
    return { allowed: true, reason: null, current: usage.channels, limit: limits.maxChannels };
  }
  if (usage.channels >= limits.maxChannels) {
    return {
      allowed: false,
      reason: `Лимит каналов на тарифе исчерпан (${usage.channels}/${limits.maxChannels}). Перейди на тариф выше или удали ненужный канал.`,
      current: usage.channels,
      limit: limits.maxChannels,
    };
  }
  return { allowed: true, reason: null, current: usage.channels, limit: limits.maxChannels };
}

/** Check whether the user can create N more posts (where N is # of channels in a crosspost). */
export async function checkPostQuota(
  userId: string,
  tier: SubscriptionTier,
  count: number = 1
): Promise<LimitCheckResult> {
  const limits = getTierLimits(tier);
  const usage = await getUsage(userId);

  if (isUnlimited(limits.maxPostsPerMonth)) {
    return { allowed: true, reason: null, current: usage.postsThisMonth, limit: limits.maxPostsPerMonth };
  }
  if (usage.postsThisMonth + count > limits.maxPostsPerMonth) {
    const remaining = Math.max(0, limits.maxPostsPerMonth - usage.postsThisMonth);
    return {
      allowed: false,
      reason: count > 1
        ? `Этот пост идёт в ${count} каналов, но осталось только ${remaining} из ${limits.maxPostsPerMonth} постов в месяц на тарифе. Уменьши число каналов или перейди на тариф выше.`
        : `Лимит постов на этот месяц исчерпан (${usage.postsThisMonth}/${limits.maxPostsPerMonth}). Лимит сбросится 1-го числа следующего месяца, или перейди на тариф выше.`,
      current: usage.postsThisMonth,
      limit: limits.maxPostsPerMonth,
    };
  }
  return { allowed: true, reason: null, current: usage.postsThisMonth, limit: limits.maxPostsPerMonth };
}

/** Check whether the user can create one more template. */
export async function checkTemplateLimit(
  userId: string,
  tier: SubscriptionTier
): Promise<LimitCheckResult> {
  const limits = getTierLimits(tier);
  const usage = await getUsage(userId);

  if (limits.maxTemplates === 0) {
    return {
      allowed: false,
      reason: 'Шаблоны доступны на платных тарифах. Перейди на «Базовый» (299₽) или «Профи» (690₽).',
      current: 0,
      limit: 0,
    };
  }
  if (isUnlimited(limits.maxTemplates)) {
    return { allowed: true, reason: null, current: usage.templates, limit: limits.maxTemplates };
  }
  if (usage.templates >= limits.maxTemplates) {
    return {
      allowed: false,
      reason: `Лимит шаблонов исчерпан (${usage.templates}/${limits.maxTemplates}).`,
      current: usage.templates,
      limit: limits.maxTemplates,
    };
  }
  return { allowed: true, reason: null, current: usage.templates, limit: limits.maxTemplates };
}

/** Check whether the user can crosspost to N channels (N >= 2). */
export function checkCrosspostLimit(
  channelCount: number,
  tier: SubscriptionTier
): LimitCheckResult {
  const limits = getTierLimits(tier);
  if (channelCount <= 1) {
    return { allowed: true, reason: null, current: channelCount, limit: limits.maxCrosspostChannels };
  }
  if (limits.maxCrosspostChannels <= 1) {
    return {
      allowed: false,
      reason: 'Кросспостинг (один пост в несколько каналов) доступен на платных тарифах. Перейди на «Базовый» (299₽) — до 3 каналов, или «Профи» (690₽) — до 50.',
      current: channelCount,
      limit: limits.maxCrosspostChannels,
    };
  }
  if (channelCount > limits.maxCrosspostChannels) {
    return {
      allowed: false,
      reason: `На твоём тарифе можно кросспостить максимум в ${limits.maxCrosspostChannels} канал(ов). Выбрано: ${channelCount}.`,
      current: channelCount,
      limit: limits.maxCrosspostChannels,
    };
  }
  return { allowed: true, reason: null, current: channelCount, limit: limits.maxCrosspostChannels };
}

/**
 * Check whether the user's subscription has expired and they need to be downgraded to free.
 * Called lazily — on /dashboard load. We don't run a separate cron for this.
 */
export function isSubscriptionExpired(profile: {
  subscription_tier: SubscriptionTier | null;
  subscription_expires_at: string | null;
}): boolean {
  if (profile.subscription_tier === 'free' || !profile.subscription_tier) return false;
  if (!profile.subscription_expires_at) return false;
  return new Date(profile.subscription_expires_at).getTime() < Date.now();
}

/**
 * Resolve the EFFECTIVE tier for a profile — accounts for expired paid subscriptions.
 * Use this everywhere instead of reading subscription_tier directly.
 */
export function getEffectiveTier(profile: {
  subscription_tier: SubscriptionTier | null;
  subscription_expires_at: string | null;
}): SubscriptionTier {
  if (isSubscriptionExpired(profile)) return 'free';
  return (profile.subscription_tier ?? 'free') as SubscriptionTier;
}
