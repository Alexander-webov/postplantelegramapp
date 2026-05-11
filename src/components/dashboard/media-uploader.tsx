'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Upload,
  FileWarning,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface UploadedMedia {
  path: string;
  kind: 'photo' | 'video' | 'animation';
  mime: string;
  size: number;
  filename: string;
  preview_url: string | null;
}

interface MediaUploaderProps {
  value: UploadedMedia[];
  onChange: (next: UploadedMedia[]) => void;
  /** Hard cap. Telegram album limit is 10. */
  maxItems?: number;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const ANIMATION_MAX_BYTES = 50 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function classifyMime(mime: string): UploadedMedia['kind'] | null {
  if (mime === 'image/gif') return 'animation';
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

function maxBytesFor(kind: UploadedMedia['kind']): number {
  if (kind === 'photo') return PHOTO_MAX_BYTES;
  if (kind === 'animation') return ANIMATION_MAX_BYTES;
  return VIDEO_MAX_BYTES;
}

function getSafeExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin';
}

type ValidationResult =
  | { ok: true; kind: UploadedMedia['kind'] }
  | { ok: false; error: string };

function validateFile(file: File): ValidationResult {
  if (!ALLOWED_MIMES.has(file.type)) {
    return {
      ok: false,
      error: `Неподдерживаемый тип файла: ${file.type || 'неизвестно'}. Разрешены: JPG, PNG, WebP, GIF, MP4, MOV, WebM`,
    };
  }

  const kind = classifyMime(file.type);
  if (!kind) return { ok: false, error: 'Не удалось определить тип файла' };

  const maxBytes = maxBytesFor(kind);
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `Файл слишком большой (${humanSize(file.size)}). Максимум: ${humanSize(maxBytes)}`,
    };
  }

  return { ok: true, kind };
}

export function MediaUploader({ value, onChange, maxItems = 10 }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const hasAnimation = value.some((v) => v.kind === 'animation');
  const albumWithAnimationWarning =
    hasAnimation && value.length > 1
      ? 'GIF/анимации нельзя в альбоме — оставь только один файл или убери GIF'
      : null;

  function pickFiles() {
    if (!uploading) inputRef.current?.click();
  }

  async function uploadOne(file: File): Promise<UploadedMedia | null> {
    const validation = validateFile(file);
    if (!validation.ok) {
      toast.error(`${file.name}: ${validation.error}`);
      return null;
    }
    const { kind } = validation;

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      toast.error('Сессия истекла. Войди заново и повтори загрузку.');
      return null;
    }

    const ext = getSafeExt(file.name);
    const storageName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const path = `${user.id}/${storageName}`;

    const { error: uploadError } = await supabase.storage.from('post-media').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Media upload failed:', uploadError);
      toast.error(`${file.name}: не удалось загрузить (${uploadError.message})`);
      return null;
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('post-media')
      .createSignedUrl(path, 60 * 60);

    if (signedError) {
      console.warn('Preview signed URL failed:', signedError);
    }

    return {
      path,
      kind,
      mime: file.type,
      size: file.size,
      filename: file.name,
      preview_url: signed?.signedUrl ?? null,
    };
  }

  async function handleFiles(files: FileList | File[]) {
    if (uploading) return;

    const arr = Array.from(files);
    if (arr.length === 0) return;

    const remaining = maxItems - value.length;
    if (remaining <= 0) {
      toast.error(`Максимум ${maxItems} файлов`);
      return;
    }

    const toUpload = arr.slice(0, remaining);
    if (arr.length > remaining) {
      toast.warning(`Загружу только ${remaining} из ${arr.length} (лимит ${maxItems})`);
    }

    setUploading(true);

    try {
      const uploaded: UploadedMedia[] = [];

      for (const file of toUpload) {
        const result = await uploadOne(file);
        if (result) uploaded.push(result);
      }

      if (uploaded.length > 0) {
        onChange([...value, ...uploaded]);
        toast.success(uploaded.length === 1 ? 'Файл загружен' : `Загружено: ${uploaded.length}`);
      }
    } catch (error) {
      console.error('Unexpected media upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
      setDragActive(false);
    }
  }

  async function removeAt(index: number) {
    const item = value[index];
    if (!item) return;

    onChange(value.filter((_, i) => i !== index));

    const supabase = createClient();
    const { error } = await supabase.storage.from('post-media').remove([item.path]);

    if (error) {
      console.warn('Media delete failed:', error);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.length) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={pickFiles}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') pickFiles();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-accent/30'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium">{uploading ? 'Загружаю…' : 'Перетащи файлы сюда'}</span>{' '}
          <span className="text-muted-foreground">или нажми чтобы выбрать</span>
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP, GIF до 10 MB · MP4, MOV, WebM до 50 MB · до {maxItems} файлов
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {value.map((media) => (
        <input key={media.path} type="hidden" name="media_paths" value={media.path} />
      ))}

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {value.map((item, index) => (
            <div
              key={item.path}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              {item.kind === 'photo' || item.kind === 'animation' ? (
                item.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.preview_url}
                    alt={item.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                  <VideoIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="line-clamp-2 break-all text-center text-[10px] text-muted-foreground">
                    {item.filename}
                  </span>
                </div>
              )}

              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                #{index + 1}
              </span>

              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {item.kind === 'photo' ? 'фото' : item.kind === 'video' ? 'видео' : 'GIF'} ·{' '}
                {humanSize(item.size)}
              </span>

              <button
                type="button"
                onClick={() => void removeAt(index)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition hover:bg-destructive group-hover:opacity-100"
                aria-label="Удалить"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {albumWithAnimationWarning && (
        <p className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <FileWarning className="h-4 w-4 shrink-0" />
          {albumWithAnimationWarning}
        </p>
      )}

      {value.length >= 2 && !hasAnimation && (
        <p className="text-xs text-muted-foreground">
          {value.length} файлов → отправится как альбом. Подпись из текста поста ставится только на первое медиа.
        </p>
      )}
    </div>
  );
}
