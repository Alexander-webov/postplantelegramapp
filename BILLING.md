# Настройка биллинга (YooKassa)

Этот документ — пошаговая инструкция как подключить приём платежей через YooKassa.

## Что нужно перед началом

1. **Юридический статус** — самозанятый / ИП / ООО. Без этого YooKassa не активирует магазин.
   - Самозанятый: оформляется за 10 минут через приложение «Мой налог» или Госуслуги. Подходит для оборота до 2.4 млн ₽/год. Налог 6% (от физлиц) / 4% (от юрлиц).
   - ИП на УСН 6%: 1-3 дня, госпошлина ~800 ₽.
2. **Банковский счёт** — куда YooKassa будет переводить выручку.

## Шаг 0. Накати миграции биллинга (два запуска)

Из-за особенности Postgres — добавленные enum значения нельзя использовать в той же транзакции — миграция разделена на два файла. Прогоняй их **по очереди**, как два отдельных запроса.

**0.1.** Supabase Dashboard → SQL Editor → вставь содержимое `supabase/migrations/005a_billing_enum.sql` → **Run**. Должно вернуть `Success. No rows returned`.

**0.2.** В том же редакторе очисти поле и вставь содержимое `supabase/migrations/005b_billing_tables.sql` → **Run**. Тоже должно вернуть `Success`.

После этого:
- В `Tables` появится таблица `payments`
- В `profiles` появится столбец `yookassa_customer_id`

## Шаг 1. Регистрация в YooKassa

1. https://yookassa.ru → «Подключить»
2. Выбери тип (самозанятый / ИП / ООО) и пройди верификацию документов
3. После активации в личном кабинете найди:
   - **shop_id** (Настройки → API → Идентификатор магазина)
   - **secret_key** (там же, нажми «Создать секретный ключ»)

## Шаг 2. Тестовый магазин (для разработки)

Прежде чем использовать живые деньги — попробуй на тестовом магазине.

1. https://yookassa.ru/developers/using-api/auth → «Получить тестовые ключи»
2. Запиши `test_shop_id` и `test_secret_key`
3. Тестовые карты для оплаты: https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing
   - `5555 5555 5555 4477` (Mastercard, успешно)
   - `5555 5555 5555 4444` (Mastercard, отклонено)

## Шаг 3. Заполни `.env.local`

```bash
YOOKASSA_SHOP_ID=12345
YOOKASSA_SECRET_KEY=test_xxxxxxxxxxxxxxxx

# Basic auth для webhook — придумай свои user:pass
YOOKASSA_WEBHOOK_BASIC_AUTH=postplan_webhook:Y4xRpXSm9nKqLwH2

# Должен быть публичный URL для webhook от YooKassa
NEXT_PUBLIC_APP_URL=https://postplan.app
```

## Шаг 4. Webhook URL для YooKassa

YooKassa POST'ает на наш endpoint когда меняется статус платежа.

**На продакшене** — Vercel автоматически даёт публичный URL. Webhook будет:
```
https://USER:PASS@postplan.app/api/yookassa/webhook
```
где `USER:PASS` — то что в `YOOKASSA_WEBHOOK_BASIC_AUTH`.

**Локально** — localhost не виден из интернета. Используй [ngrok](https://ngrok.com):

```bash
# В одном терминале запусти Postplan
npm run dev

# В другом — открой туннель
ngrok http 3000
```

Получишь URL вида `https://abc123.ngrok-free.app`. Webhook URL для YooKassa:
```
https://USER:PASS@abc123.ngrok-free.app/api/yookassa/webhook
```

## Шаг 5. Настрой webhook в YooKassa

1. Личный кабинет YooKassa → Интеграция → HTTP-уведомления
2. Webhook URL: тот что в Шаге 4 (с `USER:PASS@` префиксом!)
3. Подпиши на события:
   - `payment.succeeded` — обязательно (это активирует подписку)
   - `payment.canceled` — обязательно (для отображения отказов)
   - `payment.waiting_for_capture` — опционально (мы делаем auto-capture, обычно не приходит)
4. Сохрани

## Шаг 6. Тестовый платёж

1. Открой `/dashboard/billing` в Постплане
2. Нажми «Перейти на Базовый · 299 ₽»
3. Тебя редиректит на YooKassa-страницу
4. Введи тестовую карту `5555 5555 5555 4477`, любой CVC, любую дату
5. Подтверди → редирект обратно на `/dashboard/billing/success`
6. Через 1-2 секунды webhook должен прийти → подписка активирована
7. Обнови `/dashboard/billing` — должен показаться тариф «Базовый» с датой истечения

## Отладка webhook

Если подписка не активируется после оплаты:

1. **Проверь логи Vercel** или `npm run dev` — там будут видны входящие webhook'и и ошибки
2. **Проверь YooKassa Dashboard** → Интеграция → HTTP-уведомления → история. Видны все попытки и ответы. Если получаешь 401 — basic auth неправильный.
3. **Проверь таблицу `payments`** в Supabase — статус должен меняться на `succeeded` после webhook
4. **Проверь `profiles`** — `subscription_tier` и `subscription_expires_at` обновятся

## Идемпотентность

YooKassa ретраит webhook если не получает 200 в течение ~10 секунд. Наш handler идемпотентный:
- При повторном webhook на тот же `payment_id` со тем же статусом — мы сравниваем `webhook_received_at` и не делаем повторных side effects
- При повторном `createPaymentAction` для того же платежа (если юзер дважды нажал кнопку) — `idempotence_key` гарантирует что YooKassa создаст 1 платёж, не 2

## Что НЕ работает на этом этапе

- **Recurring (автопродление)** — нужно один раз в месяц вручную нажать «Продлить». Recurring добавим в следующем батче.
- **Refunds через UI** — пока возвраты делаем вручную через личный кабинет YooKassa. Если юзер хочет возврат, в течение 7 дней — нажимаешь в YooKassa, деньги уходят обратно. Сейчас webhook на refund'ы не реагирует — нужно вручную в Supabase сбросить `subscription_tier`.
- **Stripe** — для международных платежей. Добавим позже.

## Чеки 54-ФЗ

YooKassa автоматически генерирует фискальные чеки и шлёт их клиенту по email (мы передаём `customer.email` при создании платежа). Это работает «из коробки» — нам ничего настраивать не нужно. Но **проверь в личном кабинете YooKassa** что у тебя подключена касса (онлайн-фискализация) — обычно это бесплатная опция.
