"use client";

import {
  useEffect,
  useState
} from "react";

import {
  Compass
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";

import { SocialReflectionCard } from "@/components/social/social-reflection-card";

import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

import { appService } from "@/lib/app-service";

import type {
  SocialFeedPost
} from "@/types";

export function DiscoverFeed() {
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
            .getDiscoverFeed(
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
            : "Discover could not be loaded."
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
      <LoadingState label="Discovering public reflections…" />
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
        icon={Compass}
        title="Nothing new to discover yet"
        description="Public reflections from people you do not follow will appear here."
      />
    );
  }

  return (
    <section
      aria-labelledby="discover-feed-title"
    >
      <div className="space-y-5">
        {posts.map((post) => (
          <SocialReflectionCard
            key={post.id}
            post={post}
            initialFollowing={false}
          />
        ))}
      </div>
    </section>
  );
}