'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import {
  classifyMime,
  maxBytesFor,
  humanSize,
  TG_PHOTO_MAX_BYTES,
  TG_VIDEO_MAX_BYTES,
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
 * later submit alongside the post text. RLS guarantees the user can only upload
 * into their own folder.
 */
export async function uploadMediaAction(formData: FormData): Promise<UploadResult> {
  const user = await requireUser();

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

  const supabase = await createClient();
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
  // The form just needs to display the file the user just picked.
  let preview_url: string | null = null;
  const { data: signed } = await supabase.storage
    .from('post-media')
    .createSignedUrl(path, 60 * 60); // 1 hour
  preview_url = signed?.signedUrl ?? null;

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
 * "remove" X on a thumbnail before sending the post. RLS scopes by user_id
 * folder, so users can only delete their own files.
 */
export async function deleteMediaAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  await requireUser();
  const path = formData.get('path');
  if (typeof path !== 'string' || !path) return { error: 'Путь не указан' };

  const supabase = await createClient();
  const { error } = await supabase.storage.from('post-media').remove([path]);
  if (error) return { error: error.message };
  return { success: true };
}
