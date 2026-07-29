"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getSafeAccessDestination } from "@/lib/access-path";

interface AccessResponse {
  error?: string;
  next?: string;
  ok?: boolean;
}

export function AccessGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code,
          next: getSafeAccessDestination(searchParams.get("next"))
        })
      });
      const result = (await response.json().catch(() => null)) as
        | AccessResponse
        | null;

      if (!response.ok || !result?.ok) {
        setError(
          result?.error ??
            "We could not check the access code. Please try again."
        );
        return;
      }

      router.replace(getSafeAccessDestination(result.next));
      router.refresh();
    } catch {
      setError(
        "We could not reach the private entrance. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.08fr_.92fr]">
      <section className="flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12">
        <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <Logo />
          <div className="hidden items-center gap-2 rounded-full border border-sage-200 bg-paper/80 px-4 py-2 text-xs font-bold text-sage-700 sm:flex">
            <LockKeyhole className="size-4" aria-hidden="true" />
            Invitation only
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-2xl flex-1 items-center py-12 sm:py-16">
          <div className="w-full">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-gold-700">
              <Sparkles className="size-4" aria-hidden="true" />
              A private reflection space
            </div>

            <h1 className="max-w-xl font-serif text-5xl font-bold leading-[1.03] tracking-[-0.035em] text-ink sm:text-6xl">
              Enter this
              <span className="block text-sage-600">quiet space.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Saintagram is shared only with invited participants. Enter the
              access code you received to continue.
            </p>

            <form
              className="mt-9 max-w-xl rounded-[2rem] border border-sage-100 bg-paper p-5 shadow-soft sm:p-7"
              onSubmit={handleSubmit}
              noValidate
            >
              <label htmlFor="site-access-code" className="label">
                Access code
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sage-500"
                  aria-hidden="true"
                />
                <input
                  id="site-access-code"
                  name="code"
                  type={showCode ? "text" : "password"}
                  className="field px-12"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Enter your private code"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={256}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "access-code-error" : "access-note"}
                  disabled={submitting}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-sage-600 transition hover:bg-sage-100"
                  onClick={() => setShowCode((visible) => !visible)}
                  aria-label={showCode ? "Hide access code" : "Show access code"}
                  aria-pressed={showCode}
                >
                  {showCode ? (
                    <EyeOff className="size-5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-5" aria-hidden="true" />
                  )}
                </button>
              </div>

              {error && (
                <p
                  id="access-code-error"
                  className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary mt-5 w-full text-base"
                disabled={submitting || code.trim().length === 0}
              >
                {submitting ? "Checking your code…" : "Enter Saintagram"}
                {!submitting && (
                  <ArrowRight className="size-4" aria-hidden="true" />
                )}
              </button>

              <p
                id="access-note"
                className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted"
              >
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-sage-600"
                  aria-hidden="true"
                />
                Your code is checked securely and is never saved in browser
                storage. Access remains active on this device for seven days.
              </p>
            </form>
          </div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-sage-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute -right-28 -top-28 size-96 rounded-full border border-sage-600"
          aria-hidden="true"
        />
        <div
          className="absolute -right-10 -top-10 size-56 rounded-full border border-sage-500"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -left-24 size-80 rounded-full bg-sage-700"
          aria-hidden="true"
        />

        <div className="relative max-w-lg pt-12">
          <div className="grid size-16 place-items-center rounded-2xl bg-gold-200 text-sage-900 shadow-soft">
            <span className="relative block size-8" aria-hidden="true">
              <span className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-current" />
              <span className="absolute left-0 top-1/3 h-1 w-full rounded-full bg-current" />
            </span>
          </div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-gold-200">
            My profile before God
          </p>
          <h2 className="mt-5 font-serif text-4xl font-bold leading-tight">
            No audience. No comparison. Just an honest place to notice grace.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-sage-100">
            Once inside, your account and reflections remain private to you.
            The shared entrance code is only the first door.
          </p>
        </div>

        <div className="relative grid gap-3">
          {[
            "No follower counts or rankings",
            "Owner-only reflection data",
            "A gentle, faith-centered journey"
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-2xl border border-sage-600 bg-sage-700/60 px-4 py-3 text-sm font-semibold text-sage-50"
            >
              <ShieldCheck
                className="size-4 shrink-0 text-gold-200"
                aria-hidden="true"
              />
              {item}
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
