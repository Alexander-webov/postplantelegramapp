import { z } from 'zod';

// ---- Auth ----
export const signupSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  full_name: z.string().min(1, 'Укажите имя').max(100).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---- Bots ----
// Telegram bot tokens look like: 1234567890:AAH-XXXXXXXXXXXXXXXXXXXXXX
export const botTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(
      /^\d{6,12}:[A-Za-z0-9_-]{30,}$/,
      'Неверный формат токена. Должно быть как "1234567890:AAH-..."'
    ),
});
export type BotTokenInput = z.infer<typeof botTokenSchema>;

// ---- Channels ----
export const addChannelSchema = z.object({
  bot_id: z.string().uuid('Выберите бота'),
  username_or_id: z
    .string()
    .trim()
    .min(2, 'Укажите канал')
    .refine(
      (v) => v.startsWith('@') || /^-?\d+$/.test(v),
      'Введите @username канала или числовой chat_id'
    ),
});
export type AddChannelInput = z.infer<typeof addChannelSchema>;

// Reusable validator: 1-720 hours (= up to 30 days). null = no auto-delete.
const autoDeleteAfterHours = z
  .number()
  .int()
  .min(1, 'Минимум 1 час')
  .max(720, 'Максимум 30 дней (720 часов)')
  .nullable()
  .optional();

// ---- Quick post (send now) ----
// Content can be empty when media is attached; the server action validates
// that at least one of (content, media) is present.
// channel_ids is an array — one entry = one target channel. The action loops
// over them, doing one Telegram send per channel.
export const quickPostSchema = z.object({
  channel_ids: z
    .array(z.string().uuid())
    .min(1, 'Выберите хотя бы один канал')
    .max(50, 'Слишком много каналов в одном кросспостинге'),
  content: z.string().max(4096, 'Максимум 4096 символов в Telegram'),
  disable_preview: z.boolean().optional().default(false),
  silent: z.boolean().optional().default(false),
  /** Optional per-channel content override. Key = channel_id, value = custom text. */
  custom_contents: z.record(z.string(), z.string().max(4096)).optional(),
  /** Auto-delete after N hours from publication. null = disabled. */
  auto_delete_after_hours: autoDeleteAfterHours,
});
export type QuickPostInput = z.infer<typeof quickPostSchema>;

// ---- Schedule post ----
// scheduled_at must be in the future and at most 3 months ahead.
export const schedulePostSchema = z.object({
  channel_ids: z
    .array(z.string().uuid())
    .min(1, 'Выберите хотя бы один канал')
    .max(50, 'Слишком много каналов в одном кросспостинге'),
  content: z.string().max(4096, 'Максимум 4096 символов в Telegram'),
  disable_preview: z.boolean().optional().default(false),
  silent: z.boolean().optional().default(false),
  custom_contents: z.record(z.string(), z.string().max(4096)).optional(),
  auto_delete_after_hours: autoDeleteAfterHours,
  scheduled_at: z
    .string()
    .min(1, 'Укажите дату и время')
    .refine(
      (v) => !Number.isNaN(Date.parse(v)),
      'Неверный формат даты'
    )
    .refine((v) => {
      const t = Date.parse(v);
      // 60s grace to forgive small clock skew between client and server
      return t > Date.now() - 60_000;
    }, 'Дата должна быть в будущем')
    .refine((v) => {
      const t = Date.parse(v);
      const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
      return t <= Date.now() + threeMonthsMs;
    }, 'Не дальше чем на 3 месяца вперёд'),
});
export type SchedulePostInput = z.infer<typeof schedulePostSchema>;

// ---- Update existing scheduled post — single channel only (no crosspost editing for now) ----
export const updateScheduledSchema = z.object({
  scheduled_post_id: z.string().uuid(),
  channel_id: z.string().uuid('Выберите канал'),
  content: z.string().max(4096, 'Максимум 4096 символов в Telegram'),
  disable_preview: z.boolean().optional().default(false),
  silent: z.boolean().optional().default(false),
  auto_delete_after_hours: autoDeleteAfterHours,
  scheduled_at: z
    .string()
    .min(1, 'Укажите дату и время')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Неверный формат даты')
    .refine((v) => Date.parse(v) > Date.now() - 60_000, 'Дата должна быть в будущем')
    .refine(
      (v) => Date.parse(v) <= Date.now() + 90 * 24 * 60 * 60 * 1000,
      'Не дальше чем на 3 месяца вперёд'
    ),
});

// ---- Cancel scheduled post ----
export const cancelScheduledSchema = z.object({
  scheduled_post_id: z.string().uuid(),
});

// ---- Templates ----
export const templateKindSchema = z.enum(['signature', 'post', 'hashtags']);
export type TemplateKind = z.infer<typeof templateKindSchema>;

export const upsertTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  kind: templateKindSchema,
  name: z.string().trim().min(1, 'Укажи название').max(100, 'Слишком длинное название'),
  content: z.string().max(4096, 'Содержимое слишком длинное'),
  is_signature: z.boolean().optional().default(false),
});
export type UpsertTemplateInput = z.infer<typeof upsertTemplateSchema>;

export const deleteTemplateSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// Advertisers CRM
// ============================================================================

export const placementStatusSchema = z.enum([
  'draft',
  'awaiting_payment',
  'paid',
  'published',
  'reported',
  'cancelled',
]);
export type PlacementStatus = z.infer<typeof placementStatusSchema>;

export const upsertAdvertiserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Имя обязательно').max(120, 'Слишком длинное имя'),
  // Trim + strip leading @ to keep storage normalised
  telegram_username: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v.replace(/^@+/, '') : v))
    .or(z.literal('')),
  contact: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type UpsertAdvertiserInput = z.infer<typeof upsertAdvertiserSchema>;

export const deleteAdvertiserSchema = z.object({
  id: z.string().uuid(),
});

export const archiveAdvertiserSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});

// ---- Ad placement attached to a post ----
// Used by composer: when user creates/schedules a post they can ALSO mark it
// as an ad and link to an advertiser. Sent as part of the same FormData.
export const placementAttachmentSchema = z.object({
  // Both null → no ad placement, this is organic content
  // advertiser_id set + price > 0 → placement is created
  advertiser_id: z.string().uuid().optional().nullable(),
  price_rub: z
    .number()
    .min(0, 'Цена не может быть отрицательной')
    .max(99999999, 'Слишком большая сумма')
    .optional()
    .nullable(),
  format: z.string().trim().max(50).optional().nullable(),
  status: placementStatusSchema.optional().default('draft'),
});
export type PlacementAttachment = z.infer<typeof placementAttachmentSchema>;
