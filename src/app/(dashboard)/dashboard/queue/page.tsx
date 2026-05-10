import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Image as ImageIcon,
  Pencil,
  Plus,
  History,
  Trash2,
  Briefcase,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CancelScheduledButton } from "@/components/dashboard/cancel-scheduled-button";
import { LocalTimeLabel } from "@/components/dashboard/local-time-label";
import { EditPublishedButton } from "@/components/dashboard/edit-published-button";
import { ClearHistoryButton } from "@/components/dashboard/clear-history-button";
import { RefreshViewsButton } from "@/components/dashboard/refresh-views-button";
import { PlacementStatusBadgeWithMenu } from "@/components/dashboard/placement-status-badge";
import { ReportLinkButton } from "@/components/dashboard/report-link-button";

export const metadata = { title: "Очередь" };

const statusConfig = {
  pending: { label: "В очереди", icon: Clock, badge: "primary" as const },
  processing: { label: "Отправляется", icon: Send, badge: "warning" as const },
  sent: { label: "Отправлено", icon: CheckCircle2, badge: "success" as const },
  failed: { label: "Ошибка", icon: AlertCircle, badge: "destructive" as const },
  cancelled: {
    label: "Отменено",
    icon: AlertCircle,
    badge: "default" as const,
  },
} as const;

type QueuePageProps = {
  searchParams?: {
    date?: string | string[];
  };
};

function truncate(s: string, max = 120): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

function formatRub(value: number | string | null | undefined): string {
  if (value == null) return "0 ₽";

  const n = typeof value === "string" ? parseFloat(value) : value;

  if (Number.isNaN(n)) return "0 ₽";

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format remaining time until auto-delete in a friendly way: "5ч 12м", "23м", "<1м" */
function formatTimeUntil(targetIso: string): string {
  const ms = new Date(targetIso).getTime() - Date.now();

  if (ms <= 0) return "скоро";

  const totalMin = Math.floor(ms / 60_000);

  if (totalMin < 1) return "<1м";
  if (totalMin < 60) return `${totalMin}м`;

  const hrs = Math.floor(totalMin / 60);
  const min = totalMin % 60;

  if (hrs < 24) return min > 0 ? `${hrs}ч ${min}м` : `${hrs}ч`;

  const days = Math.floor(hrs / 24);
  const remainingHrs = hrs % 24;

  return remainingHrs > 0 ? `${days}д ${remainingHrs}ч` : `${days}д`;
}

export default async function QueuePage({ searchParams }: QueuePageProps) {
  const resolvedSearchParams = searchParams ?? {};

  const selectedDate =
    typeof resolvedSearchParams.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(resolvedSearchParams.date)
      ? resolvedSearchParams.date
      : null;

  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows, error: queueErr } = await supabase
    .from("scheduled_posts")
    .select(
      `
      id, scheduled_at, status, sent_at, error_message, retry_count, telegram_message_id,
      auto_delete_after_hours, auto_delete_at, auto_deleted_at, auto_delete_error,
      views_latest, views_latest_at, views_1h, views_6h, views_24h, views_48h,
      posts!left (id, content, post_media (id, type)),
      channels!left (id, title, username),
      ad_placements!left (id, price_rub, format, status, report_slug, advertisers!left (id, name, telegram_username))
      `,
    )
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: false })
    .limit(100);

  if (queueErr) {
    console.error("Queue page query failed:", queueErr);
  }

  const allRows = rows ?? [];

  const queue = selectedDate
    ? allRows.filter((r) => {
        const dateSource = r.scheduled_at ?? r.sent_at;
        return dateSource
          ? toDateKey(new Date(dateSource)) === selectedDate
          : false;
      })
    : allRows;

  const pending = queue.filter(
    (r) => r.status === "pending" || r.status === "processing",
  );

  const history = queue.filter(
    (r) =>
      r.status === "sent" || r.status === "failed" || r.status === "cancelled",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          selectedDate
            ? `Очередь на ${formatDateHuman(selectedDate)}`
            : "Очередь"
        }
        description={
          selectedDate
            ? "Публикации, запланированные на выбранную дату."
            : "Запланированные посты, история отправок и редактирование уже опубликованного."
        }
        action={
          <Button asChild>
            <Link href="/dashboard/posts/new">
              <Plus className="h-4 w-4" />
              Создать пост
            </Link>
          </Button>
        }
      />

      {selectedDate && (
        <Button asChild variant="ghost" size="sm" className="-mt-2 w-fit">
          <Link href="/dashboard/queue">Показать всю очередь</Link>
        </Button>
      )}

      {/* Pending section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Ожидают отправки {pending.length > 0 && `(${pending.length})`}
          </h2>
        </div>

        {pending.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Нет запланированных постов"
            description="Создай новый пост и поставь его в расписание — он появится здесь."
            action={
              <Button asChild>
                <Link href="/dashboard/posts/new">
                  <Plus className="h-4 w-4" />
                  Создать пост
                </Link>
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-2">
              {pending.map((row, i) => {
                const post = Array.isArray(row.posts)
                  ? row.posts[0]
                  : row.posts;
                const channel = Array.isArray(row.channels)
                  ? row.channels[0]
                  : row.channels;
                const cfg =
                  statusConfig[row.status as keyof typeof statusConfig];
                const StatusIcon = cfg.icon;
                const mediaCount = post?.post_media?.length ?? 0;

                return (
                  <div key={row.id}>
                    {i > 0 && <div className="h-px bg-border/60" />}

                    <div className="group flex items-start gap-3 rounded-sm px-3 py-3 transition-base hover:bg-accent/50">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${
                          row.status === "processing"
                            ? "bg-warning-soft text-warning"
                            : "bg-primary-soft text-primary-soft-foreground"
                        }`}
                      >
                        <StatusIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium tabular-nums">
                            <LocalTimeLabel utcIso={row.scheduled_at} />
                          </span>

                          <span className="text-muted-foreground">·</span>

                          <span className="truncate text-muted-foreground">
                            {channel?.title ?? "—"}
                          </span>

                          {mediaCount > 0 && (
                            <Badge variant="outline" className="shrink-0">
                              <ImageIcon className="h-3 w-3" />
                              {mediaCount}
                            </Badge>
                          )}

                          {row.auto_delete_after_hours && (
                            <Badge
                              variant="warning"
                              className="shrink-0"
                              title={`Удалится через ${row.auto_delete_after_hours}ч после публикации`}
                            >
                              <Trash2 className="h-3 w-3" />
                              авто-удаление {row.auto_delete_after_hours}ч
                            </Badge>
                          )}

                          {(() => {
                            const placement = Array.isArray(row.ad_placements)
                              ? row.ad_placements[0]
                              : row.ad_placements;

                            if (!placement) return null;

                            const adv = Array.isArray(placement.advertisers)
                              ? placement.advertisers[0]
                              : placement.advertisers;

                            return (
                              <Badge
                                variant="primary"
                                className="shrink-0"
                                title={
                                  adv?.name
                                    ? `Рекламодатель: ${adv.name}`
                                    : "Реклама"
                                }
                              >
                                <Briefcase className="h-3 w-3" />
                                {formatRub(placement.price_rub)}
                                {adv?.name && (
                                  <span className="hidden sm:inline">
                                    · {adv.name}
                                  </span>
                                )}
                              </Badge>
                            );
                          })()}

                          {row.retry_count > 0 && (
                            <Badge variant="warning" className="shrink-0">
                              попытка #{row.retry_count + 1}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {post?.content?.length
                            ? truncate(post.content, 140)
                            : mediaCount > 0
                              ? "(только медиа)"
                              : "—"}
                        </p>

                        {row.error_message && (
                          <p className="mt-1 text-xs text-destructive">
                            {row.error_message}
                          </p>
                        )}
                      </div>

                      {row.status === "pending" && (
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-base group-hover:opacity-100">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/dashboard/queue/${row.id}/edit`}>
                              <Pencil className="h-3.5 w-3.5" />
                              Изменить
                            </Link>
                          </Button>
                          <CancelScheduledButton id={row.id} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>

      {/* History section */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              <History className="mr-1.5 inline h-3.5 w-3.5" />
              История ({history.length})
            </h2>

            <ClearHistoryButton count={history.length} />
          </div>

          <Card>
            <CardContent className="p-2">
              {history.map((row, i) => {
                const post = Array.isArray(row.posts)
                  ? row.posts[0]
                  : row.posts;
                const channel = Array.isArray(row.channels)
                  ? row.channels[0]
                  : row.channels;
                const cfg =
                  statusConfig[row.status as keyof typeof statusConfig];
                const StatusIcon = cfg.icon;
                const when = row.sent_at ?? row.scheduled_at;
                const mediaCount = post?.post_media?.length ?? 0;

                return (
                  <div key={row.id}>
                    {i > 0 && <div className="h-px bg-border/60" />}

                    <div className="rounded-sm px-3 py-3 transition-base hover:bg-accent/50">
                      <div className="flex items-start gap-3">
                        <StatusIcon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            row.status === "sent"
                              ? "text-success"
                              : row.status === "failed"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant={cfg.badge} className="shrink-0">
                              {cfg.label}
                            </Badge>

                            <span className="text-muted-foreground tabular-nums">
                              <LocalTimeLabel utcIso={when} />
                            </span>

                            <span className="text-muted-foreground">·</span>

                            <span className="truncate text-muted-foreground">
                              {channel?.title ?? "—"}
                            </span>

                            {mediaCount > 0 && (
                              <Badge variant="outline" className="shrink-0">
                                <ImageIcon className="h-3 w-3" />
                                {mediaCount}
                              </Badge>
                            )}

                            {row.status === "sent" &&
                              row.auto_deleted_at &&
                              !row.auto_delete_error && (
                                <Badge
                                  variant="default"
                                  className="shrink-0"
                                  title={`Удалён ${new Date(row.auto_deleted_at).toLocaleString("ru-RU")}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  удалён авто
                                </Badge>
                              )}

                            {row.status === "sent" && row.auto_delete_error && (
                              <Badge
                                variant="destructive"
                                className="shrink-0"
                                title={row.auto_delete_error}
                              >
                                <Trash2 className="h-3 w-3" />
                                ошибка удаления
                              </Badge>
                            )}

                            {row.status === "sent" &&
                              row.auto_delete_at &&
                              !row.auto_deleted_at &&
                              !row.auto_delete_error && (
                                <Badge
                                  variant="warning"
                                  className="shrink-0"
                                  title={`Будет удалён ${new Date(row.auto_delete_at).toLocaleString("ru-RU")}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  удалится через{" "}
                                  {formatTimeUntil(row.auto_delete_at)}
                                </Badge>
                              )}

                            {(() => {
                              const placement = Array.isArray(row.ad_placements)
                                ? row.ad_placements[0]
                                : row.ad_placements;

                              if (!placement) return null;

                              const adv = Array.isArray(placement.advertisers)
                                ? placement.advertisers[0]
                                : placement.advertisers;

                              return (
                                <PlacementStatusBadgeWithMenu
                                  placementId={placement.id}
                                  currentStatus={placement.status}
                                  priceRub={placement.price_rub}
                                  advertiserName={adv?.name ?? null}
                                />
                              );
                            })()}
                          </div>

                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                            {post?.content?.length
                              ? truncate(post.content, 140)
                              : mediaCount > 0
                                ? "(только медиа)"
                                : "—"}
                          </p>

                          {row.error_message && (
                            <p className="mt-1 text-xs text-destructive">
                              {row.error_message}
                            </p>
                          )}

                          {row.status === "sent" && row.sent_at && post && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <EditPublishedButton
                                scheduledId={row.id}
                                initialContent={post.content ?? ""}
                                hasMedia={mediaCount > 0}
                                sentAt={row.sent_at}
                              />

                              {row.telegram_message_id &&
                                !row.auto_deleted_at && (
                                  <>
                                    <RefreshViewsButton
                                      scheduledId={row.id}
                                      initialViews={row.views_latest}
                                      initialRefreshedAt={row.views_latest_at}
                                    />

                                    <Link
                                      href={`/dashboard/queue/${row.id}/analytics`}
                                      className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-base hover:bg-accent hover:text-foreground"
                                    >
                                      Подробно →
                                    </Link>
                                  </>
                                )}

                              {(() => {
                                const placement = Array.isArray(
                                  row.ad_placements,
                                )
                                  ? row.ad_placements[0]
                                  : row.ad_placements;

                                if (!placement) return null;

                                const adv = Array.isArray(placement.advertisers)
                                  ? placement.advertisers[0]
                                  : placement.advertisers;

                                return (
                                  <ReportLinkButton
                                    placementId={placement.id}
                                    initialSlug={placement.report_slug ?? null}
                                    advertiserTelegram={
                                      adv?.telegram_username ?? null
                                    }
                                    channelTitle={channel?.title ?? null}
                                  />
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
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

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function formatDateHuman(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);

  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
