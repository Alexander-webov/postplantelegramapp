import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = { title: 'Вход' };

export default function LoginPage() {
  return (
    <Card>
      <CardContent className="space-y-6 px-6 py-8 sm:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">С возвращением</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Войди по email и паролю чтобы продолжить.
          </p>
        </div>

        <LoginForm />

        <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
          Ещё нет аккаунта?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Создать
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
