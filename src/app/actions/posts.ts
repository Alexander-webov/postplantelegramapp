'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { decrypt } from '@/lib/crypto';
import { sendPostToTelegram, type PreparedMedia } from '@/lib/telegram/media';
import { classifyMime } from '@/lib/telegram/media';
import { applyTemplateVariables, applySignature } from '@/lib/templates';
import { checkCrosspostLimit, checkPostQuota, getEffectiveTier } from '@/lib/usage';
import {
  quickPostSchema,
  schedulePostSchema,
  updateScheduledSchema,
  cancelScheduledSchema,
} from '@/lib/validations/schemas';

export type ActionResult = {
  error?: string;
  success?: boolean;
  /** number of channels the post was sent to */
  sent?: number;
  /** number of channels where send failed */
  failed?: number;
  /** detailed per-channel results */
  results?: { channel_id: string; channel_title: string; success: boolean; error?: string; message_id?: number }[];
};
export type ScheduleResult = {
  error?: string;
  success?: boolean;
  /** number of scheduled_posts rows created */
  scheduled?: number;
  scheduled_post_ids?: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the media_paths[] field from FormData (each entry is a Storage path). */
function readMediaPaths(formData: FormData): string[] {
  const raw = formData.getAll('media_paths');
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/** Extract channel_ids[] (multi-select form field). */
function readChannelIds(formData: FormData): string[] {
  const raw = formData.getAll('channel_ids');
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/** Parse auto_delete_after_hours from FormData. Returns null if not set or invalid. */
function readAutoDeleteHours(formData: FormData): number | null {
  const raw = formData.get('auto_delete_after_hours');
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0 || n > 720) return null;
  return n;
}

/**
 * Read advertiser placement fields from FormData. The composer emits these
 * as advertiser_id, ad_price_rub, ad_format. If advertiser_id is empty, the
 * post is organic (no placement).
 */
function readPlacementFields(formData: FormData): {
  advertiserId: string | null;
  priceRub: number;
  format: string | null;
} {
  const advertiserIdRaw = formData.get('advertiser_id');
  const advertiserId =
    typeof advertiserIdRaw === 'string' && advertiserIdRaw.length > 0
      ? advertiserIdRaw
      : null;

  const priceRaw = formData.get('ad_price_rub');
  let priceRub = 0;
  if (typeof priceRaw === 'string' && priceRaw.length > 0) {
    const parsed = parseFloat(priceRaw.replace(',', '.'));
    if (!Number.isNaN(parsed) && parsed >= 0) priceRub = parsed;
  }

  const formatRaw = formData.get('ad_format');
  const format =
    typeof formatRaw === 'string' && formatRaw.trim().length > 0
      ? formatRaw.trim().slice(0, 50)
      : null;

  return { advertiserId, priceRub, format };
}

/**
 * Read per-channel custom_contents from FormData.
 * Encoded as `custom_content[<channel_id>]` = "...".
 */
function readCustomContents(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^custom_content\[([0-9a-f-]{36})\]$/i);
    if (match && typeof value === 'string') {
      const id = match[1];
      const trimmed = value.trim();
      if (trimmed.length > 0) result[id] = value;
    }
  }
  return result;
}

async function loadMediaFromStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[]
): Promise<{ items: PreparedMedia[]; error?: string }> {
  const items: PreparedMedia[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from('post-media').download(path);
    if (error || !data) {
      return { items: [], error: `Не удалось загрузить медиа из хранилища: ${error?.message ?? path}` };
    }
    const kind = classifyMime(data.type);
    if (!kind) {
      return { items: [], error: `Неизвестный тип медиа: ${data.type}` };
    }
    items.push({
      kind,
      blob: data,
      filename: path.split('/').pop() ?? 'file',
      size: data.size,
    });
  }
  return { items };
}

async function persistPostMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  paths: string[]
) {
  if (paths.length === 0) return;
  const rows = paths.map((path, i) => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    let mediaType: 'photo' | 'video' | 'animation' = 'photo';
    if (ext === 'gif') mediaType = 'animation';
    else if (['mp4', 'mov', 'webm'].includes(ext)) mediaType = 'video';
    return {
      post_id: postId,
      type: mediaType,
      storage_path: path,
      position: i,
    };
  });
  await supabase.from('post_media').insert(rows);
}

/** Sleep helper for rate-limit pacing between Telegram calls. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Send-now (cross-post): one post -> N channels, immediate send
// ---------------------------------------------------------------------------
export async function sendQuickPostAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const profile = await getProfile();

  const channelIds = readChannelIds(formData);
  const customContents = readCustomContents(formData);

  const parsed = quickPostSchema.safeParse({
    channel_ids: channelIds,
    content: formData.get('content') ?? '',
    disable_preview: formData.get('disable_preview') === 'on',
    silent: formData.get('silent') === 'on',
    custom_contents: customContents,
    auto_delete_after_hours: readAutoDeleteHours(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  // Tier checks: crosspost cap + monthly post quota
  const tier = getEffectiveTier(profile);
  const cpCheck = checkCrosspostLimit(parsed.data.channel_ids.length, tier);
  if (!cpCheck.allowed) return { error: cpCheck.reason ?? 'Лимит кросспостинга исчерпан' };
  const quotaCheck = await checkPostQuota(user.id, tier, parsed.data.channel_ids.length);
  if (!quotaCheck.allowed) return { error: quotaCheck.reason ?? 'Лимит постов исчерпан' };

  const mediaPaths = readMediaPaths(formData);
  const rawSignatureId = formData.get('signature_id');
  const signatureId =
    typeof rawSignatureId === 'string' && rawSignatureId.length > 0 ? rawSignatureId : null;

  const supabase = await createClient();

  // Load all selected channels with their bots in one query
  const { data: channels, error: channelsErr } = await supabase
    .from('channels')
    .select('id, telegram_chat_id, title, username, is_active, bots(id, token_encrypted)')
    .eq('user_id', user.id)
    .in('id', parsed.data.channel_ids);
  if (channelsErr || !channels) return { error: 'Не удалось загрузить каналы' };

  // Validate all channels exist + are active + have bots
  const channelMap = new Map<string, typeof channels[number]>();
  for (const ch of channels) {
    if (!ch.is_active) {
      return { error: `Канал «${ch.title}» выключен — включи или убери из выбора` };
    }
    const bot = Array.isArray(ch.bots) ? ch.bots[0] : ch.bots;
    if (!bot?.token_encrypted) {
      return { error: `У канала «${ch.title}» нет привязанного бота` };
    }
    channelMap.set(ch.id, ch);
  }
  // Check that we found ALL requested channels (RLS would silently drop missing ones)
  for (const id of parsed.data.channel_ids) {
    if (!channelMap.has(id)) return { error: 'Один из выбранных каналов не найден' };
  }

  // Load signature if requested
  let signatureContent: string | null = null;
  if (signatureId) {
    const { data: sig } = await supabase
      .from('templates')
      .select('content')
      .eq('id', signatureId)
      .eq('user_id', user.id)
      .eq('kind', 'signature')
      .single();
    if (sig) signatureContent = sig.content;
  }

  // Load media once (same media reused for all channels)
  const { items: media, error: mediaErr } = await loadMediaFromStorage(supabase, mediaPaths);
  if (mediaErr) return { error: mediaErr };

  // Empty post check (any-channel: at least one of content/media must exist)
  const hasAnyContent = parsed.data.content.trim().length > 0;
  const hasAnyCustomContent = Object.values(parsed.data.custom_contents ?? {}).some((c) => c.trim().length > 0);
  if (!hasAnyContent && !hasAnyCustomContent && media.length === 0) {
    return { error: 'Пост пустой — нужен текст или медиа' };
  }

  // Create the post record once
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      content: parsed.data.content,
      parse_mode: 'HTML',
      disable_preview: parsed.data.disable_preview,
      silent: parsed.data.silent,
      status: 'published',
      applied_signature_id: signatureId,
    })
    .select('id')
    .single();
  if (postErr || !post) return { error: postErr?.message ?? 'Не удалось создать пост' };

  await persistPostMedia(supabase, post.id, mediaPaths);

  // Loop through channels with rate limit pacing
  const results: NonNullable<ActionResult['results']> = [];
  let sentCount = 0;
  let failedCount = 0;

  // Read advertiser/placement fields once — same for every channel
  // (cross-posting an ad means the ad goes to all selected channels)
  const placement = readPlacementFields(formData);

  for (let i = 0; i < parsed.data.channel_ids.length; i++) {
    const channelId = parsed.data.channel_ids[i];
    const channel = channelMap.get(channelId)!;
    const bot = Array.isArray(channel.bots) ? channel.bots[0] : channel.bots;
    const token = decrypt(bot!.token_encrypted);

    // Resolve content for this channel: custom override OR default
    const channelContent = parsed.data.custom_contents?.[channelId] ?? parsed.data.content;

    const ctx = {
      sendAt: new Date(),
      timezone: 'Europe/Moscow',
      channelTitle: channel.title,
      channelUsername: channel.username,
    };
    const contentWithVars = applyTemplateVariables(channelContent, ctx);
    const finalContent = applySignature(contentWithVars, signatureContent, ctx);

    const now = new Date().toISOString();

    try {
      const messageIds = await sendPostToTelegram({
        token,
        chatId: channel.telegram_chat_id,
        content: finalContent,
        parseMode: 'HTML',
        disablePreview: parsed.data.disable_preview,
        silent: parsed.data.silent,
        media,
      });

      // If user requested auto-delete, compute the future timestamp
      const autoDeleteAt = parsed.data.auto_delete_after_hours
        ? new Date(
            Date.now() + parsed.data.auto_delete_after_hours * 60 * 60 * 1000
          ).toISOString()
        : null;

      const { data: insertedScheduled } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: user.id,
          post_id: post.id,
          channel_id: channel.id,
          scheduled_at: now,
          status: 'sent',
          telegram_message_id: messageIds[0] ?? null,
          telegram_message_ids: messageIds,
          sent_at: now,
          custom_content: parsed.data.custom_contents?.[channelId] ?? null,
          auto_delete_after_hours: parsed.data.auto_delete_after_hours ?? null,
          auto_delete_at: autoDeleteAt,
        })
        .select('id')
        .single();

      // If this post is an ad — create the placement record. Send-now means
      // the post is already published, so status is 'published' (not 'draft').
      // Done in a fire-and-forget style: a placement failure shouldn't undo
      // a successful Telegram post.
      if (insertedScheduled && placement.advertiserId) {
        const { upsertPlacementForPost } = await import('@/app/actions/advertisers');
        const placementResult = await upsertPlacementForPost({
          userId: user.id,
          scheduledPostId: insertedScheduled.id,
          advertiserId: placement.advertiserId,
          priceRub: placement.priceRub,
          format: placement.format,
          status: 'published',
        });
        if (placementResult.error) {
          console.error('Placement creation failed for post', insertedScheduled.id, placementResult.error);
        }
      }

      results.push({
        channel_id: channelId,
        channel_title: channel.title,
        success: true,
        message_id: messageIds[0] ?? 0,
      });
      sentCount++;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'unknown error';
      await supabase.from('scheduled_posts').insert({
        user_id: user.id,
        post_id: post.id,
        channel_id: channel.id,
        scheduled_at: now,
        status: 'failed',
        error_message: errMsg,
        custom_content: parsed.data.custom_contents?.[channelId] ?? null,
      });
      results.push({
        channel_id: channelId,
        channel_title: channel.title,
        success: false,
        error: errMsg,
      });
      failedCount++;
    }

    // Rate limit pacing: 100ms between sends. Telegram allows 30 msg/sec to channels;
    // 10/sec is plenty and gives us headroom.
    if (i < parsed.data.channel_ids.length - 1) await sleep(100);
  }

  // If everything failed, mark the post as failed
  if (sentCount === 0) {
    await supabase.from('posts').update({ status: 'failed' }).eq('id', post.id);
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/posts/new');
  revalidatePath('/dashboard/queue');

  return { success: sentCount > 0, sent: sentCount, failed: failedCount, results };
}

// ---------------------------------------------------------------------------
// Schedule (cross-post): one post -> N channels, queued for later
// ---------------------------------------------------------------------------
export async function schedulePostAction(formData: FormData): Promise<ScheduleResult> {
  const user = await requireUser();
  const profile = await getProfile();

  const channelIds = readChannelIds(formData);
  const customContents = readCustomContents(formData);

  const parsed = schedulePostSchema.safeParse({
    channel_ids: channelIds,
    content: formData.get('content') ?? '',
    disable_preview: formData.get('disable_preview') === 'on',
    silent: formData.get('silent') === 'on',
    custom_contents: customContents,
    auto_delete_after_hours: readAutoDeleteHours(formData),
    scheduled_at: formData.get('scheduled_at'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  // Tier checks: crosspost cap + monthly post quota
  const tier = getEffectiveTier(profile);
  const cpCheck = checkCrosspostLimit(parsed.data.channel_ids.length, tier);
  if (!cpCheck.allowed) return { error: cpCheck.reason ?? 'Лимит кросспостинга исчерпан' };
  const quotaCheck = await checkPostQuota(user.id, tier, parsed.data.channel_ids.length);
  if (!quotaCheck.allowed) return { error: quotaCheck.reason ?? 'Лимит постов исчерпан' };

  const mediaPaths = readMediaPaths(formData);
  const rawSignatureId = formData.get('signature_id');
  const signatureId =
    typeof rawSignatureId === 'string' && rawSignatureId.length > 0 ? rawSignatureId : null;

  const hasAnyContent = parsed.data.content.trim().length > 0;
  const hasAnyCustomContent = Object.values(parsed.data.custom_contents ?? {}).some((c) => c.trim().length > 0);
  if (!hasAnyContent && !hasAnyCustomContent && mediaPaths.length === 0 && !signatureId) {
    return { error: 'Пост пустой — нужен текст или медиа' };
  }

  const supabase = await createClient();

  // Validate all channels belong to the user and are active
  const { data: channels, error: chErr } = await supabase
    .from('channels')
    .select('id, is_active, title')
    .eq('user_id', user.id)
    .in('id', parsed.data.channel_ids);
  if (chErr || !channels || channels.length !== parsed.data.channel_ids.length) {
    return { error: 'Один или несколько каналов не найдены' };
  }
  for (const ch of channels) {
    if (!ch.is_active) {
      return { error: `Канал «${ch.title}» выключен` };
    }
  }

  // Verify signature ownership if provided
  if (signatureId) {
    const { data: sig } = await supabase
      .from('templates')
      .select('id')
      .eq('id', signatureId)
      .eq('user_id', user.id)
      .eq('kind', 'signature')
      .single();
    if (!sig) return { error: 'Подпись не найдена' };
  }

  // 1. Create the post record once
  const { data: post, error: postErr } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      content: parsed.data.content,
      parse_mode: 'HTML',
      disable_preview: parsed.data.disable_preview,
      silent: parsed.data.silent,
      status: 'scheduled',
      applied_signature_id: signatureId,
    })
    .select('id')
    .single();
  if (postErr || !post) return { error: postErr?.message ?? 'Не удалось создать пост' };

  await persistPostMedia(supabase, post.id, mediaPaths);

  // 2. Insert one scheduled_posts row per channel
  const rows = parsed.data.channel_ids.map((channelId) => ({
    user_id: user.id,
    post_id: post.id,
    channel_id: channelId,
    scheduled_at: parsed.data.scheduled_at,
    status: 'pending' as const,
    custom_content: parsed.data.custom_contents?.[channelId] ?? null,
    // auto_delete_at gets computed at send time inside the Edge Function
    // based on actual sent_at + auto_delete_after_hours
    auto_delete_after_hours: parsed.data.auto_delete_after_hours ?? null,
  }));

  const { data: queued, error: queueErr } = await supabase
    .from('scheduled_posts')
    .insert(rows)
    .select('id');
  if (queueErr || !queued || queued.length === 0) {
    // Roll back the post — if we couldn't queue, the post shouldn't dangle
    await supabase.from('posts').delete().eq('id', post.id);
    return { error: queueErr?.message ?? 'Не удалось поставить в очередь' };
  }

  // If this is an ad — create placement for each cross-posted row.
  // Status is 'draft' initially; user can change it later in the queue or
  // advertiser card. We don't fail the whole action if placement fails —
  // post is already in the queue, that's the important part.
  const placement = readPlacementFields(formData);
  if (placement.advertiserId) {
    const { upsertPlacementForPost } = await import('@/app/actions/advertisers');
    for (const row of queued) {
      const r = await upsertPlacementForPost({
        userId: user.id,
        scheduledPostId: row.id,
        advertiserId: placement.advertiserId,
        priceRub: placement.priceRub,
        format: placement.format,
        status: 'draft',
      });
      if (r.error) {
        console.error('Placement creation failed for scheduled row', row.id, r.error);
      }
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/queue');
  revalidatePath('/dashboard/posts/new');
  if (placement.advertiserId) revalidatePath(`/dashboard/advertisers/${placement.advertiserId}`);
  return {
    success: true,
    scheduled: queued.length,
    scheduled_post_ids: queued.map((q) => q.id),
  };
}

// ---------------------------------------------------------------------------
// Update an existing pending scheduled_post — single channel only
// (we don't currently support editing a multi-channel batch as a unit)
// ---------------------------------------------------------------------------
export async function updateScheduledPostAction(formData: FormData): Promise<ScheduleResult> {
  const user = await requireUser();
  const scheduledId = formData.get('scheduled_post_id');
  if (typeof scheduledId !== 'string' || !scheduledId) {
    return { error: 'Неверный id' };
  }

  const parsed = updateScheduledSchema.safeParse({
    scheduled_post_id: scheduledId,
    channel_id: formData.get('channel_id'),
    content: formData.get('content') ?? '',
    disable_preview: formData.get('disable_preview') === 'on',
    silent: formData.get('silent') === 'on',
    auto_delete_after_hours: readAutoDeleteHours(formData),
    scheduled_at: formData.get('scheduled_at'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  const mediaPaths = readMediaPaths(formData);
  const rawSignatureId = formData.get('signature_id');
  const signatureId =
    typeof rawSignatureId === 'string' && rawSignatureId.length > 0 ? rawSignatureId : null;

  if (!parsed.data.content.trim() && mediaPaths.length === 0 && !signatureId) {
    return { error: 'Пост пустой — нужен текст или медиа' };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('scheduled_posts')
    .select('id, post_id, status, channel_id')
    .eq('id', scheduledId)
    .eq('user_id', user.id)
    .single();
  if (!existing) return { error: 'Запланированный пост не найден' };
  if (existing.status !== 'pending') {
    return {
      error: `Этот пост уже ${existing.status === 'sent' ? 'отправлен' : existing.status} — его нельзя изменить из очереди`,
    };
  }

  const { error: postErr } = await supabase
    .from('posts')
    .update({
      content: parsed.data.content,
      disable_preview: parsed.data.disable_preview,
      silent: parsed.data.silent,
      applied_signature_id: signatureId,
    })
    .eq('id', existing.post_id)
    .eq('user_id', user.id);
  if (postErr) return { error: postErr.message };

  const { error: schedErr } = await supabase
    .from('scheduled_posts')
    .update({
      scheduled_at: parsed.data.scheduled_at,
      channel_id: parsed.data.channel_id,
      auto_delete_after_hours: parsed.data.auto_delete_after_hours ?? null,
      last_edited_at: new Date().toISOString(),
    })
    .eq('id', scheduledId)
    .eq('user_id', user.id);
  if (schedErr) return { error: schedErr.message };

  await supabase.from('post_media').delete().eq('post_id', existing.post_id);
  await persistPostMedia(supabase, existing.post_id, mediaPaths);

  // Update placement (or remove it if user cleared advertiser)
  const placement = readPlacementFields(formData);
  const { upsertPlacementForPost } = await import('@/app/actions/advertisers');
  const placementResult = await upsertPlacementForPost({
    userId: user.id,
    scheduledPostId: scheduledId,
    advertiserId: placement.advertiserId,
    priceRub: placement.priceRub,
    format: placement.format,
    // Keep existing status if any — upsert preserves it via DEFAULT only on insert.
    // For new placements the helper falls back to 'draft' which matches the
    // editing context (post is still pending).
  });
  if (placementResult.error) {
    console.error('Placement update failed for', scheduledId, placementResult.error);
  }

  revalidatePath('/dashboard/queue');
  revalidatePath('/dashboard');
  if (placement.advertiserId) revalidatePath(`/dashboard/advertisers/${placement.advertiserId}`);
  return { success: true, scheduled: 1, scheduled_post_ids: [scheduledId] };
}

// ---------------------------------------------------------------------------
// Cancel a pending scheduled post (single, not batch)
// ---------------------------------------------------------------------------
export async function cancelScheduledAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();

  const parsed = cancelScheduledSchema.safeParse({
    scheduled_post_id: formData.get('scheduled_post_id'),
  });
  if (!parsed.success) return { error: 'Неверный id' };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scheduled_posts')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.scheduled_post_id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id, post_id')
    .single();

  if (error || !data) {
    return { error: 'Не удалось отменить (возможно, пост уже отправлен)' };
  }

  // Only flip the parent post back to draft if NO other scheduled rows are still pending.
  // For cross-posts we have multiple rows per post; we don't want to cancel the others.
  const { count: stillPending } = await supabase
    .from('scheduled_posts')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', data.post_id)
    .eq('status', 'pending');
  if ((stillPending ?? 0) === 0) {
    await supabase
      .from('posts')
      .update({ status: 'draft' })
      .eq('id', data.post_id)
      .eq('status', 'scheduled');
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/queue');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Edit a published post in Telegram (text/caption only, 48h window)
// ---------------------------------------------------------------------------
export async function editPublishedPostAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  const scheduledId = formData.get('scheduled_post_id');
  const newContent = formData.get('content');
  if (typeof scheduledId !== 'string' || !scheduledId) return { error: 'Неверный id' };
  if (typeof newContent !== 'string') return { error: 'Текст не передан' };
  if (newContent.length > 4096) return { error: 'Текст слишком длинный' };

  const supabase = await createClient();

  const { data: row, error: rowErr } = await supabase
    .from('scheduled_posts')
    .select(`
      id, status, sent_at, telegram_message_id, post_id,
      posts (id, post_media (id)),
      channels (telegram_chat_id, title, username, bots (token_encrypted))
    `)
    .eq('id', scheduledId)
    .eq('user_id', user.id)
    .single();
  if (rowErr || !row) return { error: 'Пост не найден' };

  if (row.status !== 'sent' || !row.telegram_message_id) {
    return { error: 'Можно редактировать только отправленные посты' };
  }
  if (!row.sent_at) return { error: 'Нет времени отправки' };

  const ageMs = Date.now() - new Date(row.sent_at).getTime();
  const fortyEightHours = 48 * 60 * 60 * 1000;
  if (ageMs > fortyEightHours) {
    return { error: 'Telegram не разрешает редактировать посты старше 48 часов' };
  }

  const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
  const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
  const bot = channel?.bots ? (Array.isArray(channel.bots) ? channel.bots[0] : channel.bots) : null;
  if (!channel || !bot?.token_encrypted) return { error: 'Канал или бот не найден' };

  const token = decrypt(bot.token_encrypted);
  const hasMedia = (post?.post_media?.length ?? 0) > 0;

  const ctx = {
    sendAt: new Date(row.sent_at),
    timezone: 'Europe/Moscow',
    channelTitle: channel.title,
    channelUsername: channel.username,
  };
  const finalContent = applyTemplateVariables(newContent, ctx);

  const TG_API = 'https://api.telegram.org';
  const method = hasMedia ? 'editMessageCaption' : 'editMessageText';
  const body: Record<string, unknown> = {
    chat_id: channel.telegram_chat_id,
    message_id: row.telegram_message_id,
    parse_mode: 'HTML',
  };
  if (hasMedia) body.caption = finalContent;
  else body.text = finalContent;

  const tgRes = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await tgRes.json();
  if (!data.ok) {
    return { error: `Telegram отклонил: ${data.description ?? 'unknown'}` };
  }

  await supabase.from('posts').update({ content: newContent }).eq('id', row.post_id).eq('user_id', user.id);
  await supabase.from('scheduled_posts').update({ last_edited_at: new Date().toISOString() }).eq('id', scheduledId);

  revalidatePath('/dashboard/queue');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Clear history (sent / failed / cancelled rows)
// ---------------------------------------------------------------------------
export async function clearHistoryAction(): Promise<{ error?: string; deleted?: number }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error, count } = await supabase
    .from('scheduled_posts')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .in('status', ['sent', 'failed', 'cancelled']);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/queue');
  revalidatePath('/dashboard');
  return { deleted: count ?? 0 };
}

// ============================================================================
// Manual views refresh — server action
// ============================================================================
// Triggered by a "Refresh views" button in the queue UI. Fetches the current
// view count from the public t.me embed page (same source the Edge Function
// uses), then writes views_latest + views_latest_at.
//
// Snapshot columns (views_1h, views_6h, views_24h, views_48h) are NOT
// touched here — those are write-once, set only by the Edge Function at
// the right milestones.
// ============================================================================

export async function refreshViewsAction(
  formData: FormData
): Promise<{ error?: string; views?: number; refreshedAt?: string }> {
  const user = await requireUser();
  const scheduledId = formData.get('scheduled_post_id');
  if (typeof scheduledId !== 'string') return { error: 'Неверный id' };

  const supabase = await createClient();

  // We fetch views from the public t.me embed page rather than the Bot API.
  // Reason: Bot API has no method to read channel-post view counts. The
  // historical editMessageReplyMarkup trick destroys inline buttons on
  // posts that have them, and silently fails on posts that don't.
  const { data: row } = await supabase
    .from('scheduled_posts')
    .select(`
      id, status, telegram_message_id,
      channels (telegram_chat_id, username)
    `)
    .eq('id', scheduledId)
    .eq('user_id', user.id)
    .single();

  if (!row) return { error: 'Пост не найден' };
  if (row.status !== 'sent') return { error: 'Пост ещё не отправлен' };
  if (!row.telegram_message_id) return { error: 'Нет id сообщения для замера' };

  const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
  if (!channel) return { error: 'Канал недоступен' };

  const { fetchPublicPostViews } = await import('@/lib/telegram/public-views');
  const result = await fetchPublicPostViews(channel.username, row.telegram_message_id);

  if (result.views === null) {
    // Save the error so it's visible in the UI alongside the post
    await supabase
      .from('scheduled_posts')
      .update({ views_error: result.errorMessage })
      .eq('id', scheduledId);
    return { error: result.errorMessage ?? 'Просмотры недоступны' };
  }

  const refreshedAt = new Date().toISOString();
  await supabase
    .from('scheduled_posts')
    .update({
      views_latest: result.views,
      views_latest_at: refreshedAt,
      views_error: null,
    })
    .eq('id', scheduledId);

  // Store an event-like snapshot as well. This powers the analytics page and
  // keeps a history of manual refreshes. If the RLS insert policy has not been
  // applied yet, the main scheduled_posts update above still succeeds.
  await supabase
    .from('post_analytics')
    .insert({
      scheduled_post_id: scheduledId,
      views: result.views,
      snapshot_at: refreshedAt,
    });

  revalidatePath('/dashboard/queue');
  revalidatePath(`/dashboard/queue/${scheduledId}/analytics`);
  revalidatePath('/dashboard/analytics');
  return { views: result.views, refreshedAt };
}
