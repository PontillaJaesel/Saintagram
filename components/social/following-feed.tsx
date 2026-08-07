"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookHeart, UsersRound } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { ReflectionCard } from "@/components/reflections/reflection-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { appService } from "@/lib/app-service";
import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

import type { SocialFeedPost } from "@/types";

function FeedAuthorAvatar({
  imagePath,
  profileName
}: {
  imagePath: string;
  profileName: string;
}) {
  const { loading, mode, user } = useAuth();

  const [src, setSrc] = useState(
    imagePath.startsWith("data:image/") ? imagePath : ""
  );

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
        if (active) {
          setSrc(downloadUrl);
        }
      })
      .catch(() => {
        if (active) {
          setSrc("");
        }
      });

    return () => {
      active = false;
    };
  }, [imagePath, loading, mode, user?.id]);

  if (src) {
    return (
      <div className="size-11 shrink-0 overflow-hidden rounded-full border border-sage-100 bg-sage-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${profileName} profile picture`}
          className="size-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  const initial =
    profileName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-100 font-serif text-lg font-bold text-sage-700"
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

export function FollowingFeed() {
  const { user } = useAuth();

  const [posts, setPosts] = useState<SocialFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadFeed = async () => {
      setLoading(true);
      setError("");

      try {
        const nextPosts =
          await appService.getFollowingFeed(user.id);

        if (!active) {
          return;
        }

        setPosts(nextPosts);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Your following feed could not be loaded."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadFeed();

    return () => {
      active = false;
    };
  }, [user]);

  if (loading) {
    return (
      <LoadingState label="Gathering reflections from people you follow…" />
    );
  }

  if (error) {
    return (
      <div
        className="surface p-7 text-center"
        role="alert"
      >
        <p className="font-bold text-clay-600">
          {error}
        </p>

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

  if (!posts.length) {
    return (
      <EmptyState
        icon={UsersRound}
        title="Your following feed is quiet"
        description="Follow people in the Saintagram community to see their public reflections here."
        action={
          <Link
            href="/community"
            className="btn-primary"
          >
            Find people to follow
            <ArrowRight
              className="size-4"
              aria-hidden="true"
            />
          </Link>
        }
      />
    );
  }

  return (
    <section aria-labelledby="following-feed-title">
      <div className="mb-6">
        <p className="eyebrow">
          Shared by your community
        </p>

        <h2
          id="following-feed-title"
          className="mt-1 font-serif text-2xl font-bold sm:text-3xl"
        >
          Reflections from people you follow
        </h2>

        <p className="mt-2 text-sm leading-6 text-muted">
          Public reflections only, newest first.
        </p>
      </div>

      <div className="space-y-5">
        {posts.map((post) => (
          <article
            key={post.id}
            className="space-y-3"
          >
            <div className="surface flex items-center justify-between gap-4 px-5 py-4">
              <Link
                href={`/users/${post.author.userId}`}
                className="group flex min-w-0 items-center gap-3"
              >
                <FeedAuthorAvatar
                  imagePath={post.author.imagePath}
                  profileName={post.author.profileName}
                />

                <div className="min-w-0">
                  <p className="truncate font-serif text-base font-bold text-ink transition group-hover:text-sage-700">
                    {post.author.profileName}
                  </p>

                  {post.author.heavenlyHashtag && (
                    <p className="truncate text-xs font-semibold text-sage-600">
                      {post.author.heavenlyHashtag}
                    </p>
                  )}
                </div>
              </Link>

              <Link
                href={`/users/${post.author.userId}`}
                className="btn-quiet shrink-0"
                aria-label={`View ${post.author.profileName}'s profile`}
              >
                View profile
                <ArrowRight
                  className="size-4"
                  aria-hidden="true"
                />
              </Link>
            </div>

            <ReflectionCard
              post={post}
              showPrivacy={false}
              showActions={false}
            />
          </article>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/community"
          className="btn-secondary"
        >
          <BookHeart
            className="size-4"
            aria-hidden="true"
          />
          Discover more people
        </Link>
      </div>
    </section>
  );
}