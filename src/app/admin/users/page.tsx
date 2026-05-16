import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import type { SubscriptionTier } from '@/lib/tiers';

export const dynamic = 'force-dynamic';

/**
 * Admin user list — filter by tier and search by email. We keep this
 * server-side and dead simple: the filter is via query params, so admins
 * can bookmark "users on Pro" or "users on Free" without state in JS.
 */

type SearchParams = {
  tier?: string;
  q?: string;
};

const TIER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',      label: 'Все тарифы' },
  { value: 'free',  label: 'Free' },
  { value: 'start', label: 'Start' },
  { value: 'pro',   label: 'Pro' },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createServiceClient();

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, subscription_tier, subscription_expires_at, is_admin, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200);

  if (searchParams.tier && ['free', 'start', 'pro'].includes(searchParams.tier)) {
    query = query.eq('subscription_tier', searchParams.tier as SubscriptionTier);
  }
  if (searchParams.q) {
    query = query.ilike('email', `%${searchParams.q.replace(/[%_]/g, ' ').trim()}%`);
  }

  const { data: users, count } = await query;

  // Per-user channel/post counts in one round-trip each (small DB, OK to do
  // here; if user count grows past 1k, switch to a SQL view).
  const ids = (users ?? []).map((u) => u.id);
  const [channelCounts, postCounts] = await Promise.all([
    ids.length
      ? supabase.from('channels').select('user_id').in('user_id', ids)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    ids.length
      ? supabase.from('scheduled_posts').select('user_id').in('user_id', ids)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  const channelsByUser = new Map<string, number>();
  for (const row of channelCounts.data ?? []) {
    channelsByUser.set(row.user_id, (channelsByUser.get(row.user_id) ?? 0) + 1);
  }
  const postsByUser = new Map<string, number>();
  for (const row of postCounts.data ?? []) {
    postsByUser.set(row.user_id, (postsByUser.get(row.user_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Пользователи</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Всего: {count ?? users?.length ?? 0} · показаны последние 200
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="block text-xs uppercase tracking-wider text-muted-foreground">
            Поиск по email
          </label>
          <input
            id="q"
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="user@example.com"
            className="mt-1 w-64 rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="tier" className="block text-xs uppercase tracking-wider text-muted-foreground">
            Тариф
          </label>
          <select
            id="tier"
            name="tier"
            defaultValue={searchParams.tier ?? ''}
            className="mt-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Применить
        </button>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          Сбросить
        </Link>
      </form>

      {!users || users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-sunken/30 px-6 py-12 text-center text-muted-foreground">
          Никого не найдено.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Email / Имя</th>
                <th className="px-4 py-3 font-medium">Тариф</th>
                <th className="px-4 py-3 font-medium">Действует до</th>
                <th className="px-4 py-3 font-medium">Каналов</th>
                <th className="px-4 py-3 font-medium">Постов</th>
                <th className="px-4 py-3 font-medium">Регистрация</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-sunken/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.email}</div>
                    {u.full_name ? (
                      <div className="text-xs text-muted-foreground">{u.full_name}</div>
                    ) : null}
                    {u.is_admin ? (
                      <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-soft-foreground">
                        Admin
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={u.subscription_tier} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.subscription_expires_at
                      ? new Date(u.subscription_expires_at).toLocaleDateString('ru-RU')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{channelsByUser.get(u.id) ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{postsByUser.get(u.id) ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: SubscriptionTier }) {
  const styles: Record<SubscriptionTier, string> = {
    free:  'bg-surface-sunken text-muted-foreground',
    start: 'bg-primary-soft text-primary-soft-foreground',
    pro:   'bg-success-soft text-success-soft-foreground',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[tier]}`}>
      {tier}
    </span>
  );
}
