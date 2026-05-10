import Link from "next/link";
import { Plus, Radio, Bot } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Каналы" };

type TelegramBot = {
  id: string;
  username: string | null;
  first_name: string | null;
};

type TelegramChannel = {
  id: string;
  title: string;
  username: string | null;
  subscriber_count: number | null;
  bot_id: string | null;
};

export default async function ChannelsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: botsData } = await supabase
    .from("bots")
    .select("id, username, first_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: channelsData } = await supabase
    .from("channels")
    .select("id, title, username, subscriber_count, bot_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const bots: TelegramBot[] = botsData ?? [];
  const channels: TelegramChannel[] = channelsData ?? [];

  const hasBots = bots.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Каналы</h1>
          <p className="mt-2 text-muted-foreground">
            Telegram-каналы и боты которыми ты управляешь.
          </p>
        </div>

        <div className="flex gap-2">
          {hasBots && (
            <Button asChild>
              <Link href="/dashboard/channels/add">
                <Plus className="h-4 w-4" />
                Добавить канал
              </Link>
            </Button>
          )}

          <Button asChild variant={hasBots ? "outline" : "default"}>
            <Link href="/dashboard/channels/connect">
              <Bot className="h-4 w-4" />
              Подключить бота
            </Link>
          </Button>
        </div>
      </div>

      {!hasBots && (
        <Card>
          <CardContent className="py-10 text-center">
            <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">
              Сначала подключи бота — без него Постплан не сможет публиковать в
              Telegram.
            </p>
            <Button asChild>
              <Link href="/dashboard/channels/connect">
                Подключить первого бота
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasBots && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Подключённые боты</CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <Bot className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">
                    @{bot.username ?? "unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {bot.first_name ?? "—"}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasBots && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Каналы</CardTitle>
          </CardHeader>

          <CardContent>
            {channels.length === 0 ? (
              <div className="py-6 text-center">
                <Radio className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Каналов ещё нет. Добавь первый — это займёт меньше минуты.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Radio className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{ch.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {ch.username ? `@${ch.username}` : "private"} ·{" "}
                          {ch.subscriber_count ?? 0} подписчиков
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
