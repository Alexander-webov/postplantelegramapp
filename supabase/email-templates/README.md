# Email шаблоны для Supabase Auth

Эти HTML-файлы — шаблоны писем, которые Supabase отправляет юзерам. Их **нельзя залить через миграции БД** — они настраиваются вручную в Supabase Dashboard.

## Шаги установки

1. Открой Supabase Dashboard → твой проект → **Authentication** → **Email Templates**
2. Найди нужный шаблон в списке (Confirm signup / Reset Password / Magic Link / Change Email Address)
3. Открой соответствующий файл из этой папки в текстовом редакторе
4. Скопируй **всё содержимое** HTML и вставь в Supabase редактор шаблона
5. **В поле Subject** поставь нужный заголовок:
   - `confirm-signup.html` → Subject: `Подтвердите email — Постплан`
   - `reset-password.html` → Subject: `Сброс пароля — Постплан`
6. Нажми Save

## Важное про переменные

Supabase подставляет в шаблоны такие переменные (Go-template синтаксис):

- `{{ .ConfirmationURL }}` — ссылка на которую нужно перейти юзеру
- `{{ .Token }}` — 6-значный код (если ты включил OTP-подтверждение вместо ссылки)
- `{{ .Email }}` — email получателя

Не меняй имена переменных в шаблоне — иначе подстановка не сработает.

## Тестирование

Самый быстрый способ проверить:

1. Создай новый аккаунт в Постплане с реальным email
2. Получи письмо
3. Если выглядит криво — проверь что весь HTML скопировался без обрезаний
4. Если ссылка не работает — проверь что `{{ .ConfirmationURL }}` правильно вставлен в `href`

## Что нужно ещё настроить в Supabase

- **Site URL** в Authentication → URL Configuration: `https://yourdomain.com`
- **Redirect URLs**: `https://yourdomain.com/auth/callback`, `https://yourdomain.com/auth/reset-password`
- **SMTP settings** — для production обязательно подключи свой SMTP (Postmark/Resend/Mailgun), иначе письма уходят с лимитом 3-4 в час и попадают в спам

---

## Подключение SendPulse SMTP к Supabase

Для production нужен свой SMTP — иначе Supabase лимит 3 письма/час и письма падают в спам.

### Шаг 1. Регистрация в SendPulse

1. Открой [sendpulse.com/ru](https://sendpulse.com/ru) → регистрация
2. Раздел **SMTP** → **Подключить SMTP**
3. Заполни форму, подтверди номер
4. Бесплатный тариф — до 12 000 писем/мес

### Шаг 2. Подтверждение домена

Без верифицированного домена письма будут падать в спам. SendPulse требует:

1. SMTP → **Домены** → **Добавить домен** → введи свой (например `postplan.app`)
2. SendPulse покажет 3 DNS-записи: SPF, DKIM, DMARC
3. Иди в админку домена (там где ты его регистрировал) → DNS → добавь все три записи
4. Подожди 1-24 часа, потом в SendPulse нажми **Проверить**
5. Должно стать «Верифицирован»

### Шаг 3. Получи SMTP credentials

В SendPulse → SMTP → **Настройки** скопируй:
- **SMTP-сервер**: `smtp-pulse.com`
- **Порт**: `587`
- **Логин**: твой email регистрации
- **Пароль**: создай в **Настройки** → **API ключи** → **SMTP пароль**

### Шаг 4. Подключи к Supabase

Supabase Dashboard → **Project Settings** → **Auth** → прокрути до **SMTP Settings** → **Enable Custom SMTP**:

```
Sender email: noreply@postplan.app
Sender name:  Постплан
Host:         smtp-pulse.com
Port:         587
Username:     твой email от SendPulse
Password:     SMTP пароль из шага 3
```

Сохрани. Потом в той же странице **Auth** → **Email Templates** обнови все 4 шаблона из этой папки.

### Шаг 5. Тестируй

Зарегистрируй новый аккаунт в Постплане с реальным email — должно прийти письмо от `noreply@postplan.app`.

### Если письма падают в спам

- Проверь DNS-записи через `dig TXT postplan.app` или [mxtoolbox.com](https://mxtoolbox.com/SuperTool.aspx)
- В SendPulse → **Статистика** → проверь bounce rate
- Уточни у SendPulse дополнительные шаги для российских доменов (.ru, .рф) — они могут требовать дополнительной верификации
