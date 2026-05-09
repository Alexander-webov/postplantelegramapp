import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2, Clock, Eye, Briefcase, Calendar, ExternalLink, Image as ImageIcon,
  TrendingUp, Hash,
} from 'lucide-react';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { Logo } from '@/components/dashboard/logo';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

function formatRub(value: number | string | null): string {
  if (value == null) return '0 ₽';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '0 ₽';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return {
    title: `Отчёт о размещении · Постплан`,
    description: 'Отчёт о публикации рекламного поста в Telegram-канале',
    robots: { index: false, follow: false }, // private report — don't index
  };
}

export default async function PublicReportPage({ params }: PageProps) {
  const { slug } = await params;

  // Service role bypasses RLS — we need this because reports are viewed
  // by advertisers who don't have an account. Security comes from the
  // unguessable slug (~60 bits of entropy).
  const supabase = createServiceRoleClient();

  const { data: placement } = await supabase
    .from('ad_placements')
    .select(`
      id, price_rub, format, status, paid_at, created_at,
      report_view_count, report_first_viewed_at,
      advertisers (name, telegram_username),
      scheduled_posts (
        id, scheduled_at, sent_at, telegram_message_id,
        views_latest, views_latest_at,
        views_1h, views_6h, views_24h, views_48h,
        auto_deleted_at,
        posts (content, post_media (id, type, position)),
        channels (title, username)
      )
    `)
    .eq('report_slug', slug)
    .maybeSingle();

  if (!placement) notFound();

  // Track view (fire-and-forget — don't await, don't block render)
  void supabase
    .from('ad_placements')
    .update({
      report_view_count: (placement.report_view_count ?? 0) + 1,
      report_last_viewed_at: new Date().toISOString(),
      report_first_viewed_at: placement.report_first_viewed_at ?? new Date().toISOString(),
    })
    .eq('id', placement.id)
    .then();

  const advertiser = Array.isArray(placement.advertisers) ? placement.advertisers[0] : placement.advertisers;
  const scheduledPost = Array.isArray(placement.scheduled_posts) ? placement.scheduled_posts[0] : placement.scheduled_posts;
  if (!scheduledPost) notFound();

  const post = Array.isArray(scheduledPost.posts) ? scheduledPost.posts[0] : scheduledPost.posts;
  const channel = Array.isArray(scheduledPost.channels) ? scheduledPost.channels[0] : scheduledPost.channels;

  // Direct Telegram link to the post (works only for public channels)
  const telegramLink =
    channel?.username && scheduledPost.telegram_message_id
      ? `https://t.me/${channel.username}/${scheduledPost.telegram_message_id}`
      : null;

  // Decide which views to highlight as "final" — the most recent snapshot
  const finalViews =
    scheduledPost.views_48h ??
    scheduledPost.views_24h ??
    scheduledPost.views_6h ??
    scheduledPost.views_1h ??
    scheduledPost.views_latest ??
    null;

  const snapshots = [
    { label: '1 час', value: scheduledPost.views_1h },
    { label: '6 часов', value: scheduledPost.views_6h },
    { label: '24 часа', value: scheduledPost.views_24h },
    { label: '48 часов', value: scheduledPost.views_48h },
  ];

  return (
    <div className="min-h-screen">
      {/* Branded header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="transition-base hover:opacity-80">
            <Logo />
          </Link>
          <span className="text-xs text-muted-foreground">Отчёт о размещении</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 md:px-6 md:py-14">
        {/* Hero — big number first */}
        <div className="space-y-2 text-center">
          <Badge variant="primary" className="mx-auto">
            <CheckCircle2 className="h-3 w-3" />
            Размещение выполнено
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {channel?.title ?? 'Telegram-канал'}
          </h1>
          {advertiser && (
            <p className="text-muted-foreground">
              Отчёт для <strong className="text-foreground">{advertiser.name}</strong>
            </p>
          )}
        </div>

        {/* Big views card */}
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Eye className="h-3 w-3" />
                Итоговые просмотры
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tabular-nums tracking-tight">
                  {finalViews !== null ? finalViews.toLocaleString('ru-RU') : '—'}
                </span>
                <span className="text-sm text-muted-foreground">просмотров</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Данные от Telegram Bot API. Цифры могут отличаться от внутренней статистики Telegram на ~5%.
              </p>
            </div>
            {scheduledPost.auto_deleted_at ? (
              <Badge variant="default">пост удалён</Badge>
            ) : (
              <Badge variant="success">пост в канале</Badge>
            )}
          </CardContent>
        </Card>

        {/* Deal info */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                Стоимость
              </div>
              <div className="text-xl font-semibold tabular-nums">{formatRub(placement.price_rub)}</div>
              {placement.format && (
                <div className="text-xs text-muted-foreground">Формат: {placement.format}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Дата публикации
              </div>
              <div className="text-sm font-medium">
                {scheduledPost.sent_at ? formatDateTime(scheduledPost.sent_at) : '—'}
              </div>
              {channel?.username && (
                <div className="text-xs text-muted-foreground">@{channel.username}</div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Views timeline */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Динамика просмотров
          </h2>
          <Card>
            <CardContent className="p-2">
              {snapshots.map((s, i) => {
                const prev = i > 0 ? snapshots[i - 1].value : null;
                const growth =
                  s.value !== null && prev !== null && prev > 0
                    ? Math.round(((s.value - prev) / prev) * 100)
                    : null;
                return (
                  <div key={s.label}>
                    {i > 0 && <div className="h-px bg-border/60" />}
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">Через {s.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {growth !== null && growth > 0 && (
                          <span className="text-xs text-success">+{growth}%</span>
                        )}
                        <span className="text-sm font-semibold tabular-nums">
                          {s.value !== null ? s.value.toLocaleString('ru-RU') : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {/* Post preview */}
        {post && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Пост</h2>
            <Card>
              <CardContent className="space-y-3 p-5">
                {post.post_media && post.post_media.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />
                    С медиа: {post.post_media.length} {post.post_media.length === 1 ? 'элемент' : 'элементов'}
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {post.content || '(без текста)'}
                </p>
                {telegramLink && !scheduledPost.auto_deleted_at && (
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Открыть в Telegram
                  </a>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Footer with Postplan promo */}
        <footer className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>
            Отчёт сгенерирован автоматически{' '}
            <Link href="/" className="text-primary hover:underline">Постплан</Link>
            {' — '}
            планировщик постов для Telegram-каналов
          </p>
        </footer>
      </main>
    </div>
  );
}
