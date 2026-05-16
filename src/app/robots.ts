import type { MetadataRoute } from 'next';

/**
 * robots.txt for postplan-tg.ru.
 *
 * Allow: landing, /blog, /legal, /signup, /login — everything a search
 * engine should index.
 *
 * Disallow: /dashboard, /admin, /api, /r — user data, admin panel, JSON
 * endpoints, and per-placement reports (those have unique slugs we don't
 * want spidered).
 */
export default function robots(): MetadataRoute.Robots {
  const BASE = 'https://postplan-tg.ru';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog', '/blog/', '/legal/', '/login', '/signup'],
        disallow: ['/dashboard/', '/admin/', '/api/', '/r/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
