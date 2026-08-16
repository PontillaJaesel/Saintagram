"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { adminFetch, setVerifiedAdminToken } from "@/lib/admin-api";
import { getFirebaseServices } from "@/lib/firebase";

type GuardState = "checking" | "login" | "allowed";

const DENIED_MESSAGE =
  "You do not have permission to access the Saintagram Admin Dashboard.";

type AdminVerification =
  | { allowed: true; error: "" }
  | { allowed: false; error: string };

async function verifyCurrentAdministrator(idToken: string): Promise<AdminVerification> {
  try {
    await adminFetch<{ admin: true }>("/api/admin/session", {}, idToken);
    return { allowed: true, error: "" };
  } catch (error) {
    return {
      allowed: false,
      error: error instanceof Error ? error.message : DENIED_MESSAGE,
    };
  }
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuardState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const verificationSequence = useRef(0);

  useEffect(() => {
    const services = getFirebaseServices();
    if (!services) {
      setError("Firebase is not configured for this deployment.");
      setState("login");
      return;
    }

    let active = true;
    let unsubscribe: () => void = () => undefined;
    void services.persistenceReady.then(() => {
      if (!active) return;
      unsubscribe = onIdTokenChanged(services.auth, async (firebaseUser) => {
        const sequence = ++verificationSequence.current;
        if (!firebaseUser) {
          setVerifiedAdminToken(null);
          setState("login");
          return;
        }

        setState("checking");
        // Avoid forcing a refresh here. Refreshing inside onIdTokenChanged
        // emits another token event and can race route transitions/remounts.
        const idToken = await firebaseUser.getIdToken();
        const verification = await verifyCurrentAdministrator(idToken);
        if (!active || sequence !== verificationSequence.current) return;
        if (verification.allowed) {
          setVerifiedAdminToken(idToken);
          setError("");
          setState("allowed");
          return;
        }

        setVerifiedAdminToken(null);
        await signOut(services.auth).catch(() => undefined);
        if (!active || sequence !== verificationSequence.current) return;
        setError(verification.error || DENIED_MESSAGE);
        setState("login");
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const services = getFirebaseServices();
    if (!services) {
      setError("Firebase is not configured for this deployment.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await services.persistenceReady;
      const credential = await signInWithEmailAndPassword(
        services.auth,
        email.trim(),
        password
      );
      const idToken = await credential.user.getIdToken(true);
      const verification = await verifyCurrentAdministrator(idToken);
      if (!verification.allowed) {
        setVerifiedAdminToken(null);
        await signOut(services.auth);
        setError(verification.error || DENIED_MESSAGE);
        setState("login");
      } else {
        setVerifiedAdminToken(idToken);
        // Do not rely on onIdTokenChanged to finish the form submission. The
        // listener may have already handled the sign-in token before the
        // forced refresh and therefore may not produce another state change.
        setError("");
        setState("allowed");
      }
    } catch (authenticationError) {
      await signOut(services.auth).catch(() => undefined);
      const code =
        typeof authenticationError === "object" &&
        authenticationError !== null &&
        "code" in authenticationError
          ? String(authenticationError.code)
          : "";
      setError(
        code === "auth/invalid-credential" ||
          code === "auth/user-not-found" ||
          code === "auth/wrong-password"
          ? "The email or password is incorrect."
          : "Administrator sign-in could not be completed. Please try again."
      );
      setState("login");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "checking") {
    return (
      <main className="grid min-h-screen place-items-center" role="status">
        <p className="inline-flex items-center gap-2 text-muted">
          <LoaderCircle className="size-4 animate-spin" /> Verifying administrator access…
        </p>
      </main>
    );
  }

  if (state === "login") {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-6">
        <section className="surface w-full max-w-md p-7 sm:p-9">
          <div className="flex items-center justify-between"><Logo /><ThemeToggle /></div>
          <p className="eyebrow mt-10">Saintagram administration</p>
          <h1 className="mt-2 font-serif text-4xl font-bold">Admin Login</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Sign in with an authorized Firebase email and password.
          </p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-bold" htmlFor="admin-email">Email</label>
            <div className="relative"><Mail className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" /><input id="admin-email" className="field w-full pl-10" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <label className="block text-sm font-bold" htmlFor="admin-password">Password</label>
            <div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" /><input id="admin-password" className="field w-full pl-10" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            {error && <p className="rounded-xl bg-clay-50 p-3 text-sm text-clay-700" role="alert">{error}</p>}
            <button className="btn-primary w-full" disabled={submitting} type="submit">
              {submitting ? "Verifying…" : "Sign in to Admin"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return children;
}
