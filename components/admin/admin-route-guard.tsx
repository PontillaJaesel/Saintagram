"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import {
  browserSessionPersistence,
  onIdTokenChanged,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
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

function takeHandoffCode(): string {
  if (typeof window === "undefined" || !window.location.hash) return "";

  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const code = parameters.get("handoff")?.trim() ?? "";

  if (code) {
    // Remove the one-time code from browser history immediately. URL fragments
    // are not sent to the server, and this prevents the code from remaining in
    // a copied URL after the admin tab finishes opening.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }

  return code;
}

async function redeemHandoff(code: string): Promise<string> {
  const response = await fetch("/api/admin/handoff/redeem", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  const body = (await response.json().catch(() => ({}))) as {
    customToken?: string;
    error?: string;
  };

  if (!response.ok || !body.customToken) {
    throw new Error(body.error ?? "The admin handoff could not be completed.");
  }

  return body.customToken;
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

    void (async () => {
      try {
        await services.persistenceReady;

        // Admin authentication is deliberately tab/window scoped. Closing the
        // admin tab or browser clears this Firebase Auth session, while the
        // normal Saintagram site continues using its own local persistence on
        // its separate origin.
        await setPersistence(services.auth, browserSessionPersistence);

        if (!active) return;

        const handoffCode = takeHandoffCode();
        if (handoffCode) {
          try {
            const customToken = await redeemHandoff(handoffCode);
            const credential = await signInWithCustomToken(
              services.auth,
              customToken
            );
            const idToken = await credential.user.getIdToken(true);
            const verification = await verifyCurrentAdministrator(idToken);

            if (!active) return;

            if (!verification.allowed) {
              await signOut(services.auth).catch(() => undefined);
              setVerifiedAdminToken(null);
              setError(verification.error || DENIED_MESSAGE);
              setState("login");
              return;
            }

            setVerifiedAdminToken(idToken);
            setError("");
            setState("allowed");
          } catch (handoffError) {
            await signOut(services.auth).catch(() => undefined);
            if (!active) return;
            setVerifiedAdminToken(null);
            setError(
              handoffError instanceof Error
                ? handoffError.message
                : "The admin handoff could not be completed."
            );
            setState("login");
          }
        }

        if (!active) return;

        unsubscribe = onIdTokenChanged(services.auth, async (firebaseUser) => {
          const sequence = ++verificationSequence.current;
          if (!firebaseUser) {
            setVerifiedAdminToken(null);
            setState("login");
            return;
          }

          setState("checking");
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
      } catch {
        if (!active) return;
        setVerifiedAdminToken(null);
        setError("Administrator sign-in could not be initialized.");
        setState("login");
      }
    })();

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
      await setPersistence(services.auth, browserSessionPersistence);
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
          : authenticationError instanceof Error && authenticationError.message
            ? authenticationError.message
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
            Sign in with an authorized Firebase email and password. This admin session ends when this tab or browser window is closed.
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
