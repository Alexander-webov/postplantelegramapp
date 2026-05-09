import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://postplan.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/legal/', '/login', '/signup'],
        disallow: ['/dashboard/', '/api/', '/r/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
