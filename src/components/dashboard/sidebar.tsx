'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Diamond } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/dashboard/logo';
import {
  PRIMARY_NAV, SECONDARY_NAV, FOOTER_NAV, ADMIN_NAV, type NavItem,
} from '@/components/dashboard/nav-config';

interface SidebarProps {
  tierName?: string;
  expiresAt?: string | null;
  isAdmin?: boolean;
}

export function Sidebar({ tierName = 'Free', expiresAt, isAdmin = false }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 shrink-0 border-r border-slate-200/80 bg-white/95 shadow-[12px_0_35px_-28px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:flex lg:flex-col">
      <div className="flex h-20 items-center px-6">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 text-foreground transition-fast hover:opacity-90"
        >
          <Logo className="h-7 w-auto" />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-7 px-4 pb-4">
        <NavGroup items={PRIMARY_NAV} />
        <NavGroup items={SECONDARY_NAV} title="Управление" />
        {isAdmin && <NavGroup items={ADMIN_NAV} title="Сервис" />}
      </nav>

      <div className="space-y-3 border-t border-slate-200/80 p-4">
        <Link
          href="/dashboard/billing"
          className="block rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm transition-base hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
              <Diamond className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Текущий тариф</div>
              <div className="mt-0.5 font-semibold">{tierName}</div>
              {expiresAt && (
                <div className="mt-0.5 text-xs text-slate-500">
                  до {new Date(expiresAt).toLocaleDateString('ru-RU')}
                </div>
              )}
              <div className="mt-1 text-xs font-medium text-primary">Управление тарифом</div>
            </div>
          </div>
        </Link>
        <NavGroup items={FOOTER_NAV} />
      </div>
    </aside>
  );
}

export function NavGroup({
  items, title, onItemClick,
}: {
  items: NavItem[];
  title?: string;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {title && (
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {title}
        </div>
      )}
      {items.map((item) => {
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        if (item.comingSoon) {
          return (
            <div
              key={item.href}
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400"
              title="Скоро"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider">скоро</span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-base',
              isActive
                ? 'bg-indigo-50 text-primary shadow-[inset_0_0_0_1px_rgba(79,70,229,0.08)]'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            )}
          >
            {isActive && (
              <span
                className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                aria-hidden
              />
            )}
            <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-900')} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
