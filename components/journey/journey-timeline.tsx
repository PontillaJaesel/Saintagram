"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookHeart,
  CalendarDays,
  Edit3,
  Image as ImageIcon,
  NotebookPen,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { appService } from "@/lib/app-service";
import { downloadFirebaseProfileImage, isLocalProfileImageSource } from "@/lib/profile-images";
import { formatFriendlyDate } from "@/lib/validation";
import type {
  ProfileImageHistoryEntry,
  PublicSpiritualProfile,
  ReflectionPost
} from "@/types";

interface JourneyItem {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "current-profile" | "profile" | "reflection" | "update" | "image";
  imagePath?: string;
  profile?: PublicSpiritualProfile;
}

function JourneyImagePreview({
  imagePath,
  profileName
}: {
  imagePath: string;
  profileName: string;
}) {
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
    <div className="mt-4 overflow-hidden rounded-3xl border border-sage-100 bg-paper p-3 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${profileName || "Saintagram"} profile picture history`}
        className="max-h-64 w-full rounded-2xl object-contain"
        loading="lazy"
      />
    </div>
  );
}

export function JourneyTimeline() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicSpiritualProfile | null>(null);
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
  const [imageHistory, setImageHistory] = useState<ProfileImageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
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

  const items = useMemo<JourneyItem[]>(() => {
    if (!profile) return [];
    const journey: JourneyItem[] = posts.map((post) => ({
      id: post.id,
      date: post.createdAt,
      title: post.title || "A moment God saw",
      description: post.content,
      type: "reflection"
    }));
    journey.push({
      id: "current-profile",
      date: profile.updatedAt,
      title: "Your current Profile Before God",
      description: "This is who you currently are in your spiritual journey.",
      type: "current-profile",
      imagePath: profile.imagePath,
      profile
    });
    imageHistory.forEach((entry) => {
      journey.push({
        id: entry.id,
        date: entry.createdAt,
        title: "Profile picture updated",
        description:
          "Your profile picture changed and this version remains in your journey.",
        type: "image",
        imagePath: entry.imagePath
      });
    });
    journey.push({
      id: "profile-created",
      date: profile.createdAt,
      title: "Profile Before God created",
      description: `${profile.profileName} began this private spiritual journey.`,
      type: "profile"
    });
    if (
      Math.abs(
        new Date(profile.updatedAt).getTime() -
          new Date(profile.createdAt).getTime()
      ) >
      60 * 1000
    ) {
      journey.push({
        id: "profile-updated",
        date: profile.updatedAt,
        title: "Profile reflection updated",
        description:
          "A name, bio, influence, guide, heart-seeking, or word of grace was revisited.",
        type: "update"
      });
    }
    return journey.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [imageHistory, posts, profile]);

  if (loading) return <LoadingState label="Tracing your journey…" />;

  if (error) {
    return (
      <div className="surface p-7 text-center" role="alert">
        <p className="font-bold text-clay-600">{error}</p>
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

  if (!items.length) {
    return (
      <EmptyState
        icon={BookHeart}
        title="Your journey is just beginning"
        description="Profile picture changes, profile updates, and non-private reflections will form a gentle timeline here."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="surface p-5 sm:p-8" aria-labelledby="timeline-title">
        <div className="mb-7">
          <p className="eyebrow">Grace over time</p>
          <h2 id="timeline-title" className="mt-2 font-serif text-2xl font-bold">
            Your spiritual timeline
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Your newest moments first.
          </p>
        </div>
        <ol className="relative ml-4 border-l-2 border-sage-100 pl-8">
          {items.map((item) => {
            const Icon =
            item.type === "reflection"
              ? Sparkles
              : item.type === "image"
                ? ImageIcon
                : item.type === "update"
                  ? Edit3
                  : item.type === "current-profile"
                    ? BookHeart
                    : BookHeart;
            return (
              <li key={item.id} className="relative pb-9 last:pb-0">
                <span
                  className={`absolute -left-[3rem] top-0 grid size-8 place-items-center rounded-full border-4 border-paper ${
                    item.type === "reflection"
                      ? "bg-sage-600 text-white"
                      : item.type === "update"
                        ? "bg-gold-100 text-gold-700"
                        : item.type === "current-profile"
                          ? "bg-violet-600 text-white"
                          : "bg-clay-50 text-clay-600"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <time
                  dateTime={item.date}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-600"
                >
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {formatFriendlyDate(item.date)}
                </time>
                <h3 className="mt-2 font-serif text-xl font-bold">{item.title}</h3>
                <p className="user-content mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">
                  {item.description}
                </p>
                {item.type === "current-profile" && item.profile && (
                <div className="mt-4 rounded-3xl border border-sage-100 bg-paper p-5 shadow-sm">
                  {item.imagePath && (
                    <JourneyImagePreview
                      imagePath={item.imagePath}
                      profileName={item.profile.profileName}
                    />
                  )}

                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-sage-600">
                      Profile name
                    </p>
                    <p className="mt-1 font-serif text-xl font-bold">
                      {item.profile.profileName}
                    </p>
                  </div>

                  {item.profile.spiritualBio && (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-sage-600">
                        Before God, I am
                      </p>
                      <p className="user-content mt-1 whitespace-pre-wrap text-sm leading-7 text-muted">
                        {item.profile.spiritualBio}
                      </p>
                    </div>
                  )}

                  {item.profile.heartSeeks.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-sage-600">
                        My heart seeks
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.profile.heartSeeks.map((value) => (
                          <span
                            key={value}
                            className="rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-sage-700"
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.profile.godsComment && (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-sage-600">
                        Word of grace
                      </p>
                      <p className="user-content mt-1 whitespace-pre-wrap text-sm italic leading-7 text-muted">
                        “{item.profile.godsComment}”
                      </p>
                    </div>
                  )}

                  {item.profile.heavenlyHashtag && (
                    <p className="mt-4 text-sm font-bold text-sage-600">
                      {item.profile.heavenlyHashtag}
                    </p>
                  )}
                </div>
              )}
                {item.type === "image" && item.imagePath && (
                  <JourneyImagePreview
                    imagePath={item.imagePath}
                    profileName={profile?.profileName ?? "Saintagram"}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <aside className="surface self-start p-5 lg:sticky lg:top-24">
        <div className="grid size-11 place-items-center rounded-2xl bg-sage-100 text-sage-700">
          <NotebookPen className="size-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-serif text-xl font-bold">Keep noticing.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          A journey grows through honest moments, not perfect consistency.
        </p>
      </aside>
    </div>
  );
}
