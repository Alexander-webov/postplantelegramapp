'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { getEffectiveTier, checkCrosspromoLimit } from '@/lib/usage';
import {
  upsertCpListingSchema,
  proposeCpDealSchema,
  acceptCpDealSchema,
  cpDealIdSchema,
} from '@/lib/validations/schemas';

export type CpActionResult = { error?: string; success?: boolean; id?: string };

// ===========================================================================
// Reach estimation
// ===========================================================================
/**
 * Estimate a channel's average reach from its recent published posts.
 * Uses the best available view snapshot (prefer 48h, fall back to 24h/6h/1h).
 * Falls back to subscriber_count * 0.3 if there's no analytics history yet —
 * a conservative placeholder so brand-new channels can still be matched.
 */
async function estimateAvgReach(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelId: string,
  subscriberCount: number
): Promise<number> {
  const { data } = await supabase
    .from('scheduled_posts')
    .select('post_analytics(views_1h, views_6h, views_24h, views_48h)')
    .eq('channel_id', channelId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(10);

  const reaches: number[] = [];
  for (const row of data ?? []) {
    const analytics = (row as { post_analytics: unknown }).post_analytics;
    const snaps = Array.isArray(analytics) ? analytics : analytics ? [analytics] : [];
    for (const s of snaps as Array<Record<string, number | null>>) {
      const v = s.views_48h ?? s.views_24h ?? s.views_6h ?? s.views_1h;
      if (typeof v === 'number' && v > 0) reaches.push(v);
    }
  }

  if (reaches.length > 0) {
    return Math.round(reaches.reduce((a, b) => a + b, 0) / reaches.length);
  }
  // No analytics yet → conservative estimate from subscribers
  return Math.round(subscriberCount * 0.3);
}

// ===========================================================================
// Listings — put a channel into / update it in the crosspromo exchange
// ===========================================================================
export async function upsertCpListingAction(formData: FormData): Promise<CpActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const parsed = upsertCpListingSchema.safeParse({
    channel_id: formData.get('channel_id'),
    topic: formData.get('topic'),
    weekly_slots: formData.get('weekly_slots'),
    min_partner_reach_pct: formData.get('min_partner_reach_pct'),
    description: formData.get('description'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  // Verify the channel belongs to the user (RLS also enforces, but give a clean error)
  const { data: channel, error: chErr } = await supabase
    .from('channels')
    .select('id, subscriber_count, is_active')
    .eq('id', parsed.data.channel_id)
    .eq('user_id', user.id)
    .single();
  if (chErr || !channel) return { error: 'Канал не найден' };
  if (!channel.is_active) return { error: 'Канал неактивен — включите его прежде чем выставлять в биржу' };

  const avgReach = await estimateAvgReach(supabase, channel.id, channel.subscriber_count ?? 0);

  const { data, error } = await supabase
    .from('cp_listings')
    .upsert(
      {
        channel_id: parsed.data.channel_id,
        user_id: user.id,
        topic: parsed.data.topic,
        weekly_slots: parsed.data.weekly_slots,
        min_partner_reach_pct: parsed.data.min_partner_reach_pct,
        description: parsed.data.description || null,
        avg_reach: avgReach,
        subscriber_count: channel.subscriber_count ?? 0,
        status: 'active',
        last_refreshed_at: new Date().toISOString(),
      },
      { onConflict: 'channel_id' }
    )
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/dashboard/crosspromo');
  return { success: true, id: data.id };
}

export async function toggleCpListingAction(formData: FormData): Promise<CpActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const listingId = String(formData.get('listing_id') ?? '');
  if (!listingId) return { error: 'Не указан листинг' };

  const { data: listing, error } = await supabase
    .from('cp_listings')
    .select('id, status')
    .eq('id', listingId)
    .eq('user_id', user.id)
    .single();
  if (error || !listing) return { error: 'Листинг не найден' };

  const next = listing.status === 'active' ? 'paused' : 'active';
  const { error: updErr } = await supabase
    .from('cp_listings')
    .update({ status: next })
    .eq('id', listingId)
    .eq('user_id', user.id);
  if (updErr) return { error: updErr.message };

  revalidatePath('/dashboard/crosspromo');
  return { success: true };
}

// ===========================================================================
// Matching — find candidate partners for one of my listings
// ===========================================================================
export interface CpMatch {
  listing_id: string;
  channel_id: string;
  channel_title: string;
  channel_username: string | null;
  topic: string;
  avg_reach: number;
  subscriber_count: number;
  description: string | null;
  is_verified: boolean;
  deals_completed: number;
  deals_failed: number;
}

export async function findCpMatches(myListingId: string): Promise<{ error?: string; matches?: CpMatch[] }> {
  const user = await requireUser();
  const supabase = await createClient();

  // Load my listing (RLS ensures ownership)
  const { data: mine, error: mineErr } = await supabase
    .from('cp_listings')
    .select('id, user_id, topic, avg_reach, min_partner_reach_pct')
    .eq('id', myListingId)
    .eq('user_id', user.id)
    .single();
  if (mineErr || !mine) return { error: 'Листинг не найден' };

  const reachFloor = Math.round((mine.avg_reach * mine.min_partner_reach_pct) / 100);
  const reachCeil = Math.max(mine.avg_reach * 2, 100); // don't promote channels 2x+ bigger than us

  const { data: candidates, error: candErr } = await supabase
    .from('cp_listings')
    .select(
      'id, channel_id, topic, avg_reach, subscriber_count, description, ' +
        'channels(title, username), cp_reputation(is_verified, deals_completed, deals_failed)'
    )
    .eq('status', 'active')
    .eq('topic', mine.topic)
    .neq('user_id', user.id)
    .gte('avg_reach', reachFloor)
    .lte('avg_reach', reachCeil)
    .limit(30);

  if (candErr) return { error: candErr.message };

  const single = <T,>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? v[0] ?? null : v;

  type CandidateRow = {
    id: string;
    channel_id: string;
    topic: string;
    avg_reach: number;
    subscriber_count: number;
    description: string | null;
    channels: { title?: string; username?: string | null } | { title?: string; username?: string | null }[] | null;
    cp_reputation:
      | { is_verified?: boolean; deals_completed?: number; deals_failed?: number }
      | { is_verified?: boolean; deals_completed?: number; deals_failed?: number }[]
      | null;
  };

  const matches: CpMatch[] = ((candidates ?? []) as unknown as CandidateRow[]).map((c) => {
    const ch = single(c.channels);
    const rep = single(c.cp_reputation);
    return {
      listing_id: c.id,
      channel_id: c.channel_id,
      channel_title: ch?.title ?? '(без названия)',
      channel_username: ch?.username ?? null,
      topic: c.topic,
      avg_reach: c.avg_reach,
      subscriber_count: c.subscriber_count,
      description: c.description,
      is_verified: rep?.is_verified ?? false,
      deals_completed: rep?.deals_completed ?? 0,
      deals_failed: rep?.deals_failed ?? 0,
    };
  });

  // Rank: verified first, then closeness of reach to ours
  matches.sort((a, b) => {
    if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
    const da = Math.abs(a.avg_reach - mine.avg_reach);
    const db = Math.abs(b.avg_reach - mine.avg_reach);
    return da - db;
  });

  return { matches };
}

// ===========================================================================
// Deals — propose
// ===========================================================================
export async function proposeCpDealAction(formData: FormData): Promise<CpActionResult> {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();

  const parsed = proposeCpDealSchema.safeParse({
    my_listing_id: formData.get('my_listing_id'),
    partner_listing_id: formData.get('partner_listing_id'),
    publish_at: formData.get('publish_at'),
    min_hold_hours: formData.get('min_hold_hours'),
    promo_text_for_partner: formData.get('promo_text_for_partner'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  // Tier limit — взаимопиар is the paid lever
  const tier = getEffectiveTier(profile);
  const limit = await checkCrosspromoLimit(user.id, tier);
  if (!limit.allowed) return { error: limit.reason ?? 'Лимит взаимопиара исчерпан' };

  // publish_at must be in the future
  const publishAt = new Date(parsed.data.publish_at);
  if (Number.isNaN(publishAt.getTime()) || publishAt.getTime() < Date.now() + 60_000) {
    return { error: 'Дата публикации должна быть в будущем (минимум через минуту)' };
  }

  // Load my listing (ownership) and partner listing (must be active)
  const { data: mine, error: mineErr } = await supabase
    .from('cp_listings')
    .select('id, channel_id, user_id')
    .eq('id', parsed.data.my_listing_id)
    .eq('user_id', user.id)
    .single();
  if (mineErr || !mine) return { error: 'Ваш листинг не найден' };

  const { data: partner, error: partnerErr } = await supabase
    .from('cp_listings')
    .select('id, channel_id, user_id, status')
    .eq('id', parsed.data.partner_listing_id)
    .single();
  if (partnerErr || !partner) return { error: 'Партнёрский листинг не найден' };
  if (partner.status !== 'active') return { error: 'Этот канал сейчас не принимает взаимопиар' };
  if (partner.user_id === user.id) return { error: 'Нельзя предложить взаимопиар самому себе' };

  // Guard: no duplicate pending deal between the same two channels
  const { data: existing } = await supabase
    .from('cp_deals')
    .select('id')
    .in('status', ['proposed', 'accepted', 'scheduled', 'live'])
    .or(
      `and(initiator_channel_id.eq.${mine.channel_id},partner_channel_id.eq.${partner.channel_id}),` +
        `and(initiator_channel_id.eq.${partner.channel_id},partner_channel_id.eq.${mine.channel_id})`
    )
    .maybeSingle();
  if (existing) return { error: 'Между этими каналами уже есть активная сделка' };

  const { data, error } = await supabase
    .from('cp_deals')
    .insert({
      status: 'proposed',
      initiator_listing_id: mine.id,
      initiator_channel_id: mine.channel_id,
      initiator_user_id: user.id,
      partner_listing_id: partner.id,
      partner_channel_id: partner.channel_id,
      partner_user_id: partner.user_id,
      publish_at: publishAt.toISOString(),
      min_hold_hours: parsed.data.min_hold_hours,
      promo_text_for_partner: parsed.data.promo_text_for_partner,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/dashboard/crosspromo');
  revalidatePath('/dashboard/crosspromo/deals');
  return { success: true, id: data.id };
}

// ===========================================================================
// Deals — accept (partner side). Creates the TWO scheduled_posts.
// ===========================================================================
export async function acceptCpDealAction(formData: FormData): Promise<CpActionResult> {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();

  const parsed = acceptCpDealSchema.safeParse({
    deal_id: formData.get('deal_id'),
    promo_text_for_initiator: formData.get('promo_text_for_initiator'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  // Load deal — must be the partner and status proposed
  const { data: deal, error: dealErr } = await supabase
    .from('cp_deals')
    .select('*')
    .eq('id', parsed.data.deal_id)
    .single();
  if (dealErr || !deal) return { error: 'Сделка не найдена' };
  if (deal.partner_user_id !== user.id) return { error: 'Только партнёр может принять сделку' };
  if (deal.status !== 'proposed') return { error: 'Эту сделку уже нельзя принять' };

  // Partner's tier limit applies on accept too
  const tier = getEffectiveTier(profile);
  const limit = await checkCrosspromoLimit(user.id, tier);
  if (!limit.allowed) return { error: limit.reason ?? 'Лимит взаимопиара исчерпан' };

  const publishAt = deal.publish_at as string;
  if (!publishAt || new Date(publishAt).getTime() < Date.now() + 60_000) {
    return { error: 'Дата публикации уже прошла — попросите партнёра пересоздать сделку' };
  }

  // --- Create the two posts + scheduled_posts rows ---
  // initiator publishes promo_text_for_partner in THEIR channel (promotes partner)
  // partner publishes promo_text_for_initiator in THEIR channel (promotes initiator)
  const initiatorPostText = deal.promo_text_for_partner as string;
  const partnerPostText = parsed.data.promo_text_for_initiator;

  // 1. Initiator's post object
  const { data: initiatorPost, error: ipErr } = await supabase
    .from('posts')
    .insert({
      user_id: deal.initiator_user_id,
      title: 'Взаимопиар',
      content: initiatorPostText,
      parse_mode: 'HTML',
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (ipErr || !initiatorPost) return { error: `Не удалось создать пост инициатора: ${ipErr?.message}` };

  // 2. Partner's post object
  const { data: partnerPost, error: ppErr } = await supabase
    .from('posts')
    .insert({
      user_id: deal.partner_user_id,
      title: 'Взаимопиар',
      content: partnerPostText,
      parse_mode: 'HTML',
      status: 'scheduled',
    })
    .select('id')
    .single();
  if (ppErr || !partnerPost) return { error: `Не удалось создать пост партнёра: ${ppErr?.message}` };

  // 3. scheduled_posts for the initiator (in initiator's channel)
  const { data: initiatorSched, error: isErr } = await supabase
    .from('scheduled_posts')
    .insert({
      user_id: deal.initiator_user_id,
      post_id: initiatorPost.id,
      channel_id: deal.initiator_channel_id,
      scheduled_at: publishAt,
      status: 'pending',
    })
    .select('id')
    .single();
  if (isErr || !initiatorSched) return { error: `Не удалось запланировать пост инициатора: ${isErr?.message}` };

  // 4. scheduled_posts for the partner (in partner's channel)
  const { data: partnerSched, error: psErr } = await supabase
    .from('scheduled_posts')
    .insert({
      user_id: deal.partner_user_id,
      post_id: partnerPost.id,
      channel_id: deal.partner_channel_id,
      scheduled_at: publishAt,
      status: 'pending',
    })
    .select('id')
    .single();
  if (psErr || !partnerSched) return { error: `Не удалось запланировать пост партнёра: ${psErr?.message}` };

  // 5. Update the deal → scheduled
  const { error: updErr } = await supabase
    .from('cp_deals')
    .update({
      status: 'scheduled',
      agreed_at: new Date().toISOString(),
      promo_text_for_initiator: partnerPostText,
      initiator_scheduled_post_id: initiatorSched.id,
      partner_scheduled_post_id: partnerSched.id,
    })
    .eq('id', deal.id);
  if (updErr) return { error: updErr.message };

  revalidatePath('/dashboard/crosspromo/deals');
  return { success: true };
}

// ===========================================================================
// Deals — decline (partner) / cancel (either side, before publish)
// ===========================================================================
export async function declineCpDealAction(formData: FormData): Promise<CpActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const parsed = cpDealIdSchema.safeParse({ deal_id: formData.get('deal_id') });
  if (!parsed.success) return { error: 'Не указана сделка' };

  const { data: deal, error } = await supabase
    .from('cp_deals')
    .select('id, partner_user_id, initiator_user_id, status')
    .eq('id', parsed.data.deal_id)
    .single();
  if (error || !deal) return { error: 'Сделка не найдена' };
  if (deal.status !== 'proposed') return { error: 'Эту сделку уже нельзя отклонить' };
  if (deal.partner_user_id !== user.id) return { error: 'Только партнёр может отклонить предложение' };

  const { error: updErr } = await supabase
    .from('cp_deals')
    .update({ status: 'declined' })
    .eq('id', deal.id);
  if (updErr) return { error: updErr.message };

  revalidatePath('/dashboard/crosspromo/deals');
  return { success: true };
}

export async function cancelCpDealAction(formData: FormData): Promise<CpActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const parsed = cpDealIdSchema.safeParse({ deal_id: formData.get('deal_id') });
  if (!parsed.success) return { error: 'Не указана сделка' };

  const { data: deal, error } = await supabase
    .from('cp_deals')
    .select('id, partner_user_id, initiator_user_id, status, initiator_scheduled_post_id, partner_scheduled_post_id')
    .eq('id', parsed.data.deal_id)
    .single();
  if (error || !deal) return { error: 'Сделка не найдена' };
  if (deal.initiator_user_id !== user.id && deal.partner_user_id !== user.id) {
    return { error: 'Нет доступа к этой сделке' };
  }
  // Can only cancel before it goes live
  if (!['proposed', 'accepted', 'scheduled'].includes(deal.status)) {
    return { error: 'Сделку уже нельзя отменить — посты опубликованы' };
  }

  // If posts were already scheduled, cancel them so they don't publish
  for (const sid of [deal.initiator_scheduled_post_id, deal.partner_scheduled_post_id]) {
    if (sid) {
      await supabase
        .from('scheduled_posts')
        .update({ status: 'cancelled' })
        .eq('id', sid)
        .eq('status', 'pending');
    }
  }

  const { error: updErr } = await supabase
    .from('cp_deals')
    .update({ status: 'cancelled' })
    .eq('id', deal.id);
  if (updErr) return { error: updErr.message };

  revalidatePath('/dashboard/crosspromo/deals');
  return { success: true };
}
