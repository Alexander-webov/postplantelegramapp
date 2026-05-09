'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePasswordAction } from '@/app/actions/auth';

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-sm border border-success/30 bg-success-soft px-3 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Пароль обновлён. Сейчас перенаправим в кабинет.</span>
        </div>
        <Button asChild className="w-full" size="lg">
          <a href="/dashboard">К дашборду</a>
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await updatePasswordAction(formData);
          if (result?.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result?.success) {
            setDone(true);
            toast.success('Пароль обновлён');
            setTimeout(() => router.push('/dashboard'), 1500);
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="password">Новый пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">Минимум 8 символов</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Повтори пароль</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Сохраняю…' : 'Сохранить пароль'}
      </Button>
    </form>
  );
}
