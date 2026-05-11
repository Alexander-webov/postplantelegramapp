import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  ExternalLink,
  FileText,
  Plus,
  Radio,
  Send,
  Sparkles,
  Users,
  Zap,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getProfile } from "@/lib/auth/helpers";
import { getEffectiveTier, isSubscriptionExpired, getUsage } from "@/lib/usage";
import { TIERS, isUnlimited } from "@/lib/tiers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LocalTimeLabel } from "@/components/dashboard/local-time-label";
import { ActivationChecklist } from "@/components/dashboard/activation-checklist";
import { ScheduledPostActions } from "@/components/dashboard/scheduled-post-actions";

export const metadata = { title: "Обзор" };

type PostContent = { content: string | null };
type ChannelData = {
  id: string;
  title: string | null;
  username?: string | null;
};

type RecentRow = {
  id: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  views_latest: number | null;
  posts: PostContent | PostContent[] | null;
  channels: ChannelData | ChannelData[] | null;
};

type UpcomingRow = {
  id: string;
  status: string;
  scheduled_at: string | null;
  posts: PostContent | PostContent[] | null;
  channels: ChannelData | ChannelData[] | null;
};

type ChannelRow = {
  id: string;
  title: string;
  username: string | null;
  is_active: boolean | null;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const tier = getEffectiveTier(profile);
  const expired = isSubscriptionExpired(profile);
  const tierConfig = TIERS[tier];
  const supabase = await createClient();

  const usage = await getUsage(user.id);
  const todayStart = startOfLocalDay(new Date());
  const nextMonth = new Date(todayStart);
  nextMonth.setDate(nextMonth.getDate() + 45);

  const [
    { count: scheduledCount },
    recentRes,
    upcomingRes,
    channelsRes,
    { count: sentCount },
    { count: templatesCount },
    { count: advertisersCount },
  ] = await Promise.all([
    supabase
      .from("scheduled_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("scheduled_posts")
      .select(
        "id, status, scheduled_at, sent_at, views_latest, posts(content), channels(id, title, username)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("scheduled_posts")
      .select(
        "id, status, scheduled_at, posts(content), channels(id, title, username)",
      )
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", nextMonth.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50),
    supabase
      .from("channels")
      .select("id, title, username, is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("scheduled_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "sent"),
    supabase
      .from("templates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("advertisers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("archived_at", null),
  ]);

  const recent = (recentRes.data ?? []) as RecentRow[];
  const upcoming = (upcomingRes.data ?? []) as UpcomingRow[];
  const channels = (channelsRes.data ?? []) as ChannelRow[];
  const hasChannels = channels.length > 0;
  const hasPostedAtLeastOnce = (sentCount ?? 0) > 0;
  const hasTemplates = (templatesCount ?? 0) > 0;
  const hasFirstAdvertiser = (advertisersCount ?? 0) > 0;
  const allOnboardingDone =
    hasChannels && hasPostedAtLeastOnce && hasTemplates && hasFirstAdvertiser;
  const firstName = (profile.full_name ?? profile.email).split(/\s|@/)[0];

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white px-6 py-7 shadow-[0_22px_60px_-45px_rgba(15,23,42,0.9)] md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(79,70,229,0.12),transparent_34%),radial-gradient(circle_at_95%_10%,rgba(14,165,233,0.12),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {greetingByHour()}
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 md:text-4xl">
              {hasChannels
                ? `Привет, ${firstName}`
                : `С приходом, ${firstName}`}
            </h1>
            <p className="max-w-2xl text-sm text-slate-500 md:text-base">
              {hasChannels
                ? "Единый центр управления Telegram-публикациями, каналами и рекламными размещениями."
                : "Подключи первый канал — дальше Постплан сам покажет очередь, статусы и ближайшие публикации."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl shadow-sm">
              <Link href="/dashboard/posts/new">
                <Plus className="h-4 w-4" />
                Создать пост
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl bg-white/70"
            >
              <Link href="/dashboard/channels">
                <Radio className="h-4 w-4" />
                Каналы
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {expired && (
        <SubscriptionBanner
          tone="warning"
          icon={AlertCircle}
          title="Подписка истекла"
          description="Сейчас действуют лимиты Free. Продли подписку, чтобы вернуть доступ к тарифу."
          ctaLabel="Продлить"
          ctaHref="/dashboard/billing"
        />
      )}

      {!expired && tier === "free" && (
        <SubscriptionBanner
          tone="primary"
          icon={Sparkles}
          title="Free — для проверки идеи"
          description="Базовый тариф за 299 ₽/мес открывает 5 каналов, безлимит постов, шаблоны и кросспостинг."
          ctaLabel="Смотреть тарифы"
          ctaHref="/dashboard/billing"
        />
      )}

      {!hasChannels ? (
        <OnboardingCard />
      ) : (
        <>
          {!allOnboardingDone && (
            <ActivationChecklist
              hasChannels={hasChannels}
              hasPostedAtLeastOnce={hasPostedAtLeastOnce}
              hasTemplates={hasTemplates}
              hasFirstAdvertiser={hasFirstAdvertiser}
            />
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Запланировано"
              value={scheduledCount ?? 0}
              caption="постов в очереди"
              icon={CalendarDays}
              tone="blue"
              href="/dashboard/queue"
            />
            <StatCard
              label="Активные каналы"
              value={usage.channels}
              limit={tierConfig.limits.maxChannels}
              caption="подключено к Постплану"
              icon={Users}
              tone="emerald"
              href="/dashboard/channels"
            />
            <StatCard
              label="Постов в месяце"
              value={usage.postsThisMonth}
              limit={tierConfig.limits.maxPostsPerMonth}
              caption="по текущему тарифу"
              icon={Zap}
              tone="violet"
              href="/dashboard/queue"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-48px_rgba(15,23,42,0.9)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Запланированные посты
                  </h2>
                  <p className="text-sm text-slate-500">
                    Последние публикации и очередь отправки
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-xl bg-white"
                >
                  <Link href="/dashboard/queue">
                    Все посты
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <CardContent className="p-0">
                {recent.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-primary">
                      <Send className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold">Очередь пока пустая</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                      Создай первый пост — здесь появятся время публикации,
                      канал, статус и метрики.
                    </p>
                    <Button asChild className="mt-5 rounded-xl">
                      <Link href="/dashboard/posts/new">Создать пост</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(145px,0.75fr)_118px_120px_120px] gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 lg:grid">
                      <span>Пост</span>
                      <span>Канал</span>
                      <span>Статус</span>
                      <span>Время</span>
                      <span>Метрики</span>
                    </div>
                    {recent.map((row) => (
                      <PostRow key={row.id} row={row} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <CalendarCard
                upcoming={upcoming}
                scheduledCount={scheduledCount ?? 0}
              />
              <ChannelsCard channels={channels} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PostRow({ row }: { row: RecentRow }) {
  const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
  const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
  const when = row.sent_at ?? row.scheduled_at;
  const preview = post?.content?.trim() || "(без текста)";
  const viewsLabel =
    typeof row.views_latest === "number"
      ? row.views_latest.toLocaleString("ru-RU")
      : "—";

  return (
    <div className="grid gap-3 px-5 py-4 transition-base hover:bg-slate-50/80 lg:grid-cols-[minmax(0,1.35fr)_minmax(145px,0.75fr)_118px_120px_120px] lg:items-center lg:gap-4 lg:px-6">
      <Link
        href={
          row.status === "sent"
            ? `/dashboard/queue/${row.id}/analytics`
            : `/dashboard/queue/${row.id}/edit`
        }
        className="flex min-w-0 items-start gap-3 rounded-xl transition-base hover:text-primary"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-100 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-slate-950">
            {preview}
          </div>
          <div className="mt-1 text-xs text-slate-400">Telegram-публикация</div>
        </div>
      </Link>

      <div className="flex items-center gap-2 text-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
          <Send className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800">
            {channel?.title ?? "—"}
          </div>
          {channel?.username && (
            <div className="truncate text-xs text-slate-400">
              @{channel.username}
            </div>
          )}
        </div>
      </div>

      <div>
        <ActivityBadge status={row.status} />
      </div>

      <div className="text-sm text-slate-700">
        {when ? <LocalTimeLabel utcIso={when} /> : "—"}
      </div>

      <div className="flex items-center justify-between gap-2">
        <ScheduledPostActions id={row.id} status={row.status} />
      </div>
    </div>
  );
}

function CalendarCard({
  upcoming,
  scheduledCount,
}: {
  upcoming: UpcomingRow[];
  scheduledCount: number;
}) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = today.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  const first = new Date(year, month, 1);
  const firstWeekdayMondayBased = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekdayMondayBased }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const visibleCells = cells.slice(0, 35);
  const byDate = groupUpcomingByDate(upcoming);

  return (
    <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold tracking-tight">
              Ближайшие публикации
            </h3>
            <p className="mt-1 text-sm capitalize text-slate-500">
              {monthLabel}
            </p>
          </div>
          <Badge variant="primary">{scheduledCount} в очереди</Badge>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-sm">
          {visibleCells.map((d, idx) => {
            if (!d) return <div key={`empty-${idx}`} className="h-10" />;
            const current = new Date(year, month, d);
            const dateKey = toDateKey(current);
            const posts = byDate.get(dateKey) ?? [];
            const isToday =
              d === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const dayNode = (
              <>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-base ${isToday ? "bg-primary text-white shadow-sm" : posts.length ? "text-slate-800 hover:bg-indigo-50 hover:text-primary" : "text-slate-500 hover:bg-slate-50"}`}
                >
                  {d}
                </div>
                <span
                  className={`h-1 w-1 rounded-full ${posts.length ? "bg-primary" : "bg-transparent"}`}
                />
              </>
            );
            return posts.length ? (
              <Link
                key={dateKey}
                href={`/dashboard/queue?date=${dateKey}`}
                className="flex flex-col items-center gap-1 py-1"
                title={`${posts.length} публикац. на эту дату`}
              >
                {dayNode}
              </Link>
            ) : (
              <div
                key={dateKey}
                className="flex flex-col items-center gap-1 py-1"
              >
                {dayNode}
              </div>
            );
          })}
        </div>

        {upcoming.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            {upcoming.slice(0, 3).map((row) => {
              const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
              const channel = Array.isArray(row.channels)
                ? row.channels[0]
                : row.channels;
              return (
                <Link
                  key={row.id}
                  href={`/dashboard/queue/${row.id}/edit`}
                  className="block rounded-2xl p-2 transition-base hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="truncate">
                      {channel?.title ?? "Канал"}
                    </span>
                    {row.scheduled_at && (
                      <LocalTimeLabel utcIso={row.scheduled_at} />
                    )}
                  </div>
                  <div className="mt-1 line-clamp-1 text-sm font-medium text-slate-800">
                    {post?.content?.trim() || "(без текста)"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChannelsCard({ channels }: { channels: ChannelRow[] }) {
  return (
    <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold tracking-tight">Топ каналов</h3>
            <p className="mt-1 text-sm text-slate-500">Подключённые площадки</p>
          </div>
          <Button asChild size="sm" variant="ghost" className="rounded-xl">
            <Link href="/dashboard/channels">
              Все
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {channels.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Каналов пока нет
            </p>
          ) : (
            channels.map((ch, index) => {
              const href = ch.username
                ? `https://t.me/${ch.username}`
                : "/dashboard/channels";
              const isExternal = Boolean(ch.username);
              const content = (
                <>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
                    <Send className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {ch.title}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {ch.username ? `@${ch.username}` : "private"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right text-xs">
                    <div>
                      <div className="font-semibold text-slate-700">
                        #{index + 1}
                      </div>
                      <div
                        className={
                          ch.is_active ? "text-emerald-600" : "text-slate-400"
                        }
                      >
                        {ch.is_active ? "active" : "off"}
                      </div>
                    </div>
                    {isExternal && (
                      <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
                    )}
                  </div>
                </>
              );
              return isExternal ? (
                <a
                  key={ch.id}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl p-2 transition-base hover:bg-slate-50"
                >
                  {content}
                </a>
              ) : (
                <Link
                  key={ch.id}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl p-2 transition-base hover:bg-slate-50"
                >
                  {content}
                </Link>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  limit,
  caption,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: number;
  limit?: number;
  caption: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone: "blue" | "emerald" | "violet";
}) {
  const showLimit = limit !== undefined && !isUnlimited(limit);
  const percent =
    showLimit && limit! > 0 ? Math.min(100, (value / limit!) * 100) : 0;
  const toneClass = {
    blue: "from-sky-50 text-sky-700 bg-sky-100",
    emerald: "from-emerald-50 text-emerald-700 bg-emerald-100",
    violet: "from-violet-50 text-violet-700 bg-violet-100",
  }[tone];

  return (
    <Link href={href} className="group block">
      <Card className="h-full overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_22px_60px_-52px_rgba(15,23,42,0.9)] transition-base group-hover:-translate-y-0.5 group-hover:shadow-[0_24px_70px_-48px_rgba(15,23,42,0.95)]">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClass}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight text-slate-950">
                  {value}
                </span>
                {showLimit && (
                  <span className="text-sm text-slate-400">/ {limit}</span>
                )}
                {!showLimit && limit !== undefined && (
                  <span className="text-sm text-slate-400">/ ∞</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-500">{caption}</div>
              {showLimit && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary transition-base"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SubscriptionBanner({
  tone,
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  tone: "primary" | "warning";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const toneClasses =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-indigo-100 bg-indigo-50 text-slate-950";
  const iconColor = tone === "warning" ? "text-amber-600" : "text-primary";

  return (
    <div
      className={`flex flex-col gap-4 rounded-[24px] border p-5 shadow-sm sm:flex-row sm:items-center ${toneClasses}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-slate-600">{description}</div>
      </div>
      <Button asChild size="sm" className="rounded-xl">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

function OnboardingCard() {
  return (
    <Card className="overflow-hidden rounded-[28px] border-indigo-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.95)]">
      <div className="relative p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(79,70,229,0.14),transparent_38%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <Badge variant="primary">
              <Sparkles className="h-3 w-3" />
              Быстрый старт
            </Badge>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Подключи Telegram-канал — займёт минуту
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                После подключения ты сможешь планировать посты, вести очередь
                публикаций и привязывать рекламодателей.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <OnboardingStep n={1}>
                Создай бота через <span className="kbd">@BotFather</span>
              </OnboardingStep>
              <OnboardingStep n={2}>Вставь токен в Постплан</OnboardingStep>
              <OnboardingStep n={3}>Добавь бота админом в канал</OnboardingStep>
              <OnboardingStep n={4}>Подключи канал по username</OnboardingStep>
            </div>
          </div>
          <Button asChild size="lg" className="rounded-xl">
            <Link href="/dashboard/channels/connect">
              Подключить бота
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OnboardingStep({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-700">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary shadow-sm">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function ActivityBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge variant="success">отправлен</Badge>;
  if (status === "failed") return <Badge variant="destructive">ошибка</Badge>;
  if (status === "processing")
    return <Badge variant="warning">отправляется</Badge>;
  if (status === "pending")
    return <Badge variant="primary">запланирован</Badge>;
  if (status === "cancelled") return <Badge>отменён</Badge>;
  return <Badge>{status}</Badge>;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return "Глубокая ночь";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  if (h < 23) return "Добрый вечер";
  return "Глубокая ночь";
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function groupUpcomingByDate(rows: UpcomingRow[]): Map<string, UpcomingRow[]> {
  const map = new Map<string, UpcomingRow[]>();
  for (const row of rows) {
    if (!row.scheduled_at) continue;
    const key = toDateKey(new Date(row.scheduled_at));
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}
