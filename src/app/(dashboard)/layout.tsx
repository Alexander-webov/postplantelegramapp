import { requireUser, getProfile } from '@/lib/auth/helpers';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { getEffectiveTier } from '@/lib/usage';
import { TIERS } from '@/lib/tiers';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const profile = await getProfile();
  const tier = getEffectiveTier(profile);
  const tierName = TIERS[tier]?.name ?? 'Free';

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-foreground">
      <Sidebar
        tierName={tierName}
        expiresAt={profile.subscription_expires_at}
        isAdmin={profile.is_admin}
      />
      <div className="min-h-screen lg:pl-72">
        <Header email={profile.email} fullName={profile.full_name} isAdmin={profile.is_admin} />
        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
