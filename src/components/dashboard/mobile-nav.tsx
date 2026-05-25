"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/dashboard/logo";
import { NavGroup } from "@/components/dashboard/sidebar";
import { PRIMARY_NAV, SECONDARY_NAV, FOOTER_NAV, ADMIN_NAV } from "@/components/dashboard/nav-config";

export function MobileNavTrigger({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-900 transition hover:bg-slate-100 lg:hidden"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 lg:hidden" style={{ zIndex: 2147483647 }}>
          <button type="button" className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Закрыть меню" />

          <aside className="absolute left-0 top-0 flex h-[100dvh] w-[320px] max-w-[88vw] flex-col overflow-hidden border-r border-slate-200 bg-white text-slate-950 shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="inline-flex items-center">
                <Logo className="h-6 w-auto" />
              </Link>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100"
                aria-label="Закрыть меню"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-4 overscroll-contain">
              <NavGroup items={PRIMARY_NAV} onItemClick={() => setOpen(false)} />

              <NavGroup items={SECONDARY_NAV} title="Управление" onItemClick={() => setOpen(false)} />

              {isAdmin && <NavGroup items={ADMIN_NAV} title="Сервис" onItemClick={() => setOpen(false)} />}
            </nav>

            <div className="shrink-0 border-t border-slate-200 bg-white p-3">
              <NavGroup items={FOOTER_NAV} onItemClick={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
