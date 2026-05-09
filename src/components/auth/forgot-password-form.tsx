'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordResetAction } from '@/app/actions/auth';

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-sm border border-success/30 bg-success-soft px-3 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{sent}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Проверь папку «Спам», если письма нет в основной — наши письма иногда попадают туда у первый раз.
        </p>
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await requestPasswordResetAction(formData);
          if (result?.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result?.success) {
            setSent(result.message ?? 'Ссылка отправлена');
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
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
        {pending ? 'Отправляю…' : 'Отправить ссылку'}
      </Button>
    </form>
  );
}
