'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfileAction } from '@/app/actions/settings';

interface Props {
  initialFullName: string;
  email: string;
}

export function ProfileForm({ initialFullName, email }: Props) {
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initialFullName);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await updateProfileAction(formData);
          if (r.error) toast.error(r.error);
          else toast.success('Профиль обновлён');
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="text-xs text-muted-foreground">
          Email менять нельзя — связан с аккаунтом и подпиской. Если нужно — напиши в поддержку.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Имя</Label>
        <Input
          id="full_name"
          name="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={200}
          placeholder="Иван Петров"
        />
      </div>

      <Button type="submit" disabled={pending || fullName === initialFullName}>
        <Save className="h-4 w-4" />
        {pending ? 'Сохраняю…' : 'Сохранить'}
      </Button>
    </form>
  );
}
