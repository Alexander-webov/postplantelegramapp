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
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Collects any errors so the page can SURFACE them instead of silently
  // rendering zeros. The most common production cause of "all zeros" is a
  // missing/invalid SUPABASE_SERVICE_ROLE_KEY — these aggregates bypass RLS
  // via the service-role client, and without a valid key every query errors.
  const diagnostics: string[] = [];

  // Guard: detect a missing service key explicitly (clearest possible message).
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!hasServiceKey) {
    diagnostics.push(
      'Переменная окружения SUPABASE_SERVICE_ROLE_KEY не задана на сервере. ' +
        'Добавьте её в настройках окружения (Railway → Variables) и перезапустите деплой.'
    );
  }
  if (!hasSupabaseUrl) {
    diagnostics.push('Переменная окружения NEXT_PUBLIC_SUPABASE_URL не задана на сервере.');
  }

  const supabase = createServiceClient();

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

  // Surface the first error from each query (deduplicated) so the real cause
  // is visible on the page rather than swallowed into a zero.
  const queryErrors = [
    totalUsers.error, newUsers30d.error, paidUsers.error, freeUsers.error,
    startUsers.error, proUsers.error, totalChannels.error, totalPosts.error,
    publishedPosts.error, paidPayments30d.error,
  ].filter(Boolean) as { message: string }[];
  for (const msg of new Set(queryErrors.map((e) => e.message))) {
    diagnostics.push(`Ошибка запроса к базе: ${msg}`);
  }

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

      {diagnostics.length > 0 && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Данные не загрузились — причина:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {diagnostics.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-700">
            Этот блок виден только администратору и исчезнет, как только запросы начнут проходить.
          </p>
        </section>
      )}

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
