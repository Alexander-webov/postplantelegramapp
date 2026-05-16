import Link from "next/link";
import { ArrowRight, Check, ChevronRight, FileText, Link2, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/dashboard/logo";
import { TIERS, formatLimit, type SubscriptionTier } from "@/lib/tiers";

// =============================================================================
// Постплан — landing page
// =============================================================================
// Positioning: "The only Telegram scheduler that also keeps your advertiser
// CRM and ships a branded post-placement report to each client."
//
// One promise. The whole page rolls toward it: hero → who-it's-for → 3-step
// pitch (CRM → report → reminders) → comparison → pricing → FAQ.
//
// Everything else (templates, crossposting, analytics, auto-delete) is
// supporting context, not a headline. They show up briefly under pricing.
// =============================================================================

export const metadata = {
  title: "Постплан — CRM рекламодателей и отчёт клиенту для Telegram-канала",
  description: "Веди базу рекламодателей, планируй размещения и автоматически собирай отчёт со скриншотом, охватами и ссылкой на пост. От 299 ₽/мес.",
};

// ----- Content blocks --------------------------------------------------------

const whoFor = ["Админ Telegram-канала продаёт рекламу клиентам", "СММ-агентство ведёт каналы под нескольких рекламодателей", "Медиа-сетка из 5+ каналов с общим прайсом и отчётностью"];

const steps = [
  {
    n: 1,
    icon: Users,
    title: "Заводи рекламодателя один раз",
    body: 'Имя клиента, контакт, согласованная цена. Все размещения автоматически привязываются к карточке — больше никаких "у Васи 5 постов с октября, не помню точно".',
  },
  {
    n: 2,
    icon: FileText,
    title: "Постплан собирает отчёт сам",
    body: "Каждое размещение → отдельная страница с твоим оформлением: пост, охваты через 1ч/6ч/24ч/48ч, дата публикации, ссылка на канал. Просто скидываешь клиенту ссылку.",
  },
  {
    n: 3,
    icon: Link2,
    title: "Видишь весь поток денег",
    body: "В CRM сразу видно: сколько размещений на этой неделе, у кого, на какую сумму, какие свободные слоты остались. Excel и WhatsApp можно закрыть.",
  },
];

const comparison = [
  {
    feature: "Планирование постов и кросспост",
    postplan: true,
    smm: true,
    excel: false,
  },
  {
    feature: "Карточка рекламодателя со всей историей",
    postplan: true,
    smm: false,
    excel: "руками",
  },
  {
    feature: "Автоматический отчёт по ссылке для клиента",
    postplan: true,
    smm: false,
    excel: false,
  },
  {
    feature: "Охваты на 1/6/24/48 часов в одном месте",
    postplan: true,
    smm: "отдельный сервис",
    excel: false,
  },
  {
    feature: "Свободные слоты в календаре",
    postplan: true,
    smm: "наполовину",
    excel: false,
  },
  {
    feature: "Автоудаление рекламы по таймеру",
    postplan: true,
    smm: false,
    excel: false,
  },
];

const faq = [
  {
    q: "Чем Постплан отличается от SmmPlanner / Postmypost?",
    a: "SmmPlanner и аналоги — про планирование контента. У них есть очередь и шаблоны, но нет ни карточки рекламодателя, ни отчёта клиенту. Постплан добавляет именно эту операционку: ты ведёшь продажи рекламы, а не просто публикуешь посты.",
  },
  {
    q: "Что именно видит мой рекламодатель в отчёте?",
    a: "Открытую страницу по ссылке (без регистрации): сам пост так как он вышел в канале, дата и время публикации, ссылка на канал, охваты в нескольких контрольных точках. Можно скопировать ссылку и отправить в Telegram — выглядит профессионально и в разы убедительнее скриншота.",
  },
  {
    q: "А если у меня сейчас только один клиент-рекламодатель?",
    a: 'Один клиент — это тоже клиент. Карточка с историей размещений и автоматический отчёт нужны уже на первом размещении: это снижает количество "а пришли пожалуйста статистику" в личке. Когда клиентов станет 5–10 — Постплан окупается несравнимо быстрее, чем стоит.',
  },
  {
    q: "Это надёжно? Куда уходят данные?",
    a: "Все данные — в твоём аккаунте Supabase под Row-Level Security. Никто, кроме тебя и тех, кому ты дашь ссылку на отчёт, доступа не получит. Бот-токены шифруются AES-256 перед записью в базу.",
  },
  {
    q: "Можно подключить уже существующий канал?",
    a: "Да. Через @BotFather создаёшь бота (одна минута), добавляешь его админом в канал, вставляешь токен в Постплан. Текущие посты остаются на месте, новые публикуются через бота.",
  },
  {
    q: "Что будет, если я не оплачу подписку дальше?",
    a: "Аккаунт переключится на Free. Уже опубликованные посты и история останутся, новые публикации ограничатся одним каналом и 10 постами в месяц. Ничего не удаляется.",
  },
];

// ----- Page ------------------------------------------------------------------

export default function HomePage() {
  // Schema.org markup helps Google + Yandex + ChatGPT/Perplexity understand
  // what this page is. Three entities: the company, the website (with site
  // search), and the product (so it's eligible for SoftwareApplication
  // rich results in SERP).
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://postplan-tg.ru/#organization",
        name: "Постплан",
        url: "https://postplan-tg.ru",
        logo: "https://postplan-tg.ru/icon",
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": "https://postplan-tg.ru/#website",
        url: "https://postplan-tg.ru",
        name: "Постплан",
        publisher: { "@id": "https://postplan-tg.ru/#organization" },
        inLanguage: "ru-RU",
      },
      {
        "@type": "SoftwareApplication",
        name: "Постплан",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Планировщик постов в Telegram-канала с CRM рекламодателей и автоматическим отчётом клиенту.",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "RUB",
          lowPrice: "0",
          highPrice: "990",
          offerCount: 3,
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main>
        <Hero />
        <WhoFor />
        <ThreeSteps />
        <ReportShowcase />
        <ComparisonStrip />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <PublicFooter />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}

// ----- Header ----------------------------------------------------------------

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center transition-base hover:opacity-80">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">
            Как это работает
          </a>
          <a href="#compare" className="hover:text-foreground">
            Сравнение
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Тарифы
          </a>
          <Link href="/blog" className="hover:text-foreground">
            Блог
          </Link>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">
            Войти
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">Попробовать бесплатно</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ----- Hero ------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative border-b border-border pb-20 pt-16 md:pb-28 md:pt-24">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Badge variant="outline" className="mb-6 gap-1.5 border-primary/30 bg-primary-soft text-primary-soft-foreground">
          <Sparkles className="h-3 w-3" />
          Для каналов, которые продают рекламу
        </Badge>

        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
          Веди CRM рекламодателей <span className="text-primary">и отдавай клиенту готовый отчёт по ссылке</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
          Постплан — единственный планировщик Telegram, который собирает за тебя историю размещений по каждому рекламодателю и автоматически делает публичную страницу-отчёт с охватами.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">
              Попробовать бесплатно
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <a href="#how">Посмотреть как работает</a>
          </Button>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">Без триала. Free навсегда — 1 канал и 10 постов в месяц.</p>
      </div>
    </section>
  );
}

// ----- Who is this for -------------------------------------------------------

function WhoFor() {
  return (
    <section className="border-b border-border bg-surface-sunken/30 py-14 md:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <p className="mb-6 text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">Постплан подойдёт, если</p>
        <ul className="grid gap-3 md:grid-cols-3">
          {whoFor.map((line) => (
            <li key={line} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-sm leading-snug">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ----- Three steps -----------------------------------------------------------

function ThreeSteps() {
  return (
    <section id="how" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">Как Постплан экономит твоё время</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Три простые вещи, которые в SmmPlanner или Postmypost нужно вести вручную в Excel или забыть.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map(({ n, icon: Icon, title, body }) => (
            <div key={n} className="relative flex flex-col rounded-xl border border-border bg-card p-6">
              <div className="mb-4 inline-flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----- Report showcase -------------------------------------------------------
// What the advertiser actually sees when you send them the link. This is
// the single thing the entire landing is pitching — give it its own block.
// ----------------------------------------------------------------------------

function ReportShowcase() {
  return (
    <section className="border-b border-border bg-surface-sunken/40 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <Badge variant="outline" className="mb-5 gap-1.5 border-primary/30 bg-primary-soft text-primary-soft-foreground">
            <FileText className="h-3 w-3" />
            Главная фишка
          </Badge>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">Одна ссылка</h2>
          <div className="mt-6 space-y-4 text-muted-foreground">
            <p>
              Когда пост опубликован, Постплан собирает охваты сам — на 1, 6, 24 и 48 часов. Эти цифры автоматически попадают на публичную страницу размещения, которая лежит по короткому URL вида{" "}
              <code className="rounded bg-card px-1.5 py-0.5 text-xs text-foreground">postplan-tg.ru/r/abc123</code>.
            </p>
            <p>Кидаешь ссылку клиенту — он открывает и видит всё: сам пост, время выхода, охваты на разных интервалах, ссылку на канал. Без регистрации, без скриншотов, без переписки.</p>
            <ul className="space-y-2 pt-2">
              {["Срабатывает автоматически после публикации", "Брендировано под твой канал", "Не требует от клиента никаких аккаунтов", "Можно отправить как ссылку или как превью в TG"].map(
                (line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        {/* Visual mockup of a report card. Inline SVG-ish HTML so it
            renders on first paint without an actual screenshot file. */}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border bg-surface-sunken/40 px-5 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-3 truncate text-xs text-muted-foreground">postplan-tg.ru/r/abc123</span>
              </div>
            </div>

            <div className="space-y-5 px-6 py-7">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Размещение</p>
                <p className="mt-1.5 text-lg font-semibold tracking-tight">Подборка курсов по дизайну</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Канал «Дизайн каждый день» · опубликовано 12 марта в 14:00</p>
              </div>

              <div className="rounded-lg border border-border bg-surface-sunken/30 p-4 text-sm leading-relaxed">
                Подобрали для вас 7 курсов по UX/UI — от старта до сеньорных интенсивов. Бесплатные и платные…
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { t: "1ч", v: "4.2K" },
                  { t: "6ч", v: "11.8K" },
                  { t: "24ч", v: "23.6K" },
                  { t: "48ч", v: "28.1K" },
                ].map((m) => (
                  <div key={m.t} className="rounded-md border border-border bg-card px-3 py-2.5 text-center">
                    <div className="text-xs text-muted-foreground">{m.t}</div>
                    <div className="mt-0.5 text-sm font-semibold tracking-tight">{m.v}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">Ссылка на пост</span>
                <span className="font-medium text-primary">t.me/design/8421 →</span>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-3 -right-3 -z-10 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
        </div>
      </div>
    </section>
  );
}

// ----- Comparison strip ------------------------------------------------------

function ComparisonStrip() {
  return (
    <section id="compare" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">Чем отличается от того, чем ты пользуешься сейчас</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Планировщики помогают публиковать. Постплан помогает <em className="not-italic font-medium text-foreground">продавать рекламу</em>.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5 text-left font-medium">Что нужно админу канала</th>
                <th className="px-3 py-3.5 text-center font-medium">Постплан</th>
                <th className="px-3 py-3.5 text-center font-medium">SmmPlanner / Postmypost</th>
                <th className="px-3 py-3.5 text-center font-medium">Excel + WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comparison.map((row, i) => (
                <tr key={i}>
                  <td className="px-5 py-3.5 text-foreground">{row.feature}</td>
                  <td className="px-3 py-3.5 text-center">
                    <Mark v={row.postplan} accent />
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <Mark v={row.smm} />
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <Mark v={row.excel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Mark({ v, accent = false }: { v: boolean | string; accent?: boolean }) {
  if (v === true) {
    return <Check className={`mx-auto h-5 w-5 ${accent ? "text-primary" : "text-success"}`} aria-label="да" />;
  }
  if (v === false) {
    return <X className="mx-auto h-5 w-5 text-muted-foreground/50" aria-label="нет" />;
  }
  return <span className="text-xs text-muted-foreground">{v}</span>;
}

// ----- Pricing ---------------------------------------------------------------

function Pricing() {
  const order: SubscriptionTier[] = ["free", "start", "pro"];
  return (
    <section id="pricing" className="border-b border-border bg-surface-sunken/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">Тарифы — без триалов, без сюрпризов</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">CRM рекламодателей и отчёты доступны на всех платных тарифах. Free — чтобы попробовать.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {order.map((key) => {
            const tier = TIERS[key];
            const isHighlight = key === "start";
            return (
              <div key={key} className={`relative flex flex-col rounded-xl border bg-card p-6 ${isHighlight ? "border-primary shadow-lg md:scale-[1.02]" : "border-border"}`}>
                {isHighlight && <Badge className="absolute -top-2.5 left-6">Подходит большинству</Badge>}
                <p className="text-sm font-medium text-muted-foreground">{tier.name}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{tier.priceRub === 0 ? "0" : tier.priceRub}</span>
                  <span className="text-sm text-muted-foreground">₽/мес</span>
                </div>

                <ul className="mt-5 space-y-2.5 text-sm">
                  <FeatureLine>{formatLimit(tier.limits.maxChannels)} канал(ов)</FeatureLine>
                  <FeatureLine>{tier.limits.maxPostsPerMonth === Infinity ? "Без лимита постов" : `${tier.limits.maxPostsPerMonth} постов/мес`}</FeatureLine>
                  <FeatureLine enabled={tier.limits.maxCrosspostChannels > 1}>Кросспост до {formatLimit(tier.limits.maxCrosspostChannels)} каналов</FeatureLine>
                  <FeatureLine enabled={tier.limits.maxTemplates > 0}>Шаблоны постов</FeatureLine>
                  <FeatureLine enabled={key !== "free"}>CRM рекламодателей</FeatureLine>
                  <FeatureLine enabled={key !== "free"}>Публичные отчёты клиенту</FeatureLine>
                  <FeatureLine enabled={key !== "free"}>Автоудаление рекламы</FeatureLine>
                </ul>

                <Button asChild className="mt-7 w-full" variant={isHighlight ? "default" : "outline"}>
                  <Link href="/signup">
                    {key === "free" ? "Начать бесплатно" : `Выбрать ${tier.name}`}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">Оплата через ЮKassa. Можно отменить в любой момент — деньги за неиспользованные дни не возвращаем, но и автосписаний нет.</p>
      </div>
    </section>
  );
}

function FeatureLine({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${enabled ? "text-foreground" : "text-muted-foreground/60"}`}>
      {enabled ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </li>
  );
}

// ----- FAQ -------------------------------------------------------------------

function FAQ() {
  return (
    <section id="faq" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight md:text-4xl">Вопросы, которые задают чаще всего</h2>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {faq.map((item, i) => (
            <details key={i} className="group px-5 py-4">
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-medium">
                <span>{item.q}</span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----- Final CTA -------------------------------------------------------------

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/8 via-transparent to-primary/12" />
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <ShieldCheck className="mx-auto mb-5 h-9 w-9 text-primary" />
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">Закрой Excel и WhatsApp с рекламодателями</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Бесплатный аккаунт. Один канал. 10 постов в месяц. Этого достаточно, чтобы за вечер увидеть, как работает CRM и автоматический отчёт.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">
              Создать аккаунт
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/login">У меня уже есть</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ----- Footer ----------------------------------------------------------------

function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center">
        <div>
          <Logo />
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Планировщик с CRM рекламодателей и автоматическими отчётами для Telegram-каналов.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/legal/offer" className="hover:text-foreground">
            Оферта
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground">
            Конфиденциальность
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground">
            Условия
          </Link>
          <a href="mailto:programm.aleks@gmail.com" className="hover:text-foreground">
            programm.aleks@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
