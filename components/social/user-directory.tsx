"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  LockKeyhole,
  Search,
  UsersRound,
  X
} from "lucide-react";

import {
  useAuth
} from "@/components/providers/auth-provider";

import {
  FollowButton
} from "@/components/social/follow-button";

import {
  EmptyState
} from "@/components/ui/empty-state";

import {
  LoadingState
} from "@/components/ui/loading-state";

import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

import {
  getCommunityProfiles,
  type CommunityProfile
} from "@/lib/social-community";

/*
 * ============================================================
 * AVATAR
 * ============================================================
 */

function UserAvatar({
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
      <div className="size-14 shrink-0 overflow-hidden rounded-full border border-sage-100 bg-sage-50">
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
    profileName
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "?";

  return (
    <div
      className="grid size-14 shrink-0 place-items-center rounded-full bg-sage-100 font-serif text-xl font-bold text-sage-700"
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

/*
 * ============================================================
 * DIRECTORY
 * ============================================================
 */

export function UserDirectory() {
  const { user } =
    useAuth();

  const [
    profiles,
    setProfiles
  ] =
    useState<
      CommunityProfile[]
    >([]);

  const [
    searchQuery,
    setSearchQuery
  ] =
    useState("");

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

  /*
   * ==========================================================
   * LOAD SOCIAL PROFILES
   * ==========================================================
   */
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    let active = true;

    const loadProfiles =
      async () => {
        setLoading(true);
        setError("");

        try {
          const nextProfiles =
            await getCommunityProfiles(
              user.id
            );

          if (!active) {
            return;
          }

          setProfiles(
            nextProfiles
          );
        } catch (
          loadError
        ) {
          if (!active) {
            return;
          }

          console.error(
            "[USER DIRECTORY]",
            loadError
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : "The Saintagram community could not be loaded."
          );
        } finally {
          if (active) {
            setLoading(
              false
            );
          }
        }
      };

    void loadProfiles();

    return () => {
      active = false;
    };
  }, [
    user?.id
  ]);

  /*
   * ==========================================================
   * SEARCH
   * ==========================================================
   */
  const filteredProfiles =
    useMemo(() => {
      const normalizedQuery =
        searchQuery
          .trim()
          .toLocaleLowerCase();

      if (
        !normalizedQuery
      ) {
        return profiles;
      }

      return profiles.filter(
        (profile) => {
          const searchableText =
            [
              profile.profileName,
              profile.spiritualBio,
              profile.heavenlyHashtag
            ]
              .join(" ")
              .toLocaleLowerCase();

          return searchableText.includes(
            normalizedQuery
          );
        }
      );
    }, [
      profiles,
      searchQuery
    ]);

  /*
   * ==========================================================
   * STATES
   * ==========================================================
   */

  if (loading) {
    return (
      <LoadingState
        label="Gathering the community…"
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
    !profiles.length
  ) {
    return (
      <EmptyState
        icon={UsersRound}
        title="The community is quiet for now"
        description="Other Saintagram profiles will appear here once they become available."
      />
    );
  }

  /*
   * ==========================================================
   * DIRECTORY UI
   * ==========================================================
   */

  return (
    <div className="space-y-6">
      <section className="surface p-5 sm:p-6">
        <label
          htmlFor="community-search"
          className="sr-only"
        >
          Search Saintagram users
        </label>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />

          <input
            id="community-search"
            type="search"
            className="field pl-12 pr-12"
            placeholder="Search people…"
            value={
              searchQuery
            }
            onChange={(
              event
            ) =>
              setSearchQuery(
                event.target
                  .value
              )
            }
          />

          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-sage-100 hover:text-ink"
              aria-label="Clear search"
              onClick={() =>
                setSearchQuery(
                  ""
                )
              }
            >
              <X
                className="size-4"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {searchQuery && (
          <p
            className="mt-3 text-sm text-muted"
            role="status"
            aria-live="polite"
          >
            {
              filteredProfiles.length
            }{" "}
            {filteredProfiles.length ===
            1
              ? "person"
              : "people"}{" "}
            found
          </p>
        )}
      </section>

      {filteredProfiles.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProfiles.map(
            (profile) => (
              <article
                key={
                  profile.userId
                }
                className="surface flex flex-col p-5 sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <UserAvatar
                    imagePath={
                      profile.imagePath
                    }
                    profileName={
                      profile.profileName
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/users/${profile.userId}`}
                      className="group inline-flex max-w-full items-center gap-2"
                    >
                      <h2 className="truncate font-serif text-xl font-bold text-ink group-hover:text-sage-700">
                        {
                          profile.profileName
                        }
                      </h2>

                      {profile.isPrivateAccount && (
                        <LockKeyhole
                          className="size-4 shrink-0 text-muted"
                          aria-label="Private account"
                        />
                      )}

                      <ArrowRight
                        className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>

                    {profile.heavenlyHashtag && (
                      <p className="mt-1 text-sm font-semibold text-sage-600">
                        {
                          profile.heavenlyHashtag
                        }
                      </p>
                    )}
                  </div>
                </div>

                {profile.spiritualBio ? (
                  <p className="user-content mt-4 line-clamp-3 text-sm leading-6 text-muted">
                    {
                      profile.spiritualBio
                    }
                  </p>
                ) : (
                  <p className="mt-4 text-sm italic leading-6 text-muted">
                    No public bio yet.
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                  <Link
                    href={`/users/${profile.userId}`}
                    className="btn-quiet"
                  >
                    View profile
                  </Link>

                  <FollowButton
                    targetUserId={
                      profile.userId
                    }
                    targetIsPrivate={
                      profile.isPrivateAccount
                    }
                  />
                </div>
              </article>
            )
          )}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No people found"
          description="Try searching for another profile name."
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setSearchQuery(
                  ""
                )
              }
            >
              Clear search
            </button>
          }
        />
      )}
    </div>
  );
}