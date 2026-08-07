"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { appService } from "@/lib/app-service";

import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

import type {
  SocialNotification,
  SocialProfile
} from "@/types";

function notificationTime(
  value: string
): string {
  const created =
    new Date(value).getTime();

  const difference =
    Date.now() - created;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) {
    return "Just now";
  }

  if (difference < hour) {
    const minutes =
      Math.max(
        1,
        Math.floor(
          difference / minute
        )
      );

    return `${minutes}m ago`;
  }

  if (difference < day) {
    const hours =
      Math.max(
        1,
        Math.floor(
          difference / hour
        )
      );

    return `${hours}h ago`;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year:
        new Date(value).getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined
    }
  ).format(new Date(value));
}

function NotificationAvatar({
  profile
}: {
  profile: SocialProfile | null;
}) {
  const {
    loading,
    mode,
    user
  } = useAuth();

  const imagePath =
    profile?.imagePath ?? "";

  const profileName =
    profile?.profileName ??
    "Saintagram user";

  const [src, setSrc] =
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
      return () => undefined;
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

      return () => undefined;
    }

    if (loading || !user) {
      setSrc("");
      return () => undefined;
    }

    void downloadFirebaseProfileImage(
      imagePath
    )
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
  }, [
    imagePath,
    loading,
    mode,
    user?.id
  ]);

  if (src) {
    return (
      <div className="size-10 shrink-0 overflow-hidden rounded-full border border-sage-100 bg-sage-50">
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
      .toUpperCase() || "?";

  return (
    <div
      className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-100 font-serif font-bold text-sage-700"
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();

  const containerRef =
    useRef<HTMLDivElement>(null);

  const [
    notifications,
    setNotifications
  ] = useState<
    SocialNotification[]
  >([]);

  const [
    profiles,
    setProfiles
  ] = useState<
    Record<
      string,
      SocialProfile | null
    >
  >({});

  const [open, setOpen] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    return appService
      .subscribeNotifications(
        user.id,
        (nextNotifications) => {
          setNotifications(
            nextNotifications
          );

          setError("");
        },
        (message) => {
          setError(message);
        }
      );
  }, [user]);

  useEffect(() => {
    let active = true;

    const actorIds =
      Array.from(
        new Set(
          notifications.map(
            (notification) =>
              notification.actorUserId
          )
        )
      );

    if (!actorIds.length) {
      setProfiles({});
      return () => undefined;
    }

    void Promise.all(
      actorIds.map(
        async (actorUserId) => {
          try {
            const profile =
              await appService
                .getSocialProfile(
                  actorUserId
                );

            return [
              actorUserId,
              profile
            ] as const;
          } catch {
            return [
              actorUserId,
              null
            ] as const;
          }
        }
      )
    ).then((entries) => {
      if (!active) {
        return;
      }

      setProfiles(
        Object.fromEntries(entries)
      );
    });

    return () => {
      active = false;
    };
  }, [notifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsidePress = (
      event: PointerEvent
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      closeOnOutsidePress
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsidePress
      );
    };
  }, [open]);

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.readAt
    ).length;

  const openNotification =
    async (
        notification: SocialNotification
    ) => {
        if (!user) {
        return;
        }

        setOpen(false);

        try {
        await appService
            .markNotificationRead(
            user.id,
            notification.id
            );
        } catch {
        /*
        * Navigation should still work
        * even if marking the notification
        * as read fails.
        */
        }

        /*
        * LIKE / COMMENT / REPLY
        *
        * These actions happened on a
        * reflection, so open the dedicated
        * reflection screen.
        */
        if (
        notification.reflectionId &&
        (
            notification.type === "like" ||
            notification.type === "comment" ||
            notification.type === "reply"
        )
        ) {
        router.push(
            `/reflections/${notification.reflectionId}`
        );

        return;
        }

        /*
        * FOLLOW
        *
        * A Follow action does not belong
        * to a reflection, so this is the
        * only notification that should
        * open another user's profile.
        */
        if (
        notification.type === "follow"
        ) {
        router.push(
            `/users/${notification.actorUserId}`
        );
        }
    };

  return (
    <div
      ref={containerRef}
      className="relative ml-auto"
    >
      <button
        type="button"
        className="relative grid size-11 place-items-center rounded-full border border-sage-100 bg-paper text-ink transition hover:bg-sage-50"
        aria-label={
          unreadCount
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) => !current
          )
        }
      >
        <Bell
          className="size-5"
          aria-hidden="true"
        />

        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-clay-600 px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+.65rem)] z-[90] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-sage-100 bg-paper shadow-lift lg:bottom-[calc(100%+.65rem)] lg:top-auto"
          aria-label="Notifications"
        >
          <div className="border-b border-sage-100 px-5 py-4">
            <h2 className="font-serif text-lg font-bold">
              Notifications
            </h2>

            <p className="mt-1 text-xs text-muted">
            New followers, likes, and
            comments will appear here.
            </p>
          </div>

          {error && (
            <p
              className="px-5 py-4 text-sm font-semibold text-clay-600"
              role="alert"
            >
              {error}
            </p>
          )}

          {!notifications.length ? (
            <div className="px-5 py-8 text-center">
              <Bell
                className="mx-auto size-6 text-muted"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm font-semibold">
                No notifications yet
              </p>

              <p className="mt-1 text-xs leading-5 text-muted">
                New social activity on your
                account will appear here.
            </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map(
                (notification) => {
                  const actor =
                    profiles[
                      notification
                        .actorUserId
                    ] ?? null;

                  const unread =
                    !notification.readAt;

                  return (
                    <button
                      key={
                        notification.id
                      }
                      type="button"
                      className={`flex w-full items-start gap-3 border-b border-sage-100 px-5 py-4 text-left transition last:border-b-0 hover:bg-sage-50 ${
                        unread
                          ? "bg-sage-50/60"
                          : ""
                      }`}
                      onClick={() =>
                        void openNotification(
                          notification
                        )
                      }
                    >
                      <NotificationAvatar
                        profile={actor}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-5 text-ink">
                        <strong>
                            {actor?.profileName ?? "A Saintagram user"}
                        </strong>{" "}

                        {notification.type === "follow"
                            ? "followed you."
                            : notification.type === "like"
                                ? "liked your reflection."
                                : notification.type === "reply"
                                ? "replied to your comment."
                                : "commented on your reflection."}
                        </span>

                        <span className="mt-1 block text-xs text-muted">
                          {notificationTime(
                            notification
                              .createdAt
                          )}
                        </span>
                      </span>

                      {unread && (
                        <span
                          className="mt-2 size-2 shrink-0 rounded-full bg-sage-600"
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}