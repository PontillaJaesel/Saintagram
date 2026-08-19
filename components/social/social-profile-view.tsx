"use client";

import {
  useEffect,
  useState
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  BookHeart,
  Hash,
  LockKeyhole,
  UserRound
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { FollowButton } from "@/components/social/follow-button";
import { SocialReflectionCard } from "@/components/social/social-reflection-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ProfileCover } from "@/components/ui/profile-cover";
import { calculateFiatStats } from "@/lib/fiat";

import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

import {
  getPublicProfileBundle,
  type CommunityProfile
} from "@/lib/social-community";

import type {
  ReflectionPost
} from "@/types";

/*
 * ============================================================
 * AVATAR
 * ============================================================
 */

function SocialProfileAvatar({
  imagePath,
  profileName
}: {
  imagePath: string;
  profileName: string;
}) {
  const {
    loading,
    mode,
    user
  } =
    useAuth();

  const [
    src,
    setSrc
  ] =
    useState(
      imagePath.startsWith(
        "data:image/"
      )
        ? imagePath
        : ""
    );

  useEffect(() => {
    let active = true;

    if (!imagePath) {
      setSrc("");

      return () =>
        undefined;
    }

    if (
      isLocalProfileImageSource(
        imagePath
      )
    ) {
      setSrc(
        mode === "local"
          ? imagePath
          : ""
      );

      return () =>
        undefined;
    }

    if (
      loading ||
      !user
    ) {
      setSrc("");

      return () =>
        undefined;
    }

    void downloadFirebaseProfileImage(
      imagePath
    )
      .then(
        (downloadUrl) => {
          if (active) {
            setSrc(
              downloadUrl
            );
          }
        }
      )
      .catch(() => {
        if (active) {
          setSrc("");
        }
      });

    return () => {
      active = false;
    };
  }, [
    imagePath,
    loading,
    mode,
    user?.id
  ]);

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
    profileName
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "?";

  return (
    <div
      className="grid size-24 shrink-0 place-items-center rounded-full border-4 border-paper bg-sage-100 font-serif text-3xl font-bold text-sage-700 shadow-sm sm:size-28"
      aria-label={`${profileName} profile picture`}
    >
      {initial}
    </div>
  );
}

/*
 * ============================================================
 * PROFILE PAGE
 * ============================================================
 */

export function SocialProfileView({
  userId
}: {
  userId: string;
}) {
  const { user } =
    useAuth();

  const [
    profile,
    setProfile
  ] =
    useState<
      CommunityProfile | null
    >(null);

  const [
    posts,
    setPosts
  ] =
    useState<
      ReflectionPost[]
    >([]);

  const [
    canViewPosts,
    setCanViewPosts
  ] =
    useState(false);

  const [
    initialFollowing,
    setInitialFollowing
  ] =
    useState(false);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState("");

  const [
    notFound,
    setNotFound
  ] =
    useState(false);

  /*
   * ==========================================================
   * LOAD PROFILE
   * ==========================================================
   */
  useEffect(() => {
    if (
      !user ||
      !userId
    ) {
      return;
    }

    let active = true;

    const loadProfile =
      async () => {
        setLoading(true);
        setError("");
        setNotFound(false);

        try {
          const result =
            await getPublicProfileBundle(
              user.id,
              userId
            );

          if (!active) {
            return;
          }

          if (
            !result.profile
          ) {
            setProfile(
              null
            );

            setPosts([]);

            setCanViewPosts(
              false
            );

            setNotFound(
              true
            );

            return;
          }

          setProfile(
            result.profile
          );

          setPosts(
            result.posts
          );

          setCanViewPosts(
            result
              .canViewPosts
          );

          setInitialFollowing(
            result.following
          );
        } catch (
          loadError
        ) {
          if (!active) {
            return;
          }

          console.error(
            "[SOCIAL PROFILE]",
            loadError
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : "This profile could not be loaded."
          );
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [
    user?.id,
    userId
  ]);

  /*
   * ==========================================================
   * STATES
   * ==========================================================
   */

  if (loading) {
    return (
      <LoadingState
        label="Opening this profile…"
      />
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

  if (
    notFound ||
    !profile
  ) {
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

  const isOwnProfile =
    user?.id ===
    profile.userId;

  const publicFiatStats =
    calculateFiatStats(
      posts
    );

  /*
   * ==========================================================
   * PAGE
   * ==========================================================
   */

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
        <ProfileCover coverColor={profile.coverColor} coverImageId={profile.coverImageId} className="h-28 sm:h-36" />

        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <SocialProfileAvatar
                imagePath={
                  profile.imagePath
                }
                profileName={
                  profile.profileName
                }
              />

              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words font-serif text-3xl font-bold text-ink sm:text-4xl">
                    {
                      profile.profileName
                    }
                  </h1>

                  {profile.isPrivateAccount && (
                    <LockKeyhole
                      className="size-5 shrink-0 text-muted sm:size-6"
                      aria-label="Private account"
                    />
                  )}
                </div>

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

              {publicFiatStats.currentStreak >
                0 && (
                <span
                  className="fiat-streak-badge"
                  aria-label={`Public FiAt streak: ${publicFiatStats.currentStreak} days`}
                >
                  <strong>
                    Fi@{" "}
                    {
                      publicFiatStats.currentStreak
                    }
                  </strong>
                </span>
              )}
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
                  targetUserId={
                    profile.userId
                  }
                  targetIsPrivate={
                    profile.isPrivateAccount
                  }
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
                {
                  profile.spiritualBio
                }
              </p>
            </div>
          )}
        </div>
      </section>

      <section>
        {posts.length ? (
          <div className="space-y-4">
            {posts.map(
              (post) => (
                <SocialReflectionCard
                  key={
                    post.id
                  }
                  post={{
                    ...post,
                    author:
                      profile
                  }}
                  initialFollowing={
                    initialFollowing
                  }
                  compactTimestamp
                  hideViewProfile
                />
              )
            )}
          </div>
        ) : profile.isPrivateAccount &&
          !canViewPosts ? (
          <EmptyState
            icon={
              LockKeyhole
            }
            title="This account is private"
            description={`Send ${profile.profileName} a follow request and wait for approval to see their reflections.`}
          />
        ) : (
          <EmptyState
            icon={
              BookHeart
            }
            title="No public reflections yet"
            description={`${profile.profileName} has not shared any public reflections yet.`}
          />
        )}
      </section>
    </div>
  );
}