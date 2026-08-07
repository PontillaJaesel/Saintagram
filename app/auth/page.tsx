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
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/constants";
import { resolvePostAuthRoute } from "@/lib/routes";
import {
  isValidEmail,
  passwordError,
  registrationEmailError
} from "@/lib/validation";

type AuthMode = "login" | "signup" | "reset";
type AuthMethod = "email";
type AuthErrorField =
  | "email"
  | "password"
  | "confirmPassword"
  | "credentials"
  | null;

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const requestedMode = searchParams.get("mode");
  const mode: AuthMode =
    requestedMode === "signup" || requestedMode === "reset"
      ? requestedMode
      : "login";
  const [email, setEmail] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<AuthErrorField>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError("");
    setErrorField(null);
    setMessage("");
    setAuthMethod(mode === "reset" ? "email" : null);
  }, [mode]);

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      setMessage("Email verified. You can log in now.");
    } else if (searchParams.get("verification") === "sent") {
      setMessage(
        "We sent a verification link to your email. Open it before logging in."
      );
    }
  }, [searchParams]);

  const copy = useMemo(() => {
    if (mode === "signup") {
      return {
        eyebrow: "Create your private space",
        title: "Begin as you are."
      };
    }
    if (mode === "reset") {
      return {
        eyebrow: "Password help",
        title: "Find your way back.",
        description:
          "Enter the email connected to your account and we’ll send reset instructions."
      };
    }
    return {
      eyebrow: "Welcome back",
      title: "Return to your reflection."
    };
  }, [mode]);

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
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      setErrorField("email");
      window.requestAnimationFrame(() => emailRef.current?.focus());
      return;
    }
    if (mode === "signup") {
      const emailValidation = registrationEmailError(email);
      if (emailValidation) {
        setError(emailValidation);
        setErrorField("email");
        window.requestAnimationFrame(() => emailRef.current?.focus());
        return;
      }
      if (!password.trim()) {
        setError("Enter a password.");
        setErrorField("password");
        window.requestAnimationFrame(() => passwordRef.current?.focus());
        return;
      }
      const validation = passwordError(password);
      if (validation) {
        setError(validation);
        setErrorField("password");
        window.requestAnimationFrame(() => passwordRef.current?.focus());
        return;
      }
    } else if (mode === "login" && !password.trim()) {
      setError("Enter your password.");
      setErrorField("password");
      window.requestAnimationFrame(() => passwordRef.current?.focus());
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Those passwords do not match yet.");
      setErrorField("confirmPassword");
      window.requestAnimationFrame(() => confirmPasswordRef.current?.focus());
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "reset") {
        await auth.requestPasswordReset(email);
        setMessage(
          "If an account uses that email, password-reset instructions will arrive shortly."
        );
      } else if (mode === "signup") {
        const nextUser = await auth.register(email, password);
        if (auth.mode === "firebase") {
          router.replace("/auth?mode=login&verification=sent");
        } else {
          navigateAfterLogin(nextUser);
        }
      } else {
        const nextUser = await auth.login(email, password);
        navigateAfterLogin(nextUser);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again."
      );
      setErrorField(
        mode === "reset"
          ? "email"
          : mode === "login"
            ? "credentials"
            : null
      );
    } finally {
      setSubmitting(false);
    }
  };

  const authenticateWithGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const nextUser = await auth.signInWithGoogle();
      navigateAfterLogin(nextUser);
    } catch (authenticationError) {
      setError(
        authenticationError instanceof Error
          ? authenticationError.message
          : "Authentication could not be completed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const continueAsGuest = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const nextUser = await auth.continueAsGuest();
      navigateAfterLogin(nextUser);
    } catch (authenticationError) {
      setError(
        authenticationError instanceof Error
          ? authenticationError.message
          : "Guest account creation could not be completed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const useDemoAccount = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
  };

  const formOnRight = mode !== "signup";

  return (
    <main className="auth-screen-enter relative min-h-screen overflow-hidden lg:grid lg:place-items-center lg:bg-canvas lg:p-4">
      <div className="relative min-h-screen w-full overflow-hidden lg:h-[calc(100vh-2rem)] lg:min-h-0 lg:rounded-[2rem] lg:border lg:border-sage-100 lg:bg-paper lg:shadow-lift">
      <section
        className={`flex min-h-screen flex-col px-5 py-5 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] sm:px-10 lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-1/2 lg:overflow-y-auto lg:px-14 lg:py-8 ${
          formOnRight ? "lg:translate-x-full" : "lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Link
            href="/"
            className="mb-7 inline-flex min-h-11 w-fit items-center gap-2 self-start rounded-[var(--radius-base)] border border-sage-200 bg-paper px-3 text-sm font-bold text-sage-700 shadow-sm transition hover:bg-sage-50"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to welcome
          </Link>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            {copy.title}
          </h1>
          {copy.description && (
            <p className="mt-4 text-base leading-7 text-muted">
              {copy.description}
            </p>
          )}

          {!authMethod && mode !== "reset" && (
            <div className="mt-8 space-y-4" role="group" aria-label="Choose authentication method">
              <p className="text-sm font-bold text-ink">
                How would you like to {mode === "signup" ? "create your account" : "log in"}?
              </p>
              <button
                type="button"
                className="btn-secondary w-full justify-start"
                disabled={submitting}
                onClick={() => void authenticateWithGoogle()}
              >
                <span className="grid size-5 place-items-center font-bold" aria-hidden="true">G</span>
                Sign in with Google
              </button>
              <button type="button" className="btn-secondary w-full justify-start" onClick={() => setAuthMethod("email")}>
                <Mail className="size-5" aria-hidden="true" /> Continue with email
              </button>
              {mode === "signup" && (
                <>
                  <button
                    type="button"
                    className="btn-secondary w-full justify-start"
                    disabled={submitting}
                    onClick={() => void continueAsGuest()}
                  >
                    <UserRound className="size-5" aria-hidden="true" />
                    Continue as a guest
                  </button>
                  <p className="text-xs leading-5 text-muted">
                    Guest data remains saved until you log out or delete the
                    guest account. Either action permanently deletes it.
                  </p>
                </>
              )}
              {error && (
                <div className="rounded-[var(--radius-base)] border border-clay-200 bg-clay-50 px-4 py-3 text-sm font-semibold text-clay-600" role="alert">
                  {error}
                </div>
              )}
            </div>
          )}

          {authMethod && (
          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            {mode !== "reset" && (
              <button
                type="button"
                className="text-sm font-bold text-sage-700 underline-offset-4 hover:underline"
                onClick={() => {
                  setAuthMethod(null);
                  setError("");
                  setMessage("");
                }}
              >
                Change sign-in method
              </button>
            )}
            {authMethod === "email" && (
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sage-400"
                  aria-hidden="true"
                />
                <input
                  ref={emailRef}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="field pl-12"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (
                      errorField === "email" ||
                      errorField === "credentials"
                    ) {
                      setError("");
                      setErrorField(null);
                    }
                  }}
                  placeholder="you@example.com"
                  required
                  aria-invalid={
                    errorField === "email" || errorField === "credentials"
                  }
                  aria-describedby={
                    error &&
                    (errorField === "email" || errorField === "credentials")
                      ? "auth-error"
                      : undefined
                  }
                />
              </div>
            </div>
            )}

            {authMethod === "email" && mode !== "reset" && (
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="label">
                    Password
                  </label>
                  {mode === "login" && (
                    <Link
                      href="/auth?mode=reset"
                      className="mb-2 text-xs font-bold text-sage-700 underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
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
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    className="field px-12"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (
                        errorField === "password" ||
                        errorField === "credentials"
                      ) {
                        setError("");
                        setErrorField(null);
                      }
                    }}
                    required
                    aria-invalid={
                      errorField === "password" ||
                      errorField === "credentials"
                    }
                    aria-describedby={
                      error &&
                      (errorField === "password" ||
                        errorField === "credentials")
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
                  At least 8 characters, including a letter and a number.
                </p>
              </div>
            )}

            {authMethod === "email" && mode === "signup" && (
              <div>
                <label htmlFor="confirm-password" className="label">
                  Confirm password
                </label>
                <input
                  ref={confirmPasswordRef}
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
                    error && errorField === "confirmPassword"
                      ? "auth-error"
                      : undefined
                  }
                />
              </div>
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
                className="rounded-[var(--radius-base)] border border-sage-200 bg-sage-50 px-4 py-3 text-sm font-semibold text-sage-700"
                role="status"
              >
                {message}
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
              ) : mode === "reset" ? (
                <KeyRound className="size-5" aria-hidden="true" />
              ) : null}
              {submitting
                ? "Please wait…"
                : mode === "signup"
                  ? "Create my account"
                  : mode === "reset"
                    ? "Request reset link"
                    : "Log in"}
              {!submitting && mode !== "reset" && (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </button>
          </form>
          )}

          {auth.mode === "local" && mode === "login" && (
            <div className="mt-5 rounded-[var(--radius-base)] border border-gold-200 bg-gold-50 p-4">
              <p className="text-sm font-bold text-gold-700">
                Try the completed sample profile
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {DEMO_EMAIL} · {DEMO_PASSWORD}
              </p>
              <button
                type="button"
                className="mt-3 min-h-11 rounded-[var(--radius-base)] bg-white px-4 text-xs font-bold text-sage-700 shadow-sm transition hover:bg-sage-50"
                onClick={useDemoAccount}
              >
                Fill demo credentials
              </button>
            </div>
          )}

          <p className="mt-7 text-center text-sm text-muted">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link
                  href="/auth?mode=login"
                  className="font-bold text-sage-700 underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </>
            ) : mode === "reset" ? (
              <Link
                href="/auth?mode=login"
                className="font-bold text-sage-700 underline-offset-4 hover:underline"
              >
                Return to login
              </Link>
            ) : (
              <>
                New to Saintagram?{" "}
                <Link
                  href="/auth?mode=signup"
                  className="font-bold text-sage-700 underline-offset-4 hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </section>

      <aside
        className={`absolute inset-y-0 left-0 hidden w-1/2 overflow-hidden bg-gradient-to-br from-sage-800 via-sage-700 to-sage-600 p-12 text-white transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] lg:flex lg:flex-col lg:justify-between ${
          formOnRight ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div
          className="absolute -right-28 -top-28 size-96 rounded-full border border-sage-600"
          aria-hidden="true"
        />
        <div
          className="absolute -right-10 -top-10 size-56 rounded-full border border-sage-500"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-20 size-80 rounded-full bg-gold-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f6c5df]">
            Matthew 5:3
          </p>
          <blockquote className="mt-7 font-serif text-4xl font-bold leading-tight">
            “Blessed are the poor in spirit, for theirs is the kingdom of
            heaven.”
          </blockquote>
          <p className="mt-7 max-w-md text-base leading-7 text-[#e4ddea]">
            You do not need a perfect image here. Honesty, humility, and a need
            for God are welcome.
          </p>
        </div>
        <div className="relative rounded-[var(--radius-card)] border border-sage-600 bg-sage-700/60 p-6">
          <p className="text-sm font-bold text-[#f6c5df]">
            Your reflections belong to you.
          </p>
          <p className="mt-2 text-sm leading-6 text-[#e4ddea]">
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
