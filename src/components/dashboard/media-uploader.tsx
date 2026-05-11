'use client';

import { useState, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Image as ImageIcon, Video as VideoIcon, X, Upload, FileWarning } from 'lucide-react';
import { uploadMediaAction, deleteMediaAction } from '@/app/actions/media';

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
  /** Hard cap (default 10 — Telegram album limit). */
  maxItems?: number;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaUploader({ value, onChange, maxItems = 10 }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);

  // Album rule preview: animation alone in album is invalid
  const hasAnimation = value.some((v) => v.kind === 'animation');
  const albumWithAnimationWarning =
    hasAnimation && value.length > 1
      ? 'GIF/анимации нельзя в альбоме — оставь только один файл или убери GIF'
      : null;

  function pickFiles() {
    inputRef.current?.click();
  }

  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const result = await uploadMediaAction(fd);
    if ('error' in result) {
      toast.error(`${file.name}: ${result.error}`);
      return null;
    }
    return result;
  }

  function handleFiles(files: FileList | File[]) {
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

    startTransition(async () => {
      const uploaded: UploadedMedia[] = [];
      for (const f of toUpload) {
        const r = await uploadOne(f);
        if (r) uploaded.push(r);
      }
      if (uploaded.length > 0) {
        onChange([...value, ...uploaded]);
        toast.success(
          uploaded.length === 1 ? 'Файл загружен' : `Загружено: ${uploaded.length}`
        );
      }
    });
  }

  function removeAt(index: number) {
    const item = value[index];
    if (!item) return;
    // Optimistic UI removal; storage cleanup is best-effort
    const next = value.filter((_, i) => i !== index);
    onChange(next);

    const fd = new FormData();
    fd.append('path', item.path);
    deleteMediaAction(fd).catch(() => {
      // Non-fatal — orphan files in storage will be cleaned up later
      // (we'll add a retention job in the future)
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        onClick={pickFiles}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-accent/30'
        } ${pending ? 'pointer-events-none opacity-60' : ''}`}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium">
            {pending ? 'Загружаю…' : 'Перетащи файлы сюда'}
          </span>{' '}
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
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            // reset so the same file can be re-selected after removal
            e.target.value = '';
          }}
        />
      </div>

      {/* Hidden inputs that POST the storage paths back to the server action */}
      {value.map((m) => (
        <input key={m.path} type="hidden" name="media_paths" value={m.path} />
      ))}

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {value.map((item, i) => (
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

              {/* Position badge */}
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                #{i + 1}
              </span>

              {/* Kind + size */}
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {item.kind === 'photo' ? 'фото' : item.kind === 'video' ? 'видео' : 'GIF'} ·{' '}
                {humanSize(item.size)}
              </span>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeAt(i)}
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
