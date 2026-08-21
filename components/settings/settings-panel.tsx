"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound
} from "lucide-react";
import {
  setAccountPrivate
} from "@/lib/private-account";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { appService } from "@/lib/app-service";
import { adminFetch } from "@/lib/admin-api";
import { getFirebaseServices } from "@/lib/firebase";
import { createPersonalDataPdf } from "@/lib/personal-data-pdf";
import { downloadFirebaseProfileImage } from "@/lib/profile-images";
import { getProfileCover } from "@/lib/profile-covers";
import { reflectionMediaUrl } from "@/lib/reflection-media";
import { resolvePostAuthRoute } from "@/lib/routes";
import {
  formatFriendlyDate,
  passwordError
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
    logout
  } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openingAdmin, setOpeningAdmin] = useState(false);
  const refreshedAdminAccessForUser = useRef("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [
    accountPrivateEnabled,
    setAccountPrivateEnabled
  ] = useState(
    user?.privacyPreferences
      ?.accountPrivate ?? false
  );

  const [
    privateCheckEnabled,
    setPrivateCheckEnabled
  ] = useState(
    user?.privacyPreferences
      ?.requirePrivateCheck ?? true
  );

  const [
    privacyPreferenceBusy,
    setPrivacyPreferenceBusy
  ] = useState<
    | "accountPrivate"
    | "requirePrivateCheck"
    | null
  >(null);

  useEffect(() => {
    const userId = user?.id ?? "";
    if (!userId || refreshedAdminAccessForUser.current === userId) return;

    refreshedAdminAccessForUser.current = userId;
    void refreshUser().catch(() => {
      // The rest of Settings remains usable if this refresh is temporarily
      // unavailable. The admin button is still protected by the server claim.
    });
  }, [user?.id, refreshUser]);

  useEffect(() => {
    if (
      privacyPreferenceBusy !==
      "accountPrivate"
    ) {
      setAccountPrivateEnabled(
        user?.privacyPreferences
          ?.accountPrivate ?? false
      );
    }

    if (
      privacyPreferenceBusy !==
      "requirePrivateCheck"
    ) {
      setPrivateCheckEnabled(
        user?.privacyPreferences
          ?.requirePrivateCheck ?? true
      );
    }
  }, [
    privacyPreferenceBusy,
    user?.privacyPreferences
      ?.accountPrivate,
    user?.privacyPreferences
      ?.requirePrivateCheck
  ]);

  if (!user) return null;

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordMessage("");
    setCurrentPasswordError("");
    setNewPasswordError("");
    setConfirmPasswordError("");

    if (!currentPassword.trim()) {
      setCurrentPasswordError("Enter your current password.");
      currentPasswordRef.current?.focus();
      return;
    }

    const validation = passwordError(newPassword);
    if (validation) {
      setNewPasswordError(validation);
      newPasswordRef.current?.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("The new passwords do not match.");
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
      setCurrentPasswordError("");
      setNewPasswordError("");
      setConfirmPasswordError("");
      notify("Your permanent password was saved.");
      if (refreshed) router.replace(resolvePostAuthRoute(refreshed));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your password could not be changed.";
      setCurrentPasswordError(message);
      setPasswordMessage("");
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
      accountPrivate:
        accountPrivateEnabled,

      requirePrivateCheck:
        privateCheckEnabled,

      showReflectionDates:
        user.privacyPreferences
          ?.showReflectionDates ??
        true
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

  const updateAccountPrivacy =
  async (
    value: boolean
  ) => {
    if (
      privacyPreferenceBusy
    ) {
      return;
    }

    const previous =
      accountPrivateEnabled;

    setAccountPrivateEnabled(
      value
    );

    setPrivacyPreferenceBusy(
      "accountPrivate"
    );

    try {
      await setAccountPrivate(
        user.id,
        value
      );

      await refreshUser();

      notify(
        value
          ? "Your account is now private."
          : "Your account is now public."
      );
    } catch (error) {
      setAccountPrivateEnabled(
        previous
      );

      notify(
        error instanceof Error
          ? error.message
          : "Your account privacy could not be changed.",
        "error"
      );
    } finally {
      setPrivacyPreferenceBusy(
        null
      );
    }
  };
  const exportData = async () => {
    setExporting(true);
    try {
      const archive = await appService.exportPersonalData(user.id);

      const mediaPaths = Array.from(
        new Set(
          archive.reflections.flatMap((post) =>
            (post.media ?? []).map((media) => media.path)
          )
        )
      );
      const mediaPairs = await Promise.all(
        mediaPaths.map(async (path) => {
          try {
            return [path, await reflectionMediaUrl(path)] as const;
          } catch {
            return [path, ""] as const;
          }
        })
      );
      archive.downloadLinks.reflectionMedia = Object.fromEntries(
        mediaPairs.filter(([, url]) => Boolean(url))
      );

      if (archive.profile?.imagePath) {
        try {
          archive.downloadLinks.profileImage = await downloadFirebaseProfileImage(
            archive.profile.imagePath
          );
        } catch {
          // Keep the export usable even when an old Storage object is missing.
        }
      }

      const selectedCover = getProfileCover(archive.profile?.coverImageId);
      if (selectedCover) {
        archive.downloadLinks.coverImage = new URL(
          selectedCover.src,
          window.location.origin
        ).toString();
      }

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

  const openAdminDashboard = async () => {
    if (openingAdmin) return;

    setOpeningAdmin(true);
    try {
      const refreshed = await refreshUser();
      if (!refreshed?.adminAccessGranted) {
        throw new Error("Your shared administrator access is not active.");
      }

      const services = getFirebaseServices();
      if (!services) {
        throw new Error("Firebase is not configured for this deployment.");
      }

      await services.persistenceReady;
      const firebaseUser = services.auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== refreshed.id) {
        throw new Error("Please sign in again before opening the Admin Dashboard.");
      }

      // Force a new ID token so a newly granted custom admin claim is available
      // immediately without making the user sign out of the normal app first.
      const idToken = await firebaseUser.getIdToken(true);
      const { code } = await adminFetch<{ code: string }>(
        "/api/admin/handoff",
        { method: "POST" },
        idToken
      );

      const configuredUrl =
        process.env.NEXT_PUBLIC_ADMIN_APP_URL?.trim() ?? "";
      const localHost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const destination = configuredUrl ||
        (localHost
          ? `${window.location.origin}/admin`
          : "https://saintagram-admin.axjp.workers.dev/admin");
      const adminUrl = new URL(destination, window.location.origin);
      adminUrl.hash = new URLSearchParams({ handoff: code }).toString();

      window.location.assign(adminUrl.toString());
    } catch (adminError) {
      notify(
        adminError instanceof Error
          ? adminError.message
          : "The Admin Dashboard could not be opened.",
        "error"
      );
      setOpeningAdmin(false);
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
            <div className="relative">
              <input ref={currentPasswordRef} id="settings-current-password" type={showCurrentPassword ? "text" : "password"} autoComplete="current-password" className={`field pr-11 ${currentPasswordError ? "border-clay-400" : ""}`} value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setCurrentPasswordError(""); setPasswordMessage(""); }} required aria-invalid={Boolean(currentPasswordError)} />
              <button type="button" className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink" aria-label={showCurrentPassword ? "Hide current password" : "Show current password"} onClick={() => setShowCurrentPassword((value) => !value)}>
                {showCurrentPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
            {currentPasswordError && <p className="mt-2 text-sm font-semibold text-clay-600" role="alert">{currentPasswordError}</p>}
          </div>
          <div>
            <label htmlFor="settings-new-password" className="label">New password</label>
            <div className="relative">
              <input ref={newPasswordRef} id="settings-new-password" type={showNewPassword ? "text" : "password"} autoComplete="new-password" className={`field pr-11 ${newPasswordError ? "border-clay-400" : ""}`} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setNewPasswordError(""); setPasswordMessage(""); }} required aria-invalid={Boolean(newPasswordError)} />
              <button type="button" className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink" aria-label={showNewPassword ? "Hide new password" : "Show new password"} onClick={() => setShowNewPassword((value) => !value)}>
                {showNewPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
            {newPasswordError && <p className="mt-2 text-sm font-semibold text-clay-600" role="alert">{newPasswordError}</p>}
          </div>
          <div>
            <label htmlFor="settings-confirm-password" className="label">Confirm new password</label>
            <div className="relative">
              <input ref={confirmPasswordRef} id="settings-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" className={`field pr-11 ${confirmPasswordError ? "border-clay-400" : ""}`} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setConfirmPasswordError(""); setPasswordMessage(""); }} required aria-invalid={Boolean(confirmPasswordError)} />
              <button type="button" className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink" aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"} onClick={() => setShowConfirmPassword((value) => !value)}>
                {showConfirmPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
            {confirmPasswordError && <p className="mt-2 text-sm font-semibold text-clay-600" role="alert">{confirmPasswordError}</p>}
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
      </SettingsSection>

      {user.adminAccessGranted === true && (
        <SettingsSection
          id="admin-access"
          title="Admin Dashboard"
          description="Your account has been granted shared Saintagram administrator access."
          icon={ShieldCheck}
        >
          <p className="text-sm leading-6 text-muted">
            Open the administrator site without entering your password again.
            The administrator session is limited to that tab or browser window
            and is cleared when it is closed.
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={openingAdmin}
            onClick={() => void openAdminDashboard()}
          >
            {openingAdmin ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-4" aria-hidden="true" />
            )}
            {openingAdmin ? "Opening Admin…" : "Open Saintagram Admin"}
          </button>
        </SettingsSection>
      )}

      <SettingsSection
        title="Privacy preferences"
        description="Control who can see your reflections and how private content opens."
        icon={ShieldCheck}
      >
        <div className="space-y-3">
          <label
            className={`flex cursor-pointer items-start justify-between gap-4 rounded-[var(--radius-base)] border border-sage-100 p-4 transition hover:border-sage-300 ${
              privacyPreferenceBusy ===
              "accountPrivate"
                ? "cursor-wait opacity-70"
                : ""
            }`}
          >
            <span>
              <span className="block text-sm font-bold text-ink">
                Make account private
              </span>

              <span className="mt-1 block text-xs leading-5 text-muted">
                Your profile can still be
                searched, but your reflections
                will not appear in Community.
                People must send a follow
                request before they can see
                reflections on your profile.
              </span>
            </span>

            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-sage-700"
              checked={
                accountPrivateEnabled
              }
              disabled={Boolean(
                privacyPreferenceBusy
              )}
              onChange={(event) =>
                void updateAccountPrivacy(
                  event.target.checked
                )
              }
            />
          </label>

          {accountPrivateEnabled && (
            <Link
              href="/follow-requests"
              className="btn-secondary w-full justify-center"
            >
              View Follow Requests
            </Link>
          )}

          <label
            className={`flex cursor-pointer items-start justify-between gap-4 rounded-[var(--radius-base)] border border-sage-100 p-4 transition hover:border-sage-300 ${
              privacyPreferenceBusy ===
              "requirePrivateCheck"
                ? "cursor-wait opacity-70"
                : ""
            }`}
          >
            <span>
              <span className="block text-sm font-bold text-ink">
                Confirm before opening private content
              </span>

              <span className="mt-1 block text-xs leading-5 text-muted">
                Ask before showing private
                content.
              </span>
            </span>

            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-sage-700"
              checked={
                privateCheckEnabled
              }
              disabled={Boolean(
                privacyPreferenceBusy
              )}
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
          Your personal export contains private account data, reflection media links,
          and activity history. It is never presented as a public or shareable profile.
        </p>
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
        description="The PDF contains your profile details, public and private reflections, media download links, and recorded account activity. Store it somewhere only you can access."
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
          "Your saved profile and reflections will remain. Sign in again to return."
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

    </div>
  );
}
