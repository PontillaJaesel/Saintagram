"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Footprints,
  Home,
  NotebookPen,
  Settings as SettingsIcon
} from "lucide-react";
import { Logo } from "@/components/brand/logo";

const NAV_ITEMS = [
  { href: "/profile", label: "Profile", icon: Home },
  { href: "/reflect", label: "Reflect", icon: NotebookPen },
  { href: "/journey", label: "Journey", icon: Footprints },
  { href: "/settings", label: "Settings", icon: SettingsIcon }
] as const;

export function AppShell({
  children,
  title,
  description,
  action
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[80] -translate-y-20 rounded-full bg-sage-800 px-4 py-3 text-sm font-bold text-white shadow-lift transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-sage-100/90 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo href="/profile" />
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Primary navigation"
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href === "/profile" && pathname.startsWith("/profile/"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${
                    active
                      ? "bg-sage-700 text-white"
                      : "text-muted hover:bg-sage-100 hover:text-ink"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <span className="hidden sm:block" aria-hidden="true" />
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
        {(title || description || action) && (
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {title && (
                <h1 className="font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
                  {description}
                </p>
              )}
            </div>
            {action}
          </div>
        )}
        {children}
      </main>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 rounded-[1.6rem] border border-sage-100 bg-paper/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-lift backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === "/profile" && pathname.startsWith("/profile/"));
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition ${
                  active ? "bg-sage-100 text-sage-800" : "text-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
