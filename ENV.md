# Environment Variables — Postplan

Полный список переменных, которые надо настроить в Railway → Variables.

## Обязательные

### Supabase

```
NEXT_PUBLIC_SUPABASE_URL=https://btzmnoikreazmykrsvos.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (anon key из Supabase Dashboard → API)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (service_role key — НИКОМУ не показывай)
```

⚠️ `NEXT_PUBLIC_*` переменные подставляются на этапе сборки Docker-образа.
Если их меняешь — нужен re-deploy. Для Railway: добавь как **Build args** в Dockerfile или
в Railway Service Settings → Variables (он передаёт их и в build, и в runtime).

### Encryption

```
ENCRYPTION_KEY=base64-кодированный 32-байтный ключ
```

Генерация:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

⚠️ После генерации ключа — **запиши его в Bitwarden или другой password manager**.
Если потеряешь — все сохранённые токены ботов перестанут работать (расшифровка невозможна без ключа).

### App URL (для callback'ов)

```
NEXT_PUBLIC_APP_URL=https://postplan.app
```

Используется в:
- Return URL после оплаты в YooKassa
- Ссылки на отчёты `/r/<slug>` в кнопке «Отправить в Telegram»
- robots.txt и sitemap.xml

⚠️ Должен быть **без слеша** в конце.

### YooKassa

```
YOOKASSA_SHOP_ID=12345                              (Shop ID из ЮKassa)
YOOKASSA_SECRET_KEY=live_xxx                        (Secret Key из ЮKassa)
YOOKASSA_WEBHOOK_SECRET=любая_рандомная_строка_32+ (для проверки подписи webhook'ов)
```

Где взять:
1. Личный кабинет ЮKassa → **Интеграция** → **Ключи API**
2. Скопировать **Shop ID** и **Secret Key**
3. Webhook secret сгенерировать самому: `openssl rand -hex 32`
4. Настроить Webhook в ЮKassa: URL `https://postplan.app/api/yookassa/webhook`, события: `payment.succeeded`, `payment.canceled`, `refund.succeeded`

### Cron (для Edge Functions)

Не используется в Next.js, но **обязательно** в Supabase Edge Functions:

```
ENCRYPTION_KEY=...  (тот же что выше — нужен для расшифровки токенов ботов)
```

Где настроить: Supabase Dashboard → Edge Functions → Secrets.

## Опциональные

### Аналитика (если решишь подключить)

```
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=postplan.app    (если используешь Plausible)
NEXT_PUBLIC_YANDEX_METRIKA_ID=12345678        (если используешь Яндекс.Метрику)
```

Эти переменные сейчас не использует никто из кода — добавь когда подключишь.

## Локально для разработки

Создай файл `.env.local` (он в `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://btzmnoikreazmykrsvos.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
ENCRYPTION_KEY=base64ключ
NEXT_PUBLIC_APP_URL=http://localhost:3000

YOOKASSA_SHOP_ID=12345
YOOKASSA_SECRET_KEY=test_xxx
YOOKASSA_WEBHOOK_SECRET=локальная_строка
```

⚠️ В локальной разработке используй **тестовые** ключи YooKassa (начинаются на `test_`).

## Проверка после деплоя на Railway

1. Открой свой URL → должна загрузиться главная
2. `/api/health` → должен вернуть `{"ok": true, "service": "postplan"}`
3. Зарегистрируй новый тестовый аккаунт → проверь что приходит email подтверждения
4. Подключи бота → проверь что токен сохраняется и шифруется (в БД должен быть зашифрованный, не plain)
