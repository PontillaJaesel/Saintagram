"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Footprints,
  Home,
  NotebookPen,
  Settings as SettingsIcon
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const NAV_ITEMS = [
  { href: "/profile", label: "Profile", icon: Home },
  { href: "/reflect", label: "Reflect", icon: NotebookPen },
  { href: "/journey", label: "Journey", icon: Footprints },
  { href: "/settings", label: "Settings", icon: SettingsIcon }
] as const;

let lastPrimaryNavIndex: number | null = null;

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
  const activeNavIndex = Math.max(
    0,
    NAV_ITEMS.findIndex(
      ({ href }) =>
        pathname === href ||
        (href === "/profile" && pathname.startsWith("/profile/"))
    )
  );
  const [indicatorIndex, setIndicatorIndex] = useState(
    () => lastPrimaryNavIndex ?? activeNavIndex
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIndicatorIndex(activeNavIndex);
      lastPrimaryNavIndex = activeNavIndex;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeNavIndex]);

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[80] -translate-y-20 rounded-full bg-sage-800 px-4 py-3 text-sm font-bold text-white shadow-lift transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-sage-100/70 bg-canvas/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo href="/profile" />
          <nav
            className="relative hidden w-[30rem] grid-cols-4 rounded-full p-1 lg:grid"
            aria-label="Primary navigation"
          >
            <span
              className="primary-nav-indicator pointer-events-none absolute bottom-1 left-1 top-1 rounded-full"
              style={{
                width: "calc((100% - 0.5rem) / 4)",
                transform: `translateX(${indicatorIndex * 100}%)`
              }}
              aria-hidden="true"
            />
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href === "/profile" && pathname.startsWith("/profile/"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative z-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold transition-colors duration-300 ${
                    active
                      ? "app-nav-active"
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
          <ThemeToggle />
        </div>
      </header>

      <main
        key={pathname}
        id="main-content"
        className="app-page-enter mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-12"
      >
        {(title || description || action) && (
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {title && (
                <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
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
        className="fixed inset-x-3 bottom-3 z-50 rounded-[1.6rem] border border-sage-100/80 bg-paper/85 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-lift backdrop-blur-2xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="relative mx-auto grid max-w-lg grid-cols-4">
          <span
            className="primary-nav-indicator pointer-events-none absolute inset-y-0 left-0 w-1/4 rounded-2xl"
            style={{
              transform: `translateX(${indicatorIndex * 100}%)`
            }}
            aria-hidden="true"
          />
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href === "/profile" && pathname.startsWith("/profile/"));
            return (
              <Link
                key={href}
                href={href}
                className={`relative z-10 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition-colors duration-300 ${
                  active ? "app-nav-active" : "text-muted"
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
