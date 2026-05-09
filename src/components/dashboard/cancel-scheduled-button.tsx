'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cancelScheduledAction } from '@/app/actions/posts';

export function CancelScheduledButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm('Отменить запланированный пост? Его не отправят.')) return;
        const fd = new FormData();
        fd.append('scheduled_post_id', id);
        startTransition(async () => {
          const r = await cancelScheduledAction(fd);
          if (r.error) toast.error(r.error);
          else toast.success('Отменено');
        });
      }}
      className="text-destructive hover:bg-destructive-soft hover:text-destructive"
    >
      <X className="h-3.5 w-3.5" />
      Отменить
    </Button>
  );
}
