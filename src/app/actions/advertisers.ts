'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import {
  upsertAdvertiserSchema,
  deleteAdvertiserSchema,
  archiveAdvertiserSchema,
  placementStatusSchema,
} from '@/lib/validations/schemas';

export type ActionResult = { error?: string; success?: boolean; id?: string };

/**
 * Create a new advertiser or update an existing one in a single action.
 * If `id` is present in formData → update, otherwise insert.
 */
export async function upsertAdvertiserAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = formData.get('id');

  const parsed = upsertAdvertiserSchema.safeParse({
    id: typeof id === 'string' && id.length > 0 ? id : undefined,
    name: formData.get('name'),
    telegram_username: formData.get('telegram_username') ?? '',
    contact: formData.get('contact') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  const supabase = await createClient();

  // Normalise empty strings to null so DB filters work as expected
  const payload = {
    user_id: user.id,
    name: parsed.data.name,
    telegram_username: parsed.data.telegram_username || null,
    contact: parsed.data.contact || null,
    notes: parsed.data.notes || null,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from('advertisers')
      .update(payload)
      .eq('id', parsed.data.id)
      .eq('user_id', user.id);
    if (error) return { error: error.message };

    revalidatePath('/dashboard/advertisers');
    revalidatePath(`/dashboard/advertisers/${parsed.data.id}`);
    return { success: true, id: parsed.data.id };
  }

  const { data, error } = await supabase
    .from('advertisers')
    .insert(payload)
    .select('id')
    .single();
  if (error) return { error: error.message };

  revalidatePath('/dashboard/advertisers');
  return { success: true, id: data.id };
}

/**
 * Archive (soft-delete) an advertiser, or restore an archived one.
 * Archiving keeps placement history intact. We never auto-archive — user
 * decides explicitly.
 */
export async function archiveAdvertiserAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = archiveAdvertiserSchema.safeParse({
    id: formData.get('id'),
    archived: formData.get('archived') === 'true',
  });
  if (!parsed.success) return { error: 'Неверные параметры' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('advertisers')
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/advertisers');
  revalidatePath(`/dashboard/advertisers/${parsed.data.id}`);
  return { success: true };
}

/**
 * Hard-delete advertiser. Cascades to ad_placements via FK ON DELETE CASCADE.
 * The user gets a confirmation dialog in the UI before this fires.
 */
export async function deleteAdvertiserAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = deleteAdvertiserSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { error: 'Неверный id' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('advertisers')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/advertisers');
  return { success: true };
}

/**
 * Helper: create or update an ad_placement linked to a scheduled_post.
 * Called from posts actions (sendQuickPost / schedulePost / updateScheduled)
 * — NOT called directly from the UI.
 *
 * Logic:
 *  - If advertiserId is null/undefined → ensure NO placement exists (delete if was one)
 *  - If advertiserId is set → upsert placement with the given price/format
 *
 * Status transitions are intentionally simple:
 *  - On creation: status defaults to 'draft' for scheduled posts,
 *    'published' for sent-now posts (caller passes the right one).
 */
export async function upsertPlacementForPost(params: {
  userId: string;
  scheduledPostId: string;
  advertiserId: string | null | undefined;
  priceRub: number | null | undefined;
  format: string | null | undefined;
  status?: 'draft' | 'awaiting_payment' | 'paid' | 'published' | 'reported' | 'cancelled';
}): Promise<{ error?: string }> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  // No advertiser → ensure no placement (handles "user removed advertiser from existing post")
  if (!params.advertiserId) {
    const { error } = await supabase
      .from('ad_placements')
      .delete()
      .eq('scheduled_post_id', params.scheduledPostId)
      .eq('user_id', params.userId);
    if (error) return { error: error.message };
    return {};
  }

  // Verify advertiser belongs to user (defence-in-depth — RLS would catch
  // it too but explicit check gives a friendlier error)
  const { data: adv } = await supabase
    .from('advertisers')
    .select('id')
    .eq('id', params.advertiserId)
    .eq('user_id', params.userId)
    .single();

  if (!adv) return { error: 'Рекламодатель не найден или недоступен' };

  // Upsert by scheduled_post_id (which has a UNIQUE constraint)
  const { error } = await supabase
    .from('ad_placements')
    .upsert(
      {
        user_id: params.userId,
        advertiser_id: params.advertiserId,
        scheduled_post_id: params.scheduledPostId,
        price_rub: params.priceRub ?? 0,
        format: params.format || null,
        status: params.status ?? 'draft',
      },
      { onConflict: 'scheduled_post_id' }
    );

  if (error) return { error: error.message };
  return {};
}

/**
 * Update only the status of an existing ad_placement. Used by the dropdown
 * menu in the queue history rows so users can quickly mark a placement as
 * paid / reported / cancelled without going into a full edit form.
 */
export async function updatePlacementStatusAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();

  const placementId = formData.get('placement_id');
  const statusRaw = formData.get('status');

  if (typeof placementId !== 'string' || !placementId) {
    return { error: 'Неверный id размещения' };
  }
  const statusParsed = placementStatusSchema.safeParse(statusRaw);
  if (!statusParsed.success) {
    return { error: 'Неверный статус' };
  }

  const supabase = await createClient();

  // Auto-set paid_at when transitioning into 'paid' (informational timestamp)
  const update: Record<string, unknown> = { status: statusParsed.data };
  if (statusParsed.data === 'paid') {
    update.paid_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('ad_placements')
    .update(update)
    .eq('id', placementId)
    .eq('user_id', user.id)
    .select('advertiser_id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/dashboard/queue');
  if (data?.advertiser_id) {
    revalidatePath(`/dashboard/advertisers/${data.advertiser_id}`);
  }
  return { success: true };
}

/**
 * Generate (or return existing) public report slug for a placement.
 * Called from the queue and advertiser detail page when user clicks
 * "Получить ссылку для отчёта".
 *
 * Idempotent — calling twice on the same placement returns the same slug.
 */
export async function generateReportLinkAction(
  formData: FormData
): Promise<{ error?: string; slug?: string; url?: string }> {
  const user = await requireUser();
  const placementId = formData.get('placement_id');
  if (typeof placementId !== 'string' || !placementId) {
    return { error: 'Неверный id размещения' };
  }

  const supabase = await createClient();

  // Verify ownership and check existing slug
  const { data: existing } = await supabase
    .from('ad_placements')
    .select('id, report_slug')
    .eq('id', placementId)
    .eq('user_id', user.id)
    .single();

  if (!existing) return { error: 'Размещение не найдено' };

  let slug = existing.report_slug as string | null;

  if (!slug) {
    // Generate via our SQL function (handles uniqueness)
    const { data: slugRes, error: slugErr } = await supabase.rpc('generate_placement_slug');
    if (slugErr) return { error: slugErr.message };
    slug = slugRes as string;

    const { error: updateErr } = await supabase
      .from('ad_placements')
      .update({
        report_slug: slug,
        report_generated_at: new Date().toISOString(),
      })
      .eq('id', placementId)
      .eq('user_id', user.id);

    if (updateErr) return { error: updateErr.message };
  }

  // Build absolute URL for sharing. NEXT_PUBLIC_APP_URL must be set to the
  // deployed origin (e.g. https://postplan.ru) so the link works outside
  // the user's session.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const url = origin ? `${origin}/r/${slug}` : `/r/${slug}`;

  revalidatePath('/dashboard/queue');
  return { slug, url };
}

/**
 * Revoke a public report slug — sets it to null. The /r/<slug> URL will
 * 404 after this. Useful if the link leaked or the deal got cancelled.
 */
export async function revokeReportLinkAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  const placementId = formData.get('placement_id');
  if (typeof placementId !== 'string' || !placementId) {
    return { error: 'Неверный id размещения' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('ad_placements')
    .update({
      report_slug: null,
      report_generated_at: null,
      report_first_viewed_at: null,
      report_last_viewed_at: null,
      report_view_count: 0,
    })
    .eq('id', placementId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/queue');
  return { success: true };
}
