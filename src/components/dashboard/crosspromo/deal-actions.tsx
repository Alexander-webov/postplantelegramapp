'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { acceptCpDealAction, declineCpDealAction, cancelCpDealAction } from '@/app/actions/crosspromo';

interface DealInfo {
  id: string;
  role: 'initiator' | 'partner';
  status: string;
}

export function DealActions({ deal, partnerChannelTitle }: { deal: DealInfo; partnerChannelTitle: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accepting, setAccepting] = useState(false);

  const canAccept = deal.role === 'partner' && deal.status === 'proposed';
  const canDecline = deal.role === 'partner' && deal.status === 'proposed';
  const canCancel = ['proposed', 'accepted', 'scheduled'].includes(deal.status);

  function handleAccept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.append('deal_id', deal.id);
    startTransition(async () => {
      const r = await acceptCpDealAction(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Сделка принята! Посты запланированы у обеих сторон.');
        setAccepting(false);
        router.refresh();
      }
    });
  }

  function handleDecline() {
    if (!confirm('Отклонить это предложение?')) return;
    const fd = new FormData();
    fd.append('deal_id', deal.id);
    startTransition(async () => {
      const r = await declineCpDealAction(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Предложение отклонено');
        router.refresh();
      }
    });
  }

  function handleCancel() {
    if (!confirm('Отменить сделку? Если посты уже запланированы — они не будут опубликованы.')) return;
    const fd = new FormData();
    fd.append('deal_id', deal.id);
    startTransition(async () => {
      const r = await cancelCpDealAction(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success('Сделка отменена');
        router.refresh();
      }
    });
  }

  if (accepting) {
    return (
      <form onSubmit={handleAccept} className="space-y-3 rounded-sm border border-border p-3">
        <div className="space-y-1.5">
          <Label htmlFor={`promo-${deal.id}`}>Ваш пост (рекламирует канал «{partnerChannelTitle}»)</Label>
          <Textarea
            id={`promo-${deal.id}`}
            name="promo_text_for_initiator"
            rows={4}
            required
            maxLength={2000}
            placeholder={`Например: 🔥 Рекомендую канал «${partnerChannelTitle}» — заходите!`}
          />
          <p className="text-xs text-muted-foreground">Этот пост выйдет в ВАШЕМ канале в согласованное время.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Принятие…' : 'Подтвердить и запланировать'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAccepting(false)} disabled={pending}>
            Назад
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAccept && (
        <Button type="button" size="sm" onClick={() => setAccepting(true)} disabled={pending}>
          <Check className="h-4 w-4" /> Принять
        </Button>
      )}
      {canDecline && (
        <Button type="button" variant="outline" size="sm" onClick={handleDecline} disabled={pending}>
          <X className="h-4 w-4" /> Отклонить
        </Button>
      )}
      {canCancel && !canAccept && (
        <Button type="button" variant="outline" size="sm" onClick={handleCancel} disabled={pending}>
          <Ban className="h-4 w-4" /> Отменить
        </Button>
      )}
    </div>
  );
}
