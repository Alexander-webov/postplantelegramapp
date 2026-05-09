'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { archiveAdvertiserAction, deleteAdvertiserAction } from '@/app/actions/advertisers';

interface Props {
  id: string;
  name: string;
  isArchived: boolean;
}

/**
 * Action cluster shown in the advertiser detail page header.
 * - Archive/Restore — soft delete, keeps placement history
 * - Delete forever — hard delete, with double-confirm because it cascades
 *   to ad_placements (which is the *deal records*, not the posts themselves)
 */
export function AdvertiserActions({ id, name, isArchived }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleArchive() {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('archived', String(!isArchived));
    startTransition(async () => {
      const r = await archiveAdvertiserAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success(isArchived ? 'Восстановлен' : 'В архиве');
        router.refresh();
      }
    });
  }

  function handleDelete() {
    const ok = confirm(
      `Удалить «${name}» полностью?\n\nЭто действие нельзя отменить. Карточка и вся история размещений будут стёрты. Сами посты в Telegram остаются — удаляются только записи о сделках.`
    );
    if (!ok) return;

    const fd = new FormData();
    fd.append('id', id);
    startTransition(async () => {
      const r = await deleteAdvertiserAction(fd);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success('Удалён');
        router.push('/dashboard/advertisers');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleArchive}
        disabled={pending}
      >
        {isArchived ? (
          <>
            <ArchiveRestore className="h-3.5 w-3.5" />
            Из архива
          </>
        ) : (
          <>
            <Archive className="h-3.5 w-3.5" />
            В архив
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="destructive-outline"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Удалить
      </Button>
    </div>
  );
}
