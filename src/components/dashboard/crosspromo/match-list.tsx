'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldCheck, Eye, Users, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { topicLabel } from '@/lib/crosspromo/topics';
import { proposeCpDealAction, type CpMatch } from '@/app/actions/crosspromo';

export function MatchList({ myListingId, matches }: { myListingId: string; matches: CpMatch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [proposeTo, setProposeTo] = useState<CpMatch | null>(null);

  // Default publish time: tomorrow 18:00 local, formatted for datetime-local input
  const defaultPublishAt = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  function handlePropose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!proposeTo) return;
    const fd = new FormData(e.currentTarget);
    fd.append('my_listing_id', myListingId);
    fd.append('partner_listing_id', proposeTo.listing_id);
    startTransition(async () => {
      const r = await proposeCpDealAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success('Предложение отправлено! Партнёр получит уведомление.');
        setProposeTo(null);
        router.push('/dashboard/crosspromo/deals');
      }
    });
  }

  return (
    <>
      <div className="grid gap-3">
        {matches.map((m) => (
          <Card key={m.listing_id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.channel_title}</span>
                  {m.is_verified && (
                    <Badge variant="success">
                      <ShieldCheck className="h-3 w-3" /> Проверен
                    </Badge>
                  )}
                  <Badge variant="outline">{topicLabel(m.topic)}</Badge>
                  {m.channel_username && (
                    <a
                      href={`https://t.me/${m.channel_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      @{m.channel_username}
                    </a>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> охват ≈ {m.avg_reach.toLocaleString('ru-RU')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {m.subscriber_count.toLocaleString('ru-RU')} подписчиков
                  </span>
                  {m.deals_completed > 0 && <span>✅ {m.deals_completed} сделок</span>}
                  {m.deals_failed > 0 && <span className="text-destructive">❌ {m.deals_failed} нарушений</span>}
                </div>
                {m.description && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{m.description}</p>}
              </div>
              <Button type="button" size="sm" onClick={() => setProposeTo(m)}>
                <Send className="h-4 w-4" /> Предложить ВП
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Propose modal */}
      {proposeTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg">
            <CardContent className="py-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Предложить взаимопиар: {proposeTo.channel_title}</h3>
                <button type="button" onClick={() => setProposeTo(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handlePropose} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="promo_text_for_partner">Текст вашего поста (рекламирует канал партнёра)</Label>
                  <Textarea
                    id="promo_text_for_partner"
                    name="promo_text_for_partner"
                    rows={4}
                    required
                    maxLength={2000}
                    placeholder={`Например: 🔥 Крутой канал «${proposeTo.channel_title}» — подпишись!\n\n${proposeTo.channel_username ? '@' + proposeTo.channel_username : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Этот пост выйдет в ВАШЕМ канале. Партнёр напишет свой текст про вас, когда примет.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="publish_at">Когда публикуем (оба)</Label>
                    <Input id="publish_at" name="publish_at" type="datetime-local" required defaultValue={defaultPublishAt} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="min_hold_hours">Минимум висит (часов)</Label>
                    <Input id="min_hold_hours" name="min_hold_hours" type="number" min={1} max={168} defaultValue={24} required />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={pending}>
                    {pending ? 'Отправка…' : 'Отправить предложение'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setProposeTo(null)} disabled={pending}>
                    Отмена
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
