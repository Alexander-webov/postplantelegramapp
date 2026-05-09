# Постплан

Планировщик постов для Telegram-каналов с CRM рекламодателей. Один кабинет — все каналы.
Расписание до 3 месяцев, шаблоны, кросспостинг, авто-удаление, аналитика просмотров, автоотчёты для рекламодателей.

**Production:** [postplan.app](https://postplan.app) (после деплоя)

## Стек

- **Next.js 14** (App Router) + TypeScript + Tailwind + shadcn/ui
- **Supabase** — Postgres + Auth + Storage + Edge Functions
- **YooKassa** — оплата подписок (рубли, поддержка СБП и российских карт)
- **SendPulse** — SMTP для писем регистрации/восстановления пароля
- **Railway** — хостинг приложения (Docker)
- **cron-job.org** — внешний планировщик для дёрганья Edge Functions каждую минуту
- **Telegram Bot API** — доставка постов (без userbot, без рисков банов)

## Запуск в production

См. **[DEPLOY.md](./DEPLOY.md)** — пошаговая инструкция от Supabase миграций до подключения домена.
См. **[ENV.md](./ENV.md)** — все переменные окружения.

## Локальная разработка

```bash
npm install
cp .env.example .env.local        # заполни реальными ключами
npm run dev                        # http://localhost:3000
```

## Архитектура

### Модель данных


```
profiles ── bots ── channels
   │                    │
   │                    └─→ channel_analytics (daily snapshots)
   │
   ├─→ templates
   │
   └─→ posts ── post_media
              ├─ post_buttons
              ├─ post_polls
              └─ scheduled_posts (queue: post × channel × time)
                       └─→ post_analytics (engagement snapshots)
```

Ключевая идея: `posts` — это контент. `scheduled_posts` — это «контент в канал X в момент Y». Один пост → N очередей.

### Воркер публикации

[cron-job.org](https://cron-job.org) (бесплатный внешний сервис) каждую минуту делает HTTP POST к Edge Function `publish-scheduled-posts` в Supabase:

```
SELECT * FROM scheduled_posts
WHERE scheduled_at <= NOW()
  AND status = 'pending'
ORDER BY scheduled_at ASC
LIMIT 50;
```

Для каждой записи: статус → `processing`, шлём в Telegram, обновляем `telegram_message_id`/`status='sent'`. При ошибке — `retry_count++`, экспоненциальный backoff (5min × 2^retry, max 1h). После 5 ретраев — `status='failed'`.

Полный гайд по подъёму шедулера — в [SCHEDULER.md](./SCHEDULER.md). Никакого CLI не требуется, всё через Dashboard и веб-интерфейс cron-job.org.

## Setup

### 1. Установка зависимостей

```bash
npm install
```

### 2. Supabase проект

1. Создай проект на [supabase.com](https://supabase.com)
2. В **SQL Editor** выполни `supabase/migrations/001_initial_schema.sql`
3. В **Storage** создай bucket `post-media` (private), накати политики из комментариев в конце миграции
4. В **Settings → API** скопируй `URL`, `anon key`, `service_role key`

### 3. Environment

```bash
cp .env.example .env.local
```

Заполни:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — из шага 2
- `ENCRYPTION_KEY` — сгенерируй через `openssl rand -base64 32`
- Остальные (YooKassa, Stripe, Groq) — добавишь по мере подключения фич

### 4. Регенерация типов БД

После миграции:

```bash
npx supabase login
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

### 5. Запуск

```bash
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000).

### 6. shadcn/ui компоненты

Базовый набор:

```bash
npx shadcn@latest add button input label dialog dropdown-menu select switch tabs toast tooltip card form
```

## Тарифы

| План | Цена | Каналы | Постов/мес | Кросспостинг | Шаблоны |
|------|------|--------|-----------|--------------|---------|
| Free | 0₽ | 1 | 10 | — | — |
| Базовый | 299₽/мес | 5 | ∞ | до 3 каналов | ∞ |
| Профи | 690₽/мес | 50 | ∞ | до 50 каналов | ∞ |

Без триала — новые юзеры начинают с Free, апгрейд опциональный.

**AI (когда сделаем) — BYOK:** юзер подключает свой ключ OpenAI / Anthropic / DeepSeek / GigaChat / YandexGPT. Постплан не платит за токены, юзер платит провайдеру напрямую. Это значит AI-фичи доступны на всех тарифах включая Free, а тариф платится за сам сервис (каналы, очередь, шедулер, шаблоны, кросспостинг).

## Roadmap

### MVP (4-6 недель)

- [x] Схема БД + RLS
- [x] Скаффолд проекта, Supabase clients, middleware
- [x] Auth (signup, login, logout)
- [x] Дашборд-shell (сайдбар, навигация)
- [x] Подключение бота через токен @BotFather + детект каналов
- [x] Композер: текст с HTML-форматированием
- [x] Расписание (datetime picker + до 3 месяцев)
- [x] Воркер публикации (Supabase Edge Function + cron-job.org) — см. [SCHEDULER.md](./SCHEDULER.md)
- [x] Поддержка часовых поясов в композере
- [x] Страница очереди + отмена
- [x] Медиа: фото/видео/GIF/альбомы
- [ ] Inline-кнопки, опросы
- [x] Кросспостинг (один пост → N каналов с раздельным контентом, лимит по тарифу)
- [x] Шаблоны (подписи, готовые посты, наборы хештегов с переменными)
- [x] Лимиты по тарифам (UI + enforcement в server actions)
- [x] YooKassa (создание платежей + webhook + история) — см. [BILLING.md](./BILLING.md)
- [ ] Stripe (международные карты)
- [ ] Recurring / автопродление (пока ручное продление через email-напоминание)
- [ ] Лимиты по тарифам

### Phase 2 — Revenue OS (для рекламных каналов)

Дифференциация Постплана от массовых планировщиков (SmmPlanner и др.) — фокус на то, чего нет нигде: автоматизация продажи рекламы и контроля рекламных постов.

- [x] **Авто-удаление постов через N часов** — критично для рекламы, никто из массовых конкурентов не делает
- [x] **Аналитика просмотров через Bot API** (1ч/6ч/24ч/48ч после публикации, ручное обновление)
- [x] **CRM рекламодателей — карточки и история** (батч 1: список, CRUD, страница рекламодателя)
- [x] **CRM — привязка рекламодателя к посту в композере** + цена + статус оплаты, бейдж в очереди (батч 2)
- [x] **CRM — автоотчёт после публикации** — публичная брендированная страница `/r/<slug>` + кнопка отправки в Telegram (батч 3)

### Phase 3 — Полировка

- [ ] Inline-кнопки, опросы
- [ ] Stripe (международные карты)
- [ ] Recurring / автопродление подписок
- [ ] Команды и роли (editor, copywriter, approval flow)
- [ ] Recurring посты (повторяющиеся)
- [ ] AI BYOK (генерация, переводы, переписывание)

### Phase 4 — Network mode

- [ ] Массовые операции по 20+ каналам
- [ ] A/B тесты
- [ ] Лучшее время публикации (на основе своих данных)
- [ ] Recycling старых постов
- [ ] Telegram mini-app

## Структура проекта

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # login, signup, password reset
│   ├── (dashboard)/        # protected routes
│   ├── api/                # webhooks, edge-trigger endpoints
│   ├── layout.tsx
│   └── page.tsx            # landing
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── dashboard/          # cabinet components
│   └── landing/            # marketing components
├── lib/
│   ├── supabase/           # client/server/middleware
│   ├── telegram/           # Bot API thin client
│   ├── crypto.ts           # AES-256-GCM for bot tokens
│   └── utils.ts
├── types/
│   └── database.ts         # Supabase-generated types
└── middleware.ts           # auth & route protection

supabase/
├── migrations/             # versioned SQL
└── functions/
    └── publish-scheduled-posts/   # cron worker (next iteration)
```

## Безопасность

- Все таблицы под **RLS** — юзер видит только своё.
- Токены ботов шифруются **AES-256-GCM** через `ENCRYPTION_KEY` перед записью в БД. В БД никогда не лежит plaintext-токен.
- `service_role` ключ используется только в server-only коде (webhook handlers, воркер).
- Storage с приватным bucket'ом, доступ по signed URLs или RLS-проверкам по `auth.uid()`.

## Лицензия

Proprietary. Все права у автора.
