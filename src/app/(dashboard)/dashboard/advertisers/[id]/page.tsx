import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  AtSign,
  Mail,
  FileText,
  Archive,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LocalTimeLabel } from "@/components/dashboard/local-time-label";
import { AdvertiserForm } from "@/components/dashboard/advertiser-form";
import { AdvertiserActions } from "@/components/dashboard/advertiser-actions";

export const metadata = { title: "Рекламодатель" };

type Advertiser = {
  id: string;
  name: string;
  telegram_username: string | null;
  contact: string | null;
  notes: string | null;
  total_placements: number | null;
  total_revenue_rub: number | string | null;
  archived_at: string | null;
  created_at: string | null;
};

type Channel = {
  title: string;
  username: string | null;
};

type ScheduledPost = {
  id: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  views_latest: number | null;
  channels: Channel | Channel[] | null;
};

type Placement = {
  id: string;
  price_rub: number | string | null;
  format: string | null;
  status: string;
  paid_at: string | null;
  created_at: string | null;
  scheduled_post_id: string | null;
  scheduled_posts: ScheduledPost | ScheduledPost[] | null;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatRub(value: number | string | null): string {
  if (value === null) return "0 ₽";

  const n = typeof value === "string" ? parseFloat(value) : value;

  if (Number.isNaN(n)) return "0 ₽";

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function AdvertiserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: advertiserData } = await supabase
    .from("advertisers")
    .select(
      "id, name, telegram_username, contact, notes, total_placements, total_revenue_rub, archived_at, created_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const advertiser = advertiserData as Advertiser | null;

  if (!advertiser) notFound();

  const { data: placementsData } = await supabase
    .from("ad_placements")
    .select(
      `
      id, price_rub, format, status, paid_at, created_at,
      scheduled_post_id,
      scheduled_posts!inner (
        id, scheduled_at, sent_at, status, views_latest,
        channels (title, username)
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("advertiser_id", id)
    .order("created_at", { ascending: false });

  const placements = (placementsData ?? []) as Placement[];

  const isArchived = !!advertiser.archived_at;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard/advertisers">
          <ArrowLeft className="h-3.5 w-3.5" />К списку
        </Link>
      </Button>

      <PageHeader
        title={advertiser.name}
        description={isArchived ? "В архиве" : "Карточка рекламодателя"}
        action={
          <AdvertiserActions
            id={advertiser.id}
            name={advertiser.name}
            isArchived={isArchived}
          />
        }
      />

      {isArchived && (
        <Card className="border-warning/30 bg-warning-soft">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Archive className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <strong>Этот рекламодатель в архиве.</strong> Историю размещений
              ты по-прежнему видишь, но в активном списке его нет, и в композере
              он не появится. Можно вернуть из архива — кнопка справа.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Размещений
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {advertiser.total_placements ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary-soft/40">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Заработано
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatRub(advertiser.total_revenue_rub)}
            </div>
          </CardContent>
        </Card>
      </div>

      {(advertiser.telegram_username ||
        advertiser.contact ||
        advertiser.notes) && (
        <Card>
          <CardContent className="space-y-2.5 p-5 text-sm">
            {advertiser.telegram_username && (
              <div className="flex items-start gap-2">
                <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Telegram: </span>
                  <a
                    href={`https://t.me/${advertiser.telegram_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    @{advertiser.telegram_username}
                  </a>
                </div>
              </div>
            )}

            {advertiser.contact && (
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">Контакт: </span>
                  <span>{advertiser.contact}</span>
                </div>
              </div>
            )}

            {advertiser.notes && (
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="whitespace-pre-wrap break-words">
                  {advertiser.notes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          История размещений ({placements.length})
        </h2>

        {placements.length === 0 ? (
          <Card className="border-dashed bg-card/50">
            <CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
              Размещений ещё нет. В следующем обновлении добавим выбор
              рекламодателя в композере — тогда посты будут автоматически
              попадать сюда.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-2">
              {placements.map((p, i) => {
                const sp = Array.isArray(p.scheduled_posts)
                  ? p.scheduled_posts[0]
                  : p.scheduled_posts;

                const ch = sp
                  ? Array.isArray(sp.channels)
                    ? sp.channels[0]
                    : sp.channels
                  : null;

                return (
                  <div key={p.id}>
                    {i > 0 && <div className="h-px bg-border/60" />}

                    <div className="flex items-start gap-3 rounded-sm px-3 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-secondary">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {formatRub(p.price_rub)}
                          </span>
                          <PlacementStatusBadge status={p.status} />
                          {p.format && (
                            <span className="text-xs text-muted-foreground">
                              {p.format}
                            </span>
                          )}
                        </div>

                        {sp && ch && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {ch.title}

                            {sp.sent_at ? (
                              <>
                                {" · "}
                                <LocalTimeLabel utcIso={sp.sent_at} />
                              </>
                            ) : (
                              <>
                                {" · запланирован на "}
                                <LocalTimeLabel utcIso={sp.scheduled_at} />
                              </>
                            )}

                            {typeof sp.views_latest === "number" && (
                              <>
                                {" · "}
                                <span className="font-medium">
                                  {sp.views_latest.toLocaleString("ru-RU")}
                                </span>{" "}
                                просмотров
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>

      {!isArchived && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Редактирование
          </h2>

          <Card>
            <CardContent className="pt-5">
              <AdvertiserForm
                initial={{
                  id: advertiser.id,
                  name: advertiser.name,
                  telegram_username: advertiser.telegram_username,
                  contact: advertiser.contact,
                  notes: advertiser.notes,
                }}
              />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function PlacementStatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    {
      variant: "default" | "primary" | "success" | "warning" | "destructive";
      label: string;
    }
  > = {
    draft: { variant: "default", label: "черновик" },
    awaiting_payment: { variant: "warning", label: "ждёт оплаты" },
    paid: { variant: "primary", label: "оплачено" },
    published: { variant: "success", label: "опубликовано" },
    reported: { variant: "success", label: "отчёт отправлен" },
    cancelled: { variant: "destructive", label: "отменено" },
  };

  const cfg = map[status] ?? { variant: "default" as const, label: status };

  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
