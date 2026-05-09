'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteTemplateAction, setActiveSignatureAction } from '@/app/actions/templates';

interface Props {
  id: string;
  kind: 'signature' | 'post' | 'hashtags';
  isActiveSignature: boolean;
}

export function TemplateRowActions({ id, kind, isActiveSignature }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      {kind === 'signature' && !isActiveSignature && (
        <form
          action={(fd) =>
            startTransition(async () => {
              const r = await setActiveSignatureAction(fd);
              if (r.error) toast.error(r.error);
              else toast.success('Подпись активирована');
            })
          }
        >
          <input type="hidden" name="id" value={id} />
          <Button type="submit" size="sm" variant="ghost" disabled={pending} title="Сделать активной">
            <Star className="h-3.5 w-3.5" />
          </Button>
        </form>
      )}
      {kind === 'signature' && isActiveSignature && (
        <form
          action={(fd) =>
            startTransition(async () => {
              const r = await setActiveSignatureAction(fd);
              if (r.error) toast.error(r.error);
              else toast.success('Подпись отключена');
            })
          }
        >
          {/* empty id deactivates */}
          <Button type="submit" size="sm" variant="ghost" disabled={pending} title="Отключить">
            <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
          </Button>
        </form>
      )}

      <Button asChild size="sm" variant="ghost">
        <Link href={`/dashboard/templates/${id}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </Button>

      <form
        action={(fd) =>
          startTransition(async () => {
            if (!confirm('Удалить шаблон?')) return;
            const r = await deleteTemplateAction(fd);
            if (r.error) toast.error(r.error);
            else toast.success('Удалено');
          })
        }
      >
        <input type="hidden" name="id" value={id} />
        <Button type="submit" size="sm" variant="ghost" disabled={pending}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
