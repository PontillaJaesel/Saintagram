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
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ReflectionMediaPicker } from "@/components/reflections/reflection-media-picker";
import { FiatCategorySelector } from "@/components/fiat/fiat-category-selector";
import { appService } from "@/lib/app-service";
import { LIMITS } from "@/lib/constants";
import { deleteReflectionMedia, reflectionMediaId, uploadReflectionMedia, validateReflectionMedia } from "@/lib/reflection-media";
import { MODERATION_TEXT_ERROR, moderateTextContent } from "@/lib/moderation";
import type { FiatCategory, ReflectionPost } from "@/types";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  const checkLiveTextWarning = async (
    field: "title" | "content" | "fiatOther",
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

          <ReflectionMediaPicker files={mediaFiles} onChange={setMediaFiles} disabled={saving} />

          <FiatCategorySelector value={fiatCategory} onChange={setFiatCategory} otherText={fiatOther} onOtherTextChange={(value)=>{setFiatOther(value);if(errorField==="fiatOther"){setError("");setErrorField(null);}}} otherError={errorField==="fiatOther"} />

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
            ? editingPost
              ? "Updating…"
              : "Saving…"
            : editingPost
              ? "Update reflection"
              : "Save reflection"}
          </button>
        </form>
      </section>

    </div>
  );
}
