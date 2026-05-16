import Link from 'next/link';
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { Logo } from '@/components/dashboard/logo';

// =============================================================================
// /blog — public index of published articles
// =============================================================================
// Service-role client is fine for a public read here: the RLS policy on
// blog_posts is "select where is_published = true" for anon, but using the
// service-role lets us add admin-only sections later (drafts) on the same
// page without a second client.
// =============================================================================

export const metadata: Metadata = {
  title: 'Блог Постплана — гайды для админов Telegram-каналов',
  description:
    'Статьи о работе с Telegram-каналами: маркировка рекламы, отчёты для клиентов, продажа размещений и кейсы.',
  alternates: { canonical: 'https://postplan-tg.ru/blog' },
  openGraph: {
    title: 'Блог Постплана',
    description: 'Статьи о работе с Telegram-каналами и продаже рекламы',
    url: 'https://postplan-tg.ru/blog',
    type: 'website',
  },
};

// ISR — revalidate the index every 5 minutes. Server actions also call
// revalidatePath('/blog') on writes, so updates appear sooner when admins
// publish content.
export const revalidate = 300;

export default async function BlogIndexPage() {
  const supabase = createServiceClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_image_url, published_at, reading_minutes')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 pt-14 pb-24 sm:px-6">
        <header className="mb-12">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Блог
          </p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Гайды для админов Telegram-каналов
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Маркировка рекламы, отчёты клиентам, продажа размещений и реальный опыт ведения каналов.
          </p>
        </header>

        {(!posts || posts.length === 0) ? (
          <EmptyState />
        ) : (
          <ul className="space-y-10">
            {posts.map((p) => (
              <li key={p.id} className="group">
                <Link href={`/blog/${p.slug}`} className="block">
                  <article className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                    {p.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.cover_image_url}
                        alt=""
                        className="h-44 w-full shrink-0 rounded-lg border border-border object-cover sm:h-32 sm:w-52"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary md:text-2xl">
                        {p.title}
                      </h2>
                      {p.excerpt ? (
                        <p className="mt-2 line-clamp-3 text-muted-foreground">{p.excerpt}</p>
                      ) : null}
                      <p className="mt-3 text-sm text-muted-foreground">
                        {formatDate(p.published_at)}
                        {p.reading_minutes ? ` · ${p.reading_minutes} мин чтения` : null}
                      </p>
                    </div>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-sunken/30 px-6 py-14 text-center">
      <p className="text-muted-foreground">
        Здесь скоро появятся статьи. Загляните чуть позже.
      </p>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ----- Header/Footer (small duplicate to keep this page independent) ---------

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center transition-base hover:opacity-80">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link href="/#how" className="hover:text-foreground">Как работает</Link>
          <Link href="/#pricing" className="hover:text-foreground">Тарифы</Link>
          <Link href="/blog" className="text-foreground">Блог</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">
            Войти
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Попробовать
          </Link>
        </div>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>© Постплан, {new Date().getFullYear()}</div>
        <div className="flex gap-5">
          <Link href="/legal/offer" className="hover:text-foreground">Оферта</Link>
          <Link href="/legal/privacy" className="hover:text-foreground">Конфиденциальность</Link>
        </div>
      </div>
    </footer>
  );
}
