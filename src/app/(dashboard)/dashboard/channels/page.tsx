import Link from 'next/link';
import { Plus, Radio, Bot, AlertCircle, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser, getProfile } from '@/lib/auth/helpers';
import { getEffectiveTier } from '@/lib/usage';
import { getTierLimits, isUnlimited, formatLimit, TIERS } from '@/lib/tiers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ChannelActions, BotActions } from '@/components/dashboard/channel-actions';

export const metadata = { title: 'Каналы' };

export default async function ChannelsPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const tier = getEffectiveTier(profile);
  const tierLimits = getTierLimits(tier);
  const supabase = await createClient();

  const { data: bots } = await supabase
    .from('bots')
    .select('id, username, first_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: channels } = await supabase
    .from('channels')
    .select('id, title, username, subscriber_count, bot_id, is_active')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const channelCountByBot: Record<string, number> = {};
  for (const ch of channels ?? []) {
    channelCountByBot[ch.bot_id] = (channelCountByBot[ch.bot_id] ?? 0) + 1;
  }

  const hasBots = (bots?.length ?? 0) > 0;
  const channelCount = channels?.length ?? 0;
  const atChannelLimit =
    !isUnlimited(tierLimits.maxChannels) && channelCount >= tierLimits.maxChannels;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Каналы"
        description={
          isUnlimited(tierLimits.maxChannels)
            ? 'Telegram-каналы и боты которыми ты управляешь.'
            : `Лимит на тарифе ${TIERS[tier].name}: ${channelCount} из ${formatLimit(tierLimits.maxChannels)}`
        }
        action={
          hasBots && !atChannelLimit ? (
            <Button asChild>
              <Link href="/dashboard/channels/add">
                <Plus className="h-4 w-4" />
                Добавить канал
              </Link>
            </Button>
          ) : hasBots && atChannelLimit ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/billing">
                <AlertCircle className="h-4 w-4" />
                Лимит — апгрейд
              </Link>
            </Button>
          ) : null
        }
      />

      {/* Bots section */}
      {!hasBots ? (
        <EmptyState
          icon={Bot}
          title="Подключи первого бота"
          description="Создай нового бота через @BotFather в Telegram и подключи его к Постплану. Через бота мы будем публиковать посты в твои каналы."
          action={
            <Button asChild>
              <Link href="/dashboard/channels/connect">
                <Plus className="h-4 w-4" />
                Подключить бота
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Bots list */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Боты ({bots!.length})
              </h2>
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard/channels/connect">
                  <Plus className="h-3.5 w-3.5" />
                  Ещё бот
                </Link>
              </Button>
            </div>
            <Card>
              <CardContent className="p-2">
                {bots!.map((bot, i) => (
                  <div key={bot.id}>
                    {i > 0 && <div className="h-px bg-border/60" />}
                    <div className="flex items-center gap-3 rounded-sm px-3 py-3 transition-base hover:bg-accent">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">@{bot.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {bot.first_name ?? '—'}
                          {' · '}
                          {channelCountByBot[bot.id]
                            ? `${channelCountByBot[bot.id]} канал(ов)`
                            : 'нет каналов'}
                        </div>
                      </div>
                      <BotActions
                        id={bot.id}
                        username={bot.username}
                        channelCount={channelCountByBot[bot.id] ?? 0}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* Channels list */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Каналы ({channelCount})
            </h2>
            {channelCount === 0 ? (
              <EmptyState
                icon={Radio}
                title="Подключи первый канал"
                description="Добавь бота администратором в Telegram-канал и подключи канал в Постплан."
                action={
                  <Button asChild>
                    <Link href="/dashboard/channels/add">
                      <Plus className="h-4 w-4" />
                      Добавить канал
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Card>
                <CardContent className="p-2">
                  {channels!.map((ch, i) => (
                    <div key={ch.id}>
                      {i > 0 && <div className="h-px bg-border/60" />}
                      <div
                        className={`flex items-center gap-3 rounded-sm px-3 py-3 transition-base hover:bg-accent ${
                          !ch.is_active ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary-soft-foreground">
                          <Radio className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{ch.title}</span>
                            {!ch.is_active && (
                              <Badge variant="default" className="shrink-0">выключен</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">
                              {ch.username ? `@${ch.username}` : 'private channel'}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {ch.subscriber_count}
                            </span>
                          </div>
                        </div>
                        <ChannelActions id={ch.id} title={ch.title} isActive={ch.is_active} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
