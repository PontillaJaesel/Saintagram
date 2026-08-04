"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Database,
  Download,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { appService } from "@/lib/app-service";
import { createPersonalDataPdf } from "@/lib/personal-data-pdf";
import {
  formatFriendlyDate,
  passwordError,
  registrationEmailError
} from "@/lib/validation";

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
  danger = false
}: {
  title: string;
  description: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`surface overflow-hidden ${danger ? "border-clay-200" : ""}`}
    >
      <div
        className={`flex items-start gap-4 border-b p-5 sm:p-6 ${
          danger
            ? "border-clay-200 bg-clay-50"
            : "border-sage-100 bg-sage-50/60"
        }`}
      >
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ${
            danger ? "text-clay-600" : "text-sage-600"
          }`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function SettingsPanel() {
  const {
    user,
    updateUser,
    changePassword,
    logout,
    deleteAccount,
    upgradeGuestWithGoogle,
    upgradeGuestWithEmail
  } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    Partial<Record<"current" | "new" | "confirm", string>>
  >({});
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [guestEmailOpen, setGuestEmailOpen] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestConfirmPassword, setGuestConfirmPassword] = useState("");
  const [guestUpgradeBusy, setGuestUpgradeBusy] = useState(false);
  const [guestUpgradeError, setGuestUpgradeError] = useState("");
  const [privateCheckEnabled, setPrivateCheckEnabled] = useState(
    user?.privacyPreferences?.requirePrivateCheck ?? true
  );
  const [reflectionDatesEnabled, setReflectionDatesEnabled] = useState(
    user?.privacyPreferences?.showReflectionDates ?? true
  );
  const [privacyPreferenceBusy, setPrivacyPreferenceBusy] = useState<
    "requirePrivateCheck" | "showReflectionDates" | null
  >(null);

  useEffect(() => {
    if (privacyPreferenceBusy !== "requirePrivateCheck") {
      setPrivateCheckEnabled(
        user?.privacyPreferences?.requirePrivateCheck ?? true
      );
    }
    if (privacyPreferenceBusy !== "showReflectionDates") {
      setReflectionDatesEnabled(
        user?.privacyPreferences?.showReflectionDates ?? true
      );
    }
  }, [
    privacyPreferenceBusy,
    user?.privacyPreferences?.requirePrivateCheck,
    user?.privacyPreferences?.showReflectionDates
  ]);

  if (!user) return null;

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordErrorMessage("");
    if (!currentPassword.trim()) {
      setPasswordFieldErrors({ current: "Enter your current password." });
      window.requestAnimationFrame(() => currentPasswordRef.current?.focus());
      return;
    }
    if (!newPassword.trim()) {
      setPasswordFieldErrors({ new: "Enter a new password." });
      window.requestAnimationFrame(() => newPasswordRef.current?.focus());
      return;
    }
    const validation = passwordError(newPassword);
    if (validation) {
      setPasswordFieldErrors({ new: validation });
      window.requestAnimationFrame(() => newPasswordRef.current?.focus());
      return;
    }
    if (!confirmPassword.trim()) {
      setPasswordFieldErrors({ confirm: "Confirm your new password." });
      window.requestAnimationFrame(() => confirmPasswordRef.current?.focus());
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFieldErrors({
        confirm: "The new passwords do not match."
      });
      window.requestAnimationFrame(() => confirmPasswordRef.current?.focus());
      return;
    }
    setPasswordFieldErrors({});
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFieldErrors({});
      notify("Your password was changed.");
    } catch (changeError) {
      setPasswordErrorMessage(
        changeError instanceof Error
          ? changeError.message
          : "Your password could not be changed."
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const updatePrivacyPreference = async (
    preference: "requirePrivateCheck" | "showReflectionDates",
    value: boolean
  ) => {
    if (privacyPreferenceBusy) return;
    const previous = {
      requirePrivateCheck: privateCheckEnabled,
      showReflectionDates: reflectionDatesEnabled
    };
    const next = { ...previous, [preference]: value };
    setPrivateCheckEnabled(next.requirePrivateCheck);
    setReflectionDatesEnabled(next.showReflectionDates);
    setPrivacyPreferenceBusy(preference);
    try {
      await updateUser({
        privacyPreferences: next
      });
      notify("Privacy preference saved.");
    } catch (preferenceError) {
      setPrivateCheckEnabled(previous.requirePrivateCheck);
      setReflectionDatesEnabled(previous.showReflectionDates);
      notify(
        preferenceError instanceof Error
          ? preferenceError.message
          : "The preference could not be saved.",
        "error"
      );
    } finally {
      setPrivacyPreferenceBusy(null);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const archive = await appService.exportPersonalData(user.id);
      const blob = await createPersonalDataPdf(archive);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `saintagram-personal-data-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportOpen(false);
      notify("Your private personal archive was downloaded.");
    } catch (exportError) {
      notify(
        exportError instanceof Error
          ? exportError.message
          : "Your archive could not be created.",
        "error"
      );
    } finally {
      setExporting(false);
    }
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/");
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  const confirmDelete = async () => {
    if (deletePhrase !== "DELETE") {
      setDeleteError("Type DELETE exactly to confirm.");
      return;
    }
    if ((user.authProvider === "password" || (!user.authProvider && user.email)) && !deletePassword) {
      setDeleteError("Enter your current password to verify it is you.");
      return;
    }
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteAccount(deletePassword);
      router.replace("/");
    } catch (accountError) {
      setDeleteError(
        accountError instanceof Error
          ? accountError.message
          : "Your account could not be deleted."
      );
      setDeleteBusy(false);
    }
  };

  const upgradeGuestGoogle = async () => {
    if (guestUpgradeBusy) return;
    setGuestUpgradeBusy(true);
    setGuestUpgradeError("");
    try {
      await upgradeGuestWithGoogle();
      notify("Your guest profile is now connected to Google.");
    } catch (upgradeError) {
      setGuestUpgradeError(
        upgradeError instanceof Error
          ? upgradeError.message
          : "The Google account could not be connected."
      );
    } finally {
      setGuestUpgradeBusy(false);
    }
  };

  const upgradeGuestEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (guestUpgradeBusy) return;
    const emailError = registrationEmailError(guestEmail);
    if (emailError) {
      setGuestUpgradeError(emailError);
      return;
    }
    const nextPasswordError = passwordError(guestPassword);
    if (nextPasswordError) {
      setGuestUpgradeError(nextPasswordError);
      return;
    }
    if (guestPassword !== guestConfirmPassword) {
      setGuestUpgradeError("Those passwords do not match.");
      return;
    }
    setGuestUpgradeBusy(true);
    setGuestUpgradeError("");
    try {
      await upgradeGuestWithEmail(guestEmail, guestPassword);
      router.replace("/auth?mode=login&verification=sent");
    } catch (upgradeError) {
      setGuestUpgradeError(
        upgradeError instanceof Error
          ? upgradeError.message
          : "The email account could not be created."
      );
      setGuestUpgradeBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SettingsSection
        title="Account information"
        description="The contact and account details connected to your private profile."
        icon={UserRound}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-sage-50 p-4">
            <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage-600">
              {user.email ? <Mail className="size-4" aria-hidden="true" /> : <UserRound className="size-4" aria-hidden="true" />}
              {user.email ? "Email" : "Account"}
            </dt>
            <dd className="mt-2 break-all text-sm font-semibold text-ink">
              {user.email || "Guest account on this browser"}
            </dd>
          </div>
          <div className="rounded-2xl bg-sage-50 p-4">
            <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage-600">
              <CalendarDays className="size-4" aria-hidden="true" />
              Joined
            </dt>
            <dd className="mt-2 text-sm font-semibold text-ink">
              {formatFriendlyDate(user.createdAt)}
            </dd>
          </div>
        </dl>
        {user.isGuest && (
          <div className="mt-4 rounded-2xl border border-gold-200 bg-gold-50 p-4">
            <p className="text-sm font-bold text-gold-700">
              Keep this profile permanently
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Connect a new sign-in method without losing your current profile or reflections. An email or Google account already used by another Saintagram profile cannot be connected.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={guestUpgradeBusy}
                onClick={() => void upgradeGuestGoogle()}
              >
                Connect Google
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={guestUpgradeBusy}
                onClick={() => {
                  setGuestEmailOpen((open) => !open);
                  setGuestUpgradeError("");
                }}
              >
                Create email login
              </button>
            </div>
            {guestEmailOpen && (
              <form className="mt-4 space-y-3" onSubmit={upgradeGuestEmail} noValidate>
                <div>
                  <label htmlFor="guest-upgrade-email" className="label">Email address</label>
                  <input id="guest-upgrade-email" type="email" autoComplete="email" className="field" value={guestEmail} onChange={(event) => { setGuestEmail(event.target.value); setGuestUpgradeError(""); }} required />
                </div>
                <div>
                  <label htmlFor="guest-upgrade-password" className="label">Password</label>
                  <input id="guest-upgrade-password" type="password" autoComplete="new-password" className="field" value={guestPassword} onChange={(event) => { setGuestPassword(event.target.value); setGuestUpgradeError(""); }} required />
                </div>
                <div>
                  <label htmlFor="guest-upgrade-confirm" className="label">Confirm password</label>
                  <input id="guest-upgrade-confirm" type="password" autoComplete="new-password" className="field" value={guestConfirmPassword} onChange={(event) => { setGuestConfirmPassword(event.target.value); setGuestUpgradeError(""); }} required />
                </div>
                <button type="submit" className="btn-primary" disabled={guestUpgradeBusy}>
                  {guestUpgradeBusy ? "Connecting…" : "Create and verify email login"}
                </button>
              </form>
            )}
            {guestUpgradeError && (
              <p className="mt-3 text-sm font-semibold text-clay-600" role="alert">
                {guestUpgradeError}
              </p>
            )}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Change password"
        description="Verify your current password before choosing a new one."
        icon={KeyRound}
      >
        {user.authProvider && user.authProvider !== "password" ? (
          <p className="text-sm leading-6 text-muted">
            This account does not use an email password.
          </p>
        ) : (
        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          <div>
            <label htmlFor="current-password" className="label">
              Current password
            </label>
            <input
              ref={currentPasswordRef}
              id="current-password"
              type="password"
              autoComplete="current-password"
              className={`field ${
                passwordFieldErrors.current
                  ? "border-clay-500 ring-2 ring-clay-100"
                  : ""
              }`}
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setPasswordErrorMessage("");
                setPasswordFieldErrors((current) => ({
                  ...current,
                  current: undefined
                }));
              }}
              required
              aria-invalid={Boolean(passwordFieldErrors.current)}
              aria-describedby={
                passwordFieldErrors.current
                  ? "current-password-error"
                  : undefined
              }
            />
            {passwordFieldErrors.current && (
              <p
                id="current-password-error"
                className="mt-2 text-sm font-semibold text-clay-600"
                role="alert"
              >
                {passwordFieldErrors.current}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-password" className="label">
                New password
              </label>
              <input
                ref={newPasswordRef}
                id="new-password"
                type="password"
                autoComplete="new-password"
                className={`field ${
                  passwordFieldErrors.new
                    ? "border-clay-500 ring-2 ring-clay-100"
                    : ""
                }`}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordErrorMessage("");
                  setPasswordFieldErrors((current) => ({
                    ...current,
                    new: undefined
                  }));
                }}
                required
                aria-invalid={Boolean(passwordFieldErrors.new)}
                aria-describedby={
                  passwordFieldErrors.new ? "new-password-error" : undefined
                }
              />
              {passwordFieldErrors.new && (
                <p
                  id="new-password-error"
                  className="mt-2 text-sm font-semibold text-clay-600"
                  role="alert"
                >
                  {passwordFieldErrors.new}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="label">
                Confirm new password
              </label>
              <input
                ref={confirmPasswordRef}
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                className={`field ${
                  passwordFieldErrors.confirm
                    ? "border-clay-500 ring-2 ring-clay-100"
                    : ""
                }`}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setPasswordErrorMessage("");
                  setPasswordFieldErrors((current) => ({
                    ...current,
                    confirm: undefined
                  }));
                }}
                required
                aria-invalid={Boolean(passwordFieldErrors.confirm)}
                aria-describedby={
                  passwordFieldErrors.confirm
                    ? "confirm-new-password-error"
                    : undefined
                }
              />
              {passwordFieldErrors.confirm && (
                <p
                  id="confirm-new-password-error"
                  className="mt-2 text-sm font-semibold text-clay-600"
                  role="alert"
                >
                  {passwordFieldErrors.confirm}
                </p>
              )}
            </div>
          </div>
          {passwordErrorMessage && (
            <p className="text-sm font-semibold text-clay-600" role="alert">
              {passwordErrorMessage}
            </p>
          )}
          <button
            type="submit"
            className="btn-secondary"
            disabled={passwordBusy}
          >
            {passwordBusy ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            {passwordBusy ? "Changing…" : "Change password"}
          </button>
        </form>
        )}
      </SettingsSection>

      <SettingsSection
        title="Privacy preferences"
        description="Choose how your own reflective space appears on this device."
        icon={ShieldCheck}
      >
        <div className="space-y-3">
          <label
            className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-sage-100 p-4 transition hover:border-sage-300 ${
              privacyPreferenceBusy === "requirePrivateCheck"
                ? "cursor-wait opacity-70"
                : ""
            }`}
          >
            <span>
              <span className="block text-sm font-bold text-ink">
                Confirm before opening private content
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                Ask before showing private content.
              </span>
            </span>
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-sage-700"
              checked={privateCheckEnabled}
              disabled={Boolean(privacyPreferenceBusy)}
              onChange={(event) =>
                void updatePrivacyPreference(
                  "requirePrivateCheck",
                  event.target.checked
                )
              }
            />
          </label>
          <label
            className={`flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-sage-100 p-4 transition hover:border-sage-300 ${
              privacyPreferenceBusy === "showReflectionDates"
                ? "cursor-wait opacity-70"
                : ""
            }`}
          >
            <span>
              <span className="block text-sm font-bold text-ink">
                Show dates on profile reflections
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                Dates remain visible only to you.
              </span>
            </span>
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-sage-700"
              checked={reflectionDatesEnabled}
              disabled={Boolean(privacyPreferenceBusy)}
              onChange={(event) =>
                void updatePrivacyPreference(
                  "showReflectionDates",
                  event.target.checked
                )
              }
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Your personal data"
        description="Download a private archive or sign out of this device."
        icon={Database}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" aria-hidden="true" />
            Export personal data
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Your personal export may contain your Hidden Story and private
          reflections. It is never presented as a public or shareable profile.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Delete account"
        description="Permanently remove your profile, draft, private content, reflections, and account."
        icon={Trash2}
        danger
      >
        <p className="text-sm leading-6 text-muted">
          This action cannot be undone. You will confirm the deletion before
          anything is removed.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-clay-600 px-5 py-3 text-sm font-bold text-white hover:bg-clay-500"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete my account
        </button>
      </SettingsSection>

      <ConfirmDialog
        open={exportOpen}
        title="Download your private archive?"
        description="The PDF contains all of your public and private reflections. Store it somewhere only you can access."
        confirmLabel="Download PDF"
        busy={exporting}
        onClose={() => setExportOpen(false)}
        onConfirm={() => void exportData()}
      >
        <div className="rounded-2xl bg-gold-50 p-4 text-sm leading-6 text-gold-700">
          This is a personal data export, not a public or shareable profile.
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={logoutOpen}
        title="Log out of Saintagram?"
        description={
          user.isGuest
            ? "Logging out permanently deletes this guest account and all of its saved data. This cannot be undone."
            : "Your saved profile and reflections will remain. Sign in again to return."
        }
        confirmLabel="Log out"
        busy={loggingOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void confirmLogout()}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Permanently delete your account?"
        description="This removes your account and every saved profile field, reflection, private entry, image, and draft."
        confirmLabel="Delete everything"
        destructive
        busy={deleteBusy}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteOpen(false);
          setDeletePhrase("");
          setDeletePassword("");
          setDeleteError("");
        }}
        onConfirm={() => void confirmDelete()}
      >
        <div className="space-y-4">
          {(user.authProvider === "password" || (!user.authProvider && user.email)) && <div>
            <label htmlFor="delete-password" className="label">
              Current password
            </label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              className="field"
              value={deletePassword}
              onChange={(event) => {
                setDeletePassword(event.target.value);
                setDeleteError("");
              }}
            />
          </div>}
          <div>
            <label htmlFor="delete-phrase" className="label">
              Type DELETE to confirm
            </label>
            <input
              id="delete-phrase"
              className="field"
              value={deletePhrase}
              onChange={(event) => {
                setDeletePhrase(event.target.value);
                setDeleteError("");
              }}
              autoComplete="off"
            />
          </div>
          {deleteError && (
            <p className="text-sm font-semibold text-clay-600" role="alert">
              {deleteError}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
