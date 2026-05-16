import type { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Sitemap for postplan-tg.ru.
 *
 * Statically lists landing pages + dynamically pulls every published blog
 * post. Refreshed on each ISR cycle (revalidate below) and on demand when
 * a server action calls revalidatePath('/sitemap.xml').
 *
 * Notes for SEO: dashboard pages (auth-gated) are intentionally excluded;
 * they're not useful for search engines and the canonical entry is /signup.
 */

export const revalidate = 3600;

const BASE = 'https://postplan-tg.ru';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,              changeFrequency: 'weekly',  priority: 1.0,  lastModified: new Date() },
    { url: `${BASE}/blog`,          changeFrequency: 'weekly',  priority: 0.8,  lastModified: new Date() },
    { url: `${BASE}/signup`,        changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/legal/offer`,   changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/legal/privacy`, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/legal/terms`,   changeFrequency: 'yearly',  priority: 0.3 },
  ];

  try {
    const supabase = createServiceClient();
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(500);

    const postEntries: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    }));

    return [...staticEntries, ...postEntries];
  } catch {
    // If the DB read fails (e.g. before migration is applied), still serve
    // a valid sitemap for the static pages. Better than 500ing.
    return staticEntries;
  }
}
