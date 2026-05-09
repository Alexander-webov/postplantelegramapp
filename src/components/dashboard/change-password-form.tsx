'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePasswordAction } from '@/app/actions/auth';

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          setSuccess(false);
          const result = await updatePasswordAction(formData);
          if (result?.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result?.success) {
            setSuccess(true);
            toast.success(result.message ?? 'Пароль обновлён');
            // Reset the form fields after successful update
            const form = document.querySelector<HTMLFormElement>('#password-form');
            form?.reset();
            setTimeout(() => setSuccess(false), 3000);
          }
        })
      }
      id="password-form"
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
          placeholder="Минимум 8 символов"
        />
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
        <div className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-sm border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Пароль обновлён</span>
        </div>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          <KeyRound className="h-3.5 w-3.5" />
          {pending ? 'Сохраняю…' : 'Сменить пароль'}
        </Button>
      </div>
    </form>
  );
}
