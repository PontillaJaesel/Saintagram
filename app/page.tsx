"use client";

import Link from "next/link";
import {
  ArrowRight,
  EyeOff,
  HeartHandshake,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { ModeBadge } from "@/components/ui/mode-badge";
import { APP_TAGLINE } from "@/lib/constants";
import { resolvePostAuthRoute } from "@/lib/routes";

export default function WelcomePage() {
  const { user, loading } = useAuth();
  const primaryHref = user ? resolvePostAuthRoute(user) : "/auth?mode=signup";
  const primaryLabel = user
    ? user.profileCompleted
      ? "Open My Profile"
      : "Continue My Profile"
    : "Create My Profile";

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ModeBadge />
          </div>
          {!user && !loading && (
            <Link href="/auth?mode=login" className="btn-quiet">
              Log in
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:py-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gold-700">
            <Sparkles className="size-4" aria-hidden="true" />
            My profile before God
          </div>
          <h1 className="max-w-3xl font-serif text-5xl font-bold leading-[1.02] tracking-[-0.035em] text-ink sm:text-6xl lg:text-7xl">
            Seen fully.
            <span className="block text-sage-600">Loved already.</span>
          </h1>
          <p className="mt-6 max-w-xl text-xl font-semibold leading-8 text-ink">
            {APP_TAGLINE}
          </p>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Saintagram is a private reflection space shaped like a profile—but
            without follower counts, rankings, or pressure to perform. Notice
            what God sees and name where grace is still growing.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={primaryHref} className="btn-primary text-base">
              {primaryLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            {!user && (
              <Link href="/auth?mode=login" className="btn-secondary text-base">
                I already have an account
              </Link>
            )}
          </div>
          <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Private by design",
                text: "Only you can access your reflections."
              },
              {
                icon: EyeOff,
                title: "No popularity",
                text: "No public counts or comparison."
              },
              {
                icon: HeartHandshake,
                title: "Gentle prompts",
                text: "Skip anything you are not ready to answer."
              }
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-sage-100 bg-paper/70 p-4"
              >
                <Icon className="mb-3 size-5 text-sage-600" aria-hidden="true" />
                <p className="text-sm font-bold text-ink">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div
            className="absolute -left-10 top-12 size-40 rounded-full bg-gold-200/40 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute -right-8 bottom-10 size-52 rounded-full bg-sage-200/60 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative rotate-1 rounded-[2.5rem] border border-sage-100 bg-paper p-3 shadow-lift">
            <div className="rounded-[2rem] bg-gradient-to-b from-sage-50 to-paper p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="grid size-20 shrink-0 place-items-center rounded-[1.6rem] bg-sage-700 text-gold-200 shadow-soft">
                  <span className="relative block size-9" aria-hidden="true">
                    <span className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-current" />
                    <span className="absolute left-0 top-1/3 h-1 w-full rounded-full bg-current" />
                  </span>
                </div>
                <div>
                  <p className="eyebrow">Profile before God</p>
                  <h2 className="mt-1 font-serif text-2xl font-bold">
                    Beloved Child of God
                  </h2>
                  <p className="mt-1 text-sm font-bold text-gold-700">
                    #SeenByGod
                  </p>
                </div>
              </div>
              <div className="my-6 h-px bg-sage-100" />
              <p className="font-serif text-xl leading-8 text-ink">
                “Before God, I am someone who is learning to be honest, receive
                grace, and begin again.”
              </p>
              <div className="mt-7 rounded-3xl border border-gold-100 bg-gold-50 p-5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-700">
                  <Sparkles className="size-4" aria-hidden="true" />
                  A comment of grace
                </div>
                <p className="mt-3 text-sm leading-6 text-ink">
                  You are more than the image you present. Let Me meet you as
                  you are.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Peace", "Truth", "God’s love"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-sage-100 px-3 py-2 text-xs font-bold text-sage-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
