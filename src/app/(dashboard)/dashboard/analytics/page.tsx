import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Eye,
  Radio,
  Send,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { LocalTimeLabel } from '@/components/dashboard/local-time-label';
import { RefreshChannelStatsButton } from '@/components/dashboard/refresh-channel-stats-button';

export const metadata = { title: 'Аналитика' };

type SentPostRow = {
  id: string;
  channel_id: string;
  sent_at: string | null;
  views_latest: number | null;
  views_latest_at: string | null;
  views_1h: number | null;
  views_6h: number | null;
  views_24h: number | null;
  views_48h: number | null;
  views_error: string | null;
  posts: { content: string | null } | { content: string | null }[] | null;
  channels:
    | { id: string; title: string | null; username: string | null; subscriber_count: number | null }
    | { id: string; title: string | null; username: string | null; subscriber_count: number | null }[]
    | null;
};

type ChannelRow = {
  id: string;
  title: string;
  username: string | null;
  subscriber_count: number | null;
  last_synced_at: string | null;
  is_active: boolean | null;
};

type ChannelAnalyticsRow = {
  channel_id: string;
  subscriber_count: number;
  snapshot_date: string;
};

type PlacementRow = {
  id: string;
  price_rub: number | string | null;
  status: string;
  scheduled_posts:
    | { sent_at: string | null; channel_id: string | null }
    | { sent_at: string | null; channel_id: string | null }[]
    | null;
};

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtCompact(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function fmtRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}%`;
}

function getSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getPostPreview(content: string | null | undefined) {
  const text = content?.trim();
  if (!text) return '(без текста)';
  return text.length > 86 ? `${text.slice(0, 86)}…` : text;
}

function toNumber(value: number | string | null) {
  if (value === null) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const now = new Date();
  const today = startOfDay(now);
  const from30 = new Date(today.getTime() - 29 * DAY);
  const prevFrom30 = new Date(today.getTime() - 59 * DAY);
  const prevTo30 = new Date(today.getTime() - 30 * DAY);

  const [sentRes, channelsRes, channelAnalyticsRes, placementsRes] = await Promise.all([
    supabase
      .from('scheduled_posts')
      .select(`
        id, channel_id, sent_at,
        views_latest, views_latest_at, views_1h, views_6h, views_24h, views_48h, views_error,
        posts (content),
        channels (id, title, username, subscriber_count)
      `)
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .gte('sent_at', prevFrom30.toISOString())
      .order('sent_at', { ascending: false })
      .limit(500),
    supabase
      .from('channels')
      .select('id, title, username, subscriber_count, last_synced_at, is_active')
      .eq('user_id', user.id)
      .order('subscriber_count', { ascending: false }),
    supabase
      .from('channel_analytics')
      .select('channel_id, subscriber_count, snapshot_date')
      .gte('snapshot_date', from30.toISOString().slice(0, 10))
      .order('snapshot_date', { ascending: true }),
    supabase
      .from('ad_placements')
      .select('id, price_rub, status, scheduled_posts(sent_at, channel_id)')
      .eq('user_id', user.id)
      .in('status', ['paid', 'published', 'reported'])
      .limit(500),
  ]);

  const sent = ((sentRes.data ?? []) as SentPostRow[]).filter((row) => row.sent_at);
  const currentSent = sent.filter((row) => new Date(row.sent_at!).getTime() >= from30.getTime());
  const previousSent = sent.filter((row) => {
    const t = new Date(row.sent_at!).getTime();
    return t >= prevFrom30.getTime() && t < prevTo30.getTime();
  });
  const channels = (channelsRes.data ?? []) as ChannelRow[];
  const channelAnalytics = (channelAnalyticsRes.data ?? []) as ChannelAnalyticsRow[];
  const placements = (placementsRes.data ?? []) as PlacementRow[];

  const totalViews = currentSent.reduce((sum, row) => sum + (row.views_latest ?? 0), 0);
  const previousViews = previousSent.reduce((sum, row) => sum + (row.views_latest ?? 0), 0);
  const measuredPosts = currentSent.filter((row) => typeof row.views_latest === 'number').length;
  const avgViews = measuredPosts > 0 ? Math.round(totalViews / measuredPosts) : 0;
  const totalSubscribers = channels.reduce((sum, ch) => sum + (ch.subscriber_count ?? 0), 0);
  const revenue = placements.reduce((sum, placement) => sum + toNumber(placement.price_rub), 0);

  const viewsDelta = previousViews > 0 ? ((totalViews - previousViews) / previousViews) * 100 : 0;
  const postsDelta = previousSent.length > 0 ? ((currentSent.length - previousSent.length) / previousSent.length) * 100 : 0;

  const dailyViews = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today.getTime() - (13 - index) * DAY);
    const key = date.toISOString().slice(0, 10);
    const dayPosts = currentSent.filter((row) => row.sent_at?.slice(0, 10) === key);
    return {
      key,
      label: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      posts: dayPosts.length,
      views: dayPosts.reduce((sum, row) => sum + (row.views_latest ?? 0), 0),
    };
  });
  const maxDailyViews = Math.max(1, ...dailyViews.map((d) => d.views));

  const channelStats = channels.map((channel) => {
    const posts = currentSent.filter((row) => row.channel_id === channel.id);
    const views = posts.reduce((sum, row) => sum + (row.views_latest ?? 0), 0);
    const avg = posts.length > 0 ? Math.round(views / posts.length) : 0;
    const snapshots = channelAnalytics.filter((row) => row.channel_id === channel.id);
    const first = snapshots[0]?.subscriber_count ?? channel.subscriber_count ?? 0;
    const last = snapshots[snapshots.length - 1]?.subscriber_count ?? channel.subscriber_count ?? 0;
    return {
      ...channel,
      posts: posts.length,
      views,
      avg,
      subscribersDelta: last - first,
      engagement: channel.subscriber_count ? Math.round((avg / Math.max(channel.subscriber_count, 1)) * 100) : 0,
    };
  }).sort((a, b) => b.views - a.views || (b.subscriber_count ?? 0) - (a.subscriber_count ?? 0));

  const bestPosts = [...currentSent]
    .sort((a, b) => (b.views_latest ?? -1) - (a.views_latest ?? -1))
    .slice(0, 5);

  const latestMeasuredAt = currentSent
    .map((row) => row.views_latest_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Аналитика"
        description="Реальные просмотры, динамика каналов и рекламная выручка по опубликованным постам."
        action={<RefreshChannelStatsButton />}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Просмотры за 30 дней" value={fmtCompact(totalViews)} caption={previousViews > 0 ? `${percent(viewsDelta)} к прошлым 30 дням` : 'по замеренным постам'} icon={Eye} tone="blue" />
        <MetricCard label="Опубликовано" value={String(currentSent.length)} caption={previousSent.length > 0 ? `${percent(postsDelta)} к прошлым 30 дням` : 'постов за период'} icon={Send} tone="violet" />
        <MetricCard label="Средний охват" value={fmtCompact(avgViews)} caption={measuredPosts > 0 ? `${measuredPosts} постов с замером` : 'нужны замеры просмотров'} icon={TrendingUp} tone="emerald" />
        <MetricCard label="Рекламная выручка" value={fmtRub(revenue)} caption="paid / published / reported" icon={BarChart3} tone="amber" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Динамика просмотров</h2>
                <p className="mt-1 text-sm text-slate-500">Последние 14 дней по опубликованным постам.</p>
              </div>
              {latestMeasuredAt && <Badge variant="default" className="w-fit">обновлено <LocalTimeLabel utcIso={latestMeasuredAt} /></Badge>}
            </div>

            <div className="mt-8 flex h-64 items-end gap-2 border-b border-slate-100 pb-3">
              {dailyViews.map((day) => {
                const height = Math.max(6, Math.round((day.views / maxDailyViews) * 100));
                return (
                  <Link key={day.key} href={`/dashboard/queue?date=${day.key}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                    <div className="flex flex-1 items-end rounded-t-2xl bg-slate-50 p-1 transition-base group-hover:bg-indigo-50">
                      <div className="w-full rounded-t-xl bg-primary shadow-sm transition-base group-hover:bg-indigo-700" style={{ height: `${height}%` }} />
                    </div>
                    <div className="text-center text-[11px] text-slate-400">{day.label}</div>
                    <div className="text-center text-[11px] font-semibold text-slate-700">{day.views ? fmtCompact(day.views) : '—'}</div>
                  </Link>
                );
              })}
            </div>

            {totalViews === 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Пока нет замеренных просмотров. Открой опубликованный пост в очереди и нажми «Замерить», либо включи Edge Function <strong>update-views</strong> по cron.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Каналы</h2>
                <p className="mt-1 text-sm text-slate-500">{fmtCompact(totalSubscribers)} подписчиков суммарно</p>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-xl bg-white"><Link href="/dashboard/channels">Все<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
            </div>

            <div className="mt-5 space-y-3">
              {channelStats.length === 0 ? (
                <EmptyAnalytics icon={Radio} title="Каналов пока нет" text="Подключи Telegram-канал, чтобы видеть аналитику площадок." />
              ) : (
                channelStats.slice(0, 6).map((channel, index) => {
                  const href = channel.username ? `https://t.me/${channel.username}` : '/dashboard/channels';
                  return (
                    <Link key={channel.id} href={href} target={channel.username ? '_blank' : undefined} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 transition-base hover:border-indigo-200 hover:bg-indigo-50/40">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white"><Send className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-950">{channel.title}</span><span className="text-xs text-slate-400">#{index + 1}</span></div>
                        <div className="truncate text-xs text-slate-500">{channel.username ? `@${channel.username}` : 'private'} · {fmtCompact(channel.subscriber_count ?? 0)} подписчиков</div>
                      </div>
                      <div className="text-right"><div className="text-sm font-semibold text-slate-950">{fmtCompact(channel.views)}</div><div className="text-xs text-emerald-600">{channel.subscribersDelta > 0 ? `+${channel.subscribersDelta}` : channel.subscribersDelta < 0 ? channel.subscribersDelta : '—'}</div></div>
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)]">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div><h2 className="text-lg font-semibold tracking-tight">Лучшие посты</h2><p className="text-sm text-slate-500">Топ по последнему замеру просмотров.</p></div>
              <Button asChild size="sm" variant="ghost" className="rounded-xl"><Link href="/dashboard/queue">Очередь<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
            </div>

            {bestPosts.length === 0 ? (
              <div className="p-6"><EmptyAnalytics icon={CalendarClock} title="Нет опубликованных постов" text="Опубликуй первый пост — здесь появятся просмотры и топ публикаций." /></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bestPosts.map((row) => {
                  const post = getSingle(row.posts);
                  const channel = getSingle(row.channels);
                  return (
                    <Link key={row.id} href={`/dashboard/queue/${row.id}/analytics`} className="grid gap-3 px-5 py-4 transition-base hover:bg-slate-50/80 sm:grid-cols-[minmax(0,1fr)_150px_110px] sm:items-center sm:px-6">
                      <div className="min-w-0"><div className="line-clamp-2 text-sm font-semibold text-slate-950">{getPostPreview(post?.content)}</div><div className="mt-1 text-xs text-slate-500">{channel?.title ?? '—'} · {row.sent_at ? <LocalTimeLabel utcIso={row.sent_at} /> : '—'}</div></div>
                      <div className="text-sm text-slate-500">24ч: <span className="font-semibold text-slate-900">{row.views_24h !== null ? fmtCompact(row.views_24h) : '—'}</span></div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-950"><Eye className="h-3.5 w-3.5 text-slate-400" />{row.views_latest !== null ? fmtCompact(row.views_latest) : 'замерить'}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)]">
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold tracking-tight">Качество данных</h2>
            <p className="mt-1 text-sm text-slate-500">Что сейчас реально измеряется.</p>
            <div className="mt-5 space-y-3 text-sm">
              <QualityRow label="Постов с просмотрами" value={`${measuredPosts} / ${currentSent.length}`} />
              <QualityRow label="Каналов с подписчиками" value={`${channels.filter((c) => (c.subscriber_count ?? 0) > 0).length} / ${channels.length}`} />
              <QualityRow label="Снимки 1ч / 6ч / 24ч / 48ч" value={`${currentSent.filter((p) => p.views_1h !== null || p.views_6h !== null || p.views_24h !== null || p.views_48h !== null).length}`} />
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">Telegram не отдаёт полную внутреннюю статистику канала через Bot API. Постплан показывает то, что реально доступно: просмотры сообщений, снимки во времени и счётчик подписчиков каналов.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, caption, icon: Icon, tone }: { label: string; value: string; caption: string; icon: React.ComponentType<{ className?: string }>; tone: 'blue' | 'violet' | 'emerald' | 'amber' }) {
  const toneMap = { blue: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700' }[tone];
  return <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)]"><CardContent className="p-5"><div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneMap}`}><Icon className="h-5 w-5" /></div><div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div><div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</div><div className="mt-1 text-sm text-slate-500">{caption}</div></div></div></CardContent></Card>;
}

function QualityRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2.5"><span className="text-slate-600">{label}</span><span className="font-semibold text-slate-950">{value}</span></div>;
}

function EmptyAnalytics({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm"><Icon className="h-5 w-5" /></div><div className="mt-3 font-semibold text-slate-950">{title}</div><p className="mt-1 text-sm text-slate-500">{text}</p></div>;
}
