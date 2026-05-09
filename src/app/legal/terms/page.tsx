import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/dashboard/logo';

export const metadata = {
  title: 'Условия использования · Постплан',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Условия использования</h1>
        <p className="text-sm text-muted-foreground">
          Действует с 1 мая 2026 года.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Принятие условий</h2>
          <p>
            Регистрируясь и используя сервис «Постплан» (далее — Сервис), вы соглашаетесь с настоящими Условиями. Если вы не согласны — прекратите использование Сервиса.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Что предоставляет Сервис</h2>
          <p>
            Сервис — это веб-инструмент для планирования и публикации постов в Telegram-каналах через Bot API. Вы предоставляете токены своих Telegram-ботов, мы обеспечиваем их безопасное хранение и автоматическую публикацию по расписанию.
          </p>
          <p>
            Сервис не является официальным продуктом Telegram и не аффилирован с Telegram FZ-LLC.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Регистрация</h2>
          <p>
            Для использования платных функций требуется регистрация по email. Вы обязуетесь предоставлять достоверные данные и не передавать доступ к своему аккаунту третьим лицам. Мы вправе отказать в регистрации без объяснения причин.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Тарифы и оплата</h2>
          <p>
            Сервис предлагает бесплатный тариф с ограничениями и платные подписки. Текущие цены указаны на странице тарифов и в личном кабинете. Оплата производится через ЮKassa в рублях.
          </p>
          <p>
            Подписка действует 30 дней с момента оплаты. По истечении периода доступ к платным функциям отключается до следующей оплаты — автопродление сейчас не реализовано, вам нужно оплатить вручную.
          </p>
          <p>
            Возврат средств возможен в течение 14 дней с момента оплаты, если вы не использовали платные функции. Подробнее в <Link href="/legal/offer" className="text-primary hover:underline">Публичной оферте</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Запрещённое использование</h2>
          <p>Вы обязуетесь не использовать Сервис для:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Распространения спама, мошеннических и фишинговых сообщений</li>
            <li>Публикации контента, нарушающего законы РФ или правила Telegram</li>
            <li>Нарушения авторских прав третьих лиц</li>
            <li>Атак на Сервис или попыток обойти его ограничения</li>
            <li>Реселлинга или перепродажи доступа к Сервису без нашего согласия</li>
          </ul>
          <p>
            Нарушение этих правил — основание для блокировки аккаунта без возврата оплаты.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Ответственность</h2>
          <p>
            Сервис предоставляется «как есть». Мы не гарантируем 100% работоспособность — случаются плановые работы, сбои у Telegram, у Supabase, у Railway. О плановых работах уведомляем заранее.
          </p>
          <p>
            Мы не несём ответственности за: содержание ваших постов, действия ваших ботов, бан вашего канала со стороны Telegram, упущенную выгоду и любые косвенные убытки.
          </p>
          <p>
            Максимальная сумма ответственности с нашей стороны ограничена суммой вашей последней оплаты подписки.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Прекращение использования</h2>
          <p>
            Вы можете удалить свой аккаунт в любой момент через настройки. Мы можем приостановить или удалить ваш аккаунт при нарушении настоящих Условий — с уведомлением и возможностью оспорить решение.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Изменения условий</h2>
          <p>
            Мы можем обновлять Условия. Существенные изменения уведомляются по email за 7 дней. Продолжая использование Сервиса после изменений, вы их принимаете.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Применимое право</h2>
          <p>
            Условия регулируются законодательством Российской Федерации. Споры рассматриваются по месту регистрации Оператора.
          </p>
        </section>

        <p className="text-sm text-muted-foreground border-t border-border pt-6">
          Связанные документы: <Link href="/legal/privacy" className="text-primary hover:underline">Политика конфиденциальности</Link>, <Link href="/legal/offer" className="text-primary hover:underline">Публичная оферта</Link>.
        </p>
      </main>
    </div>
  );
}
