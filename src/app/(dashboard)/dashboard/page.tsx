import Link from 'next/link';
import {
  Radio, Send, Plus, Clock, ArrowRight, Sparkles, Zap, AlertCircle, CheckCircle2, FileText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { getEffectiveTier, isSubscriptionExpired, getUsage } from '@/lib/usage';
import { TIERS, isUnlimited } from '@/lib/tiers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { LocalTimeLabel } from '@/components/dashboard/local-time-label';
import { ActivationChecklist } from '@/components/dashboard/activation-checklist';

export const metadata = { title: 'Обзор' };

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const tier = getEffectiveTier(profile);
  const expired = isSubscriptionExpired(profile);
  const tierConfig = TIERS[tier];
  const supabase = await createClient();

  const usage = await getUsage(user.id);

  const [
    { count: scheduledCount },
    recentRes,
    channelsRes,
    { count: sentCount },
    { count: templatesCount },
    { count: advertisersCount },
  ] = await Promise.all([
    supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending'),
    supabase
      .from('scheduled_posts')
      .select('id, status, scheduled_at, sent_at, posts(content), channels(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('channels')
      .select('id, title, username, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'sent'),
    supabase
      .from('templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('advertisers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('archived_at', null),
  ]);

  const recent = recentRes.data ?? [];
  const channels = channelsRes.data ?? [];
  const hasChannels = channels.length > 0;
  const hasPostedAtLeastOnce = (sentCount ?? 0) > 0;
  const hasTemplates = (templatesCount ?? 0) > 0;
  const hasFirstAdvertiser = (advertisersCount ?? 0) > 0;
  const allOnboardingDone = hasChannels && hasPostedAtLeastOnce && hasTemplates && hasFirstAdvertiser;
  const firstName = (profile.full_name ?? profile.email).split(/\s|@/)[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={greetingByHour()}
        title={hasChannels ? `Привет, ${firstName}` : `С приходом, ${firstName}`}
        description={
          hasChannels
            ? 'Вот что происходит в твоих каналах сегодня.'
            : 'Подключи свой первый канал — это займёт меньше минуты.'
        }
        action={
          hasChannels && (
            <Button asChild size="lg">
              <Link href="/dashboard/posts/new">
                <Plus className="h-4 w-4" />
                Создать пост
              </Link>
            </Button>
          )
        }
      />

      {/* Subscription banner */}
      {expired && (
        <SubscriptionBanner
          tone="warning"
          icon={AlertCircle}
          title="Подписка истекла"
          description="Сейчас действуют лимиты Free. Продли подписку чтобы вернуть доступ."
          ctaLabel="Продлить"
          ctaHref="/dashboard/billing"
        />
      )}

      {!expired && tier === 'free' && (
        <SubscriptionBanner
          tone="primary"
          icon={Sparkles}
          title="Тариф Free — попробуй больше"
          description="Базовый — 299 ₽/мес: 5 каналов, безлимит постов, шаблоны и кросспостинг."
          ctaLabel="Тарифы"
          ctaHref="/dashboard/billing"
        />
      )}

      {/* Onboarding (empty state) */}
      {!hasChannels ? (
        <OnboardingCard />
      ) : (
        <>
          {/* Activation checklist — shown until all 4 milestones done */}
          {!allOnboardingDone && (
            <ActivationChecklist
              hasChannels={hasChannels}
              hasPostedAtLeastOnce={hasPostedAtLeastOnce}
              hasTemplates={hasTemplates}
              hasFirstAdvertiser={hasFirstAdvertiser}
            />
          )}

          {/* Stats grid */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Каналов"
              value={usage.channels}
              limit={tierConfig.limits.maxChannels}
              icon={Radio}
              href="/dashboard/channels"
            />
            <StatCard
              label="Постов в этом месяце"
              value={usage.postsThisMonth}
              limit={tierConfig.limits.maxPostsPerMonth}
              icon={Zap}
              href="/dashboard/queue"
            />
            <StatCard
              label="В очереди"
              value={scheduledCount ?? 0}
              icon={Clock}
              href="/dashboard/queue"
              accent
            />
          </div>

          {/* 2-column: recent activity + channels */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between px-5 pt-5">
                <h3 className="text-base font-semibold">Последняя активность</h3>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/dashboard/queue">
                    Вся очередь
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <CardContent className="pt-3">
                {recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Пока ничего нет. Создай свой первый пост.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {recent.map((row) => {
                      const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
                      const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
                      const when = row.sent_at ?? row.scheduled_at;
                      return (
                        <div
                          key={row.id}
                          className="flex items-start gap-3 rounded-sm px-2 py-2.5 transition-base hover:bg-accent"
                        >
                          <ActivityDot status={row.status} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 text-sm">
                              <span className="font-medium text-foreground">
                                {channel?.title ?? '—'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <LocalTimeLabel utcIso={when} />
                              </span>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {post?.content?.slice(0, 80) || '(без текста)'}
                            </p>
                          </div>
                          <ActivityBadge status={row.status} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <div className="flex items-center justify-between px-5 pt-5">
                <h3 className="text-base font-semibold">Каналы</h3>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/dashboard/channels">
                    Все
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <CardContent className="pt-3">
                <div className="space-y-1">
                  {channels.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center gap-2 rounded-sm px-2 py-2 transition-base hover:bg-accent"
                    >
                      <div className={`h-2 w-2 rounded-full ${ch.is_active ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{ch.title}</div>
                        {ch.username && (
                          <div className="truncate text-xs text-muted-foreground">@{ch.username}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- helpers ----------------------------------- */

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Глубокая ночь';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  if (h < 23) return 'Добрый вечер';
  return 'Глубокая ночь';
}

function StatCard({
  label, value, limit, icon: Icon, href, accent,
}: {
  label: string;
  value: number;
  limit?: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  accent?: boolean;
}) {
  const showLimit = limit !== undefined && !isUnlimited(limit);
  const percent = showLimit && limit! > 0 ? Math.min(100, (value / limit!) * 100) : 0;
  const isAtLimit = showLimit && value >= limit!;

  return (
    <Link href={href} className="group block">
      <Card className={`hover-lift h-full ${accent ? 'border-primary/30 bg-primary-soft/40' : ''}`}>
        <CardContent className="flex items-start gap-4 p-5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${
              accent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-2xl font-semibold tracking-tight ${isAtLimit ? 'text-destructive' : ''}`}>
                {value}
              </span>
              {showLimit && (
                <span className="text-xs text-muted-foreground">/ {limit}</span>
              )}
              {!showLimit && limit !== undefined && (
                <span className="text-xs text-muted-foreground">/ ∞</span>
              )}
            </div>
            {showLimit && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-base ${
                    isAtLimit ? 'bg-destructive' : percent > 75 ? 'bg-warning' : 'bg-primary'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SubscriptionBanner({
  tone, icon: Icon, title, description, ctaLabel, ctaHref,
}: {
  tone: 'primary' | 'warning';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const toneClasses =
    tone === 'warning'
      ? 'border-warning/40 bg-warning-soft text-foreground'
      : 'border-primary/30 bg-primary-soft text-foreground';
  const iconColor = tone === 'warning' ? 'text-warning' : 'text-primary';

  return (
    <div className={`flex items-center gap-4 rounded-lg border p-4 ${toneClasses}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-card shadow-xs`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Button asChild size="sm">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

function OnboardingCard() {
  return (
    <Card className="overflow-hidden">
      <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        {/* decorative gradient */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.3), transparent)' }}
          aria-hidden
        />
        <div className="relative space-y-4">
          <Badge variant="primary">
            <Sparkles className="h-3 w-3" />
            Начинаем
          </Badge>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            Подключи Telegram-канал — займёт минуту
          </h2>
          <ol className="space-y-2.5 text-sm text-muted-foreground">
            <OnboardingStep n={1}>
              Открой <span className="kbd">@BotFather</span> в Telegram и создай нового бота — получишь токен
            </OnboardingStep>
            <OnboardingStep n={2}>
              Вставь токен в Постплан — мы зашифруем его и сохраним
            </OnboardingStep>
            <OnboardingStep n={3}>
              Добавь бота администратором в свой канал
            </OnboardingStep>
            <OnboardingStep n={4}>
              Введи <span className="kbd">@username</span> канала — мы проверим и подключим
            </OnboardingStep>
          </ol>
          <Button asChild size="lg">
            <Link href="/dashboard/channels/connect">
              Подключить первого бота
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OnboardingStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-medium text-primary-soft-foreground">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function ActivityDot({ status }: { status: string }) {
  if (status === 'sent') return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />;
  if (status === 'failed') return <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />;
  if (status === 'pending') return <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />;
  return <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />;
}

function ActivityBadge({ status }: { status: string }) {
  if (status === 'sent') return <Badge variant="success">отправлен</Badge>;
  if (status === 'failed') return <Badge variant="destructive">ошибка</Badge>;
  if (status === 'pending') return <Badge variant="primary">в очереди</Badge>;
  if (status === 'cancelled') return <Badge>отменён</Badge>;
  return <Badge>{status}</Badge>;
}
