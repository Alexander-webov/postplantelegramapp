'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signupAction } from '@/app/actions/auth';

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (successMessage) {
    return (
      <div className="space-y-4">
        <div className="rounded-sm border border-success/30 bg-success-soft px-4 py-4 text-sm text-success-foreground">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-medium">Подтверди email</div>
              <p className="mt-1 text-muted-foreground">{successMessage}</p>
            </div>
          </div>
        </div>

        <Button asChild className="w-full" variant="outline">
          <Link href="/login">Перейти ко входу</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          setSuccessMessage(null);

          const result = await signupAction(formData);

          // Server actions that redirect may resolve as undefined on the client.
          // Never use `'error' in result` without checking result first.
          if (!result) return;

          if (result.error) {
            setError(result.error);
            toast.error(result.error);
            return;
          }

          if (result.success) {
            const message = result.message ?? 'Аккаунт создан. Проверь email для подтверждения.';
            setSuccessMessage(message);
            toast.success('Письмо отправлено');
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="full_name">
          Имя <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          placeholder="Александр"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">Минимум 8 символов</p>
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
        {pending ? 'Создаю…' : 'Создать аккаунт'}
      </Button>

      <div className="flex items-start gap-2 rounded-sm border border-border/70 bg-surface-sunken/40 px-3 py-2 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
        После регистрации мы отправим письмо для подтверждения email.
      </div>
    </form>
  );
}
