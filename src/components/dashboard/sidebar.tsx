'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/dashboard/logo';
import {
  PRIMARY_NAV, SECONDARY_NAV, FOOTER_NAV, type NavItem,
} from '@/components/dashboard/nav-config';

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface-raised lg:flex lg:flex-col">
      <div className="flex h-16 items-center px-5">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 text-foreground transition-fast hover:opacity-90"
        >
          <Logo className="h-6 w-auto" />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-6 px-3 pb-3">
        <NavGroup items={PRIMARY_NAV} />
        <NavGroup items={SECONDARY_NAV} title="Управление" />
      </nav>
      <div className="border-t border-border/60 p-3">
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
    <div className="space-y-0.5">
      {title && (
        <div className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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
              className="flex cursor-not-allowed items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground/50"
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
              'group relative flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm transition-base',
              isActive
                ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {isActive && (
              <span
                className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                aria-hidden
              />
            )}
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
