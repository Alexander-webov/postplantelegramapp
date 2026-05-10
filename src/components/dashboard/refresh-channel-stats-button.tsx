'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { refreshChannelStatsAction } from '@/app/actions/analytics';

export function RefreshChannelStatsButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-xl bg-white"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await refreshChannelStatsAction();
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`Обновлено каналов: ${result.updated ?? 0}`);
        });
      }}
    >
      <RefreshCw className={pending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
      Обновить каналы
    </Button>
  );
}
