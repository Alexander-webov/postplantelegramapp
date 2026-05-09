import Link from 'next/link';
import {
  ArrowRight, Check, X, Calendar, Layers, FileText, Image as ImageIcon,
  Globe, Sparkles, Zap, Crown, MessageCircleQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/dashboard/logo';
import { TIERS, formatLimit, isUnlimited, type SubscriptionTier } from '@/lib/tiers';

export const metadata = {
  title: 'Постплан — один кабинет для всех твоих Telegram-каналов',
  description:
    'Расписание постов до 3 месяцев, шаблоны, кросспостинг, медиа и подписи. Free навсегда, платный тариф от 149 ₽/мес.',
};

const TIER_ICONS: Record<SubscriptionTier, typeof Sparkles> = {
  free: Sparkles, start: Zap, pro: Crown,
};

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main>
        <Hero />
        <Features />
        <ComparisonStrip />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>

      <PublicFooter />
    </div>
  );
}

/* ============================================================================ */
/*  HEADER                                                                      */
/* ============================================================================ */

function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="transition-base hover:opacity-80">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-base hover:text-foreground">Возможности</a>
          <a href="#pricing" className="transition-base hover:text-foreground">Тарифы</a>
          <a href="#faq" className="transition-base hover:text-foreground">Вопросы</a>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Войти</Link>
          </Button>
          <Button asChild size="sm">
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

/* ============================================================================ */
/*  HERO                                                                        */
/* ============================================================================ */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent)' }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-up">
            <Badge variant="primary" className="mb-5">
              <Sparkles className="h-3 w-3" />
              Сделано в России для русскоязычных админов
            </Badge>
          </div>

          <h1 className="animate-fade-up animate-fade-up-delay-1 text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
            Один кабинет для всех твоих{' '}
            <span className="text-primary">Telegram-каналов</span>
          </h1>

          <p className="animate-fade-up animate-fade-up-delay-2 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Планируй посты на месяцы вперёд, постй в десятки каналов одной кнопкой,
            шаблоны и подписи — экономят часы каждую неделю.
          </p>

          <div className="animate-fade-up animate-fade-up-delay-3 mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Начать бесплатно
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#features">Что внутри</a>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Без карты · Free навсегда · Платный тариф от 149 ₽/мес <span className="text-success">(−50% при запуске)</span>
          </p>
        </div>

        {/* Dashboard mockup placeholder */}
        <div className="animate-fade-up animate-fade-up-delay-3 mt-16">
          <div className="relative mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              {/* TODO: replace with real dashboard screenshot — e.g. /screenshots/dashboard-light.png */}
              <DashboardMockup />
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 -bottom-10 h-32 bg-gradient-to-t from-background to-transparent"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* SVG mockup — placeholder until you screenshot the real dashboard */
function DashboardMockup() {
  return (
    <svg viewBox="0 0 1000 600" className="w-full" aria-hidden role="presentation">
      {/* Background */}
      <rect width="1000" height="600" fill="hsl(var(--surface-raised))" />
      {/* Sidebar */}
      <rect x="0" y="0" width="220" height="600" fill="hsl(var(--background))" />
      <rect x="0" y="0" width="220" height="600" stroke="hsl(var(--border))" fill="none" />
      {/* Sidebar items */}
      <rect x="14" y="20" width="120" height="20" rx="4" fill="hsl(var(--primary))" opacity="0.9" />
      <rect x="14" y="80" width="100" height="14" rx="3" fill="hsl(var(--muted))" />
      <rect x="14" y="105" width="140" height="14" rx="3" fill="hsl(var(--muted))" />
      <rect x="14" y="130" width="80" height="14" rx="3" fill="hsl(var(--muted))" />
      <rect x="14" y="155" width="110" height="14" rx="3" fill="hsl(var(--primary-soft))" />
      {/* Main area */}
      <rect x="240" y="40" width="300" height="32" rx="4" fill="hsl(var(--foreground))" opacity="0.85" />
      <rect x="240" y="84" width="500" height="14" rx="3" fill="hsl(var(--muted-foreground))" opacity="0.4" />
      {/* Stat cards */}
      <rect x="240" y="130" width="230" height="100" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <rect x="490" y="130" width="230" height="100" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <rect x="740" y="130" width="230" height="100" rx="8" fill="hsl(var(--primary-soft))" stroke="hsl(var(--primary))" strokeOpacity="0.3" />
      {/* Activity card */}
      <rect x="240" y="260" width="480" height="300" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <rect x="260" y="280" width="180" height="16" rx="3" fill="hsl(var(--foreground))" opacity="0.8" />
      {/* Activity rows */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(260, ${320 + i * 56})`}>
          <circle cx="8" cy="20" r="4" fill="hsl(var(--success))" />
          <rect x="22" y="8" width="160" height="12" rx="2" fill="hsl(var(--foreground))" opacity="0.6" />
          <rect x="22" y="26" width="280" height="10" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4" />
          <rect x="380" y="14" width="60" height="14" rx="7" fill="hsl(var(--success-soft))" />
        </g>
      ))}
      {/* Side card */}
      <rect x="740" y="260" width="230" height="300" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <rect x="760" y="280" width="100" height="16" rx="3" fill="hsl(var(--foreground))" opacity="0.8" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(760, ${320 + i * 50})`}>
          <circle cx="6" cy="14" r="3" fill="hsl(var(--success))" />
          <rect x="18" y="4" width="120" height="10" rx="2" fill="hsl(var(--foreground))" opacity="0.7" />
          <rect x="18" y="20" width="80" height="8" rx="2" fill="hsl(var(--muted-foreground))" opacity="0.4" />
        </g>
      ))}
    </svg>
  );
}

/* ============================================================================ */
/*  FEATURES                                                                    */
/* ============================================================================ */

const features = [
  {
    icon: Calendar,
    title: 'Расписание до 3 месяцев',
    description:
      'Запланируй посты на квартал вперёд. Удобный пикер с таймзонами — UTC хранится автоматически, отображается в твоём часовом поясе.',
  },
  {
    icon: Layers,
    title: 'Кросспостинг в 50 каналов',
    description:
      'Один пост — десятки каналов. Мульти-выбор с поиском и опцией «свой текст для каждого канала». Защита от Telegram rate-limit встроена.',
  },
  {
    icon: FileText,
    title: 'Шаблоны и подписи',
    description:
      'Готовые посты с переменными ({{date}}, {{channel_username}}), наборы хештегов, автоматические подписи к каждому посту.',
  },
  {
    icon: ImageIcon,
    title: 'Медиа любого формата',
    description:
      'Фото, видео, GIF, альбомы до 10 элементов. Загрузка прямо в композер, превью, drag-n-drop переупорядочивание.',
  },
  {
    icon: Globe,
    title: 'Все таймзоны',
    description:
      'Канал в Москве, ты в Бруклине, аудитория в Алматы — пост уйдёт в нужное локальное время. Никаких ручных вычислений.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Редактирование на лету',
    description:
      'Меняй запланированные посты до отправки. Редактируй уже опубликованные через Bot API в окне 48 часов Telegram.',
  },
];

function Features() {
  return (
    <section id="features" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="default" className="mb-4">Возможности</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Всё для управления Telegram-каналами
          </h2>
          <p className="mt-4 text-muted-foreground">
            Не очередной автопостинг. Постплан умеет то, чего нет в нативных «запланированных сообщениях» Telegram.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-lg border border-border bg-card p-6 transition-base hover:border-border-strong hover:shadow-sm"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-sm bg-primary-soft text-primary-soft-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================ */
/*  COMPARISON STRIP                                                            */
/* ============================================================================ */

const comparison = [
  { capability: 'Запланировать пост на дату', us: true, tg: true },
  { capability: 'Один пост в несколько каналов', us: true, tg: false },
  { capability: 'Шаблоны постов и подписи', us: true, tg: false },
  { capability: 'Управление 50+ каналами в одном месте', us: true, tg: false },
  { capability: 'Удобный календарь и очередь', us: true, tg: false },
  { capability: 'Переменные ({{date}}, {{username}})', us: true, tg: false },
  { capability: 'Расписание до 3 месяцев', us: true, tg: true },
];

function ComparisonStrip() {
  return (
    <section className="border-b border-border bg-surface-sunken/30 py-20">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <div className="text-center">
          <Badge variant="default" className="mb-4">Telegram сам это умеет?</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Не всё. Сравнение с нативным «запланированным» в Telegram
          </h2>
          <p className="mt-4 text-muted-foreground">
            Telegram умеет ставить пост на завтра — но не управлять сеткой каналов.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[1fr_120px_120px] border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <div>Что умеет</div>
            <div className="text-center">Постплан</div>
            <div className="text-center">Telegram</div>
          </div>
          {comparison.map((row, i) => (
            <div
              key={row.capability}
              className={`grid grid-cols-[1fr_120px_120px] items-center px-4 py-3 text-sm ${
                i > 0 ? 'border-t border-border/60' : ''
              }`}
            >
              <div>{row.capability}</div>
              <div className="flex justify-center">
                {row.us ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex justify-center">
                {row.tg ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================ */
/*  PRICING                                                                     */
/* ============================================================================ */

function Pricing() {
  const tierKeys: SubscriptionTier[] = ['free', 'start', 'pro'];

  return (
    <section id="pricing" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="default" className="mb-4">Тарифы</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Прозрачные цены. Без триалов и скрытых платежей.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Free навсегда — без срока годности. Когда лимита станет мало — апгрейд за пару кликов.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
          {tierKeys.map((tier) => {
            const config = TIERS[tier];
            const Icon = TIER_ICONS[tier];
            const isPopular = tier === 'start';

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
              { label: 'Расписание до 3 месяцев', included: true },
              { label: 'Медиа: фото, видео, GIF, альбомы', included: true },
            ];

            return (
              <div
                key={tier}
                className={`relative rounded-lg border bg-card p-6 transition-base ${
                  isPopular
                    ? 'border-primary shadow-lg ring-1 ring-primary/30'
                    : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge variant="primary" className="px-2.5 py-0.5">популярный</Badge>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-sm ${
                      tier === 'pro'
                        ? 'bg-primary text-primary-foreground'
                        : tier === 'start'
                        ? 'bg-primary-soft text-primary-soft-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="font-semibold">{config.name}</div>
                </div>

                <div className="mt-3 space-y-1">
                  {config.promoPriceRub !== null && config.priceRub > 0 ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold tracking-tight">
                          {config.promoPriceRub}
                        </span>
                        <span className="text-sm text-muted-foreground">₽ / мес</span>
                        <span className="text-sm text-muted-foreground line-through opacity-60">
                          {config.priceRub} ₽
                        </span>
                      </div>
                      <p className="text-xs text-success">
                        −50% первые 3 месяца
                      </p>
                    </>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-semibold tracking-tight">
                        {config.priceRub === 0 ? '0' : config.priceRub}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ₽{config.priceRub > 0 && ' / мес'}
                      </span>
                    </div>
                  )}
                </div>

                <ul className="mt-6 space-y-2.5 text-sm">
                  {features.map((f, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 ${!f.included ? 'text-muted-foreground/60' : ''}`}
                    >
                      {f.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                      )}
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className="mt-6 w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  size="lg"
                >
                  <Link href="/signup">
                    {tier === 'free' ? 'Начать бесплатно' : `Выбрать ${config.name}`}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Оплата картой через YooKassa · цены в ₽ · НДС включён · возврат в течение 7 дней
        </p>
      </div>
    </section>
  );
}

/* ============================================================================ */
/*  FAQ                                                                         */
/* ============================================================================ */

const faq = [
  {
    q: 'Чем отличается от нативных «запланированных сообщений» Telegram?',
    a: 'Нативное расписание Telegram работает только с одним каналом за раз. Постплан — это календарь и кабинет для управления десятками каналов одновременно: кросспостинг, шаблоны, подписи, удобная очередь с возможностью редактировать каждый пост, переменные. Если у тебя 1 канал и 5 постов в месяц — родного хватит. Если канал не один — Постплан экономит часы.',
  },
  {
    q: 'Безопасно ли подключать бота через Постплан?',
    a: 'Да. Мы используем только официальный Telegram Bot API — никаких «угонов» аккаунта или userbot\'ов. Ты сам создаёшь бота через @BotFather и добавляешь его админом в свой канал. Токен бота шифруется AES-256-GCM перед сохранением в БД. Если в любой момент захочешь отключиться — удали бота, и все доступы пропадают.',
  },
  {
    q: 'Что если я перейду на платный тариф, а потом передумаю?',
    a: 'Возврат в течение 7 дней с момента оплаты — без вопросов. После 7 дней — продолжишь до конца оплаченного периода, потом просто откатишься на Free. Деньги в Free тебя не блокируют — каналы и история сохраняются.',
  },
  {
    q: 'Сколько каналов и постов на бесплатном тарифе?',
    a: '1 канал и 10 постов в месяц. Этого хватит чтобы попробовать продукт целиком. Платный тариф «Базовый» сейчас 149 ₽/мес (−50% первые 3 месяца, потом 299 ₽) — 5 каналов и безлимит постов.',
  },
  {
    q: 'Постплан читает мои сообщения из канала?',
    a: 'Нет. Бот через API публикует посты которые ты отправил из Постплана. Мы не запрашиваем permission на чтение чужих сообщений в канале и не имеем к ним доступа. История того, что отправил Постплан, видна только тебе в твоём кабинете.',
  },
  {
    q: 'Как оплатить из РФ / СНГ?',
    a: 'Российские карты — через YooKassa (Visa/MasterCard/Мир, СБП). Карты СНГ — пишут на email, обсудим индивидуально. Stripe для международных карт добавим позже.',
  },
];

function FAQ() {
  return (
    <section id="faq" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="text-center">
          <Badge variant="default" className="mb-4">Вопросы</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Часто спрашивают
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {faq.map((item, i) => (
            <details
              key={i}
              className="group rounded-lg border border-border bg-card p-5 transition-base open:shadow-sm"
            >
              <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-medium">
                <span>{item.q}</span>
                <span className="mt-1 text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================ */
/*  FINAL CTA                                                                   */
/* ============================================================================ */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse at center, hsl(var(--primary) / 0.2), transparent 60%)',
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-4 text-center md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Подключи первый канал — это занимает минуту
        </h2>
        <p className="mt-4 text-muted-foreground">
          Без карты, без триала. Создавай аккаунт, добавляй бота, постй.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">У меня уже есть аккаунт</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================================ */
/*  FOOTER                                                                      */
/* ============================================================================ */

function PublicFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xs text-muted-foreground">© 2026 Постплан</span>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Возможности</a>
            <a href="#pricing" className="hover:text-foreground">Тарифы</a>
            <a href="#faq" className="hover:text-foreground">Вопросы</a>
            <Link href="/login" className="hover:text-foreground">Войти</Link>
            <Link href="/signup" className="hover:text-foreground">Регистрация</Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground">Конфиденциальность</Link>
          <Link href="/legal/terms" className="hover:text-foreground">Условия использования</Link>
          <Link href="/legal/offer" className="hover:text-foreground">Публичная оферта</Link>
          <a href="mailto:hello@postplan.app" className="hover:text-foreground">hello@postplan.app</a>
        </div>
      </div>
    </footer>
  );
}
