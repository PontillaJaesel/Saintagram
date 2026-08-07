"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getSafeAccessDestination } from "@/lib/access-path";

interface AccessResponse {
  error?: string;
  next?: string;
  ok?: boolean;
}

const INVALID_CODE_MESSAGE =
  "That access code was not recognized. Please try again.";

export function AccessGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!code.trim()) {
      setError("Enter your access code to continue.");
      window.requestAnimationFrame(() => codeRef.current?.focus());
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          next: getSafeAccessDestination(searchParams.get("next"))
        })
      });
      const result = (await response.json().catch(() => null)) as
        | AccessResponse
        | null;

      if (!response.ok || !result?.ok) {
        setError(
          result?.error === INVALID_CODE_MESSAGE
            ? "Wrong access code. Try again."
            : result?.error ??
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
    <main className="min-h-screen bg-canvas">
      <section className="relative min-h-screen bg-canvas px-5 py-5 sm:px-8 lg:px-12">
        <header className="absolute inset-x-5 top-5 flex items-center justify-between sm:inset-x-8 lg:inset-x-12">
          <Logo />
          <ThemeToggle />
        </header>

        <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-sm place-items-center py-24">
          <form className="w-full" onSubmit={handleSubmit} noValidate>
            <h1 className="mb-5 text-center font-serif text-4xl font-bold text-ink">
              Access code
            </h1>
            <label htmlFor="site-access-code" className="sr-only">
              Access code
            </label>
            <input
              ref={codeRef}
              id="site-access-code"
              name="code"
              type="text"
              className="field text-center"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError("");
              }}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={256}
              aria-invalid={Boolean(error)}
              aria-describedby={
                error ? "access-code-error" : "access-renewal-note"
              }
              disabled={submitting}
              required
              autoFocus
            />
            {error && (
              <p
                id="access-code-error"
                className="mt-3 text-center text-sm font-semibold text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            <button type="submit" className="sr-only" disabled={submitting}>
              {submitting ? "Checking your code" : "Enter Saintagram"}
            </button>

            <div
              id="access-renewal-note"
              className="mt-5 flex items-center justify-center gap-3 rounded-[var(--radius-base)] border border-sage-200 bg-sage-50 px-4 py-4 text-center text-xs leading-5 text-muted"
            >
              <RefreshCw
                className="mt-0.5 size-4 shrink-0 text-sage-600"
                aria-hidden="true"
              />
              <p>
                Access lasts seven days. After that, enter the code again to
                continue.
              </p>
            </div>
          </form>
        </div>
      </section>

    </main>
  );
}
