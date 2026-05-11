import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Подтвердите email' };

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardContent className="space-y-6 px-6 py-8 text-center sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <Mail className="h-6 w-6" />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Проверьте почту</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Мы отправили письмо со ссылкой подтверждения. После подтверждения email можно войти в Постплан.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/login">Перейти ко входу</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
