'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { checkTemplateLimit, getEffectiveTier } from '@/lib/usage';
import {
  upsertTemplateSchema,
  deleteTemplateSchema,
} from '@/lib/validations/schemas';

export type TemplateActionResult = { error?: string; success?: boolean; id?: string };

export async function upsertTemplateAction(
  formData: FormData
): Promise<TemplateActionResult> {
  const user = await requireUser();

  const rawId = formData.get('id');
  const isCreating = !(typeof rawId === 'string' && rawId.length > 0);

  // Tier check — only on create. Editing existing templates is always allowed
  // even if the user downgraded (they can edit/delete what they already have).
  if (isCreating) {
    const profile = await getProfile();
    const tier = getEffectiveTier(profile);
    const limitCheck = await checkTemplateLimit(user.id, tier);
    if (!limitCheck.allowed) {
      return { error: limitCheck.reason ?? 'Шаблоны недоступны на тарифе' };
    }
  }

  const parsed = upsertTemplateSchema.safeParse({
    id: typeof rawId === 'string' && rawId.length > 0 ? rawId : undefined,
    kind: formData.get('kind'),
    name: formData.get('name'),
    content: formData.get('content'),
    is_signature: formData.get('is_signature') === 'on',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' };
  }
  const data = parsed.data;

  const supabase = await createClient();

  if (data.id) {
    // Update
    const { data: row, error } = await supabase
      .from('templates')
      .update({
        kind: data.kind,
        name: data.name,
        content: data.content,
        is_signature: data.kind === 'signature' ? data.is_signature : false,
      })
      .eq('id', data.id)
      .eq('user_id', user.id)
      .select('id')
      .single();
    if (error || !row) return { error: error?.message ?? 'Не удалось обновить' };

    // If this is being set as the active signature, demote all others
    if (data.kind === 'signature' && data.is_signature) {
      await supabase
        .from('templates')
        .update({ is_signature: false })
        .eq('user_id', user.id)
        .eq('kind', 'signature')
        .neq('id', row.id);
    }

    revalidatePath('/dashboard/templates');
    revalidatePath('/dashboard/posts/new');
    return { success: true, id: row.id };
  }

  // Insert
  const { data: row, error } = await supabase
    .from('templates')
    .insert({
      user_id: user.id,
      kind: data.kind,
      name: data.name,
      content: data.content,
      is_signature: data.kind === 'signature' ? data.is_signature : false,
    })
    .select('id')
    .single();
  if (error || !row) return { error: error?.message ?? 'Не удалось создать' };

  if (data.kind === 'signature' && data.is_signature) {
    await supabase
      .from('templates')
      .update({ is_signature: false })
      .eq('user_id', user.id)
      .eq('kind', 'signature')
      .neq('id', row.id);
  }

  revalidatePath('/dashboard/templates');
  revalidatePath('/dashboard/posts/new');
  return { success: true, id: row.id };
}

export async function deleteTemplateAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  const parsed = deleteTemplateSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { error: 'Неверный id' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard/templates');
  revalidatePath('/dashboard/posts/new');
  return { success: true };
}

/**
 * Toggle which signature is the active default. Setting active_id = null disables signatures entirely.
 */
export async function setActiveSignatureAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  const id = formData.get('id');
  const supabase = await createClient();

  // Demote all
  await supabase
    .from('templates')
    .update({ is_signature: false })
    .eq('user_id', user.id)
    .eq('kind', 'signature');

  if (typeof id === 'string' && id.length > 0) {
    const { error } = await supabase
      .from('templates')
      .update({ is_signature: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('kind', 'signature');
    if (error) return { error: error.message };
  }

  revalidatePath('/dashboard/templates');
  revalidatePath('/dashboard/posts/new');
  return { success: true };
}
