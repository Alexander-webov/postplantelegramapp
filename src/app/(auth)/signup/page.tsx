import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata = { title: 'Создать аккаунт' };

export default function SignupPage() {
  return (
    <Card>
      <CardContent className="space-y-6 px-6 py-8 sm:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Создать аккаунт</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            30 секунд — и можно подключать первый канал.
          </p>
        </div>

        <SignupForm />

        <ul className="space-y-1.5 rounded-sm border border-border/70 bg-surface-sunken/40 p-3 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            Бесплатно — 1 канал, 10 постов в месяц
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            Без карты, без триала, без скрытых платежей
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            Платный тариф от 299 ₽/мес — без скрытых комиссий
          </li>
        </ul>

        <p className="text-xs text-muted-foreground">
          Регистрируясь, вы соглашаетесь с{' '}
          <Link href="/legal/terms" className="text-primary hover:underline">условиями</Link>{' '}
          и{' '}
          <Link href="/legal/privacy" className="text-primary hover:underline">политикой конфиденциальности</Link>.
        </p>

        <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Войти
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
