import Link from 'next/link';
import { ArrowLeft, Inbox, Send as SendIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dealStatusLabel } from '@/lib/crosspromo/topics';
import { DealActions } from '@/components/dashboard/crosspromo/deal-actions';

export const metadata = { title: 'Сделки взаимопиара' };

type DealRow = {
  id: string;
  status: string;
  initiator_user_id: string;
  partner_user_id: string;
  initiator_channel_id: string;
  partner_channel_id: string;
  publish_at: string | null;
  min_hold_hours: number;
  promo_text_for_partner: string | null;
  promo_text_for_initiator: string | null;
  initiator_reach: number | null;
  partner_reach: number | null;
  created_at: string;
};

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'primary' | 'default' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'proposed':
    case 'accepted':
      return 'warning';
    case 'scheduled':
    case 'live':
      return 'primary';
    default:
      return 'default';
  }
}

export default async function DealsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Resolve channel titles for display
  const { data: deals } = await supabase
    .from('cp_deals')
    .select(
      'id, status, initiator_user_id, partner_user_id, initiator_channel_id, partner_channel_id, ' +
        'publish_at, min_hold_hours, promo_text_for_partner, promo_text_for_initiator, ' +
        'initiator_reach, partner_reach, created_at'
    )
    .or(`initiator_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  const rows = (deals ?? []) as unknown as DealRow[];

  // Fetch all involved channel titles in one query
  const channelIds = Array.from(new Set(rows.flatMap((d) => [d.initiator_channel_id, d.partner_channel_id])));
  const titleMap = new Map<string, string>();
  if (channelIds.length > 0) {
    const { data: chans } = await supabase.from('channels').select('id, title').in('id', channelIds);
    for (const c of chans ?? []) titleMap.set(c.id, c.title);
  }

  const incoming = rows.filter((d) => d.partner_user_id === user.id && d.status === 'proposed');
  const others = rows.filter((d) => !(d.partner_user_id === user.id && d.status === 'proposed'));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/crosspromo"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-base hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к взаимопиару
      </Link>

      <PageHeader eyebrow="Взаимопиар" title="Мои сделки" description="Входящие предложения, активные и завершённые сделки." />

      {/* Incoming proposals (need action) */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Inbox className="h-4 w-4" /> Входящие предложения
          {incoming.length > 0 && <Badge variant="warning">{incoming.length}</Badge>}
        </h2>
        {incoming.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">Новых предложений нет</CardContent>
          </Card>
        ) : (
          incoming.map((d) => (
            <Card key={d.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    Предложение от «{titleMap.get(d.initiator_channel_id) ?? 'канал'}»
                  </div>
                  <Badge variant={statusVariant(d.status)}>{dealStatusLabel(d.status)}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Публикация: {d.publish_at ? new Date(d.publish_at).toLocaleString('ru-RU') : '—'} · висит минимум {d.min_hold_hours}ч
                </div>
                <div className="rounded-sm bg-muted/40 p-3 text-sm">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Партнёр опубликует у себя про ваш канал:</div>
                  {d.promo_text_for_partner}
                </div>
                <DealActions deal={{ id: d.id, role: 'partner', status: d.status }} partnerChannelTitle={titleMap.get(d.initiator_channel_id) ?? ''} />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* All other deals */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <SendIcon className="h-4 w-4" /> Все сделки
        </h2>
        {others.length === 0 ? (
          <EmptyState icon={SendIcon} title="Сделок пока нет" description="Найдите партнёра на странице взаимопиара и отправьте предложение." />
        ) : (
          others.map((d) => {
            const isInitiator = d.initiator_user_id === user.id;
            const myChannel = isInitiator ? d.initiator_channel_id : d.partner_channel_id;
            const theirChannel = isInitiator ? d.partner_channel_id : d.initiator_channel_id;
            return (
              <Card key={d.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium">{titleMap.get(myChannel) ?? 'мой канал'}</span>
                      <span className="text-muted-foreground"> ↔ </span>
                      <span className="font-medium">{titleMap.get(theirChannel) ?? 'партнёр'}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{isInitiator ? '(вы инициатор)' : '(вам предложили)'}</span>
                    </div>
                    <Badge variant={statusVariant(d.status)}>{dealStatusLabel(d.status)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Публикация: {d.publish_at ? new Date(d.publish_at).toLocaleString('ru-RU') : '—'} · висит минимум {d.min_hold_hours}ч
                  </div>
                  {d.status === 'completed' && (
                    <div className="text-xs text-emerald-600">
                      Охваты: ваш {(isInitiator ? d.initiator_reach : d.partner_reach)?.toLocaleString('ru-RU') ?? '—'}, партнёра{' '}
                      {(isInitiator ? d.partner_reach : d.initiator_reach)?.toLocaleString('ru-RU') ?? '—'}
                    </div>
                  )}
                  <DealActions
                    deal={{ id: d.id, role: isInitiator ? 'initiator' : 'partner', status: d.status }}
                    partnerChannelTitle={titleMap.get(theirChannel) ?? ''}
                  />
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
