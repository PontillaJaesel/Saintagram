"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function IntroductionContent() {
  const { updateUser } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const continueToProfile = async () => {
    setSaving(true);
    setError("");
    try {
      await updateUser({ spiritualIntroSeenAt: new Date().toISOString() });
      router.push("/create");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your progress could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-5 sm:px-8">
      <div
        className="absolute left-1/2 top-32 size-[34rem] -translate-x-1/2 rounded-full bg-gold-100/70 blur-3xl"
        aria-hidden="true"
      />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>
      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col items-center justify-center py-12 text-center">
        <div className="grid size-14 place-items-center rounded-[var(--radius-base)] bg-sage-700 text-gold-200 shadow-lift">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>
        <p className="eyebrow mt-7">A word before your profile</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          “Blessed are the poor in spirit, for theirs is the kingdom of heaven.”
        </h1>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-gold-700">
          Matthew 5:3
        </p>

        <div className="surface mt-9 max-w-2xl p-6 text-left sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-base)] bg-clay-50 text-clay-600">
              <Heart className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">Come without a filter.</h2>
              <p className="mt-3 text-base leading-7 text-muted">
                Be honest before God without trying to appear perfect. Simply
                bring the person He already sees and loves.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-5 text-sm font-semibold text-clay-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn-primary mt-7 text-base"
          onClick={continueToProfile}
          disabled={saving}
        >
          {saving ? "Saving…" : "Create my profile before God"}
          {!saving && <ArrowRight className="size-4" aria-hidden="true" />}
        </button>
      </section>
    </main>
  );
}

export default function IntroductionPage() {
  return (
    <RouteGuard requireConsent>
      <IntroductionContent />
    </RouteGuard>
  );
}
