"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState
} from "react";
import {
  useRouter,
  useSearchParams
} from "next/navigation";
import {
  CheckCircle2,
  Lock,
  PenLine
} from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ReflectionMediaPicker } from "@/components/reflections/reflection-media-picker";
import { FiatCategorySelector } from "@/components/fiat/fiat-category-selector";
import { appService } from "@/lib/app-service";
import { LIMITS } from "@/lib/constants";
import { deleteReflectionMedia, reflectionMediaId, uploadReflectionMedia, validateReflectionMedia } from "@/lib/reflection-media";
import {
  LIVE_MODERATION_DEBOUNCE_MS,
  MODERATION_TEXT_ERROR,
  localModerationDecision,
  moderateTextContent,
  moderateTextForLiveCheck
} from "@/lib/moderation";
import type { FiatCategory, ReflectionPost } from "@/types";

type ReflectionModerationField = "title" | "content" | "fiatOther";

export function ReflectionManager() {
  const { user } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [editingPost, setEditingPost] =
    useState<ReflectionPost | null>(null);
  const [loadingEdit, setLoadingEdit] =
    useState(Boolean(editId));
  const [editLoadError, setEditLoadError] =
    useState("");
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [fiatCategory, setFiatCategory] = useState<FiatCategory>();
  const [fiatOther, setFiatOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [liveWarningField, setLiveWarningField] = useState<
    "title" | "content" | "fiatOther" | null
  >(null);
  const [liveWarningMessage, setLiveWarningMessage] = useState("");
  const [errorField, setErrorField] = useState<
    "content" | "fiatOther" | "form" | null
  >(null);

  const [composerDirty, setComposerDirty] = useState(false);
  const [leaveWarningOpen, setLeaveWarningOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveModerationTimersRef = useRef<
    Partial<Record<ReflectionModerationField, ReturnType<typeof setTimeout>>>
  >({});
  const liveModerationControllersRef = useRef<
    Partial<Record<ReflectionModerationField, AbortController>>
  >({});
  const liveModerationGenerationRef = useRef(0);

  const cancelLiveModeration = (field: ReflectionModerationField) => {
    const timer = liveModerationTimersRef.current[field];
    if (timer) clearTimeout(timer);
    delete liveModerationTimersRef.current[field];

    liveModerationControllersRef.current[field]?.abort();
    delete liveModerationControllersRef.current[field];
  };

  const cancelAllLiveModeration = () => {
    (["title", "content", "fiatOther"] as ReflectionModerationField[]).forEach(
      cancelLiveModeration
    );
  };

  const checkLiveTextWarning = (
    field: ReflectionModerationField,
    value: string
  ) => {
    const generation = ++liveModerationGenerationRef.current;
    cancelLiveModeration(field);

    const local = localModerationDecision(value);
    setLiveWarningField(null);
    setLiveWarningMessage("");

    if (!local.allowed) {
      setLiveWarningField(field);
      setLiveWarningMessage(local.reason || MODERATION_TEXT_ERROR);
      return;
    }

    // Private reflections stay local-only so journal text is not sent to the
    // third-party profanity service while the user is typing.
    if (!value.trim() || isPrivate) return;

    liveModerationTimersRef.current[field] = setTimeout(() => {
      const controller = new AbortController();
      liveModerationControllersRef.current[field] = controller;

      void moderateTextForLiveCheck(value, { signal: controller.signal })
        .then((moderation) => {
          if (
            controller.signal.aborted ||
            liveModerationGenerationRef.current !== generation
          ) {
            return;
          }

          if (!moderation.allowed) {
            setLiveWarningField(field);
            setLiveWarningMessage(moderation.reason || MODERATION_TEXT_ERROR);
          }
        })
        .catch((moderationError) => {
          if (
            !(moderationError instanceof Error) ||
            moderationError.name !== "AbortError"
          ) {
            console.warn("Live profanity check failed.", moderationError);
          }
        })
        .finally(() => {
          if (liveModerationControllersRef.current[field] === controller) {
            delete liveModerationControllersRef.current[field];
          }
        });
    }, LIVE_MODERATION_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      Object.values(liveModerationTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      Object.values(liveModerationControllersRef.current).forEach((controller) =>
        controller?.abort()
      );
    };
  }, []);

  const resetComposer = () => {
    setContent("");
    setMediaFiles([]);
    setTitle("");
    setIsPrivate(false);
    setFiatCategory(undefined);
    setFiatOther("");
    setError("");
    setLiveWarningField(null);
    setLiveWarningMessage("");
    setErrorField(null);

    setComposerDirty(false);
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
    const moderation = await moderateTextContent(`${title}\n${content}\n${fiatOther}`);
    if (!moderation.allowed) {
      setError(moderation.reason || MODERATION_TEXT_ERROR);
      setErrorField("form");
      setSaving(false);
      return;
    }
    setSaving(true);
    setError("");
    setErrorField(null);
    let uploadedMedia: ReflectionPost["media"];
    try {
      await validateReflectionMedia(mediaFiles);
      const reflectionId =
        editingPost?.id ??
        reflectionMediaId();
      uploadedMedia = mediaFiles.length ? await uploadReflectionMedia(user.id, reflectionId, mediaFiles, isPrivate) : undefined;
      const saved = await appService.saveReflection(
        user.id,
        {
          ...(editingPost
            ? {
                id: editingPost.id,
                createdAt:
                  editingPost.createdAt
              }
            : {
                newId: reflectionId
              }),
          title,
          content,
          isPrivate,
          fiatCategory,
          fiatOther,
          media:
            uploadedMedia ??
            editingPost?.media
        }
      );
      notify(
        editingPost
          ? "Your reflection was updated."
          : saved.isPrivate
            ? "Your reflection was saved privately."
            : "Your reflection was saved."
      );
      if (editingPost) {
        setComposerDirty(false);
        router.push("/profile");
        return;
      }
      resetComposer();
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch (saveError) {
      if (uploadedMedia?.length) {
        await deleteReflectionMedia(uploadedMedia).catch(() => undefined);
      }
      const firebaseCode = typeof saveError === "object" && saveError && "code" in saveError
        ? String(saveError.code)
        : "";
      const permissionDenied = firebaseCode.includes("permission-denied") || firebaseCode.includes("unauthorized");
      setError(
        permissionDenied
          ? "This reflection was rejected by Firebase permissions. Please try again after the latest rules are deployed."
          : saveError instanceof Error
          ? saveError.message
          : "Your reflection could not be saved."
      );
      setErrorField("form");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!user || !editId) {
      setEditingPost(null);
      setLoadingEdit(false);
      return;
    }

    let active = true;

    setLoadingEdit(true);
    setEditLoadError("");

    void appService
      .getReflections(user.id)
      .then((reflections) => {
        if (!active) return;

        const reflection =
          reflections.find(
            (post) => post.id === editId
          );

        if (!reflection) {
          throw new Error(
            "That reflection could not be found."
          );
        }

        setEditingPost(reflection);

        setTitle(reflection.title ?? "");
        setContent(reflection.content);
        setIsPrivate(reflection.isPrivate);
        setFiatCategory(
          reflection.fiatCategory
        );
        setFiatOther(
          reflection.fiatOther ?? ""
        );

        setMediaFiles([]);
      })
      .catch((loadError) => {
        if (!active) return;

        setEditLoadError(
          loadError instanceof Error
            ? loadError.message
            : "Your reflection could not be opened."
        );
      })
      .finally(() => {
        if (active) {
          setLoadingEdit(false);
        }
      });

    return () => {
      active = false;
    };
  }, [editId, user?.id]);

  useEffect(() => {
    const handleNavigationClick = (event: MouseEvent) => {
      if (!composerDirty || saving) {
        return;
      }

      // Only intercept normal left-click navigation.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      // Allow external links, downloads, and new tabs normally.
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(
        anchor.href,
        window.location.href
      );

      if (destination.origin !== window.location.origin) {
        return;
      }

      const current = new URL(window.location.href);

      // Allow same-page anchors such as #reflection-editor.
      if (
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setPendingHref(
        `${destination.pathname}${destination.search}${destination.hash}`
      );

      setLeaveWarningOpen(true);
    };

    document.addEventListener(
      "click",
      handleNavigationClick,
      true
    );

    return () => {
      document.removeEventListener(
        "click",
        handleNavigationClick,
        true
      );
    };
  }, [composerDirty, saving]);

  useEffect(() => {
    if (!composerDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();

      // Required by some browsers.
      event.returnValue = "";
    };

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [composerDirty]);

  const keepWriting = () => {
    setLeaveWarningOpen(false);
    setPendingHref(null);
  };

  const leaveWithoutPosting = () => {
    const destination = pendingHref;

    setLeaveWarningOpen(false);
    setPendingHref(null);

    resetComposer();

    if (destination) {
      router.push(destination);
    }
  };

  if (editId && loadingEdit) {
    return (
      <LoadingState label="Opening your reflection…" />
    );
  }

  if (
    editId &&
    !loadingEdit &&
    !editingPost
  ) {
    return (
      <div className="mx-auto max-w-3xl">
        <section className="surface p-7 text-center">
          <p className="warning-indicator rounded-xl px-4 py-3">
            {editLoadError ||
              "That reflection could not be found."}
          </p>

          <button
            type="button"
            className="btn-secondary mt-5"
            onClick={() =>
              router.push("/profile")
            }
          >
            Back to profile
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="surface overflow-hidden">
        <div className="border-b border-sage-100 bg-gradient-to-r from-sage-50 to-gold-50 p-5 sm:p-7">
          <div className="mb-4 grid size-11 place-items-center rounded-[var(--radius-base)] bg-white text-sage-600 shadow-sm">
            <PenLine className="size-5" aria-hidden="true" />
          </div>
          <p className="eyebrow">
            {editingPost
              ? "Edit your reflection"
              : "A moment worth noticing"}
          </p>

          <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">
            {editingPost
              ? "Update this moment"
              : "What is a moment God saw today?"}
          </h2>
        </div>
        <form
          id="reflection-editor"
          onSubmit={submit}
          onChangeCapture={() => setComposerDirty(true)}
          className="scroll-mt-6 p-5 sm:p-7"
          noValidate
        >
          <label htmlFor="reflection-title" className="label">
            Moment title
          </label>
          <input
            id="reflection-title"
            className="field"
            value={title}
            onChange={(event) => {
              const nextValue = event.target.value;
              setTitle(nextValue);
              void checkLiveTextWarning("title", nextValue); 
            }}
            maxLength={LIMITS.momentTitle}
            placeholder="Give this moment a name"
          />
          {liveWarningField === "title" && liveWarningMessage && (
            <p className="mt-2 text-sm font-semibold text-clay-600" role="alert" aria-live="polite">
              {liveWarningMessage}
            </p>
          )}
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
              const nextValue = event.target.value;
              setContent(nextValue);
              void checkLiveTextWarning("content", nextValue);
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
          {liveWarningField === "content" && liveWarningMessage && (
            <p className="mt-2 text-sm font-semibold text-clay-600" role="alert" aria-live="polite">
              {liveWarningMessage}
            </p>
          )}
          <p
            id="reflection-count"
            className="mt-2 text-right text-xs tabular-nums text-muted"
          >
            {content.length} / {LIMITS.post}
          </p>

          <ReflectionMediaPicker
            files={mediaFiles}
            onChange={(files) => {
              setMediaFiles(files);
              setComposerDirty(true);
            }}
            disabled={saving}
          />

          <FiatCategorySelector
            value={fiatCategory}
            onChange={(category) => {
              setFiatCategory(category);
              setComposerDirty(true);
            }}
            otherText={fiatOther}
            onOtherTextChange={(value) => {
              setFiatOther(value);
              setComposerDirty(true);

              if (errorField === "fiatOther") {
                setError("");
                setErrorField(null);
              }
            }}
            otherError={errorField === "fiatOther"}
          />

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[var(--radius-base)] border border-sage-200 p-4 transition hover:border-sage-400">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-sage-700"
              checked={isPrivate}
              onChange={(event) => {
                const nextPrivate = event.target.checked;
                setIsPrivate(nextPrivate);
                if (nextPrivate) cancelAllLiveModeration();
              }}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <Lock className="size-4 text-clay-600" aria-hidden="true" />
                Keep this reflection private
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
            disabled={saving || Boolean(liveWarningMessage)}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {saving
            ? editingPost
              ? "Updating…"
              : "Saving…"
            : editingPost
              ? "Update reflection"
              : "Save reflection"}
          </button>
        </form>
      </section>

      <ConfirmDialog
        open={leaveWarningOpen}
        title={
          editingPost
            ? "Leave without saving changes?"
            : "Leave without posting?"
        }
        description={
          editingPost
            ? "Your changes to this reflection have not been saved. If you leave now, those changes will be lost."
            : "Your reflection has not been posted. If you leave now, everything you entered will be lost."
        }
        confirmLabel={
          editingPost
            ? "Leave without saving"
            : "Leave without posting"
        }
        cancelLabel="Keep writing"
        destructive
        onClose={keepWriting}
        onConfirm={leaveWithoutPosting}
      />
      
    </div>
  );
}
