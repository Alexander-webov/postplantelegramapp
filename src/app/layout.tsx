import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://postplan.app'),
  title: {
    default: 'Постплан — планировщик постов для Telegram-каналов',
    template: '%s · Постплан',
  },
  description:
    'Управление Telegram-каналами из одного кабинета. Расписание постов до 3 месяцев, шаблоны, кросспостинг. От 299 ₽/мес.',
  keywords: [
    'постплан',
    'планировщик постов telegram',
    'отложенный постинг',
    'управление каналами telegram',
    'smm telegram',
    'crm рекламодателей telegram',
  ],
  authors: [{ name: 'Постплан' }],
  // OpenGraph tags help previews look polished when links are shared
  openGraph: {
    title: 'Постплан — планировщик постов для Telegram',
    description: 'Расписание постов, шаблоны, кросспостинг, CRM рекламодателей. От 299 ₽/мес.',
    locale: 'ru_RU',
    type: 'website',
    siteName: 'Постплан',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Постплан — планировщик постов для Telegram',
    description: 'Расписание постов, шаблоны, кросспостинг, CRM рекламодателей.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={cn(
          GeistSans.variable,
          GeistMono.variable,
          'min-h-screen bg-background font-sans antialiased'
        )}
        style={{
          // Set the CSS vars our design tokens use
          // (next/font outputs --font-geist-sans; we map it to --font-sans)
          ['--font-sans' as string]: 'var(--font-geist-sans)',
          ['--font-display' as string]: 'var(--font-geist-sans)',
          ['--font-mono' as string]: 'var(--font-geist-mono)',
        }}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                'group rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
              title: 'font-medium',
              description: 'text-muted-foreground text-sm',
              actionButton: 'bg-primary text-primary-foreground',
              cancelButton: 'bg-muted text-muted-foreground',
              error:
                '!border-destructive/30 !bg-destructive-soft !text-destructive [&>svg]:!text-destructive',
              success:
                '!border-success/30 !bg-success-soft !text-success [&>svg]:!text-success',
              warning:
                '!border-warning/40 !bg-warning-soft !text-warning [&>svg]:!text-warning',
              info: '!border-primary/30 !bg-primary-soft !text-primary-soft-foreground',
            },
          }}
        />
      </body>
    </html>
  );
}
