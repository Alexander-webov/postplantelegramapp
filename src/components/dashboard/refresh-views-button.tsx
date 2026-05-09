'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { refreshViewsAction } from '@/app/actions/posts';

interface Props {
  scheduledId: string;
  /** The cached views from DB — shown as initial value */
  initialViews: number | null;
  initialRefreshedAt: string | null;
}

/**
 * Small inline button shown on each sent post in the queue. Manually triggers
 * a fresh views fetch from Telegram. Updates UI optimistically — server
 * revalidates the path so the next render has fresh data anyway.
 */
export function RefreshViewsButton({ scheduledId, initialViews, initialRefreshedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [views, setViews] = useState<number | null>(initialViews);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(initialRefreshedAt);

  function handleClick() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('scheduled_post_id', scheduledId);
      const result = await refreshViewsAction(fd);
      if (result.error) {
        toast.error(result.error);
      } else if (typeof result.views === 'number') {
        setViews(result.views);
        setRefreshedAt(result.refreshedAt ?? new Date().toISOString());
        toast.success(`Просмотров: ${result.views.toLocaleString('ru-RU')}`);
      }
    });
  }

  // Format relative time like "обновлено 2м назад" — pure client-side, no SSR needed
  const ago = refreshedAt ? formatAgo(refreshedAt) : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-base hover:bg-accent hover:text-foreground disabled:opacity-50"
      title={ago ? `Обновлено ${ago}` : 'Обновить количество просмотров'}
    >
      {pending ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <Eye className="h-3 w-3" />
      )}
      {views !== null ? (
        <>
          <span className="tabular-nums font-medium">{views.toLocaleString('ru-RU')}</span>
          <span className="text-[10px] uppercase tracking-wider opacity-70">просм.</span>
        </>
      ) : (
        <span>Замерить</span>
      )}
    </button>
  );
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'только что';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}м назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}ч назад`;
  return `${Math.floor(hrs / 24)}д назад`;
}
