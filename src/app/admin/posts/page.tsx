import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Blog admin index — list of all posts (drafts + published).
 */
export default async function AdminPostsPage() {
  const supabase = createServiceClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, is_published, published_at, updated_at, view_count')
    .order('updated_at', { ascending: false });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Статьи блога</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {posts?.length ?? 0} статей · черновики и опубликованные вместе
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          + Новая статья
        </Link>
      </header>

      {!posts || posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-sunken/30 px-6 py-14 text-center text-muted-foreground">
          Пока ни одной статьи. <Link href="/admin/posts/new" className="text-primary hover:underline">Создать первую</Link>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Заголовок</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Обновлено</th>
                <th className="px-4 py-3 font-medium">Просмотры</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-surface-sunken/20">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.slug}</td>
                  <td className="px-4 py-3">
                    {p.is_published ? (
                      <span className="inline-flex rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-foreground">
                        Опубликован
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-foreground">
                        Черновик
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.view_count ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/posts/${p.id}/edit`} className="text-primary hover:underline">
                      Изменить
                    </Link>
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
