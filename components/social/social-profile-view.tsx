"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookHeart,
  Hash,
  UserRound
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { FollowButton } from "@/components/social/follow-button";
import { SocialReflectionCard } from "@/components/social/social-reflection-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

import { appService } from "@/lib/app-service";
import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

import type {
  ReflectionPost,
  SocialProfile
} from "@/types";

function SocialProfileAvatar({
  imagePath,
  profileName
}: {
  imagePath: string;
  profileName: string;
}) {
  const { loading, mode, user } = useAuth();

  const [src, setSrc] = useState(
    imagePath.startsWith("data:image/")
      ? imagePath
      : ""
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
      <div className="size-24 shrink-0 overflow-hidden rounded-full border-4 border-paper bg-sage-50 shadow-sm sm:size-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${profileName} profile picture`}
          className="size-full object-cover"
        />
      </div>
    );
  }

  const initial =
    profileName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="grid size-24 shrink-0 place-items-center rounded-full border-4 border-paper bg-sage-100 font-serif text-3xl font-bold text-sage-700 shadow-sm sm:size-28"
      aria-label={`${profileName} profile picture`}
    >
      {initial}
    </div>
  );
}

export function SocialProfileView({
  userId
}: {
  userId: string;
}) {
  const { user } = useAuth();

  const [profile, setProfile] =
    useState<SocialProfile | null>(null);

  const [posts, setPosts] =
    useState<ReflectionPost[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !userId) {
      return;
    }

    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      setNotFound(false);

      try {
        const [nextProfile, nextPosts] =
          await Promise.all([
            appService.getSocialProfile(userId),
            appService.getPublicReflectionsByUser(userId)
          ]);

        if (!active) {
          return;
        }

        if (!nextProfile) {
          setProfile(null);
          setPosts([]);
          setNotFound(true);
          return;
        }

        setProfile(nextProfile);
        setPosts(nextPosts);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "This profile could not be loaded."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user, userId]);

  if (loading) {
    return (
      <LoadingState label="Opening this profile…" />
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

  if (notFound || !profile) {
    return (
      <EmptyState
        icon={UserRound}
        title="Profile not found"
        description="This Saintagram profile may no longer be available."
        action={
          <Link
            href="/community"
            className="btn-secondary"
          >
            <ArrowLeft
              className="size-4"
              aria-hidden="true"
            />
            Back to community
          </Link>
        }
      />
    );
  }

  const isOwnProfile = user?.id === profile.userId;

  return (
    <div className="space-y-6">
      <Link
        href="/community"
        className="btn-quiet inline-flex"
      >
        <ArrowLeft
          className="size-4"
          aria-hidden="true"
        />
        Community
      </Link>

      <section className="surface overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-sage-100 via-gold-50 to-sage-50 sm:h-36" />

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <SocialProfileAvatar
                imagePath={profile.imagePath}
                profileName={profile.profileName}
              />

              <div className="min-w-0 pb-1">
                <h1 className="break-words font-serif text-3xl font-bold text-ink sm:text-4xl">
                  {profile.profileName}
                </h1>

                {profile.heavenlyHashtag && (
                  <p className="mt-1 flex items-center gap-1 text-sm font-bold text-sage-600">
                    <Hash
                      className="size-4"
                      aria-hidden="true"
                    />

                    {profile.heavenlyHashtag.replace(
                      /^#/,
                      ""
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0">
              {isOwnProfile ? (
                <Link
                  href="/profile"
                  className="profile-edit-button btn-secondary"
                >
                  View your profile
                </Link>
              ) : (
                <FollowButton
                  targetUserId={profile.userId}
                />
              )}
            </div>
          </div>

          {profile.spiritualBio && (
            <div className="mt-6 max-w-2xl">
              <p className="eyebrow">
                Before God, I am
              </p>

              <p className="user-content mt-2 whitespace-pre-wrap text-sm leading-7 text-muted sm:text-base">
                {profile.spiritualBio}
              </p>
            </div>
          )}
        </div>
      </section>

      <section>
        {posts.length ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <SocialReflectionCard
                key={post.id}
                post={{
                  ...post,
                  author: profile
                }}
                initialFollowing={false}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookHeart}
            title="No public reflections yet"
            description={`${profile.profileName} has not shared any public reflections yet.`}
          />
        )}
      </section>
    </div>
  );
}