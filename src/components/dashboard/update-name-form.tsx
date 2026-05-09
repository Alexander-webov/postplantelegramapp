'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateNameAction } from '@/app/actions/auth';

export function UpdateNameForm({ initialName }: { initialName: string }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);

  const dirty = name !== initialName;

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await updateNameAction(formData);
          if (result?.error) toast.error(result.error);
          else if (result?.success) toast.success(result.message ?? 'Сохранено');
        })
      }
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Имя</Label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как тебя зовут?"
        />
        <p className="text-xs text-muted-foreground">
          Отображается в шапке и письмах. Оставь пустым чтобы убрать.
        </p>
      </div>

      <div>
        <Button type="submit" disabled={pending || !dirty}>
          <Save className="h-3.5 w-3.5" />
          {pending ? 'Сохраняю…' : 'Сохранить имя'}
        </Button>
      </div>
    </form>
  );
}
