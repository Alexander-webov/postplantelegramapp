import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/dashboard/logo";

export const metadata = {
  title: "Публичная оферта · Постплан",
  robots: { index: true, follow: true },
};

export default function OfferPage() {
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
          Публичная оферта
        </h1>
        <p className="text-sm text-muted-foreground">
          Действует с 1 мая 2026 года.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Стороны</h2>
          <p>
            <strong>Исполнитель:</strong> самозанятый Александр (плательщик
            НПД), оказывающий услуги доступа к программному сервису «Постплан».
          </p>
          <p>
            <strong>Заказчик:</strong> физическое или юридическое лицо,
            оплатившее доступ к платным функциям Сервиса.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Предмет договора</h2>
          <p>
            Исполнитель предоставляет Заказчику доступ к программному сервису
            «Постплан» — веб-инструменту для планирования постов в
            Telegram-каналах через Bot API. Заказчик оплачивает выбранный тариф.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            3. Стоимость и порядок оплаты
          </h2>
          <p>
            Действующие тарифы публикуются на странице{" "}
            <Link
              href="/dashboard/billing"
              className="text-primary hover:underline"
            >
              Тарифы
            </Link>
            . Цена включает все налоги.
          </p>
          <p>
            Оплата производится единоразовым платежом через ЮKassa в рублях на
            30 дней. Доступ к платным функциям предоставляется в течение 5 минут
            после успешной оплаты.
          </p>
          <p>
            Актуальная стоимость тарифов указывается на странице оплаты.
            Акционные скидки не применяются, если они отдельно не объявлены на
            сайте или в личном кабинете.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Возврат средств</h2>
          <p>
            Возврат полной суммы возможен в течение 14 дней с момента оплаты,
            если Заказчик не воспользовался платными функциями (не подключил
            больше 1 канала, не отправил больше 10 постов).
          </p>
          <p>
            Если функции были использованы — возврат не производится. Это
            связано с тем, что услуга предоставляется в момент использования.
          </p>
          <p>
            Запросы на возврат направляйте на{" "}
            <a
              href="mailto:hello@postplan-tg.ru"
              className="text-primary hover:underline"
            >
              hello@postplan-tg.ru
            </a>{" "}
            с указанием email аккаунта и причины.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Технические сбои</h2>
          <p>
            При длительных (более 24 часов) технических сбоях по нашей вине,
            Заказчик имеет право на пропорциональную компенсацию или продление
            срока подписки. Сбои у Telegram, Supabase или иных третьих лиц не
            являются основанием для возврата.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Чек и отчётность</h2>
          <p>
            После оплаты Заказчик получает фискальный чек в системе ЮKassa.
            Самозанятый исполнитель формирует чеки в приложении «Мой налог» по
            требованию.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Заключение договора</h2>
          <p>
            Договор считается заключённым с момента оплаты Заказчиком выбранного
            тарифа. Оплата подтверждает полное и безоговорочное согласие с
            настоящей офертой.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Контакты</h2>
          <p>
            Email:{" "}
            <a
              href="mailto:hello@postplan-tg.ru"
              className="text-primary hover:underline"
            >
              hello@postplan-tg.ru
            </a>
          </p>
        </section>

        <p className="text-sm text-muted-foreground border-t border-border pt-6">
          Связанные документы:{" "}
          <Link href="/legal/privacy" className="text-primary hover:underline">
            Политика конфиденциальности
          </Link>
          ,{" "}
          <Link href="/legal/terms" className="text-primary hover:underline">
            Условия использования
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
