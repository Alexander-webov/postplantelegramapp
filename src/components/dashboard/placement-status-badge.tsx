'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Briefcase, ChevronDown } from 'lucide-react';
import { updatePlacementStatusAction } from '@/app/actions/advertisers';
import { cn } from '@/lib/utils';

type PlacementStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'published'
  | 'reported'
  | 'cancelled';

interface Props {
  placementId: string;
  currentStatus: PlacementStatus;
  priceRub: number | string | null;
  advertiserName: string | null;
}

const STATUS_LABELS: Record<PlacementStatus, string> = {
  draft: 'черновик',
  awaiting_payment: 'ждёт оплаты',
  paid: 'оплачено',
  published: 'опубликовано',
  reported: 'отчёт отправлен',
  cancelled: 'отменено',
};

// Tailwind-compatible class strings per status — uses our existing pill utilities
const STATUS_STYLES: Record<PlacementStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  awaiting_payment: 'pill-soft-warning',
  paid: 'pill-soft-primary',
  published: 'pill-soft-success',
  reported: 'pill-soft-success',
  cancelled: 'pill-soft-destructive',
};

const ALL_STATUSES: PlacementStatus[] = [
  'draft', 'awaiting_payment', 'paid', 'published', 'reported', 'cancelled',
];

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

/**
 * Click-to-change badge for ad placement status. Acts like a regular badge
 * but opens a small dropdown when clicked, letting users move the placement
 * through the lifecycle (draft → awaiting_payment → paid → reported) without
 * leaving the queue page.
 */
export function PlacementStatusBadgeWithMenu({
  placementId, currentStatus, priceRub, advertiserName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  function changeStatus(newStatus: PlacementStatus) {
    if (newStatus === status) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.append('placement_id', placementId);
    fd.append('status', newStatus);
    startTransition(async () => {
      const r = await updatePlacementStatusAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        setStatus(newStatus);
        toast.success(`Статус: ${STATUS_LABELS[newStatus]}`);
        setOpen(false);
      }
    });
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title={advertiserName ? `Рекламодатель: ${advertiserName}` : 'Размещение'}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'whitespace-nowrap transition-base hover:opacity-90',
          'disabled:opacity-50',
          STATUS_STYLES[status]
        )}
      >
        <Briefcase className="h-3 w-3" />
        <span>{formatRub(priceRub)}</span>
        {advertiserName && (
          <span className="hidden sm:inline">· {advertiserName}</span>
        )}
        <span className="opacity-70">· {STATUS_LABELS[status]}</span>
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Статус
          </div>
          {ALL_STATUSES.map((s) => {
            const isCurrent = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => changeStatus(s)}
                disabled={pending}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-base',
                  isCurrent
                    ? 'bg-accent font-medium'
                    : 'hover:bg-accent'
                )}
              >
                <span>{STATUS_LABELS[s]}</span>
                {isCurrent && (
                  <span className="text-[10px] text-muted-foreground">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
