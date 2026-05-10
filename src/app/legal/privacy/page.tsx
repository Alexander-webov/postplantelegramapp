import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/dashboard/logo";

export const metadata = {
  title: "Политика конфиденциальности · Постплан",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="transition-base hover:opacity-80">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-10 prose prose-sm">
        <h1 className="text-3xl font-semibold tracking-tight">
          Политика конфиденциальности
        </h1>
        <p className="text-sm text-muted-foreground">
          Действует с 1 мая 2026 года. Версия 1.0.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Общие положения</h2>
          <p>
            Настоящая Политика регулирует обработку персональных данных
            пользователей сервиса «Постплан» (далее — Сервис), доступного по
            адресу указанного в шапке сайта. Оператор: самозанятый Александр.
            Контакт:{" "}
            <a
              href="mailto:hello@postplan-tg.ru"
              className="text-primary hover:underline"
            >
              hello@postplan-tg.ru
            </a>
            .
          </p>
          <p>
            Используя Сервис, вы подтверждаете согласие с настоящей Политикой.
            Если вы не согласны — прекратите использование Сервиса.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            2. Какие данные мы обрабатываем
          </h2>
          <p>Мы обрабатываем следующие данные пользователей:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Email — для регистрации и связи</li>
            <li>Имя — указанное вами в настройках</li>
            <li>Зашифрованные API-токены ваших Telegram-ботов</li>
            <li>Содержимое постов, которые вы создаёте через Сервис</li>
            <li>Метаданные ваших Telegram-каналов (название, username)</li>
            <li>История публикаций и аналитика просмотров</li>
            <li>
              Платёжная информация (через ЮKassa — мы не храним номера карт)
            </li>
            <li>IP-адрес и cookies для обеспечения безопасности и аналитики</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Цели обработки</h2>
          <p>Данные обрабатываются для:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Предоставления функций Сервиса (планирование и публикация постов)
            </li>
            <li>Обработки оплаты подписки</li>
            <li>Технической поддержки и связи с пользователями</li>
            <li>Защиты Сервиса от злоупотреблений</li>
            <li>Анализа использования и улучшения продукта</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Как мы храним данные</h2>
          <p>
            Данные хранятся в базе Supabase (хостится у Amazon Web Services,
            регион Frankfurt). Токены ботов зашифрованы по алгоритму AES-256-GCM
            с ключом, который хранится отдельно от данных. Передача данных между
            вашим браузером и Сервисом защищена HTTPS.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Передача третьим лицам</h2>
          <p>Мы передаём данные:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Telegram (ваши посты публикуются в ваши же каналы через Bot API)
            </li>
            <li>ЮKassa — для обработки платежей</li>
            <li>
              SendPulse — для отправки писем подтверждения регистрации и сброса
              пароля
            </li>
            <li>Supabase — для хранения данных приложения</li>
            <li>Государственным органам — только по законному требованию</li>
          </ul>
          <p>
            Мы не продаём данные пользователей и не передаём их в рекламных
            целях.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Ваши права</h2>
          <p>Вы имеете право:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Запросить копию всех ваших данных в Сервисе</li>
            <li>
              Изменить или удалить свои данные через настройки или по запросу
            </li>
            <li>
              Удалить аккаунт целиком — все связанные данные стираются в течение
              30 дней
            </li>
            <li>Отозвать согласие на обработку персональных данных</li>
          </ul>
          <p>
            Запросы направляйте на{" "}
            <a
              href="mailto:hello@postplan-tg.ru"
              className="text-primary hover:underline"
            >
              hello@postplan-tg.ru
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Cookies</h2>
          <p>
            Сервис использует cookies для авторизации (session token) и анализа
            использования. Вы можете отключить cookies в браузере, но в этом
            случае часть функций Сервиса работать не будет.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Изменения политики</h2>
          <p>
            Мы можем обновлять Политику. Существенные изменения уведомляются по
            email за 7 дней до вступления в силу. Текущая версия всегда доступна
            по этой ссылке.
          </p>
        </section>

        <p className="text-sm text-muted-foreground border-t border-border pt-6">
          Связанные документы:{" "}
          <Link href="/legal/terms" className="text-primary hover:underline">
            Условия использования
          </Link>
          ,{" "}
          <Link href="/legal/offer" className="text-primary hover:underline">
            Публичная оферта
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
