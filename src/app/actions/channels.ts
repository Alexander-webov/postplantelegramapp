'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { telegram } from '@/lib/telegram/client';
import { decrypt } from '@/lib/crypto';
import { addChannelSchema } from '@/lib/validations/schemas';
import { checkChannelLimit } from '@/lib/usage';
import { getEffectiveTier } from '@/lib/usage';

export type ActionResult = { error?: string; channel_id?: string; channel_title?: string };

export async function addChannelAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const profile = await getProfile();

  const parsed = addChannelSchema.safeParse({
    bot_id: formData.get('bot_id'),
    username_or_id: formData.get('username_or_id'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  // Tier check — bail out before doing any Telegram work
  const tier = getEffectiveTier(profile);
  const limitCheck = await checkChannelLimit(user.id, tier);
  if (!limitCheck.allowed) {
    return { error: limitCheck.reason ?? 'Лимит исчерпан' };
  }

  const supabase = await createClient();

  // Load the bot (RLS ensures it's the user's own)
  const { data: bot, error: botErr } = await supabase
    .from('bots')
    .select('id, token_encrypted, username, user_id')
    .eq('id', parsed.data.bot_id)
    .single();
  if (botErr || !bot) return { error: 'Бот не найден' };

  const token = decrypt(bot.token_encrypted);

  // 1. Resolve the channel via getChat (works for @username and numeric -100... ids)
  let chat;
  try {
    chat = await telegram.getChat(token, parsed.data.username_or_id);
  } catch (e) {
    return {
      error:
        'Не удалось найти канал. Убедись что: 1) канал публичный или бот туда добавлен; 2) написан @username правильно',
    };
  }

  if (chat.type !== 'channel' && chat.type !== 'supergroup') {
    return { error: `Это не канал (тип: ${chat.type}). Постплан работает с каналами и супергруппами.` };
  }

  // 2. Verify the bot is admin with post permissions
  const botInfo = await telegram.getMe(token);
  let member;
  try {
    member = await telegram.getChatMember(token, chat.id, botInfo.id);
  } catch (e) {
    return { error: 'Бот не находится в канале. Добавь его как администратора.' };
  }

  if (member.status !== 'administrator' && member.status !== 'creator') {
    return {
      error: `Бот @${bot.username} не админ в канале. Зайди в Telegram → канал → Управление → Администраторы → добавь бота с правом «Публикация сообщений»`,
    };
  }
  if (member.can_post_messages === false) {
    return {
      error: `У бота нет права публиковать сообщения. Включи «Публикация сообщений» в правах админа.`,
    };
  }

  // 3. Get subscriber count for the dashboard preview
  let subscriber_count = 0;
  try {
    subscriber_count = await telegram.getChatMemberCount(token, chat.id);
  } catch {
    /* non-fatal */
  }

  // 4. Save
  const { data, error: insertErr } = await supabase
    .from('channels')
    .insert({
      user_id: user.id,
      bot_id: bot.id,
      telegram_chat_id: String(chat.id),
      title: chat.title ?? '(без названия)',
      username: chat.username ?? null,
      subscriber_count,
      last_synced_at: new Date().toISOString(),
    })
    .select('id, title')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { error: `Канал «${chat.title}» уже добавлен` };
    }
    return { error: insertErr.message };
  }

  revalidatePath('/dashboard/channels');
  revalidatePath('/dashboard');
  return { channel_id: data.id, channel_title: data.title };
}

// ===========================================================================
// Channel/bot management — rename, toggle active, delete
// ===========================================================================

export async function toggleChannelActiveAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  const id = formData.get('id');
  if (typeof id !== 'string' || !id) return { error: 'Неверный id' };

  const supabase = await createClient();
  const { data: ch } = await supabase
    .from('channels')
    .select('id, is_active')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!ch) return { error: 'Канал не найден' };

  const { error } = await supabase
    .from('channels')
    .update({ is_active: !ch.is_active })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/channels');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function renameChannelAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  const id = formData.get('id');
  const title = formData.get('title');
  if (typeof id !== 'string' || !id) return { error: 'Неверный id' };
  if (typeof title !== 'string' || !title.trim()) return { error: 'Введите название' };
  if (title.length > 200) return { error: 'Название слишком длинное' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('channels')
    .update({ title: title.trim() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/channels');
  return { success: true };
}

export async function deleteChannelAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  const id = formData.get('id');
  if (typeof id !== 'string' || !id) return { error: 'Неверный id' };

  const supabase = await createClient();

  // Cancel any pending scheduled posts for this channel first — otherwise they'd
  // hit FK CASCADE and disappear silently. Better to mark them cancelled.
  await supabase
    .from('scheduled_posts')
    .update({ status: 'cancelled', error_message: 'Канал удалён' })
    .eq('channel_id', id)
    .eq('user_id', user.id)
    .eq('status', 'pending');

  const { error } = await supabase
    .from('channels')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/channels');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/queue');
  return { success: true };
}

export async function deleteBotAction(formData: FormData): Promise<{ error?: string; success?: boolean; channelCount?: number }> {
  const user = await requireUser();
  const id = formData.get('id');
  const force = formData.get('force') === 'true';
  if (typeof id !== 'string' || !id) return { error: 'Неверный id' };

  const supabase = await createClient();

  // Count how many channels depend on this bot
  const { count: channelCount } = await supabase
    .from('channels')
    .select('id', { count: 'exact', head: true })
    .eq('bot_id', id)
    .eq('user_id', user.id);

  if ((channelCount ?? 0) > 0 && !force) {
    return {
      error: `К боту привязано ${channelCount} канал(ов). Удалите их сначала или подтвердите принудительное удаление.`,
      channelCount: channelCount ?? 0,
    };
  }

  // Cancel pending scheduled posts on all channels of this bot
  if ((channelCount ?? 0) > 0) {
    const { data: chs } = await supabase
      .from('channels')
      .select('id')
      .eq('bot_id', id)
      .eq('user_id', user.id);
    if (chs && chs.length > 0) {
      const channelIds = chs.map((c) => c.id);
      await supabase
        .from('scheduled_posts')
        .update({ status: 'cancelled', error_message: 'Бот удалён' })
        .in('channel_id', channelIds)
        .eq('status', 'pending');
    }
  }

  // Delete bot — channels CASCADE
  const { error } = await supabase
    .from('bots')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/channels');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/queue');
  return { success: true };
}
