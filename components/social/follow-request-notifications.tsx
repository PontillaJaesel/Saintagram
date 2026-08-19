"use client";

import {
  useEffect,
  useState
} from "react";

import {
  useRouter
} from "next/navigation";

import {
  Check,
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

export function FollowRequestNotifications({
  onCountChange,
  onNavigate
}: {
  onCountChange?: (
    count: number
  ) => void;

  onNavigate?: () => void;
}) {
  const {
    user
  } =
    useAuth();

  const {
    notify
  } =
    useToast();

  const router =
    useRouter();

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
    busyRequestId,
    setBusyRequestId
  ] =
    useState<
      string | null
    >(
      null
    );

  useEffect(() => {
    if (
      !user
    ) {
      setRequests(
        []
      );

      onCountChange?.(
        0
      );

      return;
    }

    return subscribeFollowRequests(
      user.id,

      (
        nextRequests
      ) => {
        setRequests(
          nextRequests
        );

        onCountChange?.(
          nextRequests.length
        );
      }
    );
  }, [
    onCountChange,
    user?.id
  ]);

  useEffect(() => {
    let active =
      true;

    const ids =
      Array.from(
        new Set(
          requests.map(
            (
              request
            ) =>
              request
                .requesterId
          )
        )
      );

    if (
      !ids.length
    ) {
      setProfiles(
        {}
      );

      return () => {
        active =
          false;
      };
    }

    void Promise.all(
      ids.map(
        async (
          id
        ) => {
          try {
            return [
              id,

              await appService
                .getSocialProfile(
                  id
                )
            ] as const;
          } catch {
            return [
              id,
              null
            ] as const;
          }
        }
      )
    ).then(
      (
        entries
      ) => {
        if (
          active
        ) {
          setProfiles(
            Object.fromEntries(
              entries
            )
          );
        }
      }
    );

    return () => {
      active =
        false;
    };
  }, [
    requests
  ]);

  const respond =
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
        if (
          accept
        ) {
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
        error
      ) {
        notify(
          error instanceof
            Error
            ? error.message
            : "The follow request could not be updated.",

          "error"
        );
      } finally {
        setBusyRequestId(
          null
        );
      }
    };

  if (
    !requests.length
  ) {
    return null;
  }

  return (
    <>
      {requests.map(
        (
          request
        ) => {
          const profile =
            profiles[
              request
                .requesterId
            ] ??
            null;

          const name =
            profile
              ?.profileName ??
            "A Saintagram user";

          const busy =
            busyRequestId ===
            request.id;

          return (
            <div
              key={
                request.id
              }
              className="border-b border-sage-100 bg-sage-50/60 px-5 py-4"
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 text-left"
                onClick={() => {
                  onNavigate?.();

                  router.push(
                    `/users/${request.requesterId}`
                  );
                }}
              >
                {profile ? (
                  <ProfileAvatar
                    imagePath={
                      profile
                        .imagePath
                    }
                    symbol=""
                    profileName={
                      name
                    }
                    size="small"
                  />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-base)] bg-sage-100 text-sage-700">
                    <UserPlus
                      className="size-5"
                      aria-hidden="true"
                    />
                  </span>
                )}

                <span className="min-w-0 flex-1 text-sm leading-5 text-ink">
                  <strong>
                    {name}
                  </strong>{" "}
                  requested to
                  follow you.
                </span>
              </button>

              <div className="mt-3 flex gap-2 pl-14">
                <button
                  type="button"
                  className="btn-primary min-h-9 flex-1 justify-center px-3 py-2 text-xs"
                  disabled={
                    busy
                  }
                  aria-label={`Accept ${name}'s follow request`}
                  onClick={() =>
                    void respond(
                      request,
                      true
                    )
                  }
                >
                  <Check
                    className="size-4"
                    aria-hidden="true"
                  />

                  Accept
                </button>

                <button
                  type="button"
                  className="btn-secondary min-h-9 flex-1 justify-center px-3 py-2 text-xs"
                  disabled={
                    busy
                  }
                  aria-label={`Reject ${name}'s follow request`}
                  onClick={() =>
                    void respond(
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
            </div>
          );
        }
      )}
    </>
  );
}