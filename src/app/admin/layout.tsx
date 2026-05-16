import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/helpers';
import { Logo } from '@/components/dashboard/logo';

/**
 * Admin layout — gated by requireAdmin(). Any non-admin (or unauthenticated)
 * user is redirected to /dashboard or /login from there. Children pages can
 * assume the visitor is an admin.
 *
 * The layout is intentionally simple: this is an internal tool, not a
 * product surface. We're not investing time in pretty design here.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="inline-flex items-center transition-base hover:opacity-80">
              <Logo />
              <span className="ml-3 rounded bg-primary-soft px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-primary-soft-foreground">
                Admin
              </span>
            </Link>
            <nav className="hidden gap-5 text-sm text-muted-foreground md:flex">
              <Link href="/admin" className="hover:text-foreground">Метрики</Link>
              <Link href="/admin/posts" className="hover:text-foreground">Блог</Link>
              <Link href="/admin/users" className="hover:text-foreground">Пользователи</Link>
            </nav>
          </div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← В кабинет
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
