import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata = { title: 'Восстановление пароля' };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-6 px-6 py-8 sm:px-8">
        <Link
          href="/login"
          className="-ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-base hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Ко входу
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Восстановить пароль</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Введи email — пришлём ссылку для сброса.
          </p>
        </div>

        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
