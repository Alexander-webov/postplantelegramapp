'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, CreditCard, Settings } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { Logo } from '@/components/dashboard/logo';
import { MobileNavTrigger } from '@/components/dashboard/mobile-nav';

interface HeaderProps {
  email: string;
  fullName?: string | null;
}

export function Header({ email, fullName }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (fullName ?? email)
    .split(/\s+|@/)[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Left side — mobile trigger + logo on small screens */}
      <div className="flex items-center gap-3">
        <MobileNavTrigger />
        <Link href="/dashboard" className="lg:hidden">
          <Logo />
        </Link>
      </div>

      {/* Right side — avatar dropdown */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-sm px-2 py-1 transition-base hover:bg-accent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              {fullName && (
                <div className="text-sm font-medium leading-tight">{fullName}</div>
              )}
              <div className="text-xs leading-tight text-muted-foreground">{email}</div>
            </div>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg">
                <div className="border-b border-border/60 px-3 py-2.5">
                  {fullName && <div className="text-sm font-medium">{fullName}</div>}
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
                <div className="border-t border-border/60 pt-1">
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-muted-foreground transition-base hover:bg-accent hover:text-foreground"
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
      className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-foreground transition-base hover:bg-accent"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {children}
    </Link>
  );
}
