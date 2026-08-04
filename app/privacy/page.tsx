"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  EyeOff,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RouteGuard } from "@/components/auth/route-guard";
import { useAuth } from "@/components/providers/auth-provider";

function PrivacyContent() {
  const { mode, updateUser } = useAuth();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const acceptedRef = useRef<HTMLInputElement>(null);

  const continueToIntroduction = async () => {
    if (saving) return;
    if (!accepted) {
      setError("Please accept the privacy notice before continuing.");
      window.requestAnimationFrame(() => acceptedRef.current?.focus());
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateUser({ privacyConsentAt: new Date().toISOString() });
      router.push("/introduction");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The privacy choice could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const points = [
    {
      icon: ShieldCheck,
      title: "You may enter sensitive personal information",
      description:
        "Your profile and reflections may include details about your faith, identity, relationships, struggles, hopes, private experiences, and any profile image you choose to upload."
    },
    {
      icon: LockKeyhole,
      title: "Your answers will not be used against you",
      description:
        "Saintagram uses what you save only to provide your personal profile and reflection experience. Your answers are not scored, ranked, diagnosed, used to punish you, or used to make decisions about your access to the app."
    },
    {
      icon: EyeOff,
      title: "Your saved data is account-only",
      description:
        "Your profile, drafts, Hidden Story, images, and reflections are available only to your signed-in account. Hidden and private entries are also kept out of your normal profile view."
    }
  ];

  return (
    <main className="min-h-screen px-5 py-5 sm:px-8 sm:py-7">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>
      <div className="mx-auto grid max-w-5xl gap-8 py-10 lg:grid-cols-[.72fr_1.28fr] lg:py-16">
        <div>
          <p className="eyebrow">A promise of privacy</p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            Your story stays in your hands.
          </h1>
          <p className="mt-5 text-base leading-7 text-muted">
            Before we begin, take a moment to understand how this reflective
            space treats what you share.
          </p>
          {mode === "local" && (
            <div className="mt-6 rounded-2xl border border-gold-200 bg-gold-50 p-4 text-sm leading-6 text-gold-700">
              <strong>Demo mode:</strong> Cloud sync is not configured, so your
              account and reflections stay in this browser’s local storage.
              This is useful for demonstration, but not a substitute for
              production-grade secure storage on a shared device.
            </div>
          )}
        </div>

        <section className="surface p-5 sm:p-8" aria-labelledby="notice-title">
          <h2 id="notice-title" className="sr-only">
            Saintagram privacy notice
          </h2>
          <div className="space-y-4">
            {points.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl border border-sage-100 bg-sage-50/60 p-4 sm:p-5"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-sage-600 shadow-sm">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-ink">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-clay-200 bg-clay-50 p-5">
            <p className="text-sm font-bold text-clay-600">
              Please read before sharing
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-ink">
              {[
                "Share only information you are comfortable storing in the app.",
                "Do not enter passwords, financial details, government identification numbers, or information that could put you or someone else at risk.",
                "Anyone with access to your signed-in account, device, or exported archive may be able to read your saved information.",
                "You can export your data or permanently delete your account and saved information in Settings."
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check
                    className="mt-1 size-4 shrink-0 text-clay-600"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <label
            className={`mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 transition ${
              error
                ? "border border-clay-500 ring-2 ring-clay-100"
                : "border border-sage-200 hover:border-sage-400"
            }`}
          >
            <input
              ref={acceptedRef}
              type="checkbox"
              checked={accepted}
              onChange={(event) => {
                setAccepted(event.target.checked);
                setError("");
              }}
              className="mt-1 size-5 shrink-0 accent-sage-700"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "privacy-consent-error" : undefined}
            />
            <span className="text-sm font-semibold leading-6 text-ink">
              I understand and accept this privacy and consent notice.
            </span>
          </label>
          {error && (
            <p
              id="privacy-consent-error"
              className="mt-3 text-sm font-semibold text-clay-600"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            className="btn-primary mt-6 w-full sm:w-auto"
            onClick={continueToIntroduction}
            disabled={saving}
          >
            {saving ? "Saving…" : "Accept and continue"}
            {!saving && <ArrowRight className="size-4" aria-hidden="true" />}
          </button>
        </section>
      </div>
    </main>
  );
}

export default function PrivacyPage() {
  return (
    <RouteGuard requireConsent={false}>
      <PrivacyContent />
    </RouteGuard>
  );
}
