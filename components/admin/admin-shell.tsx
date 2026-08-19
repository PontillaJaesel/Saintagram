"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter
} from "next/navigation";
import {
  useState,
  type ReactNode
} from "react";
import {
  BarChart3,
  Users,
  Database,
  Bell,
  Menu,
  X,
  LogOut,
  BookOpenText,
  SunMoon
} from "lucide-react";
import { signOut } from "firebase/auth";

import { getFirebaseServices } from "@/lib/firebase";
import { setVerifiedAdminToken } from "@/lib/admin-api";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DeleteAllRecordsButton } from "@/components/admin/delete-all-records-button";

/* ============================================================
   ADMIN NAVIGATION
   ============================================================ */

const nav = [
  [
    "/admin",
    "Dashboard",
    BarChart3
  ],
  [
    "/admin/reflections",
    "Reflections",
    BookOpenText
  ],
  [
    "/admin/activity",
    "Link Activity",
    BarChart3
  ],
  [
    "/admin/users",
    "Users",
    Users
  ],
  [
    "/admin/data",
    "User Data",
    Database
  ],
  [
    "/admin/notifications",
    "Notifications",
    Bell
  ],
  [
    "/admin/password-resets",
    "Password Resets",
    Bell
  ]
] as const;

/* ============================================================
   ADMIN SHELL
   ============================================================ */

export function AdminShell({
  children
}: {
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();

  const [open, setOpen] =
    useState(false);

  /* ----------------------------------------------------------
     SIGN OUT
     ---------------------------------------------------------- */

  const logout = async () => {
    setVerifiedAdminToken(null);

    const services =
      getFirebaseServices();

    if (services) {
      await signOut(
        services.auth
      );
    }

    router.replace("/");
  };

  /* ----------------------------------------------------------
     SIDEBAR
     ---------------------------------------------------------- */

  const sidebar = (
    <>
      {/* BRAND */}

      <div className="px-5 py-6">
        <p className="font-serif text-xl font-bold">
          SAINTAGRAM
        </p>

        <p className="text-xs font-bold tracking-[.2em] text-sage-600">
          ADMIN
        </p>
      </div>

      {/* NAVIGATION */}

      <nav className="flex-1 space-y-1 px-3">
        {nav.map(
          ([
            href,
            label,
            Icon
          ]) => {
            const active =
              path === href;

            return (
              <Link
                key={href}
                href={href}
                onClick={() =>
                  setOpen(false)
                }
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-sage-700 text-white"
                    : "hover:bg-sage-50"
                }`}
              >
                <Icon className="size-4 shrink-0" />

                <span>
                  {label}
                </span>
              </Link>
            );
          }
        )}
      </nav>

      {/* ======================================================
          SIDEBAR FOOTER
          ====================================================== */}

      <div className="space-y-3 border-t border-sage-100 p-4">
        {/* DESKTOP / DRAWER THEME CONTROL */}

        <div className="rounded-xl border border-sage-100 bg-sage-50/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <SunMoon className="size-4 text-muted" />

            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
              Appearance
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              Theme
            </span>

            <ThemeToggle />
          </div>
        </div>

        {/* DELETE ALL RECORDS */}

        <DeleteAllRecordsButton />

        {/* SIGN OUT */}

        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-sage-50"
          onClick={() =>
            void logout()
          }
        >
          <LogOut className="size-4" />

          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[16rem_1fr]">
      {/* ======================================================
          DESKTOP SIDEBAR
          ====================================================== */}

      <aside className="sticky top-0 hidden h-screen border-r border-sage-100 bg-paper lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* ======================================================
          MOBILE HEADER
          ====================================================== */}

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-sage-100 bg-paper px-4 lg:hidden">
        <button
          type="button"
          aria-label="Open admin navigation"
          onClick={() =>
            setOpen(true)
          }
        >
          <Menu />
        </button>

        <strong>
          Saintagram Admin
        </strong>

        {/*
         * Keep the existing mobile
         * light/dark mode button.
         */}
        <ThemeToggle />
      </header>

      {/* ======================================================
          MOBILE NAVIGATION DRAWER
          ====================================================== */}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 lg:hidden"
          onClick={() =>
            setOpen(false)
          }
        >
          <aside
            className="relative flex h-full w-72 flex-col bg-paper"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full hover:bg-sage-50"
              aria-label="Close navigation"
              onClick={() =>
                setOpen(false)
              }
            >
              <X className="size-5" />
            </button>

            {sidebar}
          </aside>
        </div>
      )}

      {/* ======================================================
          ADMIN CONTENT
          ====================================================== */}

      <main
        id="admin-content"
        className="min-w-0 p-4 pb-14 sm:p-6 sm:pb-14 lg:p-10 lg:pb-16"
      >
        {children}
      </main>
    </div>
  );
}