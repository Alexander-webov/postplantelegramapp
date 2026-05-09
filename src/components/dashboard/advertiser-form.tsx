'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, AtSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { upsertAdvertiserAction } from '@/app/actions/advertisers';

interface Props {
  initial?: {
    id: string;
    name: string;
    telegram_username: string | null;
    contact: string | null;
    notes: string | null;
  };
}

export function AdvertiserForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await upsertAdvertiserAction(formData);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result.success) {
            toast.success(isEdit ? 'Сохранено' : 'Рекламодатель создан');
            // After create, navigate to the new card. After edit — stay.
            if (!isEdit && result.id) {
              router.push(`/dashboard/advertisers/${result.id}`);
            } else {
              router.refresh();
            }
          }
        })
      }
      className="space-y-4"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">
          Имя <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          autoFocus={!isEdit}
          defaultValue={initial?.name ?? ''}
          placeholder="Ozon, Иван Петров, AdAgency"
        />
        <p className="text-xs text-muted-foreground">
          Как тебе удобно — компания, имя контакта или nickname.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="telegram_username">
          <AtSign className="mr-1 inline h-3.5 w-3.5" />
          Telegram <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Input
          id="telegram_username"
          name="telegram_username"
          maxLength={64}
          defaultValue={initial?.telegram_username ?? ''}
          placeholder="username (без @)"
        />
        <p className="text-xs text-muted-foreground">
          Для быстрой связи и автоотчётов. @ можно не писать — мы сами уберём.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact">
          Другой контакт <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Input
          id="contact"
          name="contact"
          maxLength={200}
          defaultValue={initial?.contact ?? ''}
          placeholder="email, телефон, ссылка на чат — что угодно"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Заметки <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          maxLength={2000}
          rows={4}
          defaultValue={initial?.notes ?? ''}
          placeholder="Ниша, как нашёл, какие посты любит, способ оплаты, любые детали..."
        />
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          {pending ? 'Сохраняю…' : isEdit ? 'Сохранить' : 'Создать'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}
