'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/dashboard/logo';
import { NavGroup } from '@/components/dashboard/sidebar';
import {
  PRIMARY_NAV, SECONDARY_NAV, FOOTER_NAV, ADMIN_NAV,
} from '@/components/dashboard/nav-config';

/**
 * Mobile-only drawer trigger button + slide-in panel.
 * Shown only on screens smaller than `lg`.
 */
export function MobileNavTrigger({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-sm text-foreground transition-base hover:bg-accent lg:hidden"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm transition-base lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface-raised shadow-lg transition-transform duration-slow lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Боковое меню"
      >
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-5">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="inline-flex items-center"
          >
            <Logo className="h-6 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-sm transition-base hover:bg-accent"
            aria-label="Закрыть меню"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-3">
          <NavGroup items={PRIMARY_NAV} onItemClick={() => setOpen(false)} />
          <NavGroup items={SECONDARY_NAV} title="Управление" onItemClick={() => setOpen(false)} />
          {isAdmin && (
            <NavGroup items={ADMIN_NAV} title="Сервис" onItemClick={() => setOpen(false)} />
          )}
        </nav>

        <div className="border-t border-border/60 p-3">
          <NavGroup items={FOOTER_NAV} onItemClick={() => setOpen(false)} />
        </div>
      </aside>
    </>
  );
}
