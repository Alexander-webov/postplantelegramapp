# Деплой шедулера

Этот документ — пошаговое руководство, как запустить публикацию запланированных постов раз в минуту.

**Архитектура:** [cron-job.org](https://cron-job.org) (бесплатный сервис) каждую минуту шлёт HTTP-запрос на твою Edge Function в Supabase. Функция читает из БД все `pending` посты, у которых `scheduled_at <= now()`, отправляет их в Telegram (текст / фото / видео / альбом) и обновляет статусы.

Никакого Supabase CLI не требуется — всё через веб-интерфейсы.

## Шаг 0. Накати миграцию storage (для медиа)

Это нужно **один раз** перед всем остальным, чтобы появился bucket для загруженных файлов.

1. Supabase Dashboard → SQL Editor
2. Открой файл `supabase/migrations/002_storage_bucket.sql` из проекта
3. Скопируй всё содержимое → вставь в SQL Editor → Run
4. Проверь: Storage → должен появиться bucket `post-media` (private, лимит 50 MB на файл)

Если уже накатывал миграцию `001_initial_schema.sql` ранее — она не трогает Storage, всё в порядке. Просто прогони `002_storage_bucket.sql` отдельно.

## Шаг 0.1. Накати миграцию шаблонов (для подписей и шаблонов поста)

После storage — ещё одна миграция, которая добавит `kind` к `templates` и поле `applied_signature_id` к `posts`.

1. SQL Editor → вставь содержимое `supabase/migrations/003_templates.sql` → Run
2. Проверь: вкладка Tables → `templates` → должен появиться столбец `kind`; `posts` → столбец `applied_signature_id`

## Шаг 0.2. Накати миграцию редактирования

Добавляет `last_edited_at` к `scheduled_posts` для отметок "редактировано".

1. SQL Editor → вставь содержимое `supabase/migrations/004_edits.sql` → Run

## Шаг 1. Задеплой Edge Function через Dashboard

> **Если ты уже деплоил функцию раньше (без поддержки медиа)** — нужно обновить код. Открой Dashboard → Edge Functions → `publish-scheduled-posts` → Edit, удали всё содержимое и вставь свежий код из `supabase/functions/publish-scheduled-posts/index.ts`. Save → Deploy. Без этого посты с медиа уйдут с ошибкой.

1. Открой [Supabase Dashboard](https://supabase.com/dashboard) → твой проект
2. Слева в меню — **Edge Functions**
3. Нажми **Deploy a new function**
4. Имя: `publish-scheduled-posts` (точно такое, без изменений)
5. Откроется редактор с дефолтным шаблоном — **полностью замени** его содержимым файла `supabase/functions/publish-scheduled-posts/index.ts` из проекта
6. Нажми **Deploy function**

После успешного деплоя функция появится в списке Edge Functions.

## Шаг 2. Отключи проверку JWT

По умолчанию Supabase требует пользовательский JWT в каждом запросе. Нам это не подходит — функцию будет дёргать cron-job.org с service-role токеном. Поэтому:

1. Edge Functions → `publish-scheduled-posts` → **Details** или **Settings**
2. Найди опцию **Verify JWT** (или **Enforce JWT Verification**) → выключи
3. Сохрани

## Шаг 3. Задай ENCRYPTION_KEY в секретах функции

Функция должна расшифровывать токены ботов. Для этого ей нужен тот же `ENCRYPTION_KEY`, что лежит у тебя в `.env.local`.

1. Supabase Dashboard → слева **Project Settings** (шестерёнка внизу) → **Edge Functions**
2. Раздел **Secrets** → **Add new secret**
3. Имя: `ENCRYPTION_KEY`
4. Значение: ровно то же, что в твоём `.env.local` (без кавычек, без пробелов)
5. Save

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` Supabase подставит автоматически — добавлять их вручную не надо.

## Шаг 4. Возьми SERVICE_ROLE_KEY

Понадобится для тестового вызова и для cron-job.org.

1. Supabase Dashboard → **Project Settings** → **API**
2. Раздел **Project API keys** → строка **`service_role`** → нажми **Reveal**
3. Скопируй ключ (он начинается с `eyJ...` и длиной около 200 символов)

⚠️ Этот ключ даёт **полный доступ к БД минуя RLS**. Никогда не клади его в публичный код, в `.env.example`, в скриншоты, в публичные репозитории.

## Шаг 5. Тестовый ручной вызов

Прежде чем подключать cron — убедись, что функция работает.

Открой **PowerShell** и выполни (подставь свои значения):

```powershell
$url = "https://ВАШ_PROJECT.supabase.co/functions/v1/publish-scheduled-posts"
$key = "ВАШ_SERVICE_ROLE_KEY"
Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $key" }
```

**Ожидаемый ответ:**

```json
{ "ok": true, "processed": 0, "ms": 42 }
```

Если в очереди есть `pending` пост на прошлое время — `processed: 1, sent: 1`, и пост улетит в Telegram сразу.

**Если что-то пошло не так:**
- Ответ `401 Unauthorized` — `service_role` ключ неверный или JWT verification всё ещё включена (см. шаг 2)
- Ответ `500` или сообщение о `ENCRYPTION_KEY` — секрет не задан или задан с другим значением (см. шаг 3)
- Ошибки расшифровки токенов — у тебя `ENCRYPTION_KEY` в `.env.local` и в Supabase Secrets **должны совпадать байт-в-байт**

Логи функции:
- Supabase Dashboard → Edge Functions → `publish-scheduled-posts` → вкладка **Logs**

## Шаг 6. Зарегистрируйся на cron-job.org

1. Открой [cron-job.org](https://cron-job.org/en/signup/)
2. Зарегистрируйся (бесплатно, нужен email)
3. Подтверди email

## Шаг 7. Создай cronjob

1. Войди → **Cronjobs** → **Create cronjob**
2. **Title:** `Postplan publisher` (любое)
3. **URL:** `https://ВАШ_PROJECT.supabase.co/functions/v1/publish-scheduled-posts`
4. **Schedule** → выбери **Every minute** (вкладка Common или вручную: minutes `*`, hours `*`, mdays `*`, months `*`, wdays `*`)
5. Раскрой блок **Advanced** или **Request method/headers**:
   - **Request method:** `POST`
   - **Request headers:** добавь одну строку:
     - Name: `Authorization`
     - Value: `Bearer ВАШ_SERVICE_ROLE_KEY` (с пробелом после `Bearer`)
6. (опционально) **Notifications** → можно включить email при failure — придёт письмо если функция не отвечает
7. **Save**

## Шаг 8. Проверь что cron реально работает

1. На cron-job.org → твой cronjob → **History**
2. Подожди 1-2 минуты
3. Должны появиться запуски со статусом **OK** (зелёная галочка) и HTTP 200
4. Можешь кликнуть на запуск — увидишь тело ответа: `{"ok":true,"processed":0,...}`

**Если показывает красные ошибки:**
- HTTP 401 → проблема с `Authorization` хедером или JWT verification
- HTTP 500 → смотри Supabase Edge Functions Logs
- Timeout → функция работает дольше 30 сек; пиши, разберём

## Шаг 9. End-to-end тест

1. Открой Постплан → **Создать пост** → вкладка **Запланировать**
2. Выбери канал, напиши текст, поставь время **на 2 минуты вперёд**
3. **Сохрани в очередь**
4. Открой **Очередь** — пост в «Ожидают отправки»
5. Подожди до выбранного времени + ~30 секунд
6. Обнови страницу очереди → пост должен переехать в «История» со статусом **Отправлено**
7. Проверь Telegram — пост должен быть в канале

## Если хочется поставить на паузу

cron-job.org → твой cronjob → переключатель **Enabled/Disabled**.

Запланированные посты при этом остаются в БД со статусом `pending` и отправятся как только включишь обратно.

## Оптимизации на потом (не сейчас)

- **Несколько cron-сервисов как backup** — если cron-job.org упадёт, посты не пойдут. Можно добавить параллельно cron-job.org + EasyCron + Vercel Cron — кто первый достучался, тот и обработал. Дубликатов не будет, потому что функция атомарно помечает посты `processing` перед отправкой.
- **Свой cron на Railway/Fly.io** — если уйдём с cron-job.org. $0-5/мес, надёжнее.
- **pg_cron внутри Supabase** — самое надёжное и без внешних зависимостей. Но требует CLI или возни с GUC. Пока не нужно.

---

## Auto-delete posts — второй cron (NEW)

Помимо публикации, у Постплана есть Edge Function `delete-expired-posts`, которая удаляет посты из Telegram через N часов после публикации. Это нужно для рекламных постов.

Чтобы это работало в production, **нужен второй cron pinger**, который дёргает эту функцию каждую минуту.

### Шаг 1. Залей миграцию

В Supabase Dashboard → SQL Editor:

```sql
-- Содержимое supabase/migrations/006_auto_delete.sql
```

Прогон один раз. Идемпотентен.

### Шаг 2. Задеплой Edge Function

В Supabase Dashboard → Edge Functions → **+ Deploy a new function**:

- Name: `delete-expired-posts`
- Code: вставь содержимое `supabase/functions/delete-expired-posts/index.ts`
- **Verify JWT: OFF** (важно! иначе cron-job.org не достучится)
- Deploy

После деплоя Supabase даст URL вида:
```
https://xxxx.supabase.co/functions/v1/delete-expired-posts
```

### Шаг 3. Создай второй cron в cron-job.org

Открой [cron-job.org](https://cron-job.org/en/) → **Create cronjob**:

- **Title:** `Postplan — auto-delete posts`
- **URL:** твой function URL из шага 2
- **Schedule:** Every 1 minute (как у `publish-scheduled-posts`)
- **Request method:** POST (или GET — функция принимает оба, проверяет только Authorization)
- **Headers** (важно):
  ```
  Authorization: Bearer <твой SUPABASE_SERVICE_ROLE_KEY>
  ```
- **Save**

### Шаг 4. Re-deploy старой функции

Edge Function `publish-scheduled-posts` тоже была обновлена в этом батче (теперь возвращает массив message_ids). **Перезалей её код тоже:**

Edge Functions → publish-scheduled-posts → копируй содержимое `supabase/functions/publish-scheduled-posts/index.ts` → Deploy → **снова поставь Verify JWT: OFF**.

### Шаг 5. Тест end-to-end

1. Постплан → создай пост → отправь сейчас → активируй авто-удаление **1 час** (минимум)
2. В Supabase → Tables → `scheduled_posts` → найди свежую строку
3. Проверь что заполнены `auto_delete_after_hours = 1`, `auto_delete_at` (через час от sent_at), `telegram_message_ids` (массив)
4. **Дождись часа** (или вручную через SQL поставь `auto_delete_at = now()` чтобы не ждать)
5. Через минуту проверь Telegram — пост исчез
6. В очереди Постплана у поста — бейдж «удалён авто»

### Если что-то пошло не так

- **Функция вернула 401:** проверь что Bearer токен совпадает с SUPABASE_SERVICE_ROLE_KEY
- **Бейдж "ошибка удаления":** в `auto_delete_error` будет причина. Самые частые:
  - `message can't be deleted` — бот потерял права админа в канале
  - `chat not found` — канал удалён или бот выгнан
  - `message to delete not found` — сообщение уже удалили вручную (это OK, не ошибка)
- **Удалилось только одно сообщение из альбома:** значит пост был создан до миграции 006. У него только `telegram_message_id` (single), не массив. Backfill в миграции автоматически заполняет массив значением single, так что новые альбомы должны удаляться целиком.

---

## Аналитика просмотров — третий cron (NEW)

Аналогично `delete-expired-posts`, для аналитики просмотров есть отдельная Edge Function `update-views`. Она каждую минуту проверяет посты, которым исполнилось 1ч/6ч/24ч/48ч после публикации, и снимает счётчик просмотров через Bot API.

**Технический трюк:** Bot API не отдаёт просмотры напрямую. Мы вызываем `editMessageReplyMarkup` с пустой клавиатурой — Telegram возвращает обновлённый Message с полем `views`. Это **недокументированный, но стабильно работающий** способ. Если Telegram это уберёт — фича сломается, и мы перейдём на TGStat API.

### Шаг 1. Залей миграцию

В Supabase SQL Editor:

```sql
-- Содержимое supabase/migrations/007_analytics.sql
```

Один прогон. Идемпотентен.

### Шаг 2. Задеплой Edge Function

Supabase Dashboard → Edge Functions → **+ Deploy a new function**:

- Name: `update-views`
- Code: вставь содержимое `supabase/functions/update-views/index.ts`
- **Verify JWT: OFF**
- Deploy

### Шаг 3. Третий cron в cron-job.org

cron-job.org → Create cronjob:

- **Title:** `Postplan — update views`
- **URL:** `https://xxxx.supabase.co/functions/v1/update-views`
- **Schedule:** Every 1 minute
- **Method:** POST
- **Headers:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

### Шаг 4. Проверка

1. Постплан → отправь пост в свой канал
2. Дождись 1 час (или через SQL поставь `sent_at = now() - interval '65 minutes'`)
3. Через минуту в `scheduled_posts.views_1h` должно появиться число
4. На странице `/dashboard/queue/{id}/analytics` будут все снимки

### Известные ограничения

- **Просмотры приблизительные.** Telegram кеширует, обновляет с задержкой ~5 минут.
- **Замер ломается если бот выгнан.** В `views_error` будет описание.
- **Не работает для постов с inline-кнопками** (когда добавим — нужно будет читать существующий keyboard перед edit).
- **Нагрузка на Telegram API.** Каждый замер = 1 API call. При 1000 постов/день × 4 замера = 4000 calls. Это в пределах rate-limit.
