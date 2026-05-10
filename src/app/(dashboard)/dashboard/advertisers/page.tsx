import Link from "next/link";
import { Plus, Briefcase, Archive, ArrowRight, AtSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Рекламодатели" };

type AdvertiserRow = {
  id: string;
  name: string;
  telegram_username: string | null;
  contact: string | null;
  total_placements: number | null;
  total_revenue_rub: number | string | null;
  archived_at: string | null;
  created_at: string | null;
};

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

export default async function AdvertisersPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("advertisers")
    .select(
      "id, name, telegram_username, contact, total_placements, total_revenue_rub, archived_at, created_at",
    )
    .eq("user_id", user.id)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  const all = (rows ?? []) as AdvertiserRow[];

  const active = all.filter((a) => !a.archived_at);
  const archived = all.filter((a) => !!a.archived_at);

  const totalRevenue = active.reduce(
    (sum, a) => sum + (parseFloat(String(a.total_revenue_rub ?? 0)) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Рекламодатели"
        description="Карточки клиентов, история размещений и заработок по каждому."
        action={
          active.length > 0 ? (
            <Button asChild>
              <Link href="/dashboard/advertisers/new">
                <Plus className="h-4 w-4" />
                Новый рекламодатель
              </Link>
            </Button>
          ) : null
        }
      />

      {active.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Активных" value={String(active.length)} />

          <StatCard
            label="Размещений всего"
            value={String(
              active.reduce((s, a) => s + (a.total_placements ?? 0), 0),
            )}
          />

          <StatCard label="Заработано" value={formatRub(totalRevenue)} accent />
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Добавь первого рекламодателя"
          description="Карточка с именем, контактом и заметками. Дальше — привязывай посты к рекламодателю в композере, и Постплан соберёт всю историю с заработком."
          action={
            <Button asChild>
              <Link href="/dashboard/advertisers/new">
                <Plus className="h-4 w-4" />
                Добавить
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-2">
            {active.map((a, i) => (
              <Link
                key={a.id}
                href={`/dashboard/advertisers/${a.id}`}
                className="block"
              >
                {i > 0 && <div className="h-px bg-border/60" />}

                <div className="group flex items-center gap-3 rounded-sm px-3 py-3 transition-base hover:bg-accent/50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary-soft-foreground">
                    <Briefcase className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{a.name}</span>

                      {a.telegram_username && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <AtSign className="h-3 w-3" />
                          {a.telegram_username}
                        </span>
                      )}
                    </div>

                    {a.contact && (
                      <div className="truncate text-xs text-muted-foreground">
                        {a.contact}
                      </div>
                    )}
                  </div>

                  <div className="hidden text-right sm:block">
                    <div className="text-sm font-semibold tabular-nums">
                      {formatRub(a.total_revenue_rub)}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {a.total_placements ?? 0} размещ.
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-base group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {archived.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Archive className="h-3.5 w-3.5" />
            Архив ({archived.length})
            <span className="text-xs text-muted-foreground/70 group-open:hidden">
              показать
            </span>
            <span className="hidden text-xs text-muted-foreground/70 group-open:inline">
              скрыть
            </span>
          </summary>

          <Card className="mt-3 opacity-70">
            <CardContent className="p-2">
              {archived.map((a, i) => (
                <Link
                  key={a.id}
                  href={`/dashboard/advertisers/${a.id}`}
                  className="block"
                >
                  {i > 0 && <div className="h-px bg-border/60" />}

                  <div className="flex items-center gap-3 rounded-sm px-3 py-2.5 transition-base hover:bg-accent/50">
                    <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">
                        {a.name}
                      </span>
                    </div>

                    <Badge variant="default" className="shrink-0">
                      архив
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary-soft/40" : ""}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
