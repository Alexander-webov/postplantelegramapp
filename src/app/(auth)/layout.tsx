import Link from 'next/link';
import { Logo } from '@/components/dashboard/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Top bar — only logo, minimal */}
      <header className="px-6 py-5">
        <Link href="/" className="inline-flex items-center transition-base hover:opacity-80">
          <Logo />
        </Link>
      </header>

      {/* Centered content */}
      <main className="flex min-h-[calc(100vh-80px)] items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
