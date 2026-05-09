# Деплой Постплана на Railway — пошагово

Следуй этому списку по порядку. Если зависнешь на каком-то шаге — это место и есть проблема.

---

## Шаг 0: Перед началом

Что должно быть готово:

- [ ] Домен зарегистрирован (например `postplan.app`)
- [ ] Доступ к DNS-настройкам домена
- [ ] Аккаунт в Supabase с проектом `btzmnoikreazmykrsvos` (или твой)
- [ ] Аккаунт в YooKassa с активным магазином (или тестовый)
- [ ] Аккаунт в SendPulse с верифицированным доменом
- [ ] Аккаунт в Railway

---

## Шаг 1: Накати все миграции в Supabase

**Порядок важен!** Каждая миграция — отдельный SQL Editor запрос.

```
001_initial_schema.sql           ← Run
002_storage_bucket.sql           ← Run
003_templates.sql                ← Run
004_edits.sql                    ← Run
005a_billing_enum.sql            ← Run (отдельно из-за enum)
005b_billing_tables.sql          ← Run
006_auto_delete.sql              ← Run
007_analytics.sql                ← Run
008a_placement_status_enum.sql   ← Run (отдельно из-за enum)
008b_advertisers_tables.sql      ← Run
009_placement_reports.sql        ← Run
```

Проверь: Supabase Dashboard → Table Editor → должны появиться таблицы `profiles`, `channels`, `bots`, `posts`, `scheduled_posts`, `templates`, `signatures`, `payments`, `advertisers`, `ad_placements`, `post_edits`.

---

## Шаг 2: Залей Edge Functions

Supabase Dashboard → Edge Functions → **+ Deploy a new function** для каждой:

| Имя                       | Что делает                         | Verify JWT |
| ------------------------- | ---------------------------------- | ---------- |
| `publish-scheduled-posts` | Публикует посты по расписанию      | OFF        |
| `delete-expired-posts`    | Удаляет посты после auto_delete_at | OFF        |
| `update-views`            | Снимает просмотры на 1ч/6ч/24ч/48ч | OFF        |

Код каждой — копируй из соответствующих файлов в `supabase/functions/<name>/index.ts`.

После деплоя каждой функции — открой её Settings → убедись что **Verify JWT: OFF**.

### Edge Function Secrets

Edge Functions → **Secrets** → добавь:

- `ENCRYPTION_KEY` = твой base64-ключ (тот же что в Railway)

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` инжектируются Supabase автоматически — добавлять не нужно.

---

## Шаг 3: Настрой 3 cron-job'а на cron-job.org

Зарегистрируйся на [cron-job.org](https://cron-job.org), создай 3 cron'а:

| #   | Title                | URL                                                                             |
| --- | -------------------- | ------------------------------------------------------------------------------- |
| 1   | Postplan publisher   | `https://btzmnoikreazmykrsvos.supabase.co/functions/v1/publish-scheduled-posts` |
| 2   | Postplan auto-delete | `https://btzmnoikreazmykrsvos.supabase.co/functions/v1/delete-expired-posts`    |
| 3   | Postplan views       | `https://btzmnoikreazmykrsvos.supabase.co/functions/v1/update-views`            |

Все три:

- **Schedule:** Every 1 minute
- **Method:** POST
- **Headers:** ❌ ничего не нужно (Verify JWT OFF в функциях)

Проверь History каждого cron'а через минуту — должны быть зелёные 200.

---

## Шаг 4: Настрой SMTP в Supabase

Подробно в `supabase/email-templates/README.md`. Краткий список:

1. Регистрация в SendPulse → SMTP → подтверждение домена через DNS
2. SendPulse SMTP credentials → Supabase Dashboard → Authentication → SMTP Settings
3. Скопируй HTML шаблоны из `supabase/email-templates/` в Supabase Dashboard → Authentication → Email Templates

Проверь: зарегистрируй тестовый аккаунт через `/signup` локально → должно прийти письмо.

---

## Шаг 5: Деплой на Railway

1. Открой [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → выбери свой репозиторий с Постпланом
3. Railway автоматически найдёт `Dockerfile` и `railway.json`
4. Перед деплоем — добавь все переменные из `ENV.md` в **Variables**

**Важно:** добавь следующие переменные с пометкой Build Time:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

В Railway это делается через `Service Settings → Variables → Build`. Иначе они не попадут в JS bundle и frontend не будет работать.

5. Нажми **Deploy**.

Первый билд займёт ~5 минут (Docker + Next.js build).

---

## Шаг 6: Подключи свой домен

1. Railway → твой service → **Settings** → **Domains** → **Custom Domain**
2. Введи `postplan.app` (без `https://`)
3. Railway покажет CNAME-запись
4. У регистратора домена → DNS → добавь CNAME запись на `*.up.railway.app` от Railway
5. Подожди 5-30 минут для распространения DNS
6. Railway автоматически выпустит SSL-сертификат через Let's Encrypt

После — обнови `NEXT_PUBLIC_APP_URL` в переменных Railway на `https://postplan.app` и **redeploy**.

---postplantelegramapp

## Шаг 7: Настрой YooKassa Webhook

YooKassa Личный кабинет → **HTTP-уведомления** или **Webhook'и** → создай:

- **URL:** `https://postplan.app/api/yookassa/webhook`
- **События:**
  - `payment.succeeded`
  - `payment.canceled`
  - `refund.succeeded`

Подпись webhook'а проверяется через `YOOKASSA_WEBHOOK_SECRET` (мы её используем).

---

## Шаг 8: Финальная проверка

После всего:

- [ ] Открой `https://postplan.app/` → главная грузится
- [ ] `https://postplan.app/api/health` → `{"ok":true,...}`
- [ ] `https://postplan.app/legal/privacy` → политика грузится
- [ ] Зарегистрируй тестовый аккаунт → пришло письмо подтверждения
- [ ] Подтверди email → попал в `/dashboard`
- [ ] Подключи бота → токен сохраняется
- [ ] Подключи канал
- [ ] Создай тестовый пост → отправь сейчас → пост дошёл в Telegram
- [ ] Создай запланированный → подожди минуту → cron опубликовал
- [ ] Зайди в `/dashboard/billing` → Тарифы показывают promo-цену 149₽ / 345₽
- [ ] Нажми «Перейти на Базовый» → редирект в YooKassa → оплати тестовой картой
- [ ] После оплаты вернулся в Постплан → tier обновлён на `start`

Если хоть один пункт не работает — копай в логи Railway и Supabase Edge Functions.

---

## Если что-то пошло не так

**App не стартует на Railway:**

- Логи Railway → Deploy logs → ищи ошибки сборки
- Чаще всего: забыл переменную в Build args (`NEXT_PUBLIC_*`)

**500 на любой странице:**

- Railway → Deploy logs → Runtime → ищи stack trace
- Чаще всего: неправильный SUPABASE_SERVICE_ROLE_KEY или ENCRYPTION_KEY

**401 на регистрации:**

- Supabase Auth → SMTP не настроен
- Solution: подключи SendPulse как описано в Шаге 4

**Crons падают с 401:**

- Edge Function → Settings → проверь Verify JWT: OFF
- Перезалей код функции

**YooKassa Webhook не приходит:**

- YooKassa → Webhook'и → проверь логи отправки
- Проверь что URL `https://postplan.app/api/yookassa/webhook` доступен
- Проверь `YOOKASSA_WEBHOOK_SECRET` — должен совпадать с настройкой в YooKassa
