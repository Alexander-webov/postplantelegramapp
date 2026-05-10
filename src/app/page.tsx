import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  FileText,
  Layers3,
  MessageCircleQuestion,
  Radio,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/dashboard/logo';
import { TIERS, formatLimit, isUnlimited, type SubscriptionTier } from '@/lib/tiers';

export const metadata = {
  title: 'Постплан — планировщик постов и рекламы для Telegram-каналов',
  description:
    'Планируй публикации, управляй Telegram-каналами, веди рекламодателей и зарабатывай на размещениях без хаоса в таблицах. Тарифы от 299 ₽/мес.',
};

const TIER_ICONS: Record<SubscriptionTier, typeof Sparkles> = {
  free: Sparkles,
  start: Zap,
  pro: Crown,
};

const moneyStats = [
  { value: '47', label: 'постов можно разложить по календарю заранее' },
  { value: '5+', label: 'каналов уже требуют не Telegram, а нормальный кабинет' },
  { value: '299 ₽', label: 'дешевле одной ручной ошибки в рекламном размещении' },
];

const pains = [
  'посты хранятся в заметках, чатах и таблицах',
  'рекламодатель спрашивает отчёт, а ты ищешь скриншоты вручную',
  'один и тот же пост приходится копировать в несколько каналов',
  'сложно понять, что уже вышло, что в очереди, а что забыли удалить',
];

const features = [
  {
    icon: CalendarDays,
    title: 'Контент-план на недели вперёд',
    description: 'Очередь публикаций, удобное время отправки и единый обзор: что выйдет сегодня, завтра и в этом месяце.',
  },
  {
    icon: Layers3,
    title: 'Кросспостинг без копипаста',
    description: 'Один пост можно подготовить для нескольких Telegram-каналов и не прыгать между админками.',
  },
  {
    icon: WalletCards,
    title: 'Рекламодатели и деньги',
    description: 'Храни клиентов, стоимость размещений и историю публикаций рядом с контентом, а не в отдельной таблице.',
  },
  {
    icon: Trash2,
    title: 'Автоудаление рекламных постов',
    description: 'Задай срок жизни размещения и не вспоминай ночью, какой пост нужно снять с канала.',
  },
  {
    icon: BarChart3,
    title: 'Просмотры и отчёты',
    description: 'Смотри результат публикаций и быстрее готовь отчёт для клиента после размещения.',
  },
  {
    icon: Bot,
    title: 'Через официального Telegram-бота',
    description: 'Без userbot-ов и серых схем. Ты сам добавляешь бота админом в канал и контролируешь доступ.',
  },
];

const workflow = [
  { title: 'Подключи бота', description: 'Создай бота в BotFather и добавь его админом канала.' },
  { title: 'Добавь каналы', description: 'Собери все Telegram-проекты в одном кабинете.' },
  { title: 'Запланируй посты', description: 'Готовь контент заранее, прикрепляй медиа и ставь время публикации.' },
  { title: 'Веди рекламу', description: 'Привязывай размещения к рекламодателям и считай выручку.' },
];

const comparison = [
  { capability: 'Запланировать пост на дату', us: true, tg: true },
  { capability: 'Один пост в несколько каналов', us: true, tg: false },
  { capability: 'Карточки рекламодателей', us: true, tg: false },
  { capability: 'Учёт выручки по размещениям', us: true, tg: false },
  { capability: 'Шаблоны постов и подписи', us: true, tg: false },
  { capability: 'Единая очередь по всем каналам', us: true, tg: false },
  { capability: 'Автоудаление рекламных публикаций', us: true, tg: false },
];

const faq = [
  {
    q: 'Кому точно нужен Постплан?',
    a: 'Владельцам Telegram-каналов, редакторам, SMM-специалистам и маленьким медиа-сеткам. Особенно если каналов больше одного или ты продаёшь рекламные размещения.',
  },
  {
    q: 'Чем это лучше обычного отложенного постинга в Telegram?',
    a: 'Telegram помогает поставить один пост в один канал. Постплан нужен, когда появляется система: несколько каналов, рекламодатели, шаблоны, очередь, деньги, история и отчёты.',
  },
  {
    q: 'Нужно ли давать доступ к моему Telegram-аккаунту?',
    a: 'Нет. Постплан работает через официального Telegram-бота. Ты сам создаёшь бота, добавляешь его в канал и можешь в любой момент удалить доступ.',
  },
  {
    q: 'Можно начать бесплатно?',
    a: 'Да. Free-тарифа достаточно, чтобы подключить канал, проверить публикации и понять механику. Когда начнёшь работать регулярно — переходишь на Базовый или Профи.',
  },
  {
    q: 'Почему 299 ₽, а не дешевле?',
    a: 'Потому что это рабочий инструмент, а не игрушка. Одна забытая рекламная публикация или потерянный отчёт обычно стоят дороже месячной подписки.',
  },
  {
    q: 'Как проходит оплата?',
    a: 'Оплата картой через YooKassa. После успешного платежа тариф включается в личном кабинете автоматически.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <PublicHeader />

      <main>
        <Hero />
        <PainSection />
        <Features />
        <Workflow />
        <ComparisonStrip />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>

      <PublicFooter />
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="transition-base hover:opacity-80">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-base hover:text-foreground">Возможности</a>
          <a href="#workflow" className="transition-base hover:text-foreground">Как работает</a>
          <a href="#pricing" className="transition-base hover:text-foreground">Тарифы</a>
          <a href="#faq" className="transition-base hover:text-foreground">Вопросы</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Войти</Link>
          </Button>
          <Button asChild size="sm" className="shadow-sm">
            <Link href="/signup">
              Начать бесплатно
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative border-b border-border pb-16 pt-14 md:pb-24 md:pt-20">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-[-180px] top-24 h-[420px] w-[420px] rounded-full bg-success/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 md:px-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <Badge variant="primary" className="mb-5 px-3 py-1">
            <Rocket className="h-3 w-3" />
            Для админов Telegram-каналов, которые зарабатывают на контенте
          </Badge>

          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.03] tracking-tight md:text-6xl">
            Преврати Telegram-канал в аккуратную систему публикаций и рекламы
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            Постплан помогает планировать посты, вести рекламодателей, считать выручку и не терять публикации в заметках, чатах и таблицах.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base shadow-md">
              <Link href="/signup">
                Начать бесплатно
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
              <a href="#pricing">Посмотреть тарифы</a>
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> без карты</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Free навсегда</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> тарифы от 299 ₽/мес</span>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {moneyStats.map((stat) => (
              <div key={stat.value} className="rounded-lg border border-border bg-card/80 p-4 shadow-xs backdrop-blur">
                <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-primary/15 via-background to-success/10 blur-2xl" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
              </div>
              <span className="text-xs text-muted-foreground">dashboard.postplan</span>
            </div>
            <Image
              src="/landing/dashboard-showcase.png"
              alt="Дашборд Постплан с очередью публикаций, календарём и статистикой каналов"
              width={1618}
              height={972}
              priority
              className="w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PainSection() {
  return (
    <section className="border-b border-border bg-surface-sunken/30 py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 md:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Badge variant="warning" className="mb-4">Проблема</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Пока канал маленький — хаос терпим. Когда появляется реклама — хаос начинает стоить денег.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Постплан нужен не ради красивого календаря. Он нужен, чтобы владелец канала не терял посты, клиентов и деньги.
          </p>
        </div>

        <div className="grid gap-3">
          {pains.map((pain, index) => (
            <div key={pain} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-sm font-semibold text-destructive">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-foreground">{pain}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="default" className="mb-4">Что внутри</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Не просто автопостинг. Кабинет для роста Telegram-проекта.
          </h2>
          <p className="mt-4 text-muted-foreground md:text-lg">
            Сначала ты планируешь посты. Потом добавляешь рекламодателей. Потом видишь, сколько реально приносит твоя сетка каналов.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group rounded-xl border border-border bg-card p-6 shadow-xs transition-base hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground transition-base group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="border-b border-border bg-card py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <Badge variant="success" className="mb-4">Запуск</Badge>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              От регистрации до первой публикации — без технической магии.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Пользователь должен быстро понять ценность: подключил канал, запланировал пост, увидел порядок в работе.
            </p>
            <Button asChild className="mt-7" size="lg">
              <Link href="/signup">
                Попробовать на своём канале
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {workflow.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border bg-background p-5 shadow-xs">
                <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonStrip() {
  return (
    <section className="border-b border-border bg-surface-sunken/40 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="text-center">
          <Badge variant="default" className="mb-4">Почему не Telegram?</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Telegram умеет отложить пост. Он не умеет вести бизнес вокруг канала.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Если ты просто публикуешь иногда — хватит Telegram. Если ты управляешь каналом как активом — нужен кабинет.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[1fr_110px_110px] border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid-cols-[1fr_140px_140px]">
            <div>Возможность</div>
            <div className="text-center">Постплан</div>
            <div className="text-center">Telegram</div>
          </div>
          {comparison.map((row, i) => (
            <div key={row.capability} className={`grid grid-cols-[1fr_110px_110px] items-center px-4 py-3 text-sm md:grid-cols-[1fr_140px_140px] ${i > 0 ? 'border-t border-border/60' : ''}`}>
              <div>{row.capability}</div>
              <div className="flex justify-center">
                {row.us ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground/40" />}
              </div>
              <div className="flex justify-center">
                {row.tg ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground/40" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tierKeys: SubscriptionTier[] = ['free', 'start', 'pro'];

  return (
    <section id="pricing" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="primary" className="mb-4">Тарифы</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Цена ниже, чем один потерянный рекламный пост.
          </h2>
          <p className="mt-4 text-muted-foreground md:text-lg">
            Начни бесплатно. Когда канал начнёт работать регулярно — выбери тариф под количество каналов.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-3">
          {tierKeys.map((tier) => {
            const config = TIERS[tier];
            const Icon = TIER_ICONS[tier];
            const isPopular = tier === 'start';
            const isPro = tier === 'pro';

            const features: { label: string; included: boolean }[] = [
              {
                label: `${formatLimit(config.limits.maxChannels)} ${config.limits.maxChannels === 1 ? 'канал' : 'каналов'}`,
                included: true,
              },
              {
                label: isUnlimited(config.limits.maxPostsPerMonth)
                  ? 'Безлимит постов'
                  : `${config.limits.maxPostsPerMonth} постов в месяц`,
                included: true,
              },
              {
                label: config.limits.maxCrosspostChannels > 1
                  ? `Кросспостинг до ${formatLimit(config.limits.maxCrosspostChannels)} каналов`
                  : 'Кросспостинг',
                included: config.limits.maxCrosspostChannels > 1,
              },
              { label: 'Шаблоны и подписи', included: config.limits.maxTemplates > 0 },
              { label: 'Очередь и календарь публикаций', included: true },
              { label: 'Работа с рекламодателями', included: tier !== 'free' },
            ];

            return (
              <div key={tier} className={`relative rounded-2xl border bg-card p-6 shadow-sm transition-base hover:-translate-y-1 hover:shadow-lg ${isPopular ? 'border-primary ring-1 ring-primary/25' : 'border-border'} ${isPro ? 'bg-foreground text-background' : ''}`}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="primary" className="px-3 py-1">лучший старт</Badge>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isPro ? 'bg-background text-foreground' : tier === 'start' ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="font-semibold">{config.name}</div>
                  </div>
                  {isPro && <Badge variant="outline" className="border-background/20 text-background">для сеток</Badge>}
                </div>

                <div className="mt-5 flex items-end gap-1">
                  <span className="text-5xl font-semibold tracking-tight">{config.priceRub}</span>
                  <span className={`pb-2 text-sm ${isPro ? 'text-background/65' : 'text-muted-foreground'}`}>₽ / мес</span>
                </div>

                <p className={`mt-3 text-sm leading-6 ${isPro ? 'text-background/70' : 'text-muted-foreground'}`}>
                  {tier === 'free'
                    ? 'Попробовать механику и подключить первый канал.'
                    : tier === 'start'
                    ? 'Оптимальный тариф для одного владельца нескольких каналов.'
                    : 'Для тех, кто ведёт сетку каналов и регулярно продаёт рекламу.'}
                </p>

                <ul className="mt-6 space-y-2.5 text-sm">
                  {features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 ${!f.included ? isPro ? 'text-background/35' : 'text-muted-foreground/55' : ''}`}>
                      {f.included ? <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isPro ? 'text-success' : 'text-success'}`} /> : <X className="mt-0.5 h-4 w-4 shrink-0 opacity-40" />}
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className={`mt-7 w-full ${isPro ? 'bg-background text-foreground hover:bg-background/90' : ''}`} variant={isPopular || isPro ? 'default' : 'outline'} size="lg">
                  <Link href="/signup">
                    {tier === 'free' ? 'Начать бесплатно' : `Выбрать ${config.name}`}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> оплата через YooKassa</span>
          <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /> цены в рублях</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> перейти на тариф можно в любой момент</span>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="border-b border-border bg-card py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="text-center">
          <Badge variant="default" className="mb-4">Вопросы</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Перед оплатой обычно спрашивают это</h2>
        </div>

        <div className="mt-10 space-y-3">
          {faq.map((item) => (
            <details key={item.q} className="group rounded-xl border border-border bg-background p-5 transition-base open:shadow-sm">
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-medium">
                <span>{item.q}</span>
                <span className="mt-1 text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.16),transparent_60%)]" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 text-center md:px-6">
        <Badge variant="primary" className="mb-5 px-3 py-1">
          <Radio className="h-3 w-3" />
          Проверь на своём канале
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
          Лучше один раз увидеть порядок в кабинете, чем ещё месяц вести канал в заметках.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground md:text-lg">
          Зарегистрируйся, подключи Telegram-бота и запланируй первый пост. Без карты и без риска.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base shadow-md">
            <Link href="/signup">
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
            <Link href="/login">У меня уже есть аккаунт</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xs text-muted-foreground">© 2026 Постплан</span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Возможности</a>
            <a href="#workflow" className="hover:text-foreground">Как работает</a>
            <a href="#pricing" className="hover:text-foreground">Тарифы</a>
            <a href="#faq" className="hover:text-foreground">Вопросы</a>
            <Link href="/login" className="hover:text-foreground">Войти</Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground">Конфиденциальность</Link>
          <Link href="/legal/terms" className="hover:text-foreground">Условия использования</Link>
          <Link href="/legal/offer" className="hover:text-foreground">Публичная оферта</Link>
          <a href="mailto:hello@postplan-tg.ru" className="hover:text-foreground">hello@postplan-tg.ru</a>
        </div>
      </div>
    </footer>
  );
}
