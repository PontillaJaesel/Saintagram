"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
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
import { ModeBadge } from "@/components/ui/mode-badge";
import { appService } from "@/lib/app-service";
import { formatFriendlyDate, passwordError } from "@/lib/validation";

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
    mode,
    updateUser,
    changePassword,
    logout,
    deleteAccount
  } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordErrorMessage("");
    const validation = passwordError(newPassword);
    if (validation) {
      setPasswordErrorMessage(validation);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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

  const updateDatesPreference = async (showReflectionDates: boolean) => {
    try {
      await updateUser({
        privacyPreferences: {
          requirePrivateCheck: true,
          showReflectionDates
        }
      });
      notify("Privacy preference saved.");
    } catch (preferenceError) {
      notify(
        preferenceError instanceof Error
          ? preferenceError.message
          : "The preference could not be saved.",
        "error"
      );
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const archive = await appService.exportPersonalData(user.id);
      const blob = new Blob([JSON.stringify(archive, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `saintagram-personal-archive-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
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
    if (!deletePassword) {
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SettingsSection
        title="Account information"
        description="The email and account details connected to your private profile."
        icon={UserRound}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-sage-50 p-4">
            <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage-600">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </dt>
            <dd className="mt-2 break-all text-sm font-semibold text-ink">
              {user.email}
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
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-sage-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Storage connection</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {mode === "local"
                ? "Demonstration data is stored only in this browser."
                : "Account data is protected by Firebase ownership rules."}
            </p>
          </div>
          <ModeBadge expanded />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Change password"
        description="Verify your current password before choosing a new one."
        icon={KeyRound}
      >
        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          <div>
            <label htmlFor="current-password" className="label">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              className="field"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-password" className="label">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="field"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="label">
                Confirm new password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                className="field"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
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
            disabled={
              passwordBusy ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
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
      </SettingsSection>

      <SettingsSection
        title="Privacy preferences"
        description="Choose how your own reflective space appears on this device."
        icon={ShieldCheck}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-sage-100 bg-sage-50 p-4">
            <Check
              className="mt-0.5 size-5 shrink-0 text-sage-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold text-ink">
                Private view confirmation is always on
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Hidden Stories and private entries require an additional
                privacy check and are cleared from view when you leave the tab.
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-sage-100 p-4 hover:border-sage-300">
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
              checked={
                user.privacyPreferences?.showReflectionDates ?? true
              }
              onChange={(event) =>
                void updateDatesPreference(event.target.checked)
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
          This action cannot be undone. You will verify your password and type a
          confirmation phrase before anything is removed.
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
        description="The JSON file can contain your Hidden Story, private entries, and unfinished draft. Store it somewhere only you can access."
        confirmLabel="Download archive"
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
        description="Your saved profile and reflections will remain. You will need your password to return."
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
          <div>
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
          </div>
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
