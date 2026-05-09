import 'server-only';

import { telegram, type MediaKind } from '@/lib/telegram/client';

// ----------------------------------------------------------------------------
// Telegram Bot API limits (https://core.telegram.org/bots/api#sending-files)
//   Photos: up to 10 MB
//   Other (video/animation/document): up to 50 MB
//   Album: 2-10 items, photos+videos can mix; animations cannot be in albums
// ----------------------------------------------------------------------------
export const TG_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const TG_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const ALBUM_MAX_ITEMS = 10;
export const ALBUM_MIN_ITEMS = 2;

/** Classify a MIME type into Telegram's media taxonomy. */
export function classifyMime(mime: string): MediaKind | null {
  if (mime === 'image/gif') return 'animation';
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

export function maxBytesFor(kind: MediaKind): number {
  if (kind === 'photo') return TG_PHOTO_MAX_BYTES;
  return TG_VIDEO_MAX_BYTES;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface PreparedMedia {
  kind: MediaKind;
  blob: Blob;
  filename: string;
  size: number;
}

/**
 * Validate a list of media items for sending as a single Telegram message
 * (text-only, single media, or album). Returns an error string or null.
 */
export function validateMediaSet(items: PreparedMedia[]): string | null {
  if (items.length === 0) return null;

  // Per-file size check (defence in depth — client already validates)
  for (const m of items) {
    const max = maxBytesFor(m.kind);
    if (m.size > max) {
      return `${m.filename}: превышен лимит ${humanSize(max)} для ${m.kind}`;
    }
  }

  if (items.length === 1) return null;

  // Album rules
  if (items.length > ALBUM_MAX_ITEMS) {
    return `В альбоме максимум ${ALBUM_MAX_ITEMS} файлов`;
  }

  // Animations cannot be in albums
  const hasAnimation = items.some((m) => m.kind === 'animation');
  if (hasAnimation && items.length > 1) {
    return 'GIF/анимации нельзя отправлять в альбоме — только по одной';
  }

  return null;
}

/**
 * Dispatch the right Telegram method for a given content + media set.
 *
 *  - 0 media + text  -> sendMessage
 *  - 1 media + (caption optional) -> sendPhoto/Video/Animation
 *  - 2-10 media -> sendMediaGroup (caption on first item)
 *
 * Returns the message_id of the (first) sent message.
 */
export async function sendPostToTelegram(params: {
  token: string;
  chatId: string | number;
  content: string;
  parseMode: 'HTML' | 'MarkdownV2' | 'plain';
  disablePreview: boolean;
  silent: boolean;
  media: PreparedMedia[];
}): Promise<number[]> {
  const validationError = validateMediaSet(params.media);
  if (validationError) throw new Error(validationError);

  const tgParseMode = params.parseMode === 'plain' ? undefined : params.parseMode;

  // No media → plain text
  if (params.media.length === 0) {
    const r = await telegram.sendMessage(params.token, {
      chat_id: params.chatId,
      text: params.content,
      parse_mode: tgParseMode,
      disable_web_page_preview: params.disablePreview,
      disable_notification: params.silent,
    });
    return [r.message_id];
  }

  // Single media
  if (params.media.length === 1) {
    const m = params.media[0];
    const common = {
      chat_id: params.chatId,
      caption: params.content || undefined,
      parse_mode: tgParseMode,
      disable_notification: params.silent,
      filename: m.filename,
    };
    if (m.kind === 'photo') {
      const r = await telegram.sendPhoto(params.token, { ...common, photo: m.blob });
      return [r.message_id];
    }
    if (m.kind === 'video') {
      const r = await telegram.sendVideo(params.token, { ...common, video: m.blob });
      return [r.message_id];
    }
    // animation (GIF)
    const r = await telegram.sendAnimation(params.token, { ...common, animation: m.blob });
    return [r.message_id];
  }

  // Album (2-10 photos/videos, no animations — already validated)
  const albumItems = params.media.map((m) => ({
    kind: m.kind as 'photo' | 'video',
    blob: m.blob,
    filename: m.filename,
  }));
  const r = await telegram.sendMediaGroup(params.token, {
    chat_id: params.chatId,
    media: albumItems,
    caption: params.content || undefined,
    parse_mode: tgParseMode,
    disable_notification: params.silent,
  });
  // Return all album message ids so the caller can record them for auto-delete
  return r.message_ids && r.message_ids.length > 0 ? r.message_ids : [r.message_id];
}
