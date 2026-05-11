'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/helpers';
import {
  classifyMime,
  maxBytesFor,
  humanSize,
} from '@/lib/telegram/media';

export type UploadResult =
  | { error: string }
  | {
      path: string;
      kind: 'photo' | 'video' | 'animation';
      mime: string;
      size: number;
      filename: string;
      preview_url: string | null;
    };

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

/**
 * Receives a single file from the composer and uploads it to Supabase Storage
 * under <user_id>/<random>.<ext>. Returns the storage path that the form will
 * later submit alongside the post text.
 */
export async function uploadMediaAction(formData: FormData): Promise<UploadResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: 'Сессия истекла. Войди заново и повтори загрузку.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { error: 'Файл не получен' };
  }

  // Type & size guards
  if (!ALLOWED_MIMES.has(file.type)) {
    return {
      error: `Неподдерживаемый тип файла: ${file.type}. Разрешены: JPG, PNG, WebP, GIF, MP4, MOV, WebM`,
    };
  }

  const kind = classifyMime(file.type);
  if (!kind) return { error: 'Не удалось определить тип файла' };

  const maxBytes = maxBytesFor(kind);
  if (file.size > maxBytes) {
    return {
      error: `Файл слишком большой (${humanSize(file.size)}). Максимум для ${
        kind === 'photo' ? 'фото' : kind === 'video' ? 'видео' : 'GIF'
      }: ${humanSize(maxBytes)}`,
    };
  }

  // Build path: <user_id>/<timestamp>-<random>.<ext>
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin';
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;
  const path = `${user.id}/${filename}`;

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient()
    : await createClient();

  const { error: uploadErr } = await supabase.storage
    .from('post-media')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return { error: `Не удалось загрузить: ${uploadErr.message}` };
  }

  // Generate a short-lived signed URL for the preview thumbnail in the composer.
  let preview_url: string | null = null;
  const { data: signed, error: signedErr } = await supabase.storage
    .from('post-media')
    .createSignedUrl(path, 60 * 60);

  if (!signedErr) {
    preview_url = signed?.signedUrl ?? null;
  }

  return {
    path,
    kind,
    mime: file.type,
    size: file.size,
    filename: file.name,
    preview_url,
  };
}

/**
 * Removes a single uploaded file from Storage. Used when the user clicks the
 * "remove" X on a thumbnail before sending the post.
 */
export async function deleteMediaAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Сессия истекла' };

  const path = formData.get('path');
  if (typeof path !== 'string' || !path) return { error: 'Путь не указан' };

  if (!path.startsWith(`${user.id}/`)) {
    return { error: 'Нельзя удалить чужой файл' };
  }

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient()
    : await createClient();
  const { error } = await supabase.storage.from('post-media').remove([path]);
  if (error) return { error: error.message };
  return { success: true };
}
