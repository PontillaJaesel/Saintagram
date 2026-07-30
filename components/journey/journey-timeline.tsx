"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookHeart,
  CalendarDays,
  Edit3,
  NotebookPen,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { appService } from "@/lib/app-service";
import { formatFriendlyDate } from "@/lib/validation";
import type {
  PublicSpiritualProfile,
  ReflectionPost
} from "@/types";

interface JourneyItem {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "profile" | "reflection" | "update";
}

export function JourneyTimeline() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicSpiritualProfile | null>(null);
  const [posts, setPosts] = useState<ReflectionPost[]>([]);
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
    return () => {
      unsubscribeProfile();
      unsubscribePosts();
    };
  }, [user]);

  const items = useMemo<JourneyItem[]>(() => {
    if (!profile) return [];
    const journey: JourneyItem[] = posts.map((post) => ({
      id: post.id,
      date: post.createdAt,
      title: "A moment God saw",
      description: post.content,
      type: "reflection"
    }));
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
  }, [posts, profile]);

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
        description="Profile updates and non-private reflections will form a gentle timeline here."
        action={
          <Link href="/reflect" className="btn-primary">
            Add a reflection
          </Link>
        }
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
            Newest first. There are no streaks to protect and no missed days to
            make up.
          </p>
        </div>
        <ol className="relative ml-4 border-l-2 border-sage-100 pl-8">
          {items.map((item) => {
            const Icon =
              item.type === "reflection"
                ? Sparkles
                : item.type === "update"
                  ? Edit3
                  : BookHeart;
            return (
              <li key={item.id} className="relative pb-9 last:pb-0">
                <span
                  className={`absolute -left-[3rem] top-0 grid size-8 place-items-center rounded-full border-4 border-paper ${
                    item.type === "reflection"
                      ? "bg-sage-600 text-white"
                      : item.type === "update"
                        ? "bg-gold-100 text-gold-700"
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
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">
                  {item.description}
                </p>
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
        <Link href="/reflect" className="btn-primary mt-5 w-full">
          Add reflection
        </Link>
      </aside>
    </div>
  );
}
