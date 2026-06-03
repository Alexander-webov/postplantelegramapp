'use client';

import { useMemo, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import type { UploadedMedia } from '@/components/dashboard/media-uploader';

/**
 * Safely render the subset of HTML Telegram supports into React nodes.
 * We parse with DOMParser (browser only) and walk the tree, keeping only an
 * allowlist of tags. Anything else is reduced to its text content, so a stray
 * tag can never break the layout or inject scripts.
 */
function renderTelegramHtml(input: string): ReactNode {
  if (!input) return null;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // SSR fallback: show as plain text.
    return input;
  }

  const doc = new DOMParser().parseFromString(input, 'text/html');
  let key = 0;

  const walk = (node: ChildNode): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(walk);
    const k = `n${key++}`;

    switch (tag) {
      case 'b':
      case 'strong':
        return <strong key={k}>{children}</strong>;
      case 'i':
      case 'em':
        return <em key={k}>{children}</em>;
      case 'u':
      case 'ins':
        return <u key={k}>{children}</u>;
      case 's':
      case 'strike':
      case 'del':
        return <s key={k}>{children}</s>;
      case 'code':
      case 'pre':
        return (
          <code key={k} className="rounded bg-black/10 px-1 font-mono text-[0.92em]">
            {children}
          </code>
        );
      case 'a':
        return (
          <span key={k} className="text-sky-600 underline-offset-2 hover:underline">
            {children}
          </span>
        );
      case 'blockquote':
        return (
          <blockquote key={k} className="my-1 border-l-2 border-sky-400/60 pl-2 text-foreground/90">
            {children}
          </blockquote>
        );
      case 'tg-spoiler':
      case 'span':
        if (tag === 'tg-spoiler' || el.className.includes('tg-spoiler')) {
          return (
            <span key={k} className="rounded bg-foreground/80 text-transparent transition-colors hover:bg-transparent hover:text-inherit">
              {children}
            </span>
          );
        }
        return <span key={k}>{children}</span>;
      case 'br':
        return <br key={k} />;
      default:
        return <span key={k}>{children}</span>;
    }
  };

  return Array.from(doc.body.childNodes).map(walk);
}

export function PostPreview({
  text,
  media,
  signature,
  channelTitle,
}: {
  text: string;
  media: UploadedMedia[];
  signature?: string | null;
  channelTitle?: string;
}) {
  const fullText = useMemo(() => {
    const sig = signature?.trim();
    if (sig) return text.trim() ? `${text}\n\n${sig}` : sig;
    return text;
  }, [text, signature]);

  const rendered = useMemo(() => renderTelegramHtml(fullText), [fullText]);
  const photos = media.filter((m) => m.preview_url);
  const isEmpty = !fullText.trim() && media.length === 0;

  const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Eye className="h-4 w-4" />
        Превью поста
      </div>

      {/* Telegram-like message bubble */}
      <div className="max-w-[420px] overflow-hidden rounded-xl rounded-tl-sm bg-[#f1f7f5] shadow-sm ring-1 ring-black/5 dark:bg-surface-sunken">
        <div className="px-3 pt-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
          {channelTitle || 'Ваш канал'}
        </div>

        {/* Media */}
        {photos.length > 0 && (
          <div
            className={
              photos.length === 1
                ? 'mt-1 px-1'
                : 'mt-1 grid grid-cols-2 gap-0.5 px-1'
            }
          >
            {photos.slice(0, 4).map((m, i) => (
              <div
                key={m.path}
                className="relative overflow-hidden rounded-md bg-black/5"
                style={{ aspectRatio: photos.length === 1 ? '4 / 3' : '1 / 1' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.preview_url ?? ''}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {m.kind === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center text-white/90">
                    <span className="rounded-full bg-black/50 px-2 py-1 text-xs">▶ видео</span>
                  </span>
                )}
                {i === 3 && photos.length > 4 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
                    +{photos.length - 4}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Text */}
        <div className="px-3 pb-1.5 pt-2">
          {isEmpty ? (
            <p className="text-sm italic text-muted-foreground">Пост пока пустой…</p>
          ) : (
            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">
              {rendered}
            </div>
          )}
          <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span>1</span>
            <span>{now}</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Примерно так пост увидят подписчики. Карточку-превью ссылки Telegram дорисует сам при отправке.
      </p>
    </div>
  );
}
