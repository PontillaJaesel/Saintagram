"use client";

import {
  useEffect,
  useState
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  UsersRound
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";

import { SocialReflectionCard } from "@/components/social/social-reflection-card";

import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

import { appService } from "@/lib/app-service";

import type {
  SocialFeedPost
} from "@/types";

export function FollowingFeed({
  onFindPeople
}: {
  onFindPeople?: () => void;
}) {
  const { user } = useAuth();

  const [posts, setPosts] =
    useState<SocialFeedPost[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

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
          await appService
            .getFollowingFeed(
              user.id
            );

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
          onClick={() =>
            window.location.reload()
          }
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
          onFindPeople ? (
            <button
              type="button"
              className="btn-primary"
              onClick={
                onFindPeople
              }
            >
              Find people to follow

              <ArrowRight
                className="size-4"
                aria-hidden="true"
              />
            </button>
          ) : (
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
          )
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="following-feed-title"
    >
      <div className="space-y-5">
        {posts.map((post) => (
          <SocialReflectionCard
            key={post.id}
            post={post}
            initialFollowing
          />
        ))}
      </div>
    </section>
  );
}
