'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { telegram } from '@/lib/telegram/client';
import { encrypt } from '@/lib/crypto';
import { botTokenSchema } from '@/lib/validations/schemas';

export type ActionResult = { error?: string; bot_id?: string; bot_username?: string };

export async function connectBotAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = botTokenSchema.safeParse({ token: formData.get('token') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Неверный формат токена' };
  }
  const { token } = parsed.data;

  // Validate via Telegram getMe — proves the token works AND gets bot username
  let info;
  try {
    info = await telegram.getMe(token);
  } catch (e) {
    return { error: 'Telegram отклонил токен. Проверь его в @BotFather' };
  }
  if (!info.is_bot) {
    return { error: 'Это не токен бота' };
  }

  // Encrypt before storing — plaintext tokens NEVER hit the DB
  const token_encrypted = encrypt(token);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bots')
    .insert({
      user_id: user.id,
      token_encrypted,
      username: info.username,
      first_name: info.first_name,
    })
    .select('id, username')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: `Бот @${info.username} уже подключён` };
    }
    return { error: error.message };
  }

  revalidatePath('/dashboard/channels');
  return { bot_id: data.id, bot_username: data.username };
}
