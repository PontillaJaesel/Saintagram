"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import Link from "next/link";
import type { AppUser } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { DEMO_USERNAME, DEMO_TEMP_PASSWORD } from "@/lib/constants";
import { resolvePostAuthRoute } from "@/lib/routes";
import { passwordError } from "@/lib/validation";

type AuthMode = "login";
type AuthErrorField =
  | "username"
  | "password"
  | "confirmPassword"
  | "credentials"
  | null;

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const mode: AuthMode = "login";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<AuthErrorField>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"login" | "changePassword">("login");
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (auth.user?.mustChangePassword) {
      setStage("changePassword");
      setUsername(auth.user.username ?? "");
      setMessage("Set a new permanent password before continuing.");
    }
  }, [auth.user]);

  const copy = useMemo(
    () => ({
      eyebrow: "Welcome back",
      title: "Return to your reflection.",
      description:
        "Use the one-time credentials below, then choose a permanent password before continuing."
    }),
    []
  );

  const navigateAfterLogin = (nextUser: Awaited<ReturnType<typeof auth.login>>) => {
    const destination = resolvePostAuthRoute(nextUser);
    const requestedNext = searchParams.get("next");
    const safeNext =
      requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : null;
    router.replace(destination === "/profile" && safeNext ? safeNext : destination);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setErrorField(null);
    setMessage("");

    if (stage === "login") {
      if (!username.trim()) {
        setError("Enter your username.");
        setErrorField("username");
        window.requestAnimationFrame(() => usernameRef.current?.focus());
        return;
      }
      if (!password.trim()) {
        setError("Enter your password.");
        setErrorField("password");
        window.requestAnimationFrame(() => passwordRef.current?.focus());
        return;
      }
    } else {
      if (!newPassword.trim()) {
        setError("Enter a new password.");
        setErrorField("password");
        window.requestAnimationFrame(() => newPasswordRef.current?.focus());
        return;
      }
      const validation = passwordError(newPassword);
      if (validation) {
        setError(validation);
        setErrorField("password");
        window.requestAnimationFrame(() => newPasswordRef.current?.focus());
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Those passwords do not match yet.");
        setErrorField("confirmPassword");
        window.requestAnimationFrame(() => confirmPasswordRef.current?.focus());
        return;
      }
    }

    setSubmitting(true);
    try {
      if (stage === "login") {
        const nextUser = await auth.login(username.trim(), password);
        if (nextUser.mustChangePassword) {
          setStage("changePassword");
          setMessage(
            "Temporary password accepted. Set a new permanent password before continuing."
          );
          return;
        }
        navigateAfterLogin(nextUser);
      } else {
        await auth.changePassword(password, newPassword);
        const refreshedUser = await auth.refreshUser();
        if (!refreshedUser) throw new Error("Unable to refresh your account.");
        navigateAfterLogin(refreshedUser);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again."
      );
      setErrorField(stage === "login" ? "credentials" : "password");
    } finally {
      setSubmitting(false);
    }
  };

  const useDemoAccount = () => {
    setUsername(DEMO_USERNAME);
    setPassword(DEMO_TEMP_PASSWORD);
    setError("");
  };

  const formOnRight = true;

  return (
    <main className="auth-screen-enter relative min-h-screen overflow-hidden lg:grid lg:place-items-center lg:bg-canvas lg:p-4">
      <div className="relative min-h-screen w-full overflow-hidden lg:h-[calc(100vh-2rem)] lg:min-h-0 lg:rounded-[2rem] lg:border lg:border-sage-100 lg:bg-paper lg:shadow-lift">
      <section
        className={`flex min-h-screen flex-col px-5 py-5 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] sm:px-10 lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-1/2 lg:overflow-y-auto lg:px-14 lg:py-8 ${
          formOnRight ? "lg:translate-x-full" : "lg:translate-x-0"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start gap-5">
            <Logo />
            <Link
              href="/"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-sage-200 bg-paper text-sage-700 shadow-sm transition hover:border-sage-300 hover:bg-sage-50"
              aria-label="Back to welcome"
              title="Back to welcome"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          </div>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            {copy.title}
          </h1>
          {copy.description && (
            <p className="mt-4 text-base leading-7 text-muted">
              {copy.description}
            </p>
          )}

          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            <div>
              <label htmlFor="username" className="label">
                Username
              </label>
              <input
                ref={usernameRef}
                id="username"
                type="text"
                autoComplete="username"
                className="field"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  if (errorField === "username" || errorField === "credentials") {
                    setError("");
                    setErrorField(null);
                  }
                }}
                placeholder="Enter your username"
                disabled={stage === "changePassword"}
                required
                aria-invalid={errorField === "username" || errorField === "credentials"}
                aria-describedby={
                  error && (errorField === "username" || errorField === "credentials")
                    ? "auth-error"
                    : undefined
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label">
                  {stage === "login" ? "Temporary password" : "Current temporary password"}
                </label>
              </div>
              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sage-400"
                  aria-hidden="true"
                />
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={stage === "login" ? "current-password" : "current-password"}
                  className="field px-12"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errorField === "password" || errorField === "credentials") {
                      setError("");
                      setErrorField(null);
                    }
                  }}
                  required
                  aria-invalid={errorField === "password" || errorField === "credentials"}
                  aria-describedby={
                    error && (errorField === "password" || errorField === "credentials")
                      ? "password-help auth-error"
                      : "password-help"
                  }
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sage-50"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <p id="password-help" className="mt-2 text-xs text-muted">
                Your one-time temporary password is required to sign in.
              </p>
            </div>
            {stage === "changePassword" && (
              <>
                <div>
                  <label htmlFor="new-password" className="label">
                    New password
                  </label>
                  <input
                    ref={newPasswordRef}
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="field"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      if (errorField === "password") {
                        setError("");
                        setErrorField(null);
                      }
                    }}
                    required
                    aria-invalid={errorField === "password"}
                    aria-describedby={
                      error && errorField === "password" ? "auth-error" : undefined
                    }
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="label">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="field"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      if (errorField === "confirmPassword") {
                        setError("");
                        setErrorField(null);
                      }
                    }}
                    required
                    aria-invalid={errorField === "confirmPassword"}
                    aria-describedby={
                      error && errorField === "confirmPassword" ? "auth-error" : undefined
                    }
                  />
                </div>
              </>
            )}
            {error && (
              <div
                id="auth-error"
                className="rounded-[var(--radius-base)] border border-clay-200 bg-clay-50 px-4 py-3 text-sm font-semibold text-clay-600"
                role="alert"
              >
                {error}
              </div>
            )}
            {message && (
              <div
                className={`flex items-start gap-3 rounded-[var(--radius-base)] border px-4 py-3 text-sm font-semibold ${
                  stage === "changePassword"
                    ? "border-gold-300 bg-gold-50 text-gold-700"
                    : "border-sage-200 bg-sage-50 text-sage-700"
                }`}
                role={stage === "changePassword" ? "alert" : "status"}
              >
                {stage === "changePassword" && (
                  <AlertTriangle
                    className="mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{message}</span>
              </div>
            )}
            <button
              type="submit"
              className="btn-primary w-full text-base"
              disabled={submitting}
            >
              {submitting ? (
                <LoaderCircle
                  className="size-5 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {submitting ? "Please wait…" : stage === "login" ? "Log in" : "Change password"}
              {!submitting && <ArrowRight className="size-4" aria-hidden="true" />}
            </button>
          </form>

          {auth.mode === "local" && (
            <div className="mt-5 rounded-[var(--radius-base)] border border-gray-200 bg-white p-4">
              <p className="text-sm font-bold text-gold-700">
                Use this temporary test account
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Username: {DEMO_USERNAME}
                <br />
                Temporary password: {DEMO_TEMP_PASSWORD}
              </p>
              <button
                type="button"
                className="mt-3 min-h-11 rounded-[var(--radius-base)] bg-white px-4 text-xs font-bold text-sage-700 shadow-sm transition hover:bg-sage-50"
                onClick={useDemoAccount}
              >
                Fill test credentials
              </button>
            </div>
          )}

          <p className="mt-7 text-center text-sm text-muted">
            Need help signing in? Contact support for access.
          </p>
        </div>
      </section>

      <aside
        className={`absolute inset-y-0 left-0 hidden w-1/2 overflow-hidden auth-aside-gradient p-12 text-white transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] lg:flex lg:flex-col lg:justify-between ${
          formOnRight ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div
          className="auth-aside-orbit absolute -right-28 -top-28 size-96 rounded-full border border-gold-500/50"
          aria-hidden="true"
        />
        <div
          className="auth-aside-orbit absolute -right-10 -top-10 size-56 rounded-full border border-gold-400/50"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-20 size-80 rounded-full bg-gold-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-lg">
          <p className="auth-aside-dark-text text-xs font-bold uppercase tracking-[0.2em] text-white/90">
            Matthew 5:3
          </p>
          <blockquote className="auth-aside-dark-text mt-7 font-serif text-4xl font-bold leading-tight text-white">
            "Blessed are the poor in spirit, for theirs is the kingdom of
            heaven."
          </blockquote>
          <p className="auth-aside-dark-text mt-7 max-w-md text-base leading-7 text-white/90">
            You do not need a perfect image here. Honesty, humility, and a need
            for God are welcome.
          </p>
        </div>
        <div className="relative rounded-[var(--radius-card)] border border-white/50 bg-white/45 p-6 shadow-sm backdrop-blur-sm dark:border-white/20 dark:bg-white/15">
          <p className="auth-privacy-dark-text text-sm font-bold">
            Your reflections belong to you.
          </p>
          <p className="auth-privacy-dark-text mt-2 text-sm leading-6">
            Hidden Stories and private journal entries never appear on the
            standard profile screen.
          </p>
        </div>
      </aside>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm font-semibold text-muted">
          Preparing sign in…
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
