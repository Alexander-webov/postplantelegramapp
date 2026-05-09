'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signupAction } from '@/app/actions/auth';

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await signupAction(formData);
          if (result?.error) {
            setError(result.error);
            toast.error(result.error);
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Имя <span className="text-muted-foreground">(необязательно)</span></Label>
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

      <p className="text-center text-xs text-muted-foreground">
        Регистрируясь, ты соглашаешься с{' '}
        <a href="/terms" className="hover:underline">условиями использования</a>{' '}
        и{' '}
        <a href="/privacy" className="hover:underline">политикой конфиденциальности</a>.
      </p>
    </form>
  );
}
