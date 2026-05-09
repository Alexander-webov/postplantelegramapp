'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';

export type SettingsResult = { error?: string; success?: boolean };

export async function updateProfileAction(formData: FormData): Promise<SettingsResult> {
  const user = await requireUser();
  const fullName = formData.get('full_name');
  if (typeof fullName !== 'string') return { error: 'Неверное имя' };
  if (fullName.length > 200) return { error: 'Имя слишком длинное' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() || null })
    .eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function changePasswordAction(formData: FormData): Promise<SettingsResult> {
  await requireUser();
  const newPassword = formData.get('new_password');
  if (typeof newPassword !== 'string') return { error: 'Неверный пароль' };
  if (newPassword.length < 8) return { error: 'Пароль должен быть минимум 8 символов' };
  if (newPassword.length > 128) return { error: 'Пароль слишком длинный' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: true };
}

export async function deleteAccountAction(formData: FormData): Promise<SettingsResult> {
  const user = await requireUser();
  const confirmation = formData.get('confirmation');
  if (confirmation !== 'УДАЛИТЬ') {
    return { error: 'Введите слово УДАЛИТЬ заглавными буквами для подтверждения' };
  }

  const supabase = await createClient();

  // Cancel all pending posts first so the cron doesn't try to fire them
  // after the channels (which CASCADE from user) are gone.
  await supabase
    .from('scheduled_posts')
    .update({ status: 'cancelled', error_message: 'Аккаунт удалён' })
    .eq('user_id', user.id)
    .eq('status', 'pending');

  // We can't hard-delete the auth.users row from a server action without
  // service-role key. The cleanest approach: sign the user out and rely on
  // a subsequent admin/script cleanup. For now, mark profile as inactive and
  // sign out — full deletion will be a separate admin tool.
  // TODO: when we have an admin endpoint, hard-delete auth.users.
  await supabase
    .from('profiles')
    .update({ full_name: '[deleted]' })
    .eq('id', user.id);

  await supabase.auth.signOut();

  redirect('/');
}
