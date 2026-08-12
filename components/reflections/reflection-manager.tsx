"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Lock,
  LockKeyhole,
  NotebookPen,
  PenLine,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ReflectionCard } from "@/components/reflections/reflection-card";
import { ReflectionMediaPicker } from "@/components/reflections/reflection-media-picker";
import { FiatCategorySelector } from "@/components/fiat/fiat-category-selector";
import { appService } from "@/lib/app-service";
import { LIMITS } from "@/lib/constants";
import { deleteReflectionMedia, reflectionMediaId, uploadReflectionMedia, validateReflectionMedia } from "@/lib/reflection-media";
import type { FiatCategory, ReflectionPost } from "@/types";

function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function dateInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return todayInputValue();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function ReflectionManager() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [publicPosts, setPublicPosts] = useState<ReflectionPost[]>([]);
  const [privatePosts, setPrivatePosts] = useState<ReflectionPost[]>([]);
  const [privateUnlocked, setPrivateUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [fiatCategory, setFiatCategory] = useState<FiatCategory>();
  const [fiatOther, setFiatOther] = useState("");
  const [creationDate, setCreationDate] = useState(todayInputValue);
  const [editing, setEditing] = useState<ReflectionPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<
    "content" | "date" | "fiatOther" | "form" | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<ReflectionPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [privacyDialog, setPrivacyDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return appService.subscribeReflections(
      user.id,
      "public",
      (posts) => {
        setPublicPosts(posts);
        setError("");
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      }
    );
  }, [user]);

  useEffect(() => {
    if (!user || !privateUnlocked) return;
    setPrivateLoading(true);
    return appService.subscribeReflections(
      user.id,
      "private",
      (posts) => {
        setPrivatePosts(posts);
        setPrivateLoading(false);
      },
      (message) => {
        notify(message, "error");
        setPrivateLoading(false);
      }
    );
  }, [notify, privateUnlocked, user]);

  const visiblePosts = useMemo(
    () =>
      [...publicPosts, ...(privateUnlocked ? privatePosts : [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [privatePosts, privateUnlocked, publicPosts]
  );

  const resetComposer = () => {
    setContent("");
    setMediaFiles([]);
    setTitle("");
    setIsPrivate(false);
    setFiatCategory(undefined);
    setFiatOther("");
    setCreationDate(todayInputValue());
    setEditing(null);
    setError("");
    setErrorField(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (saving) return;
    if (!content.trim()) {
      setError("Write a short moment before saving.");
      setErrorField("content");
      window.requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    if (fiatCategory === "other" && !fiatOther.trim()) {
      setError("Please describe your other FiAt before saving.");
      setErrorField("fiatOther");
      return;
    }
    if (!creationDate || Number.isNaN(new Date(`${creationDate}T12:00:00`).getTime())) {
      setError("Choose a valid creation date.");
      setErrorField("date");
      window.requestAnimationFrame(() => dateRef.current?.focus());
      return;
    }
    setSaving(true);
    setError("");
    setErrorField(null);
    let uploadedMedia: ReflectionPost["media"];
    try {
      await validateReflectionMedia(mediaFiles);
      const createdAt = new Date(`${creationDate}T12:00:00`).toISOString();
      const reflectionId = editing?.id ?? reflectionMediaId();
      uploadedMedia = mediaFiles.length ? await uploadReflectionMedia(user.id, reflectionId, mediaFiles, isPrivate) : undefined;
      const saved = await appService.saveReflection(user.id, {
        id: editing?.id,
        newId: editing ? undefined : reflectionId,
        title,
        content,
        isPrivate,
        createdAt,
        fiatCategory,
        fiatOther,
        media: uploadedMedia
      });
      if (uploadedMedia && editing?.media?.length) {
        void deleteReflectionMedia(editing.media).catch(() => undefined);
      }
      if (saved.isPrivate) {
        if (privateUnlocked) {
          setPrivatePosts((posts) => [
            saved,
            ...posts.filter((post) => post.id !== saved.id)
          ]);
        } else {
          setPublicPosts((posts) => posts.filter((post) => post.id !== saved.id));
        }
      } else {
        setPublicPosts((posts) => [
          saved,
          ...posts.filter((post) => post.id !== saved.id)
        ]);
        setPrivatePosts((posts) => posts.filter((post) => post.id !== saved.id));
      }
      notify(
        saved.isPrivate
          ? "Your reflection was saved privately."
          : editing
            ? "Your reflection was updated."
            : "Your reflection was saved."
      );
      resetComposer();
    } catch (saveError) {
      if (uploadedMedia?.length) {
        await deleteReflectionMedia(uploadedMedia).catch(() => undefined);
      }
      const firebaseCode = typeof saveError === "object" && saveError && "code" in saveError
        ? String(saveError.code)
        : "";
      const permissionDenied = firebaseCode.includes("permission-denied") || firebaseCode.includes("unauthorized");
      setError(
        permissionDenied && mediaFiles.length > 0
          ? "This reflection could not be published because Firebase Storage or Firestore rules are not configured for reflection media. Publish both rules files, then try again."
          : permissionDenied
          ? "This reflection was rejected by Firestore. Publish the latest firestore.rules, then try again."
          : saveError instanceof Error
          ? saveError.message
          : "Your reflection could not be saved."
      );
      setErrorField("form");
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (post: ReflectionPost) => {
    setEditing(post);
    setTitle(post.title ?? "");
    setContent(post.content);
    setIsPrivate(post.isPrivate);
    setFiatCategory(post.fiatCategory);
    setFiatOther(post.fiatOther ?? "");
    setCreationDate(dateInputValue(post.createdAt));
    setError("");
    setErrorField(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      await appService.deleteReflection(user.id, deleteTarget.id);
      await deleteReflectionMedia(deleteTarget.media ?? []);
      setPublicPosts((posts) =>
        posts.filter((post) => post.id !== deleteTarget.id)
      );
      setPrivatePosts((posts) =>
        posts.filter((post) => post.id !== deleteTarget.id)
      );
      if (editing?.id === deleteTarget.id) resetComposer();
      setDeleteTarget(null);
      notify("The reflection was deleted.");
    } catch (deleteError) {
      notify(
        deleteError instanceof Error
          ? deleteError.message
          : "The reflection could not be deleted.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  const unlockPrivate = async () => {
    if (!user) return;
    setPrivacyDialog(false);
    setPrivateLoading(true);
    setPrivateUnlocked(true);
  };

  const lockPrivate = () => {
    if (editing?.isPrivate) resetComposer();
    setPrivatePosts([]);
    setPrivateUnlocked(false);
    notify("Private reflections are hidden again.");
  };

  if (loading) return <LoadingState label="Gathering your reflections…" />;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,.92fr)_minmax(24rem,1.08fr)]">
      <section className="surface self-start overflow-hidden xl:sticky xl:top-24">
        <div className="border-b border-sage-100 bg-gradient-to-r from-sage-50 to-gold-50 p-5 sm:p-7">
          <div className="mb-4 grid size-11 place-items-center rounded-[var(--radius-base)] bg-white text-sage-600 shadow-sm">
            <PenLine className="size-5" aria-hidden="true" />
          </div>
          <p className="eyebrow">
            {editing ? "Editing a reflection" : "A moment worth noticing"}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
            What is a moment God saw today?
          </h2>
        </div>
        <form
          id="reflection-editor"
          onSubmit={submit}
          className="scroll-mt-6 p-5 sm:p-7"
          noValidate
        >
          {editing && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-base)] bg-sage-50 p-3">
              <span className="text-sm font-bold text-sage-700">
                Editing your entry
              </span>
              <button
                type="button"
                className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted hover:bg-white"
                onClick={resetComposer}
                aria-label="Cancel editing"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <label htmlFor="reflection-title" className="label">
            Moment title
          </label>
          <input
            id="reflection-title"
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={LIMITS.momentTitle}
            placeholder="Give this moment a name"
          />
          <p className="mt-2 text-right text-xs tabular-nums text-muted">
            {title.length} / {LIMITS.momentTitle}
          </p>

          <label htmlFor="reflection-content" className="label mt-5">
            Your reflection
          </label>
          <textarea
            ref={textareaRef}
            id="reflection-content"
            className={`field min-h-44 resize-y ${
              errorField === "content"
                ? "border-clay-500 ring-2 ring-clay-100"
                : ""
            }`}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              if (errorField === "content") {
                setError("");
                setErrorField(null);
              }
            }}
            maxLength={LIMITS.post}
            placeholder="A quiet kindness, a hard choice, a prayer, an honest struggle…"
            aria-invalid={errorField === "content"}
            aria-describedby={
              errorField === "content"
                ? "reflection-count reflection-error"
                : "reflection-count"
            }
          />
          <p
            id="reflection-count"
            className="mt-2 text-right text-xs tabular-nums text-muted"
          >
            {content.length} / {LIMITS.post}
          </p>

          <ReflectionMediaPicker files={mediaFiles} onChange={setMediaFiles} disabled={saving} />

          <FiatCategorySelector value={fiatCategory} onChange={setFiatCategory} otherText={fiatOther} onOtherTextChange={(value)=>{setFiatOther(value);if(errorField==="fiatOther"){setError("");setErrorField(null);}}} otherError={errorField==="fiatOther"} />

          <div className="mt-5">
            <label htmlFor="creation-date" className="label">
              Creation date
            </label>
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sage-400"
                aria-hidden="true"
              />
              <input
                ref={dateRef}
                id="creation-date"
                type="date"
                className={`field pl-12 ${
                  errorField === "date"
                    ? "border-clay-500 ring-2 ring-clay-100"
                    : ""
                }`}
                value={creationDate}
                max={todayInputValue()}
                onChange={(event) => {
                  setCreationDate(event.target.value);
                  if (errorField === "date") {
                    setError("");
                    setErrorField(null);
                  }
                }}
                required
                aria-invalid={errorField === "date"}
                aria-describedby={
                  errorField === "date" ? "reflection-error" : undefined
                }
              />
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[var(--radius-base)] border border-sage-200 p-4 transition hover:border-sage-400">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-sage-700"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <Lock className="size-4 text-clay-600" aria-hidden="true" />
                Keep this reflection private
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted">
                Private entries never appear on your standard profile or
                journey.
              </span>
            </span>
          </label>

          {error && (
            <div
              id="reflection-error"
              className="mt-4 rounded-[var(--radius-base)] border border-clay-200 bg-clay-50 p-3 text-sm font-semibold text-clay-600"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary mt-5 w-full"
            disabled={saving}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {saving
              ? "Saving…"
              : editing
                ? "Update reflection"
                : "Save reflection"}
          </button>
        </form>
      </section>

      <section aria-labelledby="reflection-list-title">
        <div className="mb-5 rounded-[var(--radius-card)] border border-sage-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Your own entries</p>
              <h2
                id="reflection-list-title"
                className="mt-1 font-serif text-2xl font-bold"
              >
                Reflections
              </h2>
              <p className="mt-1 text-sm text-muted">
                Your newest reflections first.
              </p>
            </div>
            {privateUnlocked ? (
              <button type="button" className="btn-secondary" onClick={lockPrivate}>
                <Lock className="size-4" aria-hidden="true" />
                Hide private entries
              </button>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (user?.privacyPreferences?.requirePrivateCheck ?? true) {
                    setPrivacyDialog(true);
                  } else {
                    void unlockPrivate();
                  }
                }}
                disabled={privateLoading}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                {privateLoading ? "Opening…" : "Manage private entries"}
              </button>
            )}
          </div>
          {privateUnlocked && (
            <div className="mb-4 flex items-start gap-3 rounded-[var(--radius-base)] border border-clay-200 bg-clay-50 p-4 text-sm text-muted">
              <LockKeyhole
                className="mt-0.5 size-5 shrink-0 text-clay-600"
                aria-hidden="true"
              />
              Private entries are temporarily visible for this page visit.
            </div>
          )}
          {visiblePosts.length ? (
            <div className="space-y-3">
              {visiblePosts.map((post) => (
                <ReflectionCard
                  key={post.id}
                  post={post}
                  showActions
                  onEdit={beginEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={NotebookPen}
              title="Your first reflection can be small"
              description="God notices the moment you tried, listened, forgave, asked for help, or simply showed up."
            />
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this reflection?"
        description="This will permanently remove the reflection from your account. It cannot be restored."
        confirmLabel="Delete reflection"
        destructive
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      >
        {deleteTarget && (
          <p className="line-clamp-3 rounded-[var(--radius-base)] bg-sage-50 p-4 text-sm italic leading-6 text-muted">
            “{deleteTarget.content}”
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={privacyDialog}
        title="Open private entries?"
        description="Confirm that you are in a private place before sensitive journal entries are loaded."
        confirmLabel="I’m ready to view them"
        headerIcon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-sage-100 bg-sage-50 text-sage-700 shadow-sm">
            <Sparkles className="size-6" aria-hidden="true" />
          </div>
        }
        onClose={() => setPrivacyDialog(false)}
        onConfirm={() => void unlockPrivate()}
      >
        <div className="flex items-start gap-3 rounded-[var(--radius-base)] bg-clay-50 p-4 text-sm leading-6 text-muted">
          <Sparkles
            className="mt-0.5 size-5 shrink-0 text-clay-600"
            aria-hidden="true"
          />
          You can hide them again at any time without deleting anything.
        </div>
      </ConfirmDialog>
    </div>
  );
}
