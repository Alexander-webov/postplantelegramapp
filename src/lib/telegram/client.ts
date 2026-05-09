import 'server-only';

/**
 * Minimal Telegram Bot API client used by Postplan.
 * Each method takes a bot token and returns the parsed result.
 * Errors throw with descriptive messages.
 */

const TG_API = 'https://api.telegram.org';

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function callJson<T>(token: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = (await res.json()) as TelegramResponse<T>;
  if (!data.ok || data.result === undefined) {
    throw new Error(`Telegram ${method} failed: ${data.description ?? 'unknown'}`);
  }
  return data.result;
}

async function callMultipart<T>(
  token: string,
  method: string,
  fields: Record<string, string>,
  files: { name: string; blob: Blob; filename: string }[]
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const f of files) form.append(f.name, f.blob, f.filename);
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
  });
  const data = (await res.json()) as TelegramResponse<T>;
  if (!data.ok || data.result === undefined) {
    throw new Error(`Telegram ${method} failed: ${data.description ?? 'unknown'}`);
  }
  return data.result;
}

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  description?: string;
}

export interface TelegramChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user: { id: number; username?: string; first_name: string };
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
}

export type MediaKind = 'photo' | 'video' | 'animation';

export interface MediaFile {
  kind: MediaKind;
  blob: Blob;
  filename: string;
}

export const telegram = {
  getMe: (token: string) => callJson<TelegramBotInfo>(token, 'getMe'),

  getChat: (token: string, chatId: string | number) =>
    callJson<TelegramChat>(token, 'getChat', { chat_id: chatId }),

  getChatMember: (token: string, chatId: string | number, userId: number) =>
    callJson<TelegramChatMember>(token, 'getChatMember', { chat_id: chatId, user_id: userId }),

  getChatMemberCount: (token: string, chatId: string | number) =>
    callJson<number>(token, 'getChatMemberCount', { chat_id: chatId }),

  sendMessage: (
    token: string,
    params: {
      chat_id: string | number;
      text: string;
      parse_mode?: 'HTML' | 'MarkdownV2';
      disable_web_page_preview?: boolean;
      disable_notification?: boolean;
      reply_markup?: { inline_keyboard: { text: string; url: string }[][] };
    }
  ) => callJson<{ message_id: number }>(token, 'sendMessage', params),

  // ---- Single media ----
  sendPhoto: (
    token: string,
    params: {
      chat_id: string | number;
      photo: Blob;
      filename: string;
      caption?: string;
      parse_mode?: 'HTML' | 'MarkdownV2';
      disable_notification?: boolean;
    }
  ) => {
    const fields: Record<string, string> = {
      chat_id: String(params.chat_id),
    };
    if (params.caption) fields.caption = params.caption;
    if (params.parse_mode) fields.parse_mode = params.parse_mode;
    if (params.disable_notification) fields.disable_notification = 'true';
    return callMultipart<{ message_id: number }>(token, 'sendPhoto', fields, [
      { name: 'photo', blob: params.photo, filename: params.filename },
    ]);
  },

  sendVideo: (
    token: string,
    params: {
      chat_id: string | number;
      video: Blob;
      filename: string;
      caption?: string;
      parse_mode?: 'HTML' | 'MarkdownV2';
      disable_notification?: boolean;
    }
  ) => {
    const fields: Record<string, string> = {
      chat_id: String(params.chat_id),
      supports_streaming: 'true',
    };
    if (params.caption) fields.caption = params.caption;
    if (params.parse_mode) fields.parse_mode = params.parse_mode;
    if (params.disable_notification) fields.disable_notification = 'true';
    return callMultipart<{ message_id: number }>(token, 'sendVideo', fields, [
      { name: 'video', blob: params.video, filename: params.filename },
    ]);
  },

  sendAnimation: (
    token: string,
    params: {
      chat_id: string | number;
      animation: Blob;
      filename: string;
      caption?: string;
      parse_mode?: 'HTML' | 'MarkdownV2';
      disable_notification?: boolean;
    }
  ) => {
    const fields: Record<string, string> = {
      chat_id: String(params.chat_id),
    };
    if (params.caption) fields.caption = params.caption;
    if (params.parse_mode) fields.parse_mode = params.parse_mode;
    if (params.disable_notification) fields.disable_notification = 'true';
    return callMultipart<{ message_id: number }>(token, 'sendAnimation', fields, [
      { name: 'animation', blob: params.animation, filename: params.filename },
    ]);
  },

  /**
   * Send 2-10 photos/videos as an album. Animations and documents cannot be in albums.
   * Caption goes on the first item.
   */
  sendMediaGroup: (
    token: string,
    params: {
      chat_id: string | number;
      media: { kind: 'photo' | 'video'; blob: Blob; filename: string }[];
      caption?: string;
      parse_mode?: 'HTML' | 'MarkdownV2';
      disable_notification?: boolean;
    }
  ) => {
    if (params.media.length < 2 || params.media.length > 10) {
      throw new Error('Альбом должен содержать от 2 до 10 файлов');
    }
    // Telegram expects a JSON array describing each media item;
    // each one references its file by attach://<name>.
    const mediaJson = params.media.map((m, i) => {
      const attachName = `file${i}`;
      const item: Record<string, unknown> = {
        type: m.kind,
        media: `attach://${attachName}`,
      };
      // Caption + parse_mode go on the FIRST item only
      if (i === 0 && params.caption) {
        item.caption = params.caption;
        if (params.parse_mode) item.parse_mode = params.parse_mode;
      }
      return item;
    });

    const fields: Record<string, string> = {
      chat_id: String(params.chat_id),
      media: JSON.stringify(mediaJson),
    };
    if (params.disable_notification) fields.disable_notification = 'true';

    const files = params.media.map((m, i) => ({
      name: `file${i}`,
      blob: m.blob,
      filename: m.filename,
    }));

    // Result is an array of messages, one per media item. We return both the
    // first message_id (for backwards compat) and the full array so callers
    // can record all ids — needed for auto-delete which must remove every
    // album member individually.
    return callMultipart<{ message_id: number }[]>(token, 'sendMediaGroup', fields, files).then(
      (msgs) => ({
        message_id: msgs[0]?.message_id ?? 0,
        message_ids: msgs.map((m) => m.message_id).filter((n) => typeof n === 'number'),
      })
    );
  },
};
