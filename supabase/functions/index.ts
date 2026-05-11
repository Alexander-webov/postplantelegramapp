// =============================================================================
// Postplan — publish-scheduled-posts Edge Function (v3: media + templates)
// =============================================================================
// Triggered every minute by cron-job.org. Picks all pending scheduled_posts
// whose scheduled_at <= now(), and for each:
//   - downloads any attached media from Storage
//   - resolves the post's applied_signature (if any)
//   - substitutes {{variables}} based on send time + channel context
//   - calls the right Telegram method (sendMessage / sendPhoto / sendVideo /
//     sendAnimation / sendMediaGroup)
//   - updates the row's status. Failed sends get retry-scheduled with backoff.
//
// Re-deploy after editing:
//   Dashboard → Edge Functions → publish-scheduled-posts → paste this file
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

// ---- Constants ------------------------------------------------------------
const BATCH_SIZE = 20;          // smaller batch since each can have media
const MAX_RETRIES = 5;
const TG_API = 'https://api.telegram.org';
const STORAGE_BUCKET = 'post-media';


function getSupabaseEnv() {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') ?? Deno.env.get('POSTPLAN_SUPABASE_URL');
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('POSTPLAN_SERVICE_ROLE_KEY');
  return { supabaseUrl, serviceKey };
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// ---- Types ----------------------------------------------------------------
type MediaKind = 'photo' | 'video' | 'animation';

interface PostMediaRow {
  storage_path: string;
  type: MediaKind;
  position: number;
}

interface ScheduledRow {
  id: string;
  user_id: string;
  post_id: string;
  channel_id: string;
  retry_count: number;
  custom_content: string | null;
  custom_disable_preview: boolean | null;
  custom_silent: boolean | null;
  auto_delete_after_hours: number | null;
  posts: {
    content: string;
    parse_mode: 'HTML' | 'MarkdownV2' | 'plain';
    disable_preview: boolean;
    silent: boolean;
    applied_signature_id: string | null;
    post_media: PostMediaRow[] | null;
  } | null;
  channels: {
    title: string;
    username: string | null;
    telegram_chat_id: string;
    bots: { token_encrypted: string | null } | { token_encrypted: string | null }[] | null;
  } | {
    title: string;
    username: string | null;
    telegram_chat_id: string;
    bots: { token_encrypted: string | null } | { token_encrypted: string | null }[] | null;
  }[] | null;
}

// ---- Template variable substitution (mirror of src/lib/templates.ts) ------
const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const RU_WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
];

function getTzParts(d: Date, tz: string): {
  year: string; month: string; day: string; hour: string; minute: string; weekday: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const wdShort = (parts.find((p) => p.type === 'weekday')?.value ?? 'Sun').slice(0, 3);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    weekday: map[wdShort] ?? 0,
  };
}

function applyTemplateVariables(
  content: string,
  ctx: {
    sendAt?: Date; timezone?: string;
    channelTitle?: string; channelUsername?: string | null;
  } = {}
): string {
  if (!content) return content;
  const sendAt = ctx.sendAt ?? new Date();
  const tz = ctx.timezone ?? 'Europe/Moscow';
  const channelTitle = ctx.channelTitle ?? '';
  const channelUsername = ctx.channelUsername ?? '';

  const parts = getTzParts(sendAt, tz);
  const dayInt = parseInt(parts.day, 10);
  const monthInt = parseInt(parts.month, 10);

  const dateLong = `${dayInt} ${RU_MONTHS[monthInt - 1]} ${parts.year}`;
  const dateShort = `${parts.day}.${parts.month}`;
  const time = `${parts.hour}:${parts.minute}`;
  const dayOfWeek = RU_WEEKDAYS[parts.weekday];

  return content
    .replace(/\{\{\s*date\s*\}\}/g, dateLong)
    .replace(/\{\{\s*date_short\s*\}\}/g, dateShort)
    .replace(/\{\{\s*time\s*\}\}/g, time)
    .replace(/\{\{\s*day_of_week\s*\}\}/g, dayOfWeek)
    .replace(/\{\{\s*channel_title\s*\}\}/g, channelTitle)
    .replace(/\{\{\s*channel_username\s*\}\}/g, () => {
      if (!channelUsername) return '';
      const clean = channelUsername.replace(/^@/, '');
      return `<a href="https://t.me/${clean}">@${clean}</a>`;
    });
}

function applySignature(
  content: string,
  signatureRaw: string | null | undefined,
  ctx: {
    sendAt?: Date; timezone?: string;
    channelTitle?: string; channelUsername?: string | null;
  } = {}
): string {
  if (!signatureRaw) return content;
  const sig = applyTemplateVariables(signatureRaw, ctx);
  if (!sig.trim()) return content;
  if (!content.trim()) return sig;
  return `${content}\n\n${sig}`;
}

// ---- AES-256-GCM decryption (mirror of src/lib/crypto.ts) -----------------
async function decryptToken(payload: string, keyB64: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  const data = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = data.slice(0, 12);
  const authTag = data.slice(12, 28);
  const ciphertext = data.slice(28);
  const ctWithTag = new Uint8Array(ciphertext.length + authTag.length);
  ctWithTag.set(ciphertext, 0);
  ctWithTag.set(authTag, ciphertext.length);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, cryptoKey, ctWithTag
  );
  return new TextDecoder().decode(plain);
}

// ---- Telegram send helpers ------------------------------------------------
async function tgCall<T>(token: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok || data.result === undefined) {
    throw new Error(`Telegram ${method}: ${data.description ?? 'unknown'}`);
  }
  return data.result as T;
}

async function tgMultipart<T>(
  token: string, method: string,
  fields: Record<string, string>,
  files: { name: string; blob: Blob; filename: string }[]
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const f of files) form.append(f.name, f.blob, f.filename);
  const res = await fetch(`${TG_API}/bot${token}/${method}`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok || data.result === undefined) {
    throw new Error(`Telegram ${method}: ${data.description ?? 'unknown'}`);
  }
  return data.result as T;
}

// ---- Send dispatcher ------------------------------------------------------
interface PreparedMedia {
  kind: MediaKind; blob: Blob; filename: string;
}

async function sendPost(params: {
  token: string; chatId: string; content: string;
  parseMode: 'HTML' | 'MarkdownV2' | 'plain';
  disablePreview: boolean; silent: boolean;
  media: PreparedMedia[];
}): Promise<number[]> {
  const tgParseMode = params.parseMode === 'plain' ? undefined : params.parseMode;

  if (params.media.length === 0) {
    const r = await tgCall<{ message_id: number }>(params.token, 'sendMessage', {
      chat_id: params.chatId,
      text: params.content,
      parse_mode: tgParseMode,
      disable_web_page_preview: params.disablePreview,
      disable_notification: params.silent,
    });
    return [r.message_id];
  }

  if (params.media.length === 1) {
    const m = params.media[0];
    const fields: Record<string, string> = { chat_id: params.chatId };
    if (params.content) fields.caption = params.content;
    if (tgParseMode) fields.parse_mode = tgParseMode;
    if (params.silent) fields.disable_notification = 'true';

    let method = 'sendPhoto';
    let fieldName = 'photo';
    if (m.kind === 'video') {
      method = 'sendVideo'; fieldName = 'video';
      fields.supports_streaming = 'true';
    } else if (m.kind === 'animation') {
      method = 'sendAnimation'; fieldName = 'animation';
    }

    const r = await tgMultipart<{ message_id: number }>(params.token, method, fields, [
      { name: fieldName, blob: m.blob, filename: m.filename },
    ]);
    return [r.message_id];
  }

  if (params.media.some((m) => m.kind === 'animation')) {
    throw new Error('GIF/анимации нельзя отправлять в альбоме');
  }
  const mediaJson = params.media.map((m, i) => {
    const item: Record<string, unknown> = {
      type: m.kind, media: `attach://file${i}`,
    };
    if (i === 0 && params.content) {
      item.caption = params.content;
      if (tgParseMode) item.parse_mode = tgParseMode;
    }
    return item;
  });
  const fields: Record<string, string> = {
    chat_id: params.chatId,
    media: JSON.stringify(mediaJson),
  };
  if (params.silent) fields.disable_notification = 'true';
  const files = params.media.map((m, i) => ({
    name: `file${i}`, blob: m.blob, filename: m.filename,
  }));
  const msgs = await tgMultipart<{ message_id: number }[]>(
    params.token, 'sendMediaGroup', fields, files
  );
  // Album: return ALL message ids so we can later delete them all.
  return msgs.map((m) => m.message_id).filter((id) => typeof id === 'number');
}

// ---- Retry backoff --------------------------------------------------------
function nextRetryAt(retryCount: number): string {
  const minutes = Math.min(60, 5 * Math.pow(2, retryCount));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

// ---- Main handler ---------------------------------------------------------
Deno.serve(async (_req) => {
  const { supabaseUrl, serviceKey } = getSupabaseEnv();
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!;

  if (!supabaseUrl || !serviceKey || !encryptionKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Missing env: Supabase URL, service role key, or ENCRYPTION_KEY',
        hint: 'Use built-in SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or custom POSTPLAN_SUPABASE_URL/POSTPLAN_SERVICE_ROLE_KEY',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const startedAt = Date.now();

  const { data: dueRows, error: selectErr } = await supabase
    .from('scheduled_posts')
    .select(
      `
      id, user_id, post_id, channel_id, retry_count,
      custom_content, custom_disable_preview, custom_silent,
      auto_delete_after_hours,
      posts (
        content, parse_mode, disable_preview, silent, applied_signature_id,
        post_media (storage_path, type, position)
      ),
      channels (title, username, telegram_chat_id, bots (token_encrypted))
      `
    )
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (selectErr) {
    console.error('Select failed:', selectErr);
    return new Response(JSON.stringify({ error: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = (dueRows ?? []) as unknown as ScheduledRow[];
  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, ms: Date.now() - startedAt }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const ids = rows.map((r) => r.id);
  await supabase.from('scheduled_posts').update({ status: 'processing' }).in('id', ids);

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const post = pickOne(row.posts as any) as ScheduledRow['posts'];
    const channel = pickOne(row.channels);
    const bot = pickOne(channel?.bots);

    if (!post || !channel || !bot?.token_encrypted) {
      await supabase
        .from('scheduled_posts')
        .update({ status: 'failed', error_message: 'Missing post/channel/bot relation' })
        .eq('id', row.id);
      failed++;
      continue;
    }

    try {
      const token = await decryptToken(bot.token_encrypted, encryptionKey);
      const rawContent = row.custom_content ?? post.content;
      const disablePreview = row.custom_disable_preview ?? post.disable_preview;
      const silent = row.custom_silent ?? post.silent;

      // Resolve signature template if specified
      let signatureContent: string | null = null;
      if (post.applied_signature_id) {
        const { data: sig } = await supabase
          .from('templates')
          .select('content')
          .eq('id', post.applied_signature_id)
          .eq('user_id', row.user_id)
          .eq('kind', 'signature')
          .single();
        if (sig) signatureContent = sig.content;
      }

      // Build context for variable substitution
      const ctx = {
        sendAt: new Date(),
        timezone: 'Europe/Moscow',
        channelTitle: channel.title,
        channelUsername: channel.username,
      };
      const contentWithVars = applyTemplateVariables(rawContent, ctx);
      const finalContent = applySignature(contentWithVars, signatureContent, ctx);

      // Pull media from Storage in attached order
      const mediaRows = (post.post_media ?? []).slice().sort(
        (a, b) => a.position - b.position
      );
      const media: PreparedMedia[] = [];
      for (const mr of mediaRows) {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(mr.storage_path);
        if (dlErr || !blob) {
          throw new Error(`Не удалось скачать медиа из Storage: ${mr.storage_path}. ${dlErr?.message ?? 'Файл не найден или недоступен'}`);
        }
        media.push({
          kind: mr.type,
          blob,
          filename: mr.storage_path.split('/').pop() ?? 'file',
        });
      }

      const messageIds = await sendPost({
        token,
        chatId: channel.telegram_chat_id,
        content: finalContent,
        parseMode: post.parse_mode,
        disablePreview,
        silent,
        media,
      });

      const now = new Date();
      const sentAtIso = now.toISOString();
      // Compute auto_delete_at if requested. Stored as timestamptz UTC.
      const autoDeleteAt = row.auto_delete_after_hours
        ? new Date(now.getTime() + row.auto_delete_after_hours * 60 * 60 * 1000).toISOString()
        : null;

      await supabase
        .from('scheduled_posts')
        .update({
          status: 'sent',
          telegram_message_id: messageIds[0] ?? null,
          telegram_message_ids: messageIds,
          sent_at: sentAtIso,
          auto_delete_at: autoDeleteAt,
          error_message: null,
        })
        .eq('id', row.id);

      await supabase
        .from('posts')
        .update({ status: 'published' })
        .eq('id', row.post_id)
        .eq('status', 'scheduled');

      sent++;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'unknown error';
      const newRetryCount = row.retry_count + 1;

      if (newRetryCount >= MAX_RETRIES) {
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            retry_count: newRetryCount,
            error_message: errMsg,
          })
          .eq('id', row.id);
        await supabase
          .from('posts')
          .update({ status: 'failed' })
          .eq('id', row.post_id)
          .eq('status', 'scheduled');
      } else {
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            error_message: errMsg,
            next_retry_at: nextRetryAt(newRetryCount),
            scheduled_at: nextRetryAt(newRetryCount),
          })
          .eq('id', row.id);
      }
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true, processed: rows.length, sent, failed,
      ms: Date.now() - startedAt,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
