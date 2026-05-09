import { Card, CardContent } from '@/components/ui/card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata = { title: 'Новый пароль' };

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-6 px-6 py-8 sm:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Новый пароль</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Установи новый пароль для входа в Постплан.
          </p>
        </div>

        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
