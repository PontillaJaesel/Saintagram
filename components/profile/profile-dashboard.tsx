"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookHeart,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  EyeOff,
  Footprints,
  Heart,
  LockKeyhole,
  MessageCircleHeart,
  NotebookPen,
  Pencil,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  UsersRound
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ReflectionCard } from "@/components/reflections/reflection-card";
import { SocialReflectionCard } from "@/components/social/social-reflection-card";
import { FiatProfileControls } from "@/components/fiat/fiat-profile-controls";
import { fiatCategoryLabel } from "@/lib/fiat";
import { appService } from "@/lib/app-service";
import { downloadFirebaseProfileImage, isLocalProfileImageSource } from "@/lib/profile-images";
import { formatFriendlyDate } from "@/lib/validation";
import type {
  ProfileImageHistoryEntry,
  PublicSpiritualProfile,
  ReflectionPost
} from "@/types";

type ProfileTab = "posts" | "journey" | "private";

const TABS: Array<{
  id: ProfileTab;
  label: string;
  icon: typeof NotebookPen;
}> = [
  { id: "posts", label: "Posts God Sees", icon: NotebookPen },
  { id: "journey", label: "Spiritual Journey", icon: Footprints },
  { id: "private", label: "Private Reflections", icon: LockKeyhole }
];

function shortDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function ValueList({
  values,
  emptyText
}: {
  values: string[];
  emptyText: string;
}) {
  if (!values.length) {
    return (
      <p className="rounded-[var(--radius-base)] border border-dashed border-sage-200 bg-sage-50/60 px-3 py-3 text-sm italic text-muted">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {values.map((value) => (
        <li
          key={value}
          className="rounded-[var(--radius-base)] border border-sage-200 bg-sage-50/80 px-3 py-2 text-xs font-semibold text-sage-700"
        >
          {value}
        </li>
      ))}
    </ul>
  );
}

function JourneyImagePreview({ imagePath }: { imagePath: string }) {
  const { loading, mode, user } = useAuth();
  const [src, setSrc] = useState(imagePath.startsWith("data:image/") ? imagePath : "");

  useEffect(() => {
    let active = true;
    if (!imagePath) {
      setSrc("");
      return () => undefined;
    }
    if (isLocalProfileImageSource(imagePath)) {
      setSrc(mode === "local" ? imagePath : "");
      return () => undefined;
    }
    if (loading || !user) {
      setSrc("");
      return () => undefined;
    }

    void downloadFirebaseProfileImage(imagePath)
      .then((downloadUrl) => {
        if (active) setSrc(downloadUrl);
      })
      .catch(() => {
        if (active) setSrc("");
      });

    return () => {
      active = false;
    };
  }, [imagePath, loading, mode, user?.id]);

  if (!src) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-sage-100 bg-paper p-2 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Profile picture history"
        className="max-h-48 w-full rounded-xl object-contain"
        loading="lazy"
      />
    </div>
  );
}

export function ProfileDashboard() {
  const { user, updateUser } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<PublicSpiritualProfile | null>(null);
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
  const [imageHistory, setImageHistory] = useState<ProfileImageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [draftDateStart, setDraftDateStart] = useState("");
  const [draftDateEnd, setDraftDateEnd] = useState("");
  const [datePreset, setDatePreset] = useState<"week" | "month" | "year" | "custom">("custom");
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [privacyDialog, setPrivacyDialog] = useState(false);
  const [privateUnlocked, setPrivateUnlocked] = useState(false);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateStory, setPrivateStory] = useState("");
  const [privatePosts, setPrivatePosts] = useState<ReflectionPost[]>([]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const filterDetailsRefs = useRef<Record<string, HTMLDetailsElement | null>>({});
  const notified = useRef(false);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const start = dateStart
      ? new Date(`${dateStart}T00:00:00`).getTime()
      : null;
    const end = dateEnd ? new Date(`${dateEnd}T23:59:59.999`).getTime() : null;

    return posts.filter((post) => {
      const matchesText =
        !normalizedQuery ||
        `${post.title ?? ""} ${post.content}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      const createdAt = new Date(post.createdAt).getTime();
      const matchesDate =
        !Number.isNaN(createdAt) &&
        (start === null || createdAt >= start) &&
        (end === null || createdAt <= end);
      return matchesText && matchesDate;
    });
  }, [dateEnd, dateStart, posts, searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
  };

  const clearSearchAndFilter = () => {
    clearSearch();
    setDateStart("");
    setDateEnd("");
    setDraftDateStart("");
    setDraftDateEnd("");
  };

  const dateFilterLabel = dateStart && dateEnd
    ? `${shortDate(dateStart)} – ${shortDate(dateEnd)}`
    : dateStart
      ? `From ${shortDate(dateStart)}`
      : dateEnd
        ? `Until ${shortDate(dateEnd)}`
        : "Date";

  const choosePreset = (preset: "week" | "month" | "year") => {
    const today = new Date();
    let start: Date;
    let end: Date;
    if (preset === "week") {
      const currentWeekStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - today.getDay()
      );
      end = new Date(currentWeekStart);
      end.setDate(currentWeekStart.getDate() - 1);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
    } else if (preset === "month") {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
    }
    setDatePreset(preset);
    setDraftDateStart(dateInputValue(start));
    setDraftDateEnd(dateInputValue(end));
    setCalendarMonth(new Date(end.getFullYear(), end.getMonth(), 1));
  };

  const chooseCalendarDate = (date: Date) => {
    const value = dateInputValue(date);
    setDatePreset("custom");
    if (!draftDateStart || draftDateEnd) {
      setDraftDateStart(value);
      setDraftDateEnd("");
    } else if (value < draftDateStart) {
      setDraftDateEnd(draftDateStart);
      setDraftDateStart(value);
    } else {
      setDraftDateEnd(value);
    }
  };

  const applyDateFilter = () => {
    setDateStart(draftDateStart);
    setDateEnd(draftDateEnd || draftDateStart);
    setTab("posts");
    Object.values(filterDetailsRefs.current).forEach((details) => {
      if (details?.open) details.open = false;
    });
  };

  const calendarDays = calendarCells(calendarMonth);

  const searchControls = (idSuffix: string) => (
    <div
      className="relative"
      role="search"
    >
      <label htmlFor={`profile-search-${idSuffix}`} className="sr-only">
        Search your posted reflections
      </label>
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1 rounded-md border-2 border-gray-300 bg-paper/75 shadow-sm transition focus-within:border-gray-400 focus-within:bg-paper focus-within:ring-2 focus-within:ring-gray-200">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id={`profile-search-${idSuffix}`}
            type="search"
            className="min-h-11 w-full bg-transparent py-2 pl-11 pr-11 text-sm text-ink placeholder:text-muted focus:outline-none"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setTab("posts");
            }}
            placeholder="Search reflections…"
          />
          {(searchQuery || dateStart || dateEnd) && (
            <button
              type="button"
              className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-sage-100 hover:text-ink"
              onClick={clearSearchAndFilter}
              aria-label="Clear search and date filter"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <details
          ref={(node) => {
            filterDetailsRefs.current[idSuffix] = node;
          }}
          className="group relative shrink-0"
        >
          <summary
            className={`relative grid size-11 cursor-pointer list-none place-items-center rounded-md transition hover:bg-sage-100 focus-visible:ring-2 [&::-webkit-details-marker]:hidden ${
              dateStart || dateEnd ? "text-sage-700" : "text-muted"
            }`}
            aria-label={`Filter reflections by date. ${dateFilterLabel}`}
          >
            <SlidersHorizontal className="size-7" strokeWidth={1.8} aria-hidden="true" />
            {(dateStart || dateEnd) && (
              <span className="absolute right-0.5 top-0.5 size-2.5 rounded-full border-2 border-paper bg-sage-500" aria-hidden="true" />
            )}
          </summary>
          <div
            className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto rounded-[var(--radius-base)] border border-sage-100 bg-paper shadow-lift sm:grid sm:grid-cols-[8.5rem_1fr]"
          >
            <div className="flex flex-col border-b border-sage-100 p-3 sm:border-b-0 sm:border-r">
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-1">
                {([['week', 'Last Week'], ['month', 'Last Month'], ['year', 'Last Year'], ['custom', 'Custom']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-lg px-3 py-2 text-left text-sm transition ${datePreset === value ? "bg-sage-100 font-semibold text-ink" : "text-muted hover:bg-sage-50 hover:text-ink"}`}
                    onClick={() => value === "custom" ? setDatePreset("custom") : choosePreset(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-primary mt-3 min-h-10 rounded-lg px-4 sm:mt-auto" onClick={applyDateFilter}>
                Apply
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <button type="button" className="grid size-9 place-items-center rounded-full text-muted hover:bg-sage-100 hover:text-ink" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Previous month">
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <p className="text-sm font-semibold text-ink">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarMonth)}</p>
                <button type="button" className="grid size-9 place-items-center rounded-full text-muted hover:bg-sage-100 hover:text-ink" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Next month">
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-muted" aria-hidden="true">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="py-2">{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1" aria-label="Choose a date range">
                {calendarDays.map((date) => {
                  const value = dateInputValue(date);
                  const inMonth = date.getMonth() === calendarMonth.getMonth();
                  const selected = value === draftDateStart || value === draftDateEnd;
                  const inRange = Boolean(draftDateStart && draftDateEnd && value > draftDateStart && value < draftDateEnd);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`min-h-9 text-xs transition ${selected ? "rounded-lg bg-sage-600 font-bold text-paper" : inRange ? "bg-sage-100 text-ink" : inMonth ? "rounded-lg text-ink hover:bg-sage-50" : "rounded-lg text-muted/45 hover:bg-sage-50"}`}
                      onClick={() => chooseCalendarDate(date)}
                      aria-label={shortDate(value)}
                      aria-pressed={selected}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 min-h-5 text-center text-xs text-muted">
                {draftDateStart ? `${shortDate(draftDateStart)}${draftDateEnd ? ` – ${shortDate(draftDateEnd)}` : " – Select end date"}` : "Select a start date"}
              </p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let profileReady = false;
    let postsReady = false;
    const ready = () => {
      if (profileReady && postsReady) setLoading(false);
    };
    const fail = (message: string) => {
      setError(message);
      setLoading(false);
    };
    const unsubscribeProfile = appService.subscribeProfile(
      user.id,
      (nextProfile) => {
        setProfile(nextProfile);
        setError("");
        profileReady = true;
        ready();
      },
      fail
    );
    const unsubscribePosts = appService.subscribeReflections(
      user.id,
      "public",
      (nextPosts) => {
        setPosts(nextPosts);
        postsReady = true;
        ready();
      },
      fail
    );
    const unsubscribeImageHistory = appService.subscribeProfileImageHistory(
      user.id,
      (nextHistory) => {
        setImageHistory(nextHistory);
      },
      fail
    );
    return () => {
      unsubscribeProfile();
      unsubscribePosts();
      unsubscribeImageHistory();
    };
  }, [user]);

  useEffect(() => {
    if (notified.current) return;
    if (searchParams.get("created") === "1") {
      notified.current = true;
      notify("Your Profile Before God is ready.");
    } else if (searchParams.get("saved") === "1") {
      notified.current = true;
      notify("Your profile changes were saved.");
    }
  }, [notify, searchParams]);

  useEffect(() => {
    const closeFilters = (event: PointerEvent) => {
      Object.values(filterDetailsRefs.current).forEach((details) => {
        if (details?.open && !details.contains(event.target as Node)) {
          details.open = false;
        }
      });
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      Object.values(filterDetailsRefs.current).forEach((details) => {
        if (details?.open) details.open = false;
      });
    };
    document.addEventListener("pointerdown", closeFilters);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFilters);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const chooseTab = (nextTab: ProfileTab) => {
    setTab(nextTab);
    if (nextTab !== "private") {
      setPrivateUnlocked(false);
      setPrivateStory("");
      setPrivatePosts([]);
    }
  };

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }
    chooseTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const unlockPrivate = async () => {
    if (!user) return;
    setPrivacyDialog(false);
    setPrivateLoading(true);
    try {
      const [story, reflections] = await Promise.all([
        appService.getPrivateStory(user.id),
        appService.getPrivateReflections(user.id)
      ]);
      setPrivateStory(story);
      setPrivatePosts(reflections);
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

  if (loading) return <LoadingState label="Gathering your profile…" />;

  if (error) {
    return (
      <div className="surface p-7 text-center" role="alert">
        <p className="warning-indicator rounded-xl px-4 py-3">{error}</p>
        <button
          type="button"
          className="btn-secondary mt-5"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!profile) {
    const repairProfile = async () => {
      try {
        await updateUser({ profileCompleted: false });
        router.replace("/create");
      } catch (repairError) {
        notify(
          repairError instanceof Error
            ? repairError.message
            : "Profile creation could not be reopened.",
          "error"
        );
      }
    };
    return (
      <EmptyState
        icon={BookHeart}
        title="Your profile is waiting to be completed"
        description="Continue the guided reflection to create your Profile Before God."
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => void repairProfile()}
          >
            Continue profile
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        }
      />
    );
  }

  const profileInsights = (
    <>
      <section className="profile-insight-card surface p-5">
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
          <MessageCircleHeart className="size-5 text-gold-600" aria-hidden="true" />
          God’s Comment
        </h2>
        <div className="profile-insight-value mt-4 rounded-2xl bg-white p-4">
          <p className="user-content font-secondary whitespace-pre-wrap text-sm leading-7 text-ink">
            {profile.godsComment || <span className="italic text-muted">This space is open for a word of grace.</span>}
          </p>
        </div>
      </section>
      <section className="profile-insight-card surface p-5">
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
          <UsersRound
            className="size-5 text-sage-600"
            aria-hidden="true"
          />
          Who helps me lead closer to God
        </h2>

        <div className="mt-3">
          <ValueList
            values={profile.spiritualGuides}
            emptyText="No one has been added yet."
          />
        </div>

      </section>
      <section className="profile-insight-card surface p-5">
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
          <Footprints
            className="size-5 text-sage-600"
            aria-hidden="true"
          />
          Who or what am I following in my life right now?
        </h2>

        <div className="mt-3">
          <ValueList
            values={profile.lifeDirections}
            emptyText="Nothing has been added yet."
          />
        </div>
      </section>
      <section className="profile-insight-card surface p-5">
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
          <Heart className="size-5 text-clay-600" aria-hidden="true" />
          Likes
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">What my heart usually seeks.</p>
        <div className="mt-3"><ValueList values={profile.heartSeeks} emptyText="This reflection is still open." /></div>
      </section>
      <p className="flex items-center gap-2 px-2 text-xs leading-5 text-muted">
        <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
        Profile last updated {formatFriendlyDate(profile.updatedAt)}
      </p>
    </>
  );

  return (
    <div className="profile-dashboard grid min-h-screen pb-6 sm:pb-8 xl:grid-cols-[minmax(0,42rem)_minmax(19rem,1fr)]">
      <div className="profile-main-column min-w-0 border-r border-sage-100 bg-paper/55">
        <div className="profile-header-bar sticky top-0 z-20 flex min-h-16 items-center border-b border-sage-100 bg-paper/85 px-5 backdrop-blur-xl">
          <div>
            <p className="text-base font-bold text-ink">{profile.profileName}</p>
            <p className="font-secondary text-xs text-muted">
              {posts.length} {posts.length === 1 ? "reflection" : "reflections"}
            </p>
          </div>
          <FiatProfileControls />
        </div>
        <section className="profile-hero border-b border-sage-100">
          <div
            className="profile-cover h-36 sm:h-52"
            style={{ backgroundColor: profile.coverColor ?? "#DDD2F6" }}
            aria-hidden="true"
          />
          <div className="relative z-10 px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-12 flex items-end justify-between gap-4 sm:-mt-16">
              <div className="relative z-20 shrink-0">
                <ProfileAvatar
                  imagePath={profile.imagePath}
                  symbol={profile.selectedSymbol}
                  profileName={profile.profileName}
                />
              </div>

              <Link
                href="/profile/edit"
                className="profile-edit-button btn-secondary -mb-3 shrink-0 px-3 py-1.5 text-sm sm:-mb-3 sm:px-4 sm:py-2 sm:text-base"
              >
                <Pencil className="size-3.5 sm:size-4" aria-hidden="true" />
                Edit Profile
              </Link>
            </div>

            <div className="mt-4 max-w-2xl">
              <div className="min-w-0">
                <p className="eyebrow">Profile before God</p>

                <h1 className="mt-1 truncate font-serif text-2xl font-bold tracking-tight sm:text-4xl">
                  {profile.profileName}
                </h1>
              </div>
              {profile.heavenlyHashtag && (
                <p className="mt-1 font-bold text-gold-700">
                  {profile.heavenlyHashtag}
                </p>
              )}
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-sage-600">
                Before God, I am someone who…
              </p>
              <p className="font-secondary mt-2 whitespace-pre-wrap text-base leading-7 text-ink">
                {profile.spiritualBio || (
                  <span className="italic text-muted">
                    This reflection is still open.
                  </span>
                )}
              </p>
              <p className="font-secondary mt-4 flex items-center gap-2 text-sm text-muted">
                <CalendarDays className="size-4" aria-hidden="true" />
                Joined {formatFriendlyDate(profile.createdAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-visible">
          <div
            className="profile-tabs sticky top-0 z-20 grid grid-cols-3 border-b border-sage-100 bg-paper/95 backdrop-blur-xl"
            role="tablist"
            aria-label="Profile sections"
          >
            <span
              className="profile-tab-indicator pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-t-full"
              style={{
                width: "calc(100% / 3)",
                transform: `translateX(${TABS.findIndex(({ id }) => id === tab) * 100}%)`
              }}
              aria-hidden="true"
            />
            {TABS.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`tab-${id}`}
                type="button"
                role="tab"
                tabIndex={tab === id ? 0 : -1}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className={`relative z-10 flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-2 text-center text-[11px] font-medium transition-colors duration-150 sm:flex-row sm:text-sm ${
                  tab === id
                    ? "profile-tab-selected"
                    : "text-muted hover:text-ink"
                }`}
                onClick={() => chooseTab(id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <div
            id={`panel-${tab}`}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`tab-${tab}`}
            className="p-5 sm:p-7"
          >
            {tab === "posts" && (
              <div>
                <div className="mb-5 xl:hidden">{searchControls("mobile")}</div>
                {(searchQuery || dateStart || dateEnd) && (
                  <p className="font-secondary mb-4 text-sm text-muted" role="status" aria-live="polite">
                    {filteredPosts.length} {filteredPosts.length === 1 ? "reflection" : "reflections"} found
                    {searchQuery ? ` for “${searchQuery}”` : ""}.
                  </p>
                )}
                {filteredPosts.length ? (
                  <div className="profile-scroll max-h-[min(60vh,42rem)] space-y-3 overflow-y-auto overscroll-contain pr-2" tabIndex={0} aria-label="Reflection search results">
                    {filteredPosts.map((post) => (
                      <SocialReflectionCard
                        key={post.id}
                        post={{
                          ...post,
                          author: {
                            id: profile.id,
                            userId: profile.userId,
                            profileName:
                              profile.profileName,
                            imagePath:
                              profile.imagePath,
                            spiritualBio:
                              profile.spiritualBio,
                            heavenlyHashtag:
                              profile.heavenlyHashtag,
                            createdAt:
                              profile.createdAt,
                            updatedAt:
                              profile.updatedAt
                          }
                        }}
                        initialFollowing={false}
                      />
                    ))}
                  </div>
                ) : posts.length ? (
                  <EmptyState
                    icon={Search}
                    title="No reflections match"
                    description="Try another search phrase or widen the date filter."
                    action={
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          clearSearchAndFilter();
                        }}
                      >
                        Clear search and filter
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={NotebookPen}
                    title="No quiet moments here yet"
                    description="When you are ready, name one small moment God saw—even if nobody else noticed."
                  />
                )}
              </div>
            )}

            {tab === "journey" && (
              <div>
                <div className="mb-6">
                  <h2 className="font-serif text-2xl font-bold">
                    Spiritual Journey
                  </h2>
                    <p className="font-secondary mt-1 text-sm text-muted">
                    A gentle timeline of growth—not a streak to maintain.
                  </p>
                </div>
                <ol className="relative ml-3 border-l border-sage-200 pl-7">
                  {[...imageHistory]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((entry) => (
                      <li key={entry.id} className="relative pb-7 last:pb-0">
                                              <span className="absolute -left-[2.15rem] top-1 grid size-4 place-items-center rounded-full border-4 border-paper bg-gray-300" />
                        <time
                          dateTime={entry.createdAt}
                          className="text-xs font-bold uppercase tracking-wider text-gold-700"
                        >
                          {formatFriendlyDate(entry.createdAt)}
                        </time>
                        <p className="font-secondary mt-2 text-sm font-semibold leading-6 text-ink">
                          Profile picture updated
                        </p>
                        <JourneyImagePreview imagePath={entry.imagePath} />
                      </li>
                    ))}
                  {[...posts]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((post) => (
                      <li key={post.id} className="relative pb-7 last:pb-0">
                        <span className="absolute -left-[2.15rem] top-1 grid size-4 place-items-center rounded-full border-4 border-paper bg-sage-600" />
                        <time
                          dateTime={post.createdAt}
                          className="text-xs font-bold uppercase tracking-wider text-sage-600"
                        >
                          {formatFriendlyDate(post.createdAt)}
                        </time>
                        <p className="font-secondary mt-2 text-sm leading-6 text-ink">
                          {post.content}
                        </p>
                        {post.fiatCategory && <span className="mt-2 inline-flex rounded-full bg-gold-50 px-2.5 py-1 text-xs font-bold text-gold-700">Fi@ · {fiatCategoryLabel(post.fiatCategory)}</span>}
                      </li>
                    ))}
                  <li className="relative">
                                      <span className="absolute -left-[2.15rem] top-1 grid size-4 place-items-center rounded-full border-4 border-paper bg-gray-300" />
                    <time
                      dateTime={profile.createdAt}
                      className="text-xs font-bold uppercase tracking-wider text-gold-700"
                    >
                      {formatFriendlyDate(profile.createdAt)}
                    </time>
                    <p className="mt-2 text-sm font-bold text-ink">
                      Created a Profile Before God
                    </p>
                  </li>
                </ol>
                <Link href="/journey" className="btn-quiet mt-6">
                  Open full journey
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            )}

            {tab === "private" && (
              <div>
                {!privateUnlocked && !privateLoading && (
                  <div className="rounded-[var(--radius-card)] border border-clay-200 bg-clay-50 p-6 text-center sm:p-8">
                    <div className="mx-auto grid size-14 place-items-center rounded-[var(--radius-base)] bg-white text-clay-600 shadow-sm">
                      <LockKeyhole className="size-6" aria-hidden="true" />
                    </div>
                    <h2 className="mt-5 font-serif text-2xl font-bold">
                      A more private space
                    </h2>
                    <p className="font-secondary mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                      Hidden Stories and private journal entries are not loaded
                      until you confirm that it is safe to view them.
                    </p>
                    <button
                      type="button"
                      className="btn-primary mt-5"
                      onClick={() => {
                        if (
                          user?.privacyPreferences?.requirePrivateCheck ?? true
                        ) {
                          setPrivacyDialog(true);
                        } else {
                          void unlockPrivate();
                        }
                      }}
                    >
                      <ShieldCheck className="size-4" aria-hidden="true" />
                      Privacy check
                    </button>
                  </div>
                )}
                {privateLoading && (
                  <LoadingState label="Opening your private reflections…" />
                )}
                {privateUnlocked && (
                  <div>
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-serif text-2xl font-bold">
                          Private Reflections
                        </h2>
                        <p className="font-secondary mt-1 text-sm text-muted">
                          Visible only in this confirmed owner view.
                        </p>
                      </div>
                      <ShieldCheck
                        className="size-6 shrink-0 text-clay-600"
                        aria-hidden="true"
                      />
                    </div>
                    <section className="rounded-[var(--radius-card)] border border-clay-200 bg-clay-50 p-5">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-clay-600">
                        <EyeOff className="size-4" aria-hidden="true" />
                        Hidden Story
                      </p>
                      <p className="user-content mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">
                        {privateStory || (
                          <span className="italic text-muted">
                            You chose not to add a Hidden Story.
                          </span>
                        )}
                      </p>
                    </section>
                    <div className="mt-5 space-y-3">
                      {privatePosts.length ? (
                        privatePosts.map((post) => (
                          <ReflectionCard
                            key={post.id}
                            post={post}
                            showDate={
                              user?.privacyPreferences?.showReflectionDates ??
                              true
                            }
                          />
                        ))
                      ) : (
                        <EmptyState
                          icon={LockKeyhole}
                          title={
                            privateStory
                              ? "No additional private journal entries"
                              : "No private journal entries yet"
                          }
                          description={
                            privateStory
                              ? "Your Hidden Story is saved above. Add another private entry whenever you need more room."
                              : "Add a private reflection whenever it needs a quieter place."
                          }
                        />
                      )}
                    </div>
                    <Link href="/reflect" className="btn-primary mt-5">
                      <NotebookPen className="size-4" aria-hidden="true" />
                      Add another private journal entry
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        <aside className="grid gap-4 border-t border-sage-100 p-5 sm:grid-cols-2 sm:p-7 xl:hidden" aria-label="Profile details">
          {profileInsights}
        </aside>
      </div>

      <aside className="profile-insights-column relative hidden px-6 py-6 xl:block xl:sticky xl:top-0 xl:h-screen xl:overflow-visible xl:self-start">
        {searchControls("desktop")}
        <div className="profile-scroll mt-4 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto pr-1">
          {profileInsights}
        </div>
      </aside>

      <ConfirmDialog
        open={privacyDialog}
        title="Is this a private moment?"
        description="Make sure only you can see your screen."
        confirmLabel="Open private reflections"
        headerIcon={
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-sage-100 bg-sage-50 text-sage-700 shadow-sm">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
        }
        onClose={() => setPrivacyDialog(false)}
        onConfirm={() => void unlockPrivate()}
      />
    </div>
  );
}
