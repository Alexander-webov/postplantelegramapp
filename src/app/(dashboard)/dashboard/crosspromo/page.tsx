import { Repeat, ShieldCheck, Users, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { getEffectiveTier } from '@/lib/usage';
import { getTierLimits, isUnlimited, TIERS } from '@/lib/tiers';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { topicLabel } from '@/lib/crosspromo/topics';
import { CpListingManager } from '@/components/dashboard/crosspromo/listing-manager';
import Link from 'next/link';

export const metadata = { title: 'Взаимопиар' };

type ChannelRow = { id: string; title: string; username: string | null; subscriber_count: number | null; is_active: boolean };
type ListingRow = {
  id: string;
  channel_id: string;
  topic: string;
  avg_reach: number;
  subscriber_count: number;
  weekly_slots: number;
  min_partner_reach_pct: number;
  description: string | null;
  status: 'active' | 'paused';
};

export default async function CrosspromoPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();
  const tier = getEffectiveTier(profile);
  const limits = getTierLimits(tier);

  const [{ data: channels }, { data: listings }, { data: usage }] = await Promise.all([
    supabase
      .from('channels')
      .select('id, title, username, subscriber_count, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('cp_listings')
      .select('id, channel_id, topic, avg_reach, subscriber_count, weekly_slots, min_partner_reach_pct, description, status')
      .eq('user_id', user.id),
    supabase.from('cp_weekly_usage').select('deals_this_week').eq('user_id', user.id).maybeSingle(),
  ]);

  const channelRows = (channels ?? []) as ChannelRow[];
  const listingRows = (listings ?? []) as ListingRow[];
  const dealsThisWeek = (usage as { deals_this_week?: number } | null)?.deals_this_week ?? 0;
  const weeklyLimit = limits.maxCrosspromoSlotsPerWeek;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Рост канала"
        title="Взаимопиар"
        description="Обменивайся постами с каналами твоего размера и тематики. Постплан подберёт партнёра, поставит взаимные посты и проверит, что обе стороны честно опубликовали."
        action={
          <Link
            href="/dashboard/crosspromo/deals"
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium transition-base hover:border-border-strong"
          >
            <Repeat className="h-4 w-4" /> Мои сделки
          </Link>
        }
      />

      {/* Weekly limit banner */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Сделок взаимопиара на этой неделе: </span>
            <span className="font-semibold">
              {dealsThisWeek}
              {isUnlimited(weeklyLimit) ? '' : ` / ${weeklyLimit}`}
            </span>
          </div>
          {!isUnlimited(weeklyLimit) && (
            <Link href="/dashboard/billing" className="text-sm font-medium text-primary hover:underline">
              {tier === 'free'
                ? `Free: ${weeklyLimit}/нед → Профи без лимита`
                : `${TIERS[tier].name}: ${weeklyLimit}/нед → Профи без лимита`}
            </Link>
          )}
        </CardContent>
      </Card>

      {channelRows.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Сначала добавьте канал"
          description="Чтобы участвовать во взаимопиаре, нужен хотя бы один подключённый канал."
          action={
            <Link
              href="/dashboard/channels"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Добавить канал
            </Link>
          }
        />
      ) : (
        <CpListingManager
          channels={channelRows.map((c) => ({
            id: c.id,
            title: c.title,
            username: c.username,
            subscriber_count: c.subscriber_count ?? 0,
            is_active: c.is_active,
          }))}
          listings={listingRows}
        />
      )}

      {/* How it works */}
      <Card>
        <CardContent className="py-5">
          <h3 className="mb-3 text-sm font-semibold">Как это работает</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Step icon={Users} title="1. Выстави канал" text="Выбери тематику и сколько ВП в неделю готов делать. Постплан зафиксирует твой реальный охват." />
            <Step icon={Eye} title="2. Найди партнёра" text="Постплан подберёт каналы твоего размера и тематики. Договоритесь — посты ставятся автоматически." />
            <Step icon={ShieldCheck} title="3. Проверка честности" text="После публикации Постплан проверит, что оба опубликовали и не удалили рано. Так растёт твой Verified-бейдж." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}
