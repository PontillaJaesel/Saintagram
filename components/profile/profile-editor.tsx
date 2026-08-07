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
  Palette,
  Save,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { ImageSymbolPicker } from "@/components/forms/image-symbol-picker";
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
          <h2
            className={`font-serif text-xl font-bold ${
              privateSection ? "text-clay-600 dark:text-clay-200" : "text-ink"
            }`}
          >
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
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const committedImagePathRef = useRef("");
  const latestImagePathRef = useRef("");

  useEffect(() => {
    if (!user || !privacyConfirmed) return;
    let active = true;
    appService
      .getFullProfile(user.id)
      .then((nextProfile) => {
        if (active) {
          committedImagePathRef.current = nextProfile?.imagePath ?? "";
          latestImagePathRef.current = nextProfile?.imagePath ?? "";
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

  const setField = <Key extends keyof SpiritualProfile>(
    key: Key,
    value: SpiritualProfile[Key]
  ) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile) return;
    if (!profile.profileName.trim()) {
      setError("Enter a profile name before saving your changes.");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setError("");
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
        title="Open your private profile editor?"
        description="This editor includes your Hidden Story. Confirm that you are in a place where only you can read the screen before it is loaded."
        confirmLabel="I’m ready to edit privately"
        cancelLabel="Back to profile"
        headerIcon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-100 bg-white text-gold-700 shadow-sm">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
        }
        onClose={() => router.replace("/profile")}
        onConfirm={() => setPrivacyConfirmed(true)}
      >
        <div className="flex items-start gap-3 rounded-[var(--radius-base)] bg-clay-50 p-4 text-sm leading-6 text-muted">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-clay-600"
            aria-hidden="true"
          />
          Your Hidden Story stays unloaded until you confirm.
        </div>
      </ConfirmDialog>
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
          title="Profile Name"
          description="Choose the name shown at the top of your profile."
          icon={UserRound}
        >
          <label htmlFor="edit-profile-name" className="label">
            Profile name <span className="text-clay-600">*</span>
          </label>
          <input
            ref={nameRef}
            id="edit-profile-name"
            className="field"
            value={profile.profileName}
            onChange={(event) => setField("profileName", event.target.value)}
            maxLength={LIMITS.profileName}
            required
            aria-invalid={!profile.profileName.trim() && Boolean(error)}
            aria-describedby={
              !profile.profileName.trim() && error
                ? "edit-profile-name-error"
                : undefined
            }
          />
          {!profile.profileName.trim() && error && (
            <p
              id="edit-profile-name-error"
              className="mt-2 text-sm font-semibold text-muted"
            >
              A profile name is required.
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
        </EditorSection>

        <EditorSection
          title="Cover background"
          description="Choose any color for the cover at the top of your profile."
          icon={Palette}
        >
          <div
            className="mb-5 h-28 rounded-[var(--radius-base)] border border-gray-100"
            style={{ backgroundColor: profile.coverColor ?? "#D4AF37" }}
            aria-hidden="true"
          />
          <label htmlFor="edit-cover-color" className="label">
            Cover color
          </label>
          <div className="flex items-center gap-4">
            <input
              id="edit-cover-color"
              type="color"
              value={profile.coverColor ?? "#D4AF37"}
              onChange={(event) => setField("coverColor", event.target.value)}
              className="h-12 w-16 cursor-pointer rounded-xl border border-gray-200 bg-paper p-1"
            />
            <output
              htmlFor="edit-cover-color"
              className="font-secondary text-sm font-medium text-muted"
            >
              {(profile.coverColor ?? "#D4AF37").toUpperCase()}
            </output>
          </div>
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
            onChange={(event) => setField("spiritualBio", event.target.value)}
            maxLength={LIMITS.bio}
          />
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
            onChange={(event) => setField("godsComment", event.target.value)}
            maxLength={LIMITS.godsComment}
          />
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
              onChange={(event) =>
                setField(
                  "heavenlyHashtag",
                  normalizeHashtag(event.target.value)
                )
              }
              maxLength={LIMITS.hashtag}
              placeholder="#YourGraceForToday"
            />
          </fieldset>
        </EditorSection>

        <EditorSection
          title="Hidden Story"
          description="Owner-only content. It is saved separately and never loaded into your standard profile or journey."
          icon={ShieldCheck}
          privateSection
        >
          <label htmlFor="edit-hidden-story" className="label">
            What does God know that others may not see?
          </label>
          <textarea
            id="edit-hidden-story"
            className="field min-h-48 resize-y"
            value={profile.hiddenStory}
            onChange={(event) => setField("hiddenStory", event.target.value)}
            maxLength={LIMITS.hiddenStory}
          />
          <p className="mt-2 text-right text-xs text-muted">
            {profile.hiddenStory.length} / {LIMITS.hiddenStory}
          </p>
        </EditorSection>
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

    </form>
  );
}
