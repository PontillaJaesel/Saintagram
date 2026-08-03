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
  const isProfile = pathname === "/profile";
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
      <header
        className="sticky top-0 z-40 border-b border-sage-100/70 bg-canvas/80 backdrop-blur-2xl lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo href="/profile" />
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[92rem] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="sticky top-0 hidden h-screen border-r border-sage-100 bg-paper/55 px-3 py-6 backdrop-blur-xl lg:flex lg:flex-col xl:px-4">
            <Logo href="/profile" />
            <nav className="mt-10 space-y-2" aria-label="Primary navigation">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href === "/profile" && pathname.startsWith("/profile/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-sage-100 text-sage-800"
                        : "text-ink hover:bg-sage-50"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            {pathname === "/reflect" && (
              <a href="#reflection-editor" className="btn-primary mt-6 w-full">
                <NotebookPen className="size-5" aria-hidden="true" />
                New reflection
              </a>
            )}
            <div className="mt-auto">
              <ThemeToggle />
              <p className="font-secondary mt-4 text-xs leading-5 text-muted">
                A private space for the parts of your story that matter beyond
                numbers.
              </p>
            </div>
          </aside>

        <main
          key={pathname}
          id="main-content"
          className={`app-page-enter w-full ${
            isProfile
              ? "min-w-0 px-0 py-0"
              : "mx-auto min-w-0 max-w-6xl px-4 py-7 sm:px-8 sm:py-12"
          }`}
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
      </div>

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
