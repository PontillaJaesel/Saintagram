"use client";

import {
  useEffect,
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
  EyeOff,
  Footprints,
  Heart,
  LockKeyhole,
  MessageCircleHeart,
  NotebookPen,
  Pencil,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ReflectionCard } from "@/components/reflections/reflection-card";
import { appService } from "@/lib/app-service";
import { formatFriendlyDate } from "@/lib/validation";
import type {
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

function ValueList({
  values,
  emptyText
}: {
  values: string[];
  emptyText: string;
}) {
  if (!values.length) {
    return <p className="text-sm italic text-muted">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li
          key={value}
          className="rounded-full bg-sage-50 px-3 py-2 text-xs font-bold text-sage-700"
        >
          {value}
        </li>
      ))}
    </ul>
  );
}

export function ProfileDashboard() {
  const { user, updateUser } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<PublicSpiritualProfile | null>(null);
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [privacyDialog, setPrivacyDialog] = useState(false);
  const [privateUnlocked, setPrivateUnlocked] = useState(false);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateStory, setPrivateStory] = useState("");
  const [privatePosts, setPrivatePosts] = useState<ReflectionPost[]>([]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const notified = useRef(false);

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
    return () => {
      unsubscribeProfile();
      unsubscribePosts();
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

  return (
    <div className="grid min-h-screen xl:grid-cols-[minmax(0,42rem)_minmax(19rem,1fr)]">
      <div className="min-w-0 border-r border-sage-100 bg-paper/55">
        <div className="sticky top-0 z-20 flex min-h-16 items-center border-b border-sage-100 bg-paper/85 px-5 backdrop-blur-xl">
          <div>
            <p className="text-base font-bold text-ink">{profile.profileName}</p>
            <p className="font-secondary text-xs text-muted">
              {posts.length} {posts.length === 1 ? "reflection" : "reflections"}
            </p>
          </div>
        </div>
        <section className="overflow-hidden border-b border-sage-100">
          <div
            className="h-36 sm:h-52"
            style={{ backgroundColor: profile.coverColor }}
            aria-hidden="true"
          />
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-12 flex items-end justify-between gap-4 sm:-mt-16">
              <div className="shrink-0">
                <ProfileAvatar
                  imagePath={profile.imagePath}
                  symbol={profile.selectedSymbol}
                  profileName={profile.profileName}
                />
              </div>
              <div className="pb-1">
                <Link href="/profile/edit" className="btn-secondary">
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit Profile
                </Link>
              </div>
            </div>

            <div className="mt-5 max-w-2xl">
              <p className="eyebrow">Profile before God</p>
              <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                {profile.profileName}
              </h1>
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

        <section className="overflow-hidden">
          <div
            className="relative grid grid-cols-3 border-b border-sage-100 p-1.5"
            role="tablist"
            aria-label="Profile sections"
          >
            <span
              className="profile-tab-indicator pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-xl"
              style={{
                width: "calc((100% - 0.75rem) / 3)",
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
                className={`relative z-10 flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-[11px] font-bold transition-colors duration-300 sm:flex-row sm:text-sm ${
                  tab === id
                    ? "profile-tab-selected"
                    : "text-muted hover:bg-sage-50 hover:text-ink"
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
                <div className="mb-5">
                  <div>
                    <h2 className="font-serif text-2xl font-bold">
                      Posts God Sees
                    </h2>
                    <p className="font-secondary mt-1 text-sm text-muted">
                      Quiet moments, newest first. No likes or public totals.
                    </p>
                  </div>
                </div>
                {posts.length ? (
                  <div className="space-y-3">
                    {posts.map((post) => (
                      <ReflectionCard
                        key={post.id}
                        post={post}
                        showPrivacy={false}
                        showDate={
                          user?.privacyPreferences?.showReflectionDates ?? true
                        }
                      />
                    ))}
                  </div>
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
                      </li>
                    ))}
                  <li className="relative">
                    <span className="absolute -left-[2.15rem] top-1 grid size-4 place-items-center rounded-full border-4 border-paper bg-gold-500" />
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
                  <div className="rounded-3xl border border-clay-200 bg-clay-50 p-6 text-center sm:p-8">
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-clay-600 shadow-sm">
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
                      onClick={() => setPrivacyDialog(true)}
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
                    <section className="rounded-3xl border border-clay-200 bg-clay-50 p-5">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-clay-600">
                        <EyeOff className="size-4" aria-hidden="true" />
                        Hidden Story
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">
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
                          <ReflectionCard key={post.id} post={post} />
                        ))
                      ) : (
                        <EmptyState
                          icon={LockKeyhole}
                          title="No private journal entries"
                          description="You can mark a new reflection private whenever it needs a quieter place."
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="hidden space-y-4 px-6 py-6 xl:block xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto xl:self-start">
        <label className="relative block">
          <span className="sr-only">Search your profile</span>
          <input
            type="search"
            className="field rounded-full bg-paper/80"
            placeholder="Search your reflections"
          />
        </label>
        <section className="surface p-5">
          <h2 className="flex items-center gap-2 font-serif text-xl font-bold">
            <MessageCircleHeart
              className="size-5 text-gold-600"
              aria-hidden="true"
            />
            God’s Comment
          </h2>
          <div className="mt-4 rounded-2xl bg-gold-50 p-4">
            <p className="font-secondary whitespace-pre-wrap text-sm leading-7 text-ink">
              {profile.godsComment || (
                <span className="italic text-muted">
                  This space is open for a word of grace.
                </span>
              )}
            </p>
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <UsersRound className="size-4 text-sage-600" aria-hidden="true" />
            Followers
          </h2>
          <div className="mt-3">
            <ValueList
              values={profile.followers}
              emptyText="No followers named yet."
            />
          </div>
          <div className="my-5 h-px bg-sage-100" />
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Footprints className="size-4 text-sage-600" aria-hidden="true" />
            Following
          </h2>
          <div className="mt-3">
            <ValueList
              values={profile.following}
              emptyText="Nothing followed yet."
            />
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Heart className="size-4 text-clay-600" aria-hidden="true" />
            Likes
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            What my heart usually seeks.
          </p>
          <div className="mt-3">
            <ValueList
              values={profile.heartSeeks}
              emptyText="This reflection is still open."
            />
          </div>
        </section>

        <p className="flex items-center gap-2 px-2 text-xs leading-5 text-muted">
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          Profile last updated {formatFriendlyDate(profile.updatedAt)}
        </p>
      </aside>

      <ConfirmDialog
        open={privacyDialog}
        title="Is this a private moment?"
        description="Private content may be sensitive. Confirm that you are in a place where only you can read the screen."
        confirmLabel="Open private reflections"
        onClose={() => setPrivacyDialog(false)}
        onConfirm={() => void unlockPrivate()}
      >
        <div className="flex items-start gap-3 rounded-2xl bg-clay-50 p-4 text-sm leading-6 text-muted">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-clay-600"
            aria-hidden="true"
          />
          This confirmation adds visual privacy. Your account ownership remains
          protected separately by database rules and storage policies.
        </div>
      </ConfirmDialog>
    </div>
  );
}
