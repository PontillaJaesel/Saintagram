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
  id,
  title,
  description,
  icon: Icon,
  children,
  danger = false
}: {
  id?: string;
  title: string;
  description: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      id={id}
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
          className={`grid size-11 shrink-0 place-items-center rounded-[var(--radius-base)] bg-white shadow-sm ${
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
    refreshUser,
    logout,
    deleteAccount,
    upgradeGuestWithGoogle,
    upgradeGuestWithEmail
  } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [guestEmailOpen, setGuestEmailOpen] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestConfirmPassword, setGuestConfirmPassword] = useState("");
  const [guestUpgradeBusy, setGuestUpgradeBusy] = useState(false);
  const [guestUpgradeError, setGuestUpgradeError] = useState("");
  const [privateCheckEnabled, setPrivateCheckEnabled] = useState(
    user?.privacyPreferences?.requirePrivateCheck ?? true
  );
  const [privacyPreferenceBusy, setPrivacyPreferenceBusy] = useState<
    "requirePrivateCheck" | null
  >(null);

  useEffect(() => {
    if (privacyPreferenceBusy !== "requirePrivateCheck") {
      setPrivateCheckEnabled(
        user?.privacyPreferences?.requirePrivateCheck ?? true
      );
    }
  }, [
    privacyPreferenceBusy,
    user?.privacyPreferences?.requirePrivateCheck
  ]);

  if (!user) return null;

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordMessage("");
    if (!currentPassword.trim()) {
      setPasswordMessage("Enter your current temporary password.");
      currentPasswordRef.current?.focus();
      return;
    }
    const validation = passwordError(newPassword);
    if (validation) {
      setPasswordMessage(validation);
      newPasswordRef.current?.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("The new passwords do not match.");
      confirmPasswordRef.current?.focus();
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      const refreshed = await refreshUser();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify("Your permanent password was saved.");
      if (refreshed) router.replace(refreshed.profileCompleted ? "/profile" : "/privacy");
    } catch (error) {
      setPasswordMessage(
        error instanceof Error ? error.message : "Your password could not be changed."
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const updatePrivacyPreference = async (
    preference: "requirePrivateCheck",
    value: boolean
  ) => {
    if (privacyPreferenceBusy) return;
    const previous = {
      requirePrivateCheck: privateCheckEnabled,
      showReflectionDates: user.privacyPreferences?.showReflectionDates ?? true
    };
    const next = { ...previous, [preference]: value };
    setPrivateCheckEnabled(next.requirePrivateCheck);
    setPrivacyPreferenceBusy(preference);
    try {
      await updateUser({
        privacyPreferences: next
      });
      notify("Privacy preference saved.");
    } catch (preferenceError) {
      setPrivateCheckEnabled(previous.requirePrivateCheck);
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
        id="change-password"
        title="Change password"
        description={
          user.mustChangePassword
            ? "Your temporary password worked. You must replace it before using the rest of Saintagram."
            : "Update the password used to sign in to your account."
        }
        icon={KeyRound}
      >
        {user.mustChangePassword && (
          <div className="mb-5 rounded-[var(--radius-base)] border border-gold-300 bg-gold-50 px-4 py-3 text-sm font-semibold text-gold-700" role="alert">
            Set a new permanent password before continuing.
          </div>
        )}
        <form className="space-y-4" onSubmit={submitPassword} noValidate>
          <div>
            <label htmlFor="settings-current-password" className="label">
              {user.mustChangePassword ? "Current temporary password" : "Current password"}
            </label>
            <input ref={currentPasswordRef} id="settings-current-password" type="password" autoComplete="current-password" className="field" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setPasswordMessage(""); }} required />
          </div>
          <div>
            <label htmlFor="settings-new-password" className="label">New password</label>
            <input ref={newPasswordRef} id="settings-new-password" type="password" autoComplete="new-password" className="field" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordMessage(""); }} required />
          </div>
          <div>
            <label htmlFor="settings-confirm-password" className="label">Confirm new password</label>
            <input ref={confirmPasswordRef} id="settings-confirm-password" type="password" autoComplete="new-password" className="field" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordMessage(""); }} required />
          </div>
          {passwordMessage && <p className="text-sm font-semibold text-clay-600" role="alert">{passwordMessage}</p>}
          <button type="submit" className="btn-primary" disabled={passwordBusy}>
            {passwordBusy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
            {passwordBusy
              ? "Saving…"
              : user.mustChangePassword
                ? "Save permanent password"
                : "Change password"}
          </button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Account information"
        description="The contact and account details connected to your private profile."
        icon={UserRound}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-base)] bg-sage-50 p-4">
            <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage-600">
              {user.email ? <Mail className="size-4" aria-hidden="true" /> : <UserRound className="size-4" aria-hidden="true" />}
              {user.email ? "Email" : "Account"}
            </dt>
            <dd className="mt-2 break-all text-sm font-semibold text-ink">
              {user.email || "Guest account on this browser"}
            </dd>
          </div>
          <div className="rounded-[var(--radius-base)] bg-sage-50 p-4">
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
          <div className="mt-4 rounded-[var(--radius-base)] border border-gray-200 bg-white p-4">
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
        title="Privacy preferences"
        description="Choose how your own reflective space appears on this device."
        icon={ShieldCheck}
      >
        <div className="space-y-3">
          <label
            className={`flex cursor-pointer items-start justify-between gap-4 rounded-[var(--radius-base)] border border-sage-100 p-4 transition hover:border-sage-300 ${
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
        </div>
      </SettingsSection>

      <SettingsSection
        title="Your personal data"
        description="Download a private archive or sign out of this device."
        icon={Database}
      >
        <div className="grid gap-3">
          <button
            type="button"
            className="btn-secondary w-full justify-center"
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" aria-hidden="true" />
            Export personal data
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
        <div className="mt-6">
          <button
            type="button"
            className="btn-destructive w-full"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete my account
          </button>
        </div>
      </SettingsSection>

      <div className="mt-6">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => setLogoutOpen(true)}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </button>
      </div>

      <ConfirmDialog
        open={exportOpen}
        title="Download your private archive?"
        description="The PDF contains all of your public and private reflections. Store it somewhere only you can access."
        confirmLabel="Download PDF"
        headerIcon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-sage-100 bg-sage-50 text-sage-700 shadow-sm">
            <Download className="size-6" aria-hidden="true" />
          </div>
        }
        busy={exporting}
        onClose={() => setExportOpen(false)}
        onConfirm={() => void exportData()}
      >
        <div className="rounded-[var(--radius-base)] bg-white p-4 text-sm leading-6 text-gold-700">
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
        headerIcon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-sage-100 bg-sage-50 text-sage-700 shadow-sm">
            <LogOut className="size-6" aria-hidden="true" />
          </div>
        }
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
        headerIcon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-sage-200 bg-white text-clay-600 shadow-sm">
            <Trash2 className="size-6" aria-hidden="true" />
          </div>
        }
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
        <div className="space-y-4 mt-8">
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
          <div className="mt-6">
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
