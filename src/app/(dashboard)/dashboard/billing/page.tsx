import Link from 'next/link';
import {
  Check, X, AlertCircle, CreditCard, Calendar, Receipt,
  CheckCircle2, XCircle, Clock as ClockIcon, Sparkles, Zap, Crown,
} from 'lucide-react';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { getUsage, getEffectiveTier, isSubscriptionExpired } from '@/lib/usage';
import { TIERS, isUnlimited, formatLimit, type SubscriptionTier } from '@/lib/tiers';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { LocalTimeLabel } from '@/components/dashboard/local-time-label';
import { UpgradeButton } from '@/components/dashboard/upgrade-button';

export const metadata = { title: 'Тариф и оплата' };

const TIER_ORDER: SubscriptionTier[] = ['free', 'start', 'pro'];
const TIER_ICONS: Record<SubscriptionTier, typeof Sparkles> = {
  free: Sparkles,
  start: Zap,
  pro: Crown,
};

export default async function BillingPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const currentTier = getEffectiveTier(profile);
  const expired = isSubscriptionExpired(profile);
  const usage = await getUsage(user.id);

  const supabase = await createClient();
  const { data: payments } = await supabase
    .from('payments')
    .select('id, tier, amount_rub, status, paid, created_at, payment_method_type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Тариф и оплата"
        description="Текущий план, использование лимитов и история платежей."
      />

      {/* Expired banner */}
      {expired && (
        <Card className="border-warning/40 bg-warning-soft">
          <CardContent className="flex items-start gap-4 p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Подписка истекла</p>
              <p className="text-sm text-muted-foreground">
                Доступ к функциям тарифа{' '}
                <strong>{TIERS[(profile.subscription_tier ?? 'free') as SubscriptionTier].name}</strong> закончился{' '}
                {profile.subscription_expires_at && (
                  <LocalTimeLabel utcIso={profile.subscription_expires_at} />
                )}
                . Сейчас действуют лимиты Free.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current tier + usage */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Текущий тариф
                </div>
                <div className="text-lg font-semibold">{TIERS[currentTier].name}</div>
              </div>
            </div>
            {!expired && currentTier !== 'free' && profile.subscription_expires_at && (
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Действует до
                </div>
                <div className="text-sm font-medium tabular-nums">
                  <LocalTimeLabel utcIso={profile.subscription_expires_at} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <UsageCard
              label="Каналы"
              current={usage.channels}
              limit={TIERS[currentTier].limits.maxChannels}
            />
            <UsageCard
              label="Постов в месяце"
              current={usage.postsThisMonth}
              limit={TIERS[currentTier].limits.maxPostsPerMonth}
            />
            <UsageCard
              label="Шаблоны"
              current={usage.templates}
              limit={TIERS[currentTier].limits.maxTemplates}
            />
          </div>
        </CardContent>
      </Card>

      {/* Plans grid */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Все тарифы</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {TIER_ORDER.map((tierKey) => (
            <PlanCard
              key={tierKey}
              tier={tierKey}
              isCurrent={tierKey === currentTier}
              isExpired={expired && tierKey === profile.subscription_tier}
            />
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Оплата картой через YooKassa · цены в ₽ · НДС включён · возврат в течение 7 дней
        </p>
      </div>

      {/* Payment history */}
      {payments && payments.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            История платежей
          </h2>
          <Card>
            <CardContent className="p-2">
              {payments.map((p, i) => {
                const StatusIcon =
                  p.status === 'succeeded' && p.paid
                    ? CheckCircle2
                    : p.status === 'canceled'
                    ? XCircle
                    : ClockIcon;
                const statusBadge =
                  p.status === 'succeeded' && p.paid
                    ? ('success' as const)
                    : p.status === 'canceled'
                    ? ('destructive' as const)
                    : ('warning' as const);
                const statusLabel =
                  p.status === 'succeeded' && p.paid
                    ? 'Оплачено'
                    : p.status === 'canceled'
                    ? 'Отменено'
                    : p.status === 'pending'
                    ? 'Ожидает оплаты'
                    : p.status;
                const statusColor =
                  p.status === 'succeeded' && p.paid
                    ? 'text-success'
                    : p.status === 'canceled'
                    ? 'text-destructive'
                    : 'text-warning';

                return (
                  <div key={p.id}>
                    {i > 0 && <div className="h-px bg-border/60" />}
                    <div className="flex items-center gap-3 rounded-sm px-3 py-3 transition-base hover:bg-accent/50">
                      <StatusIcon className={`h-4 w-4 shrink-0 ${statusColor}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {TIERS[p.tier as SubscriptionTier]?.name ?? p.tier} · {p.amount_rub} ₽
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <LocalTimeLabel utcIso={p.created_at} />
                          {p.payment_method_type && ` · ${p.payment_method_type}`}
                        </div>
                      </div>
                      <Badge variant={statusBadge} className="shrink-0">
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

/* ----------------------------- helpers ----------------------------------- */

function UsageCard({ label, current, limit }: { label: string; current: number; limit: number }) {
  const unlimited = isUnlimited(limit);
  const percent = unlimited ? 0 : limit > 0 ? Math.min(100, (current / limit) * 100) : 100;
  const nearLimit = !unlimited && percent >= 80;
  const overLimit = !unlimited && current >= limit;

  return (
    <div className="space-y-2 rounded-sm border border-border bg-surface-sunken/30 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold tabular-nums ${overLimit ? 'text-destructive' : ''}`}>
          {current}
        </span>
        <span className="text-sm text-muted-foreground">/ {formatLimit(limit)}</span>
      </div>
      {!unlimited && limit > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-base ${
              overLimit ? 'bg-destructive' : nearLimit ? 'bg-warning' : 'bg-primary'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PlanCard({
  tier,
  isCurrent,
  isExpired,
}: {
  tier: SubscriptionTier;
  isCurrent: boolean;
  isExpired: boolean;
}) {
  const config = TIERS[tier];
  const isFree = tier === 'free';
  const isPopular = tier === 'start' && !isCurrent;
  const TierIcon = TIER_ICONS[tier];

  const features: { label: string; included: boolean }[] = [
    {
      label: `${formatLimit(config.limits.maxChannels)} ${config.limits.maxChannels === 1 ? 'канал' : 'каналов'}`,
      included: true,
    },
    {
      label: isUnlimited(config.limits.maxPostsPerMonth)
        ? 'Безлимит постов'
        : `${config.limits.maxPostsPerMonth} постов/мес`,
      included: true,
    },
    {
      label: config.limits.maxCrosspostChannels > 1
        ? `Кросспостинг до ${formatLimit(config.limits.maxCrosspostChannels)} каналов`
        : 'Кросспостинг',
      included: config.limits.maxCrosspostChannels > 1,
    },
    {
      label: 'Шаблоны постов и подписи',
      included: config.limits.maxTemplates > 0,
    },
    { label: 'Расписание до 3 месяцев', included: true },
    { label: 'Медиа: фото, видео, GIF, альбомы', included: true },
  ];

  return (
    <Card
      className={`relative flex flex-col ${
        isCurrent && !isExpired
          ? 'border-primary shadow-lg ring-1 ring-primary/30'
          : isPopular
          ? 'border-primary/40 shadow-sm'
          : ''
      }`}
    >
      {/* Top badge */}
      {(isCurrent && !isExpired) && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge variant="primary" className="px-2.5 py-0.5">текущий</Badge>
        </div>
      )}
      {isPopular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge variant="warning" className="px-2.5 py-0.5">популярный</Badge>
        </div>
      )}

      <div className="px-5 pt-6">
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
            <TierIcon className="h-4 w-4" />
          </div>
          <div className="font-semibold">{config.name}</div>
        </div>
        <div className="mt-3 space-y-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold tracking-tight">
              {config.priceRub === 0 ? '0' : config.priceRub}
            </span>
            <span className="text-sm text-muted-foreground">
              ₽{config.priceRub > 0 && ' / мес'}
            </span>
          </div>
        </div>
      </div>

      <CardContent className="flex-1 space-y-4 pt-4">
        <ul className="space-y-2 text-sm">
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

        <div className="pt-2">
          {isFree ? (
            isCurrent ? (
              <Button variant="secondary" disabled className="w-full">
                Активный тариф
              </Button>
            ) : (
              <Button variant="outline" disabled className="w-full">
                Бесплатный
              </Button>
            )
          ) : isCurrent && !isExpired ? (
            <Button variant="secondary" disabled className="w-full">
              Активный тариф
            </Button>
          ) : (
            <UpgradeButton tier={tier} priceRub={config.priceRub} tierName={config.name} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
