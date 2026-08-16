"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ImageSymbolPicker } from "@/components/forms/image-symbol-picker";
import { TagEditor } from "@/components/forms/tag-editor";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { LoadingState } from "@/components/ui/loading-state";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { appService } from "@/lib/app-service";
import {
  FOLLOWING_IDEAS,
  HASHTAG_IDEAS,
  HEART_SEEKS_IDEAS,
  LIMITS,
  PROFILE_NAME_IDEAS
} from "@/lib/constants";
import { formatFriendlyDate, normalizeHashtag } from "@/lib/validation";
import {
  EMPTY_DRAFT,
  type ProfileDraftData,
  type SpiritualSymbol
} from "@/types";

const STEPS = [
  { title: "Display name", short: "Name", icon: UserRound },
  { title: "Choose a profile symbol or photo", short: "Image", icon: ImageIcon }
] as const;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function cloneEmptyDraft(): ProfileDraftData {
  return {
    ...EMPTY_DRAFT,
    spiritualGuides: [],
    lifeDirections: [],
    onboardingPostTitles: [""],
    onboardingPosts: [""],
    heartSeeks: []
  };
}

function CharacterCount({
  value,
  limit,
  id
}: {
  value: string;
  limit: number;
  id?: string;
}) {
  return (
    <p
      id={id}
      className="mt-2 text-right text-xs tabular-nums text-muted"
      aria-live="polite"
    >
      {value.length} / {limit}
    </p>
  );
}

function ReviewSection({
  title,
  step,
  children,
  privateSection = false,
  onEdit
}: {
  title: string;
  step: number;
  children: ReactNode;
  privateSection?: boolean;
  onEdit: (step: number) => void;
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border p-5 ${
        privateSection
          ? "border-amber-300/80 bg-amber-50/90 text-amber-950 dark:border-gold-500/60 dark:bg-gold-500/10 dark:text-gold-100"
          : "border-sage-100 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className={`flex items-center gap-2 text-sm font-bold ${privateSection ? "text-amber-950 dark:text-violet-100" : "text-ink dark:text-slate-100"}`}>
          {privateSection && (
            <ShieldCheck className="size-4 text-gold-500" aria-hidden="true" />
          )}
          {title}
          {privateSection && (
            <span
              className="rounded-full bg-white px-2 py-1 text-[10px] uppercase tracking-wider text-red-700 dark:text-red-700"
              style={{ backgroundColor: "rgb(255 255 255)" }}
            >
              Private
            </span>
          )}
        </h3>
        <button
          type="button"
          className="min-h-11 rounded-[var(--radius-base)] px-3 text-xs font-bold text-sage-700 transition hover:bg-sage-50"
          onClick={() => onEdit(step)}
        >
          Edit
        </button>
      </div>
      <div className="mt-3 text-sm leading-6 text-muted">
        <div className="user-content whitespace-pre-wrap">{children}</div>
      </div>
    </section>
  );
}

export function ProfileWizard() {
  const { user, refreshUser } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [data, setData] = useState<ProfileDraftData>(cloneEmptyDraft);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [restoredAt, setRestoredAt] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const [stepError, setStepError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [persistedImagePath, setPersistedImagePath] = useState("");
  const finishingRef = useRef(false);
  const pendingSaveRef = useRef<Promise<unknown> | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const persistedImagePathRef = useRef("");
  const latestImagePathRef = useRef("");
  const knownImagePathsRef = useRef(new Set<string>());
  const nameRef = useRef<HTMLInputElement>(null);
  const stepContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void appService
      .getDraft(user.id)
      .then((draft) => {
        if (!active) return;
        if (draft) {
          const restoredImagePath = draft.draftData.imagePath ?? "";
          persistedImagePathRef.current = restoredImagePath;
          latestImagePathRef.current = restoredImagePath;
          if (restoredImagePath) {
            knownImagePathsRef.current.add(restoredImagePath);
          }
          setPersistedImagePath(restoredImagePath);
          setData({
            ...cloneEmptyDraft(),
            ...draft.draftData,
            onboardingPostTitles: draft.draftData.onboardingPosts?.map(
              (_post, index) => draft.draftData.onboardingPostTitles?.[index] ?? ""
            ) ?? [""],
            onboardingPosts: draft.draftData.onboardingPosts?.length
              ? draft.draftData.onboardingPosts
              : [""]
          });
          setStep(Math.max(0, Math.min(STEPS.length - 1, draft.currentStep)));
          setRestoredAt(draft.updatedAt);
          setSaveStatus("saved");
        }
        setLoaded(true);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Your draft could not be restored."
        );
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const persistDraft = useCallback(
    async (showNotification = false) => {
      if (!user || finishingRef.current) return;
      setSaveStatus("saving");
      const imagePathBeingSaved = data.imagePath;
      if (imagePathBeingSaved) {
        knownImagePathsRef.current.add(imagePathBeingSaved);
      }
      const previousSave = pendingSaveRef.current;
      const saveOperation = (previousSave
        ? previousSave.catch(() => undefined)
        : Promise.resolve()
      ).then(async () => {
        const savedDraft = await appService.saveDraft(user.id, step, data);
        const previousImagePath = persistedImagePathRef.current;
        persistedImagePathRef.current = imagePathBeingSaved;
        setPersistedImagePath(imagePathBeingSaved);

        if (
          previousImagePath &&
          previousImagePath !== imagePathBeingSaved
        ) {
          try {
            await appService.deleteProfileImage(user.id, previousImagePath);
            knownImagePathsRef.current.delete(previousImagePath);
          } catch {
            // The replacement path is already durable. Keep the old path in
            // the cleanup set so completion, discard, or unmount can retry.
          }
        }
        return savedDraft;
      });
      pendingSaveRef.current = saveOperation;
      try {
        await saveOperation;
        setSaveStatus("saved");
        if (showNotification) notify("Your draft is saved.");
      } catch (saveError) {
        setSaveStatus("error");
        if (showNotification) {
          notify(
            saveError instanceof Error
              ? saveError.message
              : "The draft could not be saved.",
            "error"
          );
        }
      } finally {
        if (pendingSaveRef.current === saveOperation) {
          pendingSaveRef.current = null;
        }
      }
    },
    [data, notify, step, user]
  );

  const waitForPendingSave = async () => {
    try {
      await pendingSaveRef.current;
    } catch {
      // Completion and discard perform their own durable write/delete. A
      // failed background save must not recreate a draft or block either.
    }
  };

  const cleanupKnownImages = async (
    keepImagePath: string,
    failOnError: boolean
  ) => {
    if (!user) return;
    const candidates = new Set(knownImagePathsRef.current);
    if (latestImagePathRef.current) {
      candidates.add(latestImagePathRef.current);
    }
    if (persistedImagePathRef.current) {
      candidates.add(persistedImagePathRef.current);
    }

    for (const imagePath of candidates) {
      if (!imagePath || imagePath === keepImagePath) continue;
      try {
        await appService.deleteProfileImage(user.id, imagePath);
        knownImagePathsRef.current.delete(imagePath);
      } catch (cleanupError) {
        if (failOnError) throw cleanupError;
      }
    }
  };

  useEffect(() => {
    if (!loaded || !user || finishingRef.current) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      void persistDraft();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data, step, loaded, user, persistDraft]);

  useEffect(() => {
    if (!loaded) return;
    const heading = document.getElementById("wizard-step-title");
    heading?.focus();
  }, [step, loaded]);

  useEffect(() => {
    latestImagePathRef.current = data.imagePath;
    if (data.imagePath) knownImagePathsRef.current.add(data.imagePath);
  }, [data.imagePath]);

  useEffect(() => {
    const userId = user?.id;
    return () => {
      if (!userId) return;
      void (async () => {
        try {
          await pendingSaveRef.current;
        } catch {
          // A failed save leaves only the last successful path committed.
        }
        const keepImagePath = persistedImagePathRef.current;
        const candidates = new Set(knownImagePathsRef.current);
        if (latestImagePathRef.current) {
          candidates.add(latestImagePathRef.current);
        }
        await Promise.allSettled(
          [...candidates]
            .filter((imagePath) => imagePath !== keepImagePath)
            .map((imagePath) =>
              appService.deleteProfileImage(userId, imagePath)
            )
        );
      })();
    };
  }, [user?.id]);

  const updateData = <Key extends keyof ProfileDraftData>(
    key: Key,
    value: ProfileDraftData[Key]
  ) => {
    setData((current) => ({ ...current, [key]: value }));
    setError("");
    setStepError("");
  };

  const updateImageChoice = (value: {
    imagePath: string;
    selectedSymbol: SpiritualSymbol;
  }) => {
    if (data.imagePath) knownImagePathsRef.current.add(data.imagePath);
    if (value.imagePath) knownImagePathsRef.current.add(value.imagePath);
    latestImagePathRef.current = value.imagePath;
    setData((current) => ({ ...current, ...value }));
    setError("");
    setStepError("");
  };

  const validationMessage = (targetStep: number): string => {
    const messages = [
      !data.profileName.trim()
        ? "Add a display name before continuing."
        : "",
      !data.imagePath && !data.selectedSymbol
        ? "Choose a profile picture or spiritual symbol before continuing."
        : "",
      "",
      data.spiritualGuides.length === 0
        ? "Add at least one person or holy companion before continuing."
        : "",
      data.lifeDirections.length === 0
        ? "Add at least one influence you are following before continuing."
        : "",
      data.onboardingPosts.length === 0 ||
      data.onboardingPosts.some((post) => !post.trim())
        ? "Answer every moment field before continuing."
        : "",
      data.heartSeeks.length === 0
        ? "Choose or add something your heart seeks before continuing."
        : "",
      !data.hiddenStory.trim()
        ? "Answer the Hidden Story question before continuing."
        : "",
      !data.godsComment.trim()
        ? "Answer God’s Comment before continuing."
        : "",
      !data.heavenlyHashtag.trim()
        ? "Choose or create a Heavenly Hashtag before continuing."
        : ""
    ];
    return messages[targetStep] ?? "";
  };

  const focusFirstStepField = () => {
    window.requestAnimationFrame(() => {
      const target =
        stepContentRef.current?.querySelector<HTMLElement>(
          "input:not([type='hidden']), textarea, button:not([disabled])"
        ) ?? nameRef.current;
      target?.focus();
      if (typeof target?.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  };

  const validateCurrentStep = (): boolean => {
    const message = validationMessage(step);
    if (message) {
      setStepError(message);
      focusFirstStepField();
      return false;
    }
    setStepError("");
    return true;
  };

  const next = () => {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const previous = () => {
    setError("");
    setStepError("");
    setStep((current) => Math.max(0, current - 1));
  };

  const complete = async () => {
    if (!user) return;
    const firstIncompleteStep = Array.from(
      { length: STEPS.length },
      (_item, index) => index
    ).find((index) => validationMessage(index));
    if (firstIncompleteStep !== undefined) {
      setStep(firstIncompleteStep);
      setStepError(validationMessage(firstIncompleteStep));
      window.requestAnimationFrame(focusFirstStepField);
      return;
    }
    finishingRef.current = true;
    setFinishing(true);
    setError("");
    try {
      await waitForPendingSave();
      await appService.completeProfile(user.id, data);
      persistedImagePathRef.current = data.imagePath;
      latestImagePathRef.current = data.imagePath;
      setPersistedImagePath(data.imagePath);
      await cleanupKnownImages(data.imagePath, false);
      if (data.imagePath) knownImagePathsRef.current.add(data.imagePath);
      const refreshed = await refreshUser();
      router.replace(refreshed?.mustChangePassword !== false ? "/settings" : "/profile?created=1");
    } catch (completeError) {
      finishingRef.current = false;
      setFinishing(false);
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Your profile could not be saved."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!loaded) {
    return <LoadingState label="Restoring your profile draft…" fullPage />;
  }

  const current = STEPS[step];
  const CurrentIcon = current.icon;
  const progress = ((step + 1) / STEPS.length) * 100;

  const stepContent = (() => {
    switch (step) {
      case 0:
        return (
          <div>
            <label htmlFor="profile-name" className="label text-base">
              What display name would you like to use?{" "}
              <span className="text-clay-600">*</span>
            </label>
            <p className="mb-4 text-sm leading-6 text-muted">
              This is the name people will see on your profile. Your issued username code remains fixed.
            </p>
            <input
              ref={nameRef}
              id="profile-name"
              className={`field text-lg font-semibold ${
                stepError ? "border-clay-500 ring-2 ring-clay-100" : ""
              }`}
              value={data.profileName}
              onChange={(event) =>
                updateData("profileName", event.target.value)
              }
              maxLength={LIMITS.profileName}
              placeholder="For example, Still Growing"
              required
              aria-invalid={Boolean(stepError)}
              aria-describedby={
                stepError
                  ? "wizard-step-error profile-name-count"
                  : "profile-name-count"
              }
            />
            <CharacterCount
              id="profile-name-count"
              value={data.profileName}
              limit={LIMITS.profileName}
            />
            <div className="mt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-sage-600">
                A few gentle ideas
              </p>
              <div className="flex flex-wrap gap-2">
                {PROFILE_NAME_IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    className={`chip ${
                      data.profileName === idea ? "chip-selected" : ""
                    }`}
                    onClick={() => updateData("profileName", idea)}
                  >
                    {data.profileName === idea && (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <ImageSymbolPicker
            imagePath={data.imagePath}
            committedImagePath={persistedImagePath}
            deferImageCleanup
            selectedSymbol={data.selectedSymbol}
            profileName={data.profileName}
            onChange={updateImageChoice}
          />
        );
      case 3:
        return (
          <TagEditor
            label="Who helps me lead closer to God?"
            values={data.spiritualGuides}
            onChange={(values) =>
              updateData("spiritualGuides", values)
            }
            placeholder="Add a person or guide"
          />
        );
      case 4:
        return (
          <TagEditor
            label="Who or what am I following in my life right now?"
            values={data.lifeDirections}
            onChange={(values) =>
              updateData("lifeDirections", values)
            }
            suggestions={FOLLOWING_IDEAS}
            placeholder="Add an influence"
          />
        );
      case 5:
        return (
          <fieldset>
            <legend className="label text-base">
              What moments in your life does God see, even when nobody else
              notices?
            </legend>
            <p className="mb-5 text-sm leading-6 text-muted">
              Add one or more quiet moments. These will become your first “Posts
              God Sees” and appear newest first.
            </p>
            <div className="space-y-4">
              {data.onboardingPosts.map((post, index) => (
                <div
                  key={index}
                  className="rounded-[var(--radius-base)] border border-sage-100 bg-sage-50/60 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">
                      Moment {index + 1}
                    </span>
                    {data.onboardingPosts.length > 1 && (
                      <button
                        type="button"
                        className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted hover:bg-white hover:text-clay-600"
                        onClick={() => {
                          updateData("onboardingPosts", data.onboardingPosts.filter(
                            (_item, itemIndex) => itemIndex !== index
                          ));
                          updateData("onboardingPostTitles", (data.onboardingPostTitles ?? []).filter(
                            (_item, itemIndex) => itemIndex !== index
                          ));
                        }}
                        aria-label={`Remove moment ${index + 1}`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <label htmlFor={`onboarding-title-${index}`} className="label">
                    Moment title
                  </label>
                  <input
                    id={`onboarding-title-${index}`}
                    className="field mb-3 bg-white"
                    value={data.onboardingPostTitles?.[index] ?? ""}
                    maxLength={LIMITS.momentTitle}
                    placeholder={`Moment ${index + 1}`}
                    onChange={(event) => {
                      const titles = [...(data.onboardingPostTitles ?? [])];
                      titles[index] = event.target.value;
                      updateData("onboardingPostTitles", titles);
                    }}
                  />
                  <CharacterCount
                    value={data.onboardingPostTitles?.[index] ?? ""}
                    limit={LIMITS.momentTitle}
                  />
                  <label htmlFor={`onboarding-post-${index}`} className="label mt-3">
                    Moment entry
                  </label>
                  <textarea
                    id={`onboarding-post-${index}`}
                    className="field min-h-28 resize-y bg-white"
                    value={post}
                    maxLength={LIMITS.post}
                    placeholder="A kindness, struggle, prayer, effort, or small act of courage…"
                    onChange={(event) => {
                      const posts = [...data.onboardingPosts];
                      posts[index] = event.target.value;
                      updateData("onboardingPosts", posts);
                    }}
                  />
                  <CharacterCount value={post} limit={LIMITS.post} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  updateData("onboardingPosts", [
                    ...data.onboardingPosts,
                    ""
                  ]);
                  updateData("onboardingPostTitles", [
                    ...(data.onboardingPostTitles ?? []),
                    ""
                  ]);
                }}
                disabled={data.onboardingPosts.length >= 20}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add another moment
              </button>
            </div>
          </fieldset>
        );
      case 6:
        return (
          <TagEditor
            label="What does your heart usually seek?"
            description="Choose any that feel true today. This is about awareness, not judging your desires."
            values={data.heartSeeks}
            onChange={(values) => updateData("heartSeeks", values)}
            suggestions={HEART_SEEKS_IDEAS}
            placeholder="Add something else your heart seeks"
          />
        );
      case 7:
        return (
          <div className="rounded-[var(--radius-card)] border border-clay-200 bg-clay-50 p-5 sm:p-6 dark:border-clay-600/40 dark:bg-clay-900/06">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-base)] bg-white text-clay-600 shadow-sm dark:text-clay-500">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-ink">Owner-only · Required</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Your Hidden Story is stored separately and never loaded into
                  the standard profile, journey, preview, or public view.
                </p>
              </div>
            </div>
            <label htmlFor="hidden-story" className="label text-base text-slate-900 dark:text-slate-300">
              What is something God knows about you that others may not see?
            </label>
            <textarea
              id="hidden-story"
              className="field min-h-48 resize-y border-gold-400 hover:border-gold-700 focus:border-gold-700 dark:border-gold-500/40 dark:hover:border-gold-600 transition-colors"
              value={data.hiddenStory}
              onChange={(event) =>
                updateData("hiddenStory", event.target.value)
              }
              maxLength={LIMITS.hiddenStory}
              placeholder="Share the private answer only you can access."
              aria-describedby="hidden-story-privacy hidden-story-count"
            />
            <p id="hidden-story-privacy" className="sr-only">
              This response is private and accessible only in your confirmed
              Private Reflections area.
            </p>
            <CharacterCount
              id="hidden-story-count"
              value={data.hiddenStory}
              limit={LIMITS.hiddenStory}
            />
          </div>
        );
      case 8:
        return (
          <div>
            <label htmlFor="gods-comment" className="label text-base">
              If God commented on your profile today, what do you believe He
              would want you to hear?
            </label>
            <p className="mb-4 text-sm leading-6 text-muted">
              Write a short message grounded in God’s mercy, truth, and love.
            </p>
            <div className="rounded-[var(--radius-card)] border border-gray-100 bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-700">
                <Sparkles className="size-4" aria-hidden="true" />
                A comment of grace
              </div>
              <textarea
                id="gods-comment"
                className="field min-h-36 resize-y border-gold-200"
                value={data.godsComment}
                onChange={(event) =>
                  updateData("godsComment", event.target.value)
                }
                maxLength={LIMITS.godsComment}
                placeholder="You are loved here, before you prove anything."
                aria-describedby="gods-comment-count"
              />
              <CharacterCount
                id="gods-comment-count"
                value={data.godsComment}
                limit={LIMITS.godsComment}
              />
            </div>
          </div>
        );
      case 9:
        return (
          <fieldset>
            <legend className="label text-base">
              Choose one Heavenly Hashtag
            </legend>
            <p className="mb-5 text-sm leading-6 text-muted">
              Let it name a grace, invitation, or truth you want to carry.
            </p>
            <div className="flex flex-wrap gap-2">
              {HASHTAG_IDEAS.map((hashtag) => (
                <button
                  key={hashtag}
                  type="button"
                  className={`chip ${
                    data.heavenlyHashtag === hashtag ? "chip-selected" : ""
                  }`}
                  aria-pressed={data.heavenlyHashtag === hashtag}
                  onClick={() => updateData("heavenlyHashtag", hashtag)}
                >
                  {data.heavenlyHashtag === hashtag && (
                    <Check className="size-4" aria-hidden="true" />
                  )}
                  {hashtag}
                </button>
              ))}
            </div>
            <label htmlFor="custom-hashtag" className="label mt-6">
              Or create your own
            </label>
            <input
              id="custom-hashtag"
              className="field"
              value={
                HASHTAG_IDEAS.includes(data.heavenlyHashtag)
                  ? ""
                  : data.heavenlyHashtag
              }
              onChange={(event) =>
                updateData(
                  "heavenlyHashtag",
                  normalizeHashtag(event.target.value)
                )
              }
              maxLength={LIMITS.hashtag}
              placeholder="#YourGraceForToday"
            />
          </fieldset>
        );
      default:
        return (
          <div>
            <div className="mb-6 flex flex-col items-center gap-4 rounded-[var(--radius-card)] bg-sage-50 p-6 text-center sm:flex-row sm:text-left">
              <ProfileAvatar
                imagePath={data.imagePath}
                symbol={data.selectedSymbol}
                profileName={data.profileName}
              />
              <div>
                <p className="eyebrow">Your profile before God</p>
                <h2 className="mt-1 font-serif text-3xl font-bold">
                  {data.profileName || "Profile name needed"}
                </h2>
                {data.heavenlyHashtag && (
                  <p className="mt-1 font-bold text-gold-700">
                    {data.heavenlyHashtag}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewSection title="Spiritual bio" step={2} onEdit={setStep}>
                {data.spiritualBio || <em>Not answered</em>}
              </ReviewSection>
              <ReviewSection
                title="Who helps me lead closer to God?"
                step={3}
                onEdit={setStep}
              >
                {data.spiritualGuides.length
                  ? data.spiritualGuides.join(" · ")
                  : <em>Not answered</em>}
              </ReviewSection>

              <ReviewSection
                title="Who or what am I following in my life right now?"
                step={4}
                onEdit={setStep}
              >
                {data.lifeDirections.length
                  ? data.lifeDirections.join(" · ")
                  : <em>Not answered</em>}
              </ReviewSection>
              <ReviewSection title="Likes" step={6} onEdit={setStep}>
                {data.heartSeeks.length ? data.heartSeeks.join(" · ") : <em>Not answered</em>}
              </ReviewSection>
              <ReviewSection title="Posts God Sees" step={5} onEdit={setStep}>
                {data.onboardingPosts.filter((post) => post.trim()).length ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {data.onboardingPosts
                      .filter((post) => post.trim())
                      .map((post, index) => (
                        <li key={index} className="user-content">
                          <strong className="text-ink">
                            {data.onboardingPostTitles?.[index] || `Moment ${index + 1}`}:
                          </strong>{" "}
                          {post}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <em>Not answered</em>
                )}
              </ReviewSection>
              <ReviewSection title="God’s Comment" step={8} onEdit={setStep}>
                {data.godsComment || <em>Not answered</em>}
              </ReviewSection>
              <ReviewSection title="Heavenly Hashtag" step={9} onEdit={setStep}>
                {data.heavenlyHashtag || <em>Not answered</em>}
              </ReviewSection>
              <ReviewSection
                title="Hidden Story"
                step={7}
                privateSection
                onEdit={setStep}
              >
                {data.hiddenStory || <em>Not answered</em>}
              </ReviewSection>
            </div>
            <div className="mt-5 rounded-[var(--radius-base)] border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-800 privacy-check dark:border-gold-500 dark:bg-gold-500/12">
              <strong className="text-red-800 privacy-check-strong">Privacy check:</strong> Your Hidden
              Story will not appear on the profile you are about to open. It is
              available only behind the Private Reflections confirmation.
            </div>
          </div>
        );
    }
  })();

  return (
    <div className="min-h-screen">
      <header className="border-b border-sage-100 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-10">
        <div className="grid gap-7 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
          <aside className="sticky top-8 self-start z-20">
            <div className="surface p-5">
              {restoredAt && (
                <div
                  className="mb-5 rounded-[var(--radius-base)] border border-sage-200 bg-sage-50 p-4 text-sm text-sage-800"
                  role="status"
                >
                  <p>
                    <strong>Welcome back.</strong> Your unfinished draft from {formatFriendlyDate(restoredAt, true)} was restored.
                  </p>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {`Step ${step + 1} of ${STEPS.length}`}
                  </p>
                  <div
                    className={`mt-2 flex items-center gap-2 text-xs font-semibold ${
                      saveStatus === "error" ? "text-clay-600" : "text-muted"
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {saveStatus === "saving" ? (
                      <LoaderCircle
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : saveStatus === "error" ? (
                      <CircleAlert className="size-3.5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2
                        className="size-3.5 text-sage-600"
                        aria-hidden="true"
                      />
                    )}
                    {saveStatus === "saving"
                      ? "Saving changes…"
                      : saveStatus === "error"
                        ? "Draft save failed"
                        : saveStatus === "saved"
                          ? "Draft saved automatically"
                          : "Ready to begin"}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-sage-600">
                  {Math.round(progress)}%
                </span>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full"
                role="progressbar"
                aria-label="Profile creation progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                style={{ backgroundColor: "#F9DBDB" }}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: "#8E1B1B",
                    boxShadow: "0 2px 6px rgba(142,27,27,0.2)"
                  }}
                />
              </div>
              <ol className="mt-5 hidden space-y-1 lg:block profile-wizard-sidebar">
                {STEPS.map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <li key={item.title}>
                      <button
                        type="button"
                        className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold transition ${
                          index === step
                            ? "bg-sage-700 text-white dark:bg-slate-800 dark:text-slate-200"
                            : index < step
                              ? "text-slate-600 dark:text-slate-400 hover:bg-sage-50 dark:hover:bg-slate-700"
                              : "text-slate-600 dark:text-slate-400 hover:bg-sage-50 dark:hover:bg-slate-700"
                        }`}
                        disabled
                        aria-current={index === step ? "step" : undefined}
                      >
                        <span
                          className={`grid size-6 place-items-center rounded-full ${
                            index < step
                              ? "bg-sage-100 text-sage-700 dark:bg-slate-700 dark:text-slate-300"
                              : index === step
                                ? "bg-white/15 dark:bg-slate-700"
                                : "bg-sage-50 dark:bg-slate-800"
                          }`}
                        >
                          {index < step ? (
                            <Check className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ItemIcon className="size-3.5" aria-hidden="true" />
                          )}
                        </span>
                        {item.short}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-sage-200 bg-paper px-3 text-[11px] font-bold text-sage-700 transition hover:bg-sage-50"
                  onClick={() => void persistDraft(true)}
                  disabled={saveStatus === "saving" || finishing}
                >
                  {saveStatus === "saving" ? (
                    <LoaderCircle
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save className="size-3.5" aria-hidden="true" />
                  )}
                  Save draft
                </button>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <section className="surface overflow-hidden review-surface">
              <div className="border-b border-sage-100 bg-gradient-to-r from-sage-50 to-gold-50/50 p-5 sm:p-8">
                <div className="mb-4 grid size-11 place-items-center rounded-[var(--radius-base)] bg-white text-sage-600 shadow-sm">
                  <CurrentIcon className="size-5" aria-hidden="true" />
                </div>
                <p className="eyebrow">
                  {`Step ${step + 1} of ${STEPS.length}`}
                </p>
                <h1
                  id="wizard-step-title"
                  tabIndex={-1}
                  className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl"
                >
                  {current.title}
                </h1>
              </div>
              <div className="p-5 sm:p-8">
                {error && (
                  <div
                    id="wizard-error"
                    className="warning-indicator mb-5 flex items-start gap-2 px-4 py-3 text-sm"
                    role="alert"
                  >
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}
                <div
                  ref={stepContentRef}
                  className={`rounded-[var(--radius-base)] p-4 step-content ${
                    stepError ? "border border-clay-300" : ""
                  }`}
                  aria-describedby={
                    stepError ? "wizard-step-error" : undefined
                  }
                >
                  {stepContent}
                </div>
                {stepError && (
                  <div
                    id="wizard-step-error"
                    className="warning-indicator mt-4 flex items-start gap-2 px-4 py-3 text-sm"
                    role="alert"
                  >
                    <CircleAlert
                      className="mt-0.5 size-4 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                    {stepError}
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 z-20 flex flex-col-reverse gap-3 border-t border-sage-100 bg-sage-50/95 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={previous}
                  disabled={step === 0 || finishing}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Previous
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={next}
                    disabled={finishing}
                  >
                    Next
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void complete()}
                    disabled={finishing}
                  >
                    {finishing ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    )}
                    {finishing ? "Creating your profile…" : "Create My Profile"}
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

    </div>
  );
}
