'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BarChart3, Eye, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cancelScheduledAction } from '@/app/actions/posts';
import { Button } from '@/components/ui/button';

export function ScheduledPostActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canEdit = status === 'pending';
  const canDelete = status === 'pending';
  const viewHref = status === 'sent' ? `/dashboard/queue/${id}/analytics` : `/dashboard/queue/${id}/edit`;

  function onDelete() {
    if (!canDelete) return;
    if (!confirm('Удалить из очереди? Пост не будет опубликован.')) return;
    const fd = new FormData();
    fd.append('scheduled_post_id', id);
    startTransition(async () => {
      const result = await cancelScheduledAction(fd);
      if (result.error) toast.error(result.error);
      else {
        toast.success('Пост удалён из очереди');
        setOpen(false);
      }
    });
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <Button asChild size="sm" variant="ghost" className="h-8 rounded-xl px-2 text-slate-600 hover:text-primary">
        <Link href={viewHref} aria-label="Посмотреть пост">
          {status === 'sent' ? <BarChart3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="sr-only">Посмотреть</span>
        </Link>
      </Button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-base hover:bg-slate-100 hover:text-slate-950"
        aria-label="Действия с постом"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
          />
          <div className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
            <Link
              href={canEdit ? `/dashboard/queue/${id}/edit` : `/dashboard/queue/${id}/analytics`}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-base hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <Pencil className="h-4 w-4 text-slate-400" />
              {canEdit ? 'Изменить' : 'Открыть'}
            </Link>
            <button
              type="button"
              disabled={!canDelete || pending}
              onClick={onDelete}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition-base hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <Trash2 className="h-4 w-4" />
              {canDelete ? 'Удалить' : 'Удаление недоступно'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
