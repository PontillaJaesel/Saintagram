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
import { appService } from "@/lib/app-service";
import { LIMITS } from "@/lib/constants";
import type { ReflectionPost } from "@/types";

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
  const [isPrivate, setIsPrivate] = useState(false);
  const [creationDate, setCreationDate] = useState(todayInputValue);
  const [editing, setEditing] = useState<ReflectionPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ReflectionPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [privacyDialog, setPrivacyDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    appService
      .getPublicReflections(user.id)
      .then((posts) => {
        if (active) setPublicPosts(posts);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Your reflections could not be loaded."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

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
    setIsPrivate(false);
    setCreationDate(todayInputValue());
    setEditing(null);
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!content.trim()) {
      setError("Write a short moment before saving.");
      textareaRef.current?.focus();
      return;
    }
    if (!creationDate || Number.isNaN(new Date(`${creationDate}T12:00:00`).getTime())) {
      setError("Choose a valid creation date.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const createdAt = new Date(`${creationDate}T12:00:00`).toISOString();
      const saved = await appService.saveReflection(user.id, {
        id: editing?.id,
        content,
        isPrivate,
        createdAt: editing ? editing.createdAt : createdAt
      });
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
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your reflection could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (post: ReflectionPost) => {
    setEditing(post);
    setContent(post.content);
    setIsPrivate(post.isPrivate);
    setCreationDate(dateInputValue(post.createdAt));
    setError("");
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
    try {
      const posts = await appService.getPrivateReflections(user.id);
      setPrivatePosts(posts);
      setPrivateUnlocked(true);
    } catch (unlockError) {
      notify(
        unlockError instanceof Error
          ? unlockError.message
          : "Private reflections could not be opened.",
        "error"
      );
    } finally {
      setPrivateLoading(false);
    }
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
          <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-white text-sage-600 shadow-sm">
            <PenLine className="size-5" aria-hidden="true" />
          </div>
          <p className="eyebrow">
            {editing ? "Editing a reflection" : "A moment worth noticing"}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
            What is a moment God saw today?
          </h2>
        </div>
        <form onSubmit={submit} className="p-5 sm:p-7" noValidate>
          {editing && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-sage-50 p-3">
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
          <label htmlFor="reflection-content" className="label">
            Your reflection
          </label>
          <textarea
            ref={textareaRef}
            id="reflection-content"
            className="field min-h-44 resize-y"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setError("");
            }}
            maxLength={LIMITS.post}
            placeholder="A quiet kindness, a hard choice, a prayer, an honest struggle…"
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
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
                id="creation-date"
                type="date"
                className="field pl-12"
                value={creationDate}
                max={todayInputValue()}
                onChange={(event) => setCreationDate(event.target.value)}
                disabled={Boolean(editing)}
                required
              />
            </div>
            {editing && (
              <p className="mt-2 text-xs text-muted">
                The original creation date is preserved when editing.
              </p>
            )}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-sage-200 p-4 transition hover:border-sage-400">
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
              className="mt-4 rounded-2xl border border-clay-200 bg-clay-50 p-3 text-sm font-semibold text-clay-600"
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
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Your own entries</p>
            <h2
              id="reflection-list-title"
              className="mt-1 font-serif text-2xl font-bold"
            >
              Reflections
            </h2>
            <p className="mt-1 text-sm text-muted">
              Newest first, with no reactions or engagement totals.
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
              onClick={() => setPrivacyDialog(true)}
              disabled={privateLoading}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {privateLoading ? "Opening…" : "Manage private entries"}
            </button>
          )}
        </div>

        {privateUnlocked && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-clay-200 bg-clay-50 p-4 text-sm text-muted">
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
          <p className="line-clamp-3 rounded-2xl bg-sage-50 p-4 text-sm italic leading-6 text-muted">
            “{deleteTarget.content}”
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={privacyDialog}
        title="Open private entries?"
        description="Confirm that you are in a private place before sensitive journal entries are loaded."
        confirmLabel="I’m ready to view them"
        onClose={() => setPrivacyDialog(false)}
        onConfirm={() => void unlockPrivate()}
      >
        <div className="flex items-start gap-3 rounded-2xl bg-clay-50 p-4 text-sm leading-6 text-muted">
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
