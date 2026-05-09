'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearHistoryAction } from '@/app/actions/posts';

export function ClearHistoryButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Очистить историю (${count} записей)? Сами посты в Telegram не удаляются — удаляется только локальная история отправок.`)) return;
        startTransition(async () => {
          const r = await clearHistoryAction();
          if (r.error) toast.error(r.error);
          else toast.success(`Удалено ${r.deleted} записей`);
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Очистить
    </Button>
  );
}
