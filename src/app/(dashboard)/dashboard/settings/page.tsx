import { requireUser, getProfile } from '@/lib/auth/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { UpdateNameForm } from '@/components/dashboard/update-name-form';
import { ChangePasswordForm } from '@/components/dashboard/change-password-form';

export const metadata = { title: 'Настройки' };

export default async function SettingsPage() {
  await requireUser();
  const profile = await getProfile();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Настройки"
        description="Имя и пароль аккаунта."
      />

      {/* Profile */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Профиль</h2>
        <Card>
          <CardContent className="space-y-5 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {(profile.full_name ?? profile.email)[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {profile.full_name ?? profile.email.split('@')[0]}
                </div>
                <div className="truncate text-xs text-muted-foreground">{profile.email}</div>
              </div>
            </div>

            <div className="border-t border-border/60 pt-4">
              <UpdateNameForm initialName={profile.full_name ?? ''} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Password */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Безопасность</h2>
        <Card>
          <CardContent className="px-5 py-5">
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </section>

      {/* Email — read-only for now */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Email</h2>
        <Card>
          <CardContent className="px-5 py-5">
            <div className="text-sm font-medium">{profile.email}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Смена email-адреса временно недоступна — добавим в следующих обновлениях.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
