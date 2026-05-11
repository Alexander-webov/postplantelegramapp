'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { signupSchema, loginSchema } from '@/lib/validations/schemas';

export type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
  needsEmailConfirmation?: boolean;
};

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function signupAction(formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is disabled, Supabase returns a session immediately.
  // If confirmation is enabled, session is null and the user must confirm email first.
  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  }

  return {
    success: true,
    needsEmailConfirmation: true,
    message: 'Аккаунт создан. Мы отправили письмо для подтверждения email. Проверь входящие и папку «Спам».',
  };
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes('email not confirmed') || message.includes('confirm')) {
      return {
        error: 'Email ещё не подтверждён. Проверь почту и перейди по ссылке подтверждения.',
      };
    }

    return { error: 'Неверный email или пароль' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

// ---------------------------------------------------------------------------
// Password reset — request flow
// ---------------------------------------------------------------------------

const requestResetSchema = z.object({
  email: z.string().email('Неверный email'),
});

/**
 * Send a password-reset email via Supabase. The email contains a magic link
 * that lands on `/auth/reset-password`, where the user can set a new password.
 *
 * For security, we always return success even if the email isn't registered —
 * this prevents account enumeration via this endpoint.
 */
export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  const parsed = requestResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/reset-password`,
  });

  // Don't leak whether the address was real
  if (error) {
    console.error('Password reset request error:', error);
  }

  return {
    success: true,
    message: 'Если такой email зарегистрирован, мы отправили ссылку для сброса пароля. Проверь почту.',
  };
}

// ---------------------------------------------------------------------------
// Password reset — set new password (after clicking magic link)
// ---------------------------------------------------------------------------

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Минимум 8 символов'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  });

export async function updatePasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { success: true, message: 'Пароль обновлён' };
}

// ---------------------------------------------------------------------------
// Settings — update display name
// ---------------------------------------------------------------------------

const updateNameSchema = z.object({
  full_name: z.string().max(100, 'Слишком длинное имя'),
});

export async function updateNameAction(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateNameSchema.safeParse({
    full_name: formData.get('full_name') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }

  const supabase = await createClient();

  // Update both the auth user metadata and the profiles row so it
  // shows up consistently in the header and Supabase admin panel.
  const [authRes, profileRes] = await Promise.all([
    supabase.auth.updateUser({ data: { full_name: parsed.data.full_name || null } }),
    supabase
      .from('profiles')
      .update({ full_name: parsed.data.full_name || null })
      .eq('id', user.id),
  ]);

  if (authRes.error) return { error: authRes.error.message };
  if (profileRes.error) return { error: profileRes.error.message };

  revalidatePath('/', 'layout');
  return { success: true, message: 'Имя обновлено' };
}
