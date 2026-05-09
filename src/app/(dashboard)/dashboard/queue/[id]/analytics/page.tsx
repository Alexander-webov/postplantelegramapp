import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, TrendingUp, Clock, AlertCircle, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { LocalTimeLabel } from '@/components/dashboard/local-time-label';
import { RefreshViewsButton } from '@/components/dashboard/refresh-views-button';

export const metadata = { title: 'Аналитика поста' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PostAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('scheduled_posts')
    .select(`
      id, status, sent_at, telegram_message_id,
      views_latest, views_latest_at,
      views_1h, views_6h, views_24h, views_48h,
      views_error,
      auto_deleted_at,
      posts (id, content, post_media (id, type)),
      channels (id, title, username)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!row) notFound();
  if (row.status !== 'sent') notFound();

  const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
  const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
  const mediaCount = post?.post_media?.length ?? 0;

  const snapshots = [
    { label: '1 час', value: row.views_1h, hours: 1 },
    { label: '6 часов', value: row.views_6h, hours: 6 },
    { label: '24 часа', value: row.views_24h, hours: 24 },
    { label: '48 часов', value: row.views_48h, hours: 48 },
  ];

  const sentAt = row.sent_at ? new Date(row.sent_at) : null;
  const elapsedHours = sentAt ? (Date.now() - sentAt.getTime()) / (60 * 60 * 1000) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard/queue">
          <ArrowLeft className="h-3.5 w-3.5" />
          К очереди
        </Link>
      </Button>

      <PageHeader
        title="Аналитика поста"
        description={`${channel?.title ?? '—'} · опубликован`}
        action={
          row.telegram_message_id && !row.auto_deleted_at ? (
            <RefreshViewsButton
              scheduledId={row.id}
              initialViews={row.views_latest}
              initialRefreshedAt={row.views_latest_at}
            />
          ) : null
        }
      />
      {row.sent_at && (
        <p className="-mt-3 text-sm text-muted-foreground">
          <LocalTimeLabel utcIso={row.sent_at} />
        </p>
      )}

      {/* Disclaimer */}
      <Card className="border-warning/30 bg-warning-soft">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <strong>Данные приблизительные.</strong> Telegram кеширует счётчик просмотров и обновляет его с задержкой в несколько минут. Цифры здесь — то, что Bot API вернул в момент замера, и могут немного отличаться от того, что показывает сам Telegram-клиент.
          </div>
        </CardContent>
      </Card>

      {/* Latest views big card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <Eye className="h-3 w-3" />
                Последний замер
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tabular-nums tracking-tight">
                  {row.views_latest !== null
                    ? row.views_latest.toLocaleString('ru-RU')
                    : '—'}
                </span>
                <span className="text-sm text-muted-foreground">просмотров</span>
              </div>
              {row.views_latest_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Обновлено <LocalTimeLabel utcIso={row.views_latest_at} />
                </p>
              )}
            </div>
            {row.auto_deleted_at && (
              <Badge variant="default">пост удалён</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Snapshots timeline */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          <Clock className="mr-1.5 inline h-3.5 w-3.5" />
          Снимки во времени
        </h2>
        <Card>
          <CardContent className="p-2">
            {snapshots.map((s, i) => {
              const isPending = elapsedHours < s.hours && s.value === null;
              const isReached = elapsedHours >= s.hours;
              const prev = i > 0 ? snapshots[i - 1].value : null;
              const growth =
                s.value !== null && prev !== null && prev > 0
                  ? Math.round(((s.value - prev) / prev) * 100)
                  : null;

              return (
                <div key={s.label}>
                  {i > 0 && <div className="h-px bg-border/60" />}
                  <div className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-sm ${
                          s.value !== null && s.value > 0
                            ? 'bg-primary-soft text-primary-soft-foreground'
                            : isPending
                            ? 'bg-secondary text-muted-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Через {s.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {isPending
                            ? 'Замер будет автоматически'
                            : isReached
                            ? 'Замерено'
                            : 'Время ещё не пришло'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {growth !== null && growth !== 0 && (
                        <span
                          className={`flex items-center gap-1 text-xs ${
                            growth > 0 ? 'text-success' : 'text-muted-foreground'
                          }`}
                        >
                          <TrendingUp className="h-3 w-3" />
                          {growth > 0 ? '+' : ''}
                          {growth}%
                        </span>
                      )}
                      <div className="text-right">
                        <div className="text-lg font-semibold tabular-nums">
                          {s.value !== null
                            ? s.value.toLocaleString('ru-RU')
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Error display */}
      {row.views_error && (
        <Card className="border-destructive/30 bg-destructive-soft">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <strong>Не удалось замерить просмотры.</strong>
              <p className="mt-1 text-xs">{row.views_error}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Часто причины: бот выгнан из канала, сообщение удалено, или Telegram временно
                недоступен. Попробуй вручную обновить через кнопку выше.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post preview */}
      {post && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Содержимое поста</h2>
          <Card>
            <CardContent className="space-y-3 p-5">
              {mediaCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  📎 С медиа: {mediaCount}{' '}
                  {mediaCount === 1 ? 'элемент' : mediaCount < 5 ? 'элемента' : 'элементов'}
                </div>
              )}
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {post.content || '(без текста)'}
              </p>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
