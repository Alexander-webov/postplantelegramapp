import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Admin dashboard — high-level metrics about user base and revenue.
 *
 * Everything here uses the service-role client because RLS on profiles
 * restricts SELECT to "own row only". We need cross-user aggregates here,
 * and the page is already gated by requireAdmin() in layout.
 */
export default async function AdminHomePage() {
  const supabase = createServiceClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Parallel reads — small queries, but no reason to serialize
  const [
    totalUsers,
    newUsers30d,
    paidUsers,
    freeUsers,
    startUsers,
    proUsers,
    totalChannels,
    totalPosts,
    publishedPosts,
    paidPayments30d,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('subscription_tier', 'free'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_tier', 'free'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_tier', 'start'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_tier', 'pro'),
    supabase.from('channels').select('id', { count: 'exact', head: true }),
    supabase.from('scheduled_posts').select('id', { count: 'exact', head: true }),
    supabase.from('scheduled_posts').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    supabase
      .from('payments')
      .select('amount_rub')
      .eq('status', 'succeeded')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const revenue30d =
    (paidPayments30d.data ?? []).reduce((sum, p) => sum + Number(p.amount_rub ?? 0), 0);

  const metrics: { label: string; value: string | number; muted?: boolean }[] = [
    { label: 'Всего пользователей',      value: totalUsers.count ?? 0 },
    { label: 'Регистраций за 30 дней',   value: newUsers30d.count ?? 0 },
    { label: 'Платящих',                 value: paidUsers.count ?? 0 },
    { label: 'Выручка, 30 дней (₽)',     value: revenue30d.toLocaleString('ru-RU') },
    { label: 'Free',                     value: freeUsers.count ?? 0, muted: true },
    { label: 'Start',                    value: startUsers.count ?? 0, muted: true },
    { label: 'Pro',                      value: proUsers.count ?? 0, muted: true },
    { label: 'Каналов',                  value: totalChannels.count ?? 0, muted: true },
    { label: 'Постов в очереди',         value: totalPosts.count ?? 0, muted: true },
    { label: 'Опубликовано всего',       value: publishedPosts.count ?? 0, muted: true },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Метрики</h1>
        <p className="mt-1 text-sm text-muted-foreground">Состояние сервиса на {now.toLocaleString('ru-RU')}.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-lg border border-border bg-card p-4 ${m.muted ? 'opacity-90' : ''}`}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{m.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Быстрые ссылки</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link href="/admin/posts/new" className="text-primary hover:underline">
              Написать новую статью →
            </Link>
          </li>
          <li>
            <Link href="/admin/posts" className="text-primary hover:underline">
              Все статьи блога →
            </Link>
          </li>
          <li>
            <Link href="/admin/users" className="text-primary hover:underline">
              Пользователи →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
