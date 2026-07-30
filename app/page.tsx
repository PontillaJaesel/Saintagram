"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { MouseEvent, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { APP_TAGLINE } from "@/lib/constants";
import { resolvePostAuthRoute } from "@/lib/routes";

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const primaryHref = user ? resolvePostAuthRoute(user) : "/auth?mode=signup";
  const primaryLabel = user
    ? user.profileCompleted
      ? "Open My Profile"
      : "Continue My Profile"
    : "Create My Profile";

  const navigateSmoothly = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (leaving) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }

    setLeaving(true);
    window.setTimeout(() => router.push(href), 280);
  };

  return (
    <main
      className={`relative grid min-h-screen min-h-[100svh] place-items-center overflow-hidden px-5 py-20 sm:px-8 ${
        leaving ? "welcome-exit pointer-events-none" : ""
      }`}
      aria-busy={leaving}
    >
      <header className="glass-nav absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:h-[4.5rem] sm:px-7">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <section className="welcome-enter mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-gold-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gold-700 sm:text-sm">
          <Sparkles className="size-4" aria-hidden="true" />
          My profile before God
        </div>

        <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-ink sm:text-6xl lg:text-7xl">
          Seen fully.
          <span className="block text-sage-600">Loved already.</span>
        </h1>

        <p className="mt-7 max-w-xl text-lg leading-8 text-muted sm:text-xl">
          {APP_TAGLINE}
        </p>

        <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
          <Link
            href={primaryHref}
            onClick={(event) => navigateSmoothly(event, primaryHref)}
            className="btn-primary w-full text-base sm:w-auto"
          >
            {primaryLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          {!user && !loading && (
            <Link
              href="/auth?mode=login"
              onClick={(event) =>
                navigateSmoothly(event, "/auth?mode=login")
              }
              className="btn-secondary w-full text-base sm:w-auto"
            >
              I already have an account
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
