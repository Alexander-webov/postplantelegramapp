'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CreditCard, LogOut, Plus, Settings } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { Logo } from '@/components/dashboard/logo';
import { MobileNavTrigger } from '@/components/dashboard/mobile-nav';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  email: string;
  fullName?: string | null;
  isAdmin?: boolean;
}

export function Header({ email, fullName, isAdmin = false }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (fullName ?? email)
    .split(/\s+|@/)[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/70 bg-[#f7f8fc]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <MobileNavTrigger isAdmin={isAdmin} />
        <Link href="/dashboard" className="lg:hidden">
          <Logo />
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Button asChild className="hidden rounded-xl shadow-sm sm:inline-flex">
          <Link href="/dashboard/posts/new">
            <Plus className="h-4 w-4" />
            Создать пост
          </Link>
        </Button>

        <button
          type="button"
          className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-base hover:bg-slate-50 hover:text-slate-950 sm:flex"
          aria-label="Уведомления"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-2xl px-2 py-1 transition-base hover:bg-white/80"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground shadow-sm">
              {initials}
            </div>
            <div className="hidden max-w-[180px] text-left sm:block">
              {fullName && (
                <div className="truncate text-sm font-semibold leading-tight">{fullName}</div>
              )}
              <div className="truncate text-xs leading-tight text-muted-foreground">{email}</div>
            </div>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-50 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-3">
                  {fullName && <div className="text-sm font-semibold">{fullName}</div>}
                  <div className="truncate text-xs text-muted-foreground">{email}</div>
                </div>
                <div className="py-1">
                  <MenuLink href="/dashboard/billing" icon={CreditCard} onClick={() => setMenuOpen(false)}>
                    Тариф и оплата
                  </MenuLink>
                  <MenuLink href="/dashboard/settings" icon={Settings} onClick={() => setMenuOpen(false)}>
                    Настройки
                  </MenuLink>
                </div>
                <div className="border-t border-slate-100 pt-1">
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-base hover:bg-slate-50 hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      Выйти
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href, icon: Icon, children, onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground transition-base hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </Link>
  );
}
