import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { renderMarkdown } from '@/lib/blog/markdown';
import { Logo } from '@/components/dashboard/logo';

// =============================================================================
// /blog/[slug] — public blog article
// =============================================================================
// Renders Markdown via our in-repo renderer (no dangerouslySetInnerHTML, no
// runtime dependency). Generates Schema.org `Article` JSON-LD for SEO so
// the post is eligible for Google's article rich results. Sets canonical
// URL + OG tags from the post's stored meta fields with sensible fallbacks.
// =============================================================================

export const revalidate = 300;

type PageProps = { params: { slug: string } };

async function fetchPost(slug: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: 'Статья не найдена — Постплан' };

  const title = post.meta_title || post.title;
  const description =
    post.meta_description || post.excerpt || `Статья «${post.title}» в блоге Постплана.`;
  const url = `https://postplan-tg.ru/blog/${post.slug}`;
  const ogImage = post.og_image_url || post.cover_image_url || undefined;

  return {
    title: `${title} — Постплан`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || post.meta_description || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: post.author_name
      ? { '@type': 'Person', name: post.author_name }
      : { '@type': 'Organization', name: 'Постплан' },
    publisher: {
      '@type': 'Organization',
      name: 'Постплан',
      logo: { '@type': 'ImageObject', url: 'https://postplan-tg.ru/icon' },
    },
    image: post.og_image_url || post.cover_image_url || undefined,
    mainEntityOfPage: `https://postplan-tg.ru/blog/${post.slug}`,
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <nav className="mb-8 text-sm">
          <Link href="/blog" className="text-muted-foreground hover:text-foreground">
            ← К списку статей
          </Link>
        </nav>

        <article>
          <header className="mb-8 border-b border-border pb-8">
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              {post.title}
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              {formatDate(post.published_at)}
              {post.reading_minutes ? ` · ${post.reading_minutes} мин чтения` : null}
              {post.author_name ? ` · ${post.author_name}` : null}
            </p>
            {post.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.cover_image_url}
                alt=""
                className="mt-8 w-full rounded-xl border border-border"
              />
            ) : null}
          </header>

          <div className="text-base text-foreground/90">{renderMarkdown(post.content_md)}</div>

          <footer className="mt-16 rounded-xl border border-border bg-surface-sunken/30 p-6 text-center">
            <p className="text-lg font-medium">Постплан — планировщик для Telegram-каналов</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              CRM рекламодателей, отчёты клиенту и аналитика в одном кабинете.
            </p>
            <Link
              href="/signup"
              className="mt-5 inline-flex rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Попробовать бесплатно
            </Link>
          </footer>
        </article>
      </main>

      <PublicFooter />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

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
