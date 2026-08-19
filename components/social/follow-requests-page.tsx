"use client";

import {
  useEffect,
  useState
} from "react";

import Link from "next/link";

import {
  Check,
  LockKeyhole,
  UserPlus,
  X
} from "lucide-react";

import {
  useAuth
} from "@/components/providers/auth-provider";

import {
  useToast
} from "@/components/providers/toast-provider";

import {
  EmptyState
} from "@/components/ui/empty-state";

import {
  LoadingState
} from "@/components/ui/loading-state";

import {
  ProfileAvatar
} from "@/components/ui/profile-avatar";

import {
  appService
} from "@/lib/app-service";

import {
  acceptFollowRequest,
  rejectFollowRequest,
  subscribeFollowRequests
} from "@/lib/private-account";

import type {
  FollowRequest,
  SocialProfile
} from "@/types";

/*
 * ============================================================
 * FOLLOW REQUEST TIME
 * ============================================================
 *
 * Examples:
 *
 * Just now
 * 1m ago
 * 59m ago
 * 1h ago
 * 23h ago
 * 1d ago
 * 7d ago
 * Aug 5, 2026
 *
 * Dates are only shown when the request
 * is older than 7 days.
 * ============================================================
 */
function formatFollowRequestTime(
  createdAt: string,
  nowMs: number
): string {
  const createdTime =
    new Date(
      createdAt
    ).getTime();

  if (
    !createdAt ||
    Number.isNaN(
      createdTime
    )
  ) {
    return "";
  }

  const differenceMs =
    Math.max(
      0,
      nowMs - createdTime
    );

  const minuteMs =
    60 * 1000;

  const hourMs =
    60 * minuteMs;

  const dayMs =
    24 * hourMs;

  /*
   * Less than 1 minute.
   */
  if (
    differenceMs <
    minuteMs
  ) {
    return "Just now";
  }

  /*
   * 1–59 minutes.
   */
  if (
    differenceMs <
    hourMs
  ) {
    const minutes =
      Math.floor(
        differenceMs /
          minuteMs
      );

    return `${minutes}m ago`;
  }

  /*
   * 1–23 hours.
   */
  if (
    differenceMs <
    dayMs
  ) {
    const hours =
      Math.floor(
        differenceMs /
          hourMs
      );

    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      differenceMs /
        dayMs
    );

  /*
   * 1–7 days.
   *
   * Exactly 7 days:
   * "7d ago"
   */
  if (days <= 7) {
    return `${days}d ago`;
  }

  /*
   * More than 7 days:
   *
   * Aug 5, 2026
   */
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(
    new Date(createdTime)
  );
}

export function FollowRequestsPage() {
  const { user } =
    useAuth();

  const { notify } =
    useToast();

  const [
    requests,
    setRequests
  ] =
    useState<
      FollowRequest[]
    >([]);

  const [
    profiles,
    setProfiles
  ] =
    useState<
      Record<
        string,
        SocialProfile | null
      >
    >({});

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    busyRequestId,
    setBusyRequestId
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError
  ] =
    useState("");

  /*
   * Current time used by the
   * "1m ago", "2h ago", etc.
   *
   * It automatically refreshes
   * once per minute.
   */
  const [
    nowMs,
    setNowMs
  ] =
    useState(
      () => Date.now()
    );

  /*
   * ==========================================================
   * UPDATE RELATIVE TIMES
   * ==========================================================
   */
  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setNowMs(
            Date.now()
          );
        },
        60 * 1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  /*
   * ==========================================================
   * LISTEN FOR FOLLOW REQUESTS
   * ==========================================================
   *
   * Listen for follow requests belonging
   * to the currently signed-in user.
   * ==========================================================
   */
  useEffect(() => {
    if (!user) {
      setRequests([]);
      setLoading(false);

      return;
    }

    setLoading(true);

    return subscribeFollowRequests(
      user.id,

      (
        nextRequests
      ) => {
        setRequests(
          nextRequests
        );

        setLoading(false);
        setError("");
      },

      (message) => {
        setError(
          message
        );

        setLoading(false);
      }
    );
  }, [
    user?.id
  ]);

  /*
   * ==========================================================
   * LOAD REQUESTER PROFILES
   * ==========================================================
   *
   * Load the social profile of
   * each person who sent a request.
   * ==========================================================
   */
  useEffect(() => {
    let active = true;

    const requesterIds =
      Array.from(
        new Set(
          requests.map(
            (
              request
            ) =>
              request.requesterId
          )
        )
      );

    if (
      requesterIds.length ===
      0
    ) {
      setProfiles({});

      return () => {
        active = false;
      };
    }

    void Promise.all(
      requesterIds.map(
        async (
          requesterId
        ) => {
          try {
            const profile =
              await appService
                .getSocialProfile(
                  requesterId
                );

            return [
              requesterId,
              profile
            ] as const;
          } catch {
            return [
              requesterId,
              null
            ] as const;
          }
        }
      )
    ).then(
      (entries) => {
        if (!active) {
          return;
        }

        setProfiles(
          Object.fromEntries(
            entries
          )
        );
      }
    );

    return () => {
      active = false;
    };
  }, [
    requests
  ]);

  /*
   * ==========================================================
   * ACCEPT / REJECT REQUEST
   * ==========================================================
   */
  const respondToRequest =
    async (
      request:
        FollowRequest,

      accept:
        boolean
    ) => {
      if (
        !user ||
        busyRequestId
      ) {
        return;
      }

      setBusyRequestId(
        request.id
      );

      try {
        if (accept) {
          await acceptFollowRequest(
            user.id,
            request.id
          );

          notify(
            "Follow request accepted."
          );
        } else {
          await rejectFollowRequest(
            user.id,
            request.id
          );

          notify(
            "Follow request rejected."
          );
        }
      } catch (
        responseError
      ) {
        notify(
          responseError instanceof
          Error
            ? responseError
                .message
            : "The follow request could not be updated.",
          "error"
        );
      } finally {
        setBusyRequestId(
          null
        );
      }
    };

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */
  if (loading) {
    return (
      <LoadingState
        label="Loading follow requests…"
      />
    );
  }

  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */
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

  /*
   * ==========================================================
   * EMPTY
   * ==========================================================
   */
  if (
    requests.length ===
    0
  ) {
    return (
      <EmptyState
        icon={UserPlus}
        title="No follow requests"
        description="When someone asks to follow your private account, their request will appear here."
      />
    );
  }

  /*
   * ==========================================================
   * PAGE
   * ==========================================================
   */
  return (
    <div className="space-y-4">
      {/*
       * Information banner.
       */}
      <div className="surface flex items-start gap-3 p-5 text-sm text-muted">
        <LockKeyhole
          className="mt-0.5 size-5 shrink-0 text-sage-700"
          aria-hidden="true"
        />

        <div>
          <p className="font-semibold text-ink">
            Your account is private
          </p>

          <p className="mt-1 leading-5">
            Only people you
            accept become
            followers and can
            view the public
            reflections shown
            on your private
            profile.
          </p>
        </div>
      </div>

      {/*
       * Follow requests.
       */}
      {requests.map(
        (
          request
        ) => {
          const profile =
            profiles[
              request.requesterId
            ] ?? null;

          const profileName =
            profile
              ?.profileName ??
            "Saintagram user";

          const busy =
            busyRequestId ===
            request.id;

          /*
           * Dynamic request age.
           */
          const requestTime =
            formatFollowRequestTime(
              request.createdAt,
              nowMs
            );

          return (
            <article
              key={
                request.id
              }
              className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              {/*
               * Requester profile
               * information.
               */}
              <Link
                href={`/users/${request.requesterId}`}
                className="group flex min-w-0 items-center gap-4"
              >
                <ProfileAvatar
                  imagePath={
                    profile
                      ?.imagePath ??
                    ""
                  }
                  symbol=""
                  profileName={
                    profileName
                  }
                  size="small"
                />

                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate font-serif text-lg font-bold text-ink transition group-hover:text-sage-700">
                      {
                        profileName
                      }
                    </h2>

                    {profile
                      ?.isPrivateAccount && (
                      <LockKeyhole
                        className="size-4 shrink-0 text-muted"
                        aria-label="Private account"
                      />
                    )}
                  </div>

                  {/*
                   * FOLLOW REQUEST TIME
                   *
                   * Previously:
                   *
                   * "Wants to follow your
                   * private account."
                   */}
                  <p
                    className="mt-1 text-sm leading-5 text-muted"
                    title={
                      request.createdAt
                        ? new Intl.DateTimeFormat(
                            "en-US",
                            {
                              month:
                                "long",
                              day:
                                "numeric",
                              year:
                                "numeric",
                              hour:
                                "numeric",
                              minute:
                                "2-digit"
                            }
                          ).format(
                            new Date(
                              request.createdAt
                            )
                          )
                        : undefined
                    }
                  >
                    {
                      requestTime ||
                      "Recently"
                    }
                  </p>
                </div>
              </Link>

              {/*
               * Accept / Reject
               * controls.
               */}
              <div className="flex gap-2 sm:shrink-0">
                <button
                  type="button"
                  className="btn-primary flex-1 justify-center sm:flex-none"
                  disabled={
                    busy
                  }
                  aria-label={`Accept ${profileName}'s follow request`}
                  onClick={() =>
                    void respondToRequest(
                      request,
                      true
                    )
                  }
                >
                  <Check
                    className="size-4"
                    aria-hidden="true"
                  />

                  {busy
                    ? "Saving…"
                    : "Accept"}
                </button>

                <button
                  type="button"
                  className="btn-secondary flex-1 justify-center sm:flex-none"
                  disabled={
                    busy
                  }
                  aria-label={`Reject ${profileName}'s follow request`}
                  onClick={() =>
                    void respondToRequest(
                      request,
                      false
                    )
                  }
                >
                  <X
                    className="size-4"
                    aria-hidden="true"
                  />

                  Reject
                </button>
              </div>
            </article>
          );
        }
      )}
    </div>
  );
}