"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Heart,
  LoaderCircle,
  MessageCircleHeart,
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
  LIMITS
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
  description: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  privateSection?: boolean;
}) {
  return (
    <section
      className={`surface overflow-hidden ${
        privateSection ? "border-clay-200" : ""
      }`}
    >
      <div
        className={`flex items-start gap-4 border-b p-5 sm:p-6 ${
          privateSection
            ? "border-clay-200 bg-clay-50"
            : "border-sage-100 bg-sage-50/60"
        }`}
      >
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ${
            privateSection ? "text-clay-600" : "text-sage-600"
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

export function ProfileEditor() {
  const { user } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<SpiritualProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clearHiddenOpen, setClearHiddenOpen] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !privacyConfirmed) return;
    let active = true;
    appService
      .getFullProfile(user.id)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
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
      setError("Profile name is required.");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await appService.updateProfile(user.id, profile);
      notify("Your profile changes were saved.");
      router.replace("/profile?saved=1");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your profile changes could not be saved."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        onClose={() => router.replace("/profile")}
        onConfirm={() => setPrivacyConfirmed(true)}
      >
        <div className="flex items-start gap-3 rounded-2xl bg-clay-50 p-4 text-sm leading-6 text-muted">
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
        <Link href="/profile" className="btn-secondary mt-5">
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && (
        <div
          className="mb-5 rounded-2xl border border-clay-200 bg-clay-50 p-4 text-sm font-semibold text-clay-600"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-5">
        <EditorSection
          title="Identity"
          description="Update the name, image, or symbol at the top of your profile."
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
          />
          <div className="mt-6">
            <ImageSymbolPicker
              imageUrl={profile.imageUrl}
              selectedSymbol={profile.selectedSymbol}
              profileName={profile.profileName}
              onChange={(value) =>
                setProfile((current) =>
                  current ? { ...current, ...value } : current
                )
              }
            />
          </div>
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
          title="Guides and influences"
          description="Names are supportive reflection labels, never public follower or following counts."
          icon={CheckCircle2}
        >
          <TagEditor
            label="Who helps lead me closer to God?"
            values={profile.followers}
            onChange={(values) => setField("followers", values)}
            placeholder="Add a faith guide"
          />
          <div className="my-7 h-px bg-sage-100" />
          <TagEditor
            label="Who or what am I following right now?"
            values={profile.following}
            onChange={(values) => setField("following", values)}
            suggestions={FOLLOWING_IDEAS}
            placeholder="Add an influence"
          />
        </EditorSection>

        <EditorSection
          title="What my heart seeks"
          description="A reflective alternative to “likes”—with no totals, reactions, or scoring."
          icon={Heart}
        >
          <TagEditor
            label="What does your heart usually seek?"
            values={profile.heartSeeks}
            onChange={(values) => setField("heartSeeks", values)}
            suggestions={HEART_SEEKS_IDEAS}
            placeholder="Add another desire"
          />
        </EditorSection>

        <EditorSection
          title="A comment of grace"
          description="Revisit what you believe God would want you to hear today."
          icon={MessageCircleHeart}
        >
          <label htmlFor="edit-gods-comment" className="label">
            God’s Comment
          </label>
          <textarea
            id="edit-gods-comment"
            className="field min-h-36 resize-y border-gold-200 bg-gold-50/30"
            value={profile.godsComment}
            onChange={(event) => setField("godsComment", event.target.value)}
            maxLength={LIMITS.godsComment}
          />
          <p className="mt-2 text-right text-xs text-muted">
            {profile.godsComment.length} / {LIMITS.godsComment}
          </p>

          <fieldset className="mt-7">
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
            className="field min-h-48 resize-y border-clay-200"
            value={profile.hiddenStory}
            onChange={(event) => setField("hiddenStory", event.target.value)}
            maxLength={LIMITS.hiddenStory}
          />
          <p className="mt-2 text-right text-xs text-muted">
            {profile.hiddenStory.length} / {LIMITS.hiddenStory}
          </p>
          <button
            type="button"
            className="btn-quiet mt-2 text-clay-600"
            onClick={() => {
              if (profile.hiddenStory) setClearHiddenOpen(true);
            }}
            disabled={!profile.hiddenStory}
          >
            Prefer not to answer
          </button>
        </EditorSection>
      </div>

      <div className="sticky bottom-20 z-30 mt-6 flex flex-col-reverse gap-3 rounded-3xl border border-sage-100 bg-paper/95 p-4 shadow-lift backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
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
        open={clearHiddenOpen}
        title="Clear your Hidden Story?"
        description="This removes the private text from the editor. It will be permanently deleted from storage when you save profile changes."
        confirmLabel="Clear Hidden Story"
        destructive
        onClose={() => setClearHiddenOpen(false)}
        onConfirm={() => {
          setField("hiddenStory", "");
          setClearHiddenOpen(false);
        }}
      />
    </form>
  );
}
