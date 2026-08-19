"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Heart,
  Image as ImageIcon,
  LoaderCircle,
  MessageCircleHeart,
  Save,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { ImageSymbolPicker } from "@/components/forms/image-symbol-picker";
import { CoverBackgroundPicker } from "@/components/forms/cover-background-picker";
import { TagEditor } from "@/components/forms/tag-editor";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { appService } from "@/lib/app-service";
import {
  FOLLOWING_IDEAS,
  HASHTAG_IDEAS,
  HEART_SEEKS_IDEAS,
  LIMITS,
  PROFILE_NAME_IDEAS
} from "@/lib/constants";
import {
  MODERATION_TEXT_ERROR,
  moderateTextContent
} from "@/lib/moderation";
import { normalizeHashtag } from "@/lib/validation";
import type { SpiritualProfile } from "@/types";

function EditorSection({
  title,
  description,
  icon: Icon,
  children,
  privateSection = false
}: {
  title: string;
  description?: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  privateSection?: boolean;
}) {
  return (
    <section
      className={`surface overflow-hidden ${
        privateSection ? "border-clay-200/80" : "border-sage-100"
      }`}
    >
      <div
        className={`flex items-start gap-4 border-b p-5 sm:p-6 ${
          privateSection
            ? "border-clay-200 bg-clay-50/80 dark:border-slate-700/60 dark:bg-slate-800/15"
            : "border-sage-100 bg-sage-50/70"
        }`}
      >
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-[var(--radius-base)] bg-white shadow-sm ${
            privateSection ? "text-clay-600 dark:text-clay-300" : "text-sage-600"
          }`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          )}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function ProfileEditor() {
  const { user } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<SpiritualProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [liveWarningField, setLiveWarningField] = useState<
    "profileName" | "spiritualBio" | "godsComment" | "heavenlyHashtag" | null
  >(null);
  const [liveWarningMessage, setLiveWarningMessage] = useState("");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const committedImagePathRef = useRef("");
  const latestImagePathRef = useRef("");
  const initialProfileRef = useRef("");

  useEffect(() => {
    if (!user || !privacyConfirmed) return;
    let active = true;
    appService
      .getFullProfile(user.id)
      .then((nextProfile) => {
        if (active) {
          committedImagePathRef.current = nextProfile?.imagePath ?? "";
          latestImagePathRef.current = nextProfile?.imagePath ?? "";
          initialProfileRef.current = nextProfile ? JSON.stringify(nextProfile) : "";
          setProfile(nextProfile);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Your profile could not be loaded."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [privacyConfirmed, user]);

  useEffect(() => {
    latestImagePathRef.current = profile?.imagePath ?? "";
  }, [profile?.imagePath]);

  useEffect(() => {
    return () => {
      const stagedImagePath = latestImagePathRef.current;
      if (
        user &&
        stagedImagePath &&
        stagedImagePath !== committedImagePathRef.current
      ) {
        void appService
          .deleteProfileImage(user.id, stagedImagePath)
          .catch(() => undefined);
      }
    };
  }, [user]);

  const hasUnsavedChanges = Boolean(
    profile &&
      initialProfileRef.current &&
      JSON.stringify(profile) !== initialProfileRef.current
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const confirmInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.href === window.location.href || destination.hash && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      setPendingDestination(destination.href);
    };
    document.addEventListener("click", confirmInternalNavigation, true);
    return () => document.removeEventListener("click", confirmInternalNavigation, true);
  }, [hasUnsavedChanges]);

  const discardChangesAndExit = () => {
    if (!pendingDestination) return;
    const destination = new URL(pendingDestination, window.location.href);
    initialProfileRef.current = profile ? JSON.stringify(profile) : "";
    setPendingDestination(null);
    if (destination.origin === window.location.origin) {
      router.push(`${destination.pathname}${destination.search}${destination.hash}`);
    } else {
      window.location.assign(destination.href);
    }
  };

  const setField = <Key extends keyof SpiritualProfile>(
    key: Key,
    value: SpiritualProfile[Key]
  ) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
    setError("");
  };

  const checkLiveTextWarning = async (
    field: "profileName" | "spiritualBio" | "godsComment" | "heavenlyHashtag",
    value: string
  ) => {
    if (!value.trim()) {
      if (liveWarningField === field) {
        setLiveWarningField(null);
        setLiveWarningMessage("");
      }
      return;
    }

    const moderation = await moderateTextContent(value);
    if (moderation.allowed) {
      if (liveWarningField === field) {
        setLiveWarningField(null);
        setLiveWarningMessage("");
      }
      return;
    }

    setLiveWarningField(field);
    setLiveWarningMessage(moderation.reason || MODERATION_TEXT_ERROR);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile) return;
    if (!profile.profileName.trim()) {
      setError("Enter a profile name before saving your changes.");
      nameRef.current?.focus();
      return;
    }

    const checks = [
      { field: "profileName" as const, value: profile.profileName },
      { field: "spiritualBio" as const, value: profile.spiritualBio },
      { field: "godsComment" as const, value: profile.godsComment },
      { field: "heavenlyHashtag" as const, value: profile.heavenlyHashtag }
    ];

    for (const check of checks) {
      const moderation = await moderateTextContent(check.value);
      if (!moderation.allowed) {
        setLiveWarningField(check.field);
        setLiveWarningMessage(moderation.reason || MODERATION_TEXT_ERROR);
        setError(moderation.reason || MODERATION_TEXT_ERROR);
        if (check.field === "profileName") {
          nameRef.current?.focus();
        }
        return;
      }
    }

    setLiveWarningField(null);
    setLiveWarningMessage("");
    setError("");
    setSaving(true);
    try {
      const updated = await appService.updateProfile(user.id, profile);
      committedImagePathRef.current = updated.imagePath;
      latestImagePathRef.current = updated.imagePath;
      notify("Your profile changes were saved.");
      router.replace("/profile?saved=1");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We couldn’t save your profile changes. Please try again."
      );
      window.requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSaving(false);
    }
  };

  if (!privacyConfirmed) {
    return (
      <ConfirmDialog
        open
        title="Edit your profile?"
        description="Update how your profile appears to others."
        confirmLabel="Continue editing"
        cancelLabel="Back to profile"
        headerIcon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-100 bg-white text-gold-700 shadow-sm">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
        }
        onClose={() => router.replace("/profile")}
        onConfirm={() => setPrivacyConfirmed(true)}
      />
    );
  }

  if (loading) return <LoadingState label="Opening profile editor…" />;

  if (!profile) {
    return (
      <div className="surface p-7 text-center" role="alert">
        <p className="font-bold text-clay-600">
          {error || "Your profile could not be found."}
        </p>
        <p className="mt-2 text-sm text-muted">
          Check your connection, then try opening the editor again.
        </p>
        <button
          type="button"
          className="btn-primary mt-5"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
        <Link href="/profile" className="btn-secondary mt-5">
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="pb-8 sm:pb-6">
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="mb-5 rounded-[var(--radius-base)] border border-clay-200 bg-clay-50 p-4 text-sm font-semibold text-clay-600"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p>Please review your profile.</p>
              <p className="mt-1 font-normal leading-6">{error}</p>
              <p className="mt-1 font-normal leading-6">
                Your entries are still here. Review the highlighted field or
                try saving again.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <EditorSection
          title="Display Name"
          description="Choose the display name shown at the top of your profile."
          icon={UserRound}
        >
          <label htmlFor="edit-profile-name" className="label">
            Display name <span className="text-clay-600">*</span>
          </label>
          <input
            ref={nameRef}
            id="edit-profile-name"
            className="field"
            value={profile.profileName}
            onChange={(event) => {
              setField("profileName", event.target.value);
              void checkLiveTextWarning("profileName", event.target.value);
            }}
            maxLength={LIMITS.profileName}
            required
            aria-invalid={!profile.profileName.trim() && Boolean(error)}
            aria-describedby={
              !profile.profileName.trim() && error
                ? "edit-profile-name-error"
                : undefined
            }
          />
          {liveWarningField === "profileName" && liveWarningMessage && (
            <p className="mt-2 text-sm font-semibold text-clay-600" role="alert" aria-live="polite">
              {liveWarningMessage}
            </p>
          )}
          {!profile.profileName.trim() && error && (
            <p
              id="edit-profile-name-error"
              className="mt-2 text-sm font-semibold text-muted"
            >
              A display name is required.
            </p>
          )}
          <div className="mt-4 rounded-[var(--radius-base)] border border-sage-100 bg-sage-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-600">
              A few gentle ideas
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {PROFILE_NAME_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    profile.profileName === idea
                      ? "border-sage-300 bg-sage-100 text-ink"
                      : "border-gray-100 bg-white text-ink hover:border-gray-300"
                  }`}
                  onClick={() => setField("profileName", idea)}
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 text-right text-xs text-muted">
            {profile.profileName.length} / {LIMITS.profileName}
          </p>
          <div className="mt-5 border-t border-sage-100 pt-5">
            <label htmlFor="profile-username" className="label">
              Username
            </label>
            <input
              id="profile-username"
              className="field bg-sage-50 text-muted"
              value={user?.email || "Guest account"}
              readOnly
              aria-describedby="profile-username-help"
            />
            <p id="profile-username-help" className="mt-2 text-xs text-muted">
              Your username is the issued account code and cannot be changed.
            </p>
          </div>
        </EditorSection>

        <EditorSection
          title="Cover Background"
          description="Choose a color or one of Saintagram's cover designs."
          icon={ImageIcon}
        >
          <CoverBackgroundPicker
            coverColor={profile.coverColor}
            coverImageId={profile.coverImageId}
            onChange={(value) => {
              setProfile((current) => (current ? { ...current, ...value } : current));
              setError("");
            }}
          />
        </EditorSection>

        <EditorSection
          title="Picture / Spiritual Symbol"
          description="Choose a photo or spiritual symbol for your profile."
          icon={ImageIcon}
        >
          <ImageSymbolPicker
            imagePath={profile.imagePath}
            committedImagePath={committedImagePathRef.current}
            selectedSymbol={profile.selectedSymbol}
            profileName={profile.profileName}
            onChange={(value) => {
              setProfile((current) =>
                current ? { ...current, ...value } : current
              );
              setError("");
            }}
          />
        </EditorSection>

        <EditorSection
          title="Spiritual bio"
          description="Return to the sentence with honesty about where you are now."
          icon={MessageCircleHeart}
        >
          <label htmlFor="edit-bio" className="label">
            Before God, I am someone who…
          </label>
          <textarea
            id="edit-bio"
            className="field min-h-40 resize-y"
            value={profile.spiritualBio}
            onChange={(event) => {
              setField("spiritualBio", event.target.value);
              void checkLiveTextWarning("spiritualBio", event.target.value);
            }}
            maxLength={LIMITS.bio}
          />
          {liveWarningField === "spiritualBio" && liveWarningMessage && (
            <p className="mt-2 text-sm font-semibold text-clay-600" role="alert" aria-live="polite">
              {liveWarningMessage}
            </p>
          )}
          <p className="mt-2 text-right text-xs text-muted">
            {profile.spiritualBio.length} / {LIMITS.bio}
          </p>
        </EditorSection>

        <EditorSection
          title="Spiritual influences"
          icon={CheckCircle2}
        >
          <TagEditor
            label="Who helps me lead closer to God?"
            values={profile.spiritualGuides}
            onChange={(values) =>
              setField("spiritualGuides", values)
            }
            placeholder="Add a person or guide"
          />
          <div className="my-7 h-px bg-gray-200" />
          <TagEditor
            label="Who or what am I following in my life right now?"
            values={profile.lifeDirections}
            onChange={(values) =>
              setField("lifeDirections", values)
            }
            suggestions={FOLLOWING_IDEAS}
            placeholder="Add an influence"
          />
        </EditorSection>

        <EditorSection
          title="Likes"
          description="What does my heart usually seek?"
          icon={Heart}
        >
          <TagEditor
            label="What does my heart usually seek?"
            values={profile.heartSeeks}
            onChange={(values) => setField("heartSeeks", values)}
            suggestions={HEART_SEEKS_IDEAS}
            placeholder="Add another desire"
          />
        </EditorSection>

        <EditorSection
          title="Comments of Grace"
          description="Revisit what you believe God would want you to hear today."
          icon={MessageCircleHeart}
        >
          <label htmlFor="edit-gods-comment" className="label">
            God’s Comment
          </label>
          <textarea
            id="edit-gods-comment"
            className="field min-h-40 resize-y"
            value={profile.godsComment}
            onChange={(event) => {
              setField("godsComment", event.target.value);
              void checkLiveTextWarning("godsComment", event.target.value);
            }}
            maxLength={LIMITS.godsComment}
          />
          {liveWarningField === "godsComment" && liveWarningMessage && (
            <p className="mt-2 text-sm font-semibold text-clay-600" role="alert" aria-live="polite">
              {liveWarningMessage}
            </p>
          )}
          <p className="mt-2 text-right text-xs text-muted">
            {profile.godsComment.length} / {LIMITS.godsComment}
          </p>
        </EditorSection>

        <EditorSection
          title="Heavenly Hashtag"
          description="Choose a grace, invitation, or truth you want to carry."
          icon={Cloud}
        >
          <fieldset>
            <legend className="label">Heavenly Hashtag</legend>
            <div className="flex flex-wrap gap-2">
              {HASHTAG_IDEAS.map((hashtag) => (
                <button
                  key={hashtag}
                  type="button"
                  className={`chip ${
                    profile.heavenlyHashtag === hashtag ? "chip-selected" : ""
                  }`}
                  aria-pressed={profile.heavenlyHashtag === hashtag}
                  onClick={() => setField("heavenlyHashtag", hashtag)}
                >
                  {profile.heavenlyHashtag === hashtag && (
                    <Check className="size-4" aria-hidden="true" />
                  )}
                  {hashtag}
                </button>
              ))}
            </div>
            <label htmlFor="edit-hashtag" className="label mt-5">
              Custom hashtag
            </label>
            <input
              id="edit-hashtag"
              className="field"
              value={
                HASHTAG_IDEAS.includes(profile.heavenlyHashtag)
                  ? ""
                  : profile.heavenlyHashtag
              }
              onChange={(event) => {
                const nextValue = normalizeHashtag(event.target.value);
                setField("heavenlyHashtag", nextValue);
                void checkLiveTextWarning("heavenlyHashtag", nextValue);
              }}
              maxLength={LIMITS.hashtag}
              placeholder="#YourGraceForToday"
            />
            {liveWarningField === "heavenlyHashtag" && liveWarningMessage && (
              <p className="mt-2 text-sm font-semibold text-clay-600" role="alert" aria-live="polite">
                {liveWarningMessage}
              </p>
            )}
          </fieldset>
        </EditorSection>

        {/* Password management lives in Settings so account security has one
            clear and mandatory destination. */}
        {/* <EditorSection
          title="Account security"
          description="Update your sign-in password from your profile settings."
          icon={KeyRound}
        >
          {user?.authProvider && user.authProvider !== "password" ? (
            <p className="text-sm leading-6 text-muted">
              This account does not use a password login.
            </p>
          ) : (
            <form onSubmit={submitPassword} className="space-y-4" noValidate>
              <div>
                <label htmlFor="profile-current-password" className="label">
                  Current password
                </label>
                <input
                  ref={currentPasswordRef}
                  id="profile-current-password"
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
                      ? "profile-current-password-error"
                      : undefined
                  }
                />
                {passwordFieldErrors.current && (
                  <p
                    id="profile-current-password-error"
                    className="mt-2 text-sm font-semibold text-clay-600"
                    role="alert"
                  >
                    {passwordFieldErrors.current}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-new-password" className="label">
                    New password
                  </label>
                  <input
                    ref={newPasswordRef}
                    id="profile-new-password"
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
                      passwordFieldErrors.new ? "profile-new-password-error" : undefined
                    }
                  />
                  {passwordFieldErrors.new && (
                    <p
                      id="profile-new-password-error"
                      className="mt-2 text-sm font-semibold text-clay-600"
                      role="alert"
                    >
                      {passwordFieldErrors.new}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="profile-confirm-new-password" className="label">
                    Confirm new password
                  </label>
                  <input
                    ref={confirmPasswordRef}
                    id="profile-confirm-new-password"
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
                        ? "profile-confirm-new-password-error"
                        : undefined
                    }
                  />
                  {passwordFieldErrors.confirm && (
                    <p
                      id="profile-confirm-new-password-error"
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
              <button type="submit" className="btn-secondary" disabled={passwordBusy}>
                {passwordBusy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="size-4" aria-hidden="true" />
                )}
                {passwordBusy ? "Changing…" : "Change password"}
              </button>
            </form>
          )}
        </EditorSection> */}

      </div>

      <div className="mx-auto mt-6 flex max-w-6xl flex-col-reverse gap-3 rounded-[var(--radius-card)] border border-gray-100 bg-paper/95 px-4 py-4 shadow-lift backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/profile" className="btn-secondary">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Cancel
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {saving ? "Saving changes…" : "Save profile changes"}
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDestination)}
        title="Unsaved profile changes"
        description="Save your changes before leaving. If you exit now, your edits will be lost."
        confirmLabel="Exit without saving"
        cancelLabel="Keep editing"
        destructive
        onClose={() => setPendingDestination(null)}
        onConfirm={discardChangesAndExit}
      />

    </form>
  );
}
