"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  BookHeart,
  CalendarDays,
  Edit3,
  Heart,
  MessageCircle,
  Sparkles,
  UserRoundPlus
} from "lucide-react";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";

import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

import { useAuth } from "@/components/providers/auth-provider";

import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ReflectionMediaView } from "@/components/reflections/reflection-media-view";

import { appService } from "@/lib/app-service";
import { getFirebaseServices } from "@/lib/firebase";
import { formatFriendlyDate } from "@/lib/validation";

import type {
  PublicSpiritualProfile,
  ReflectionComment,
  ReflectionLike,
  ReflectionPost
} from "@/types";

type JourneyItemType =
  | "account"
  | "profile-created"
  | "reflection"
  | "profile-update"
  | "like"
  | "comment"
  | "reply";

interface JourneyItem {
  id: string;
  date: string;
  title: string;
  description: string;
  type: JourneyItemType;
  priority: number;
  imagePath?: string;
  media?: ReflectionPost["media"];
}

interface ProfileJourneyEvent {
  id: string;
  userId: string;
  changes: string[];
  imagePath?: string;
  createdAt: string;
}

interface ReflectionJourneyMeta {
  reflectionId: string;
  title: string;
  content: string;
  ownerId: string;
  ownerName: string;
}

function validDate(value: string): boolean {
  return !Number.isNaN(
    new Date(value).getTime()
  );
}

function formatMilitaryDateTime(
  value: string
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return formatFriendlyDate(
      value
    );
  }

  const hours = String(
    date.getHours()
  ).padStart(2, "0");

  const minutes = String(
    date.getMinutes()
  ).padStart(2, "0");

  return `${formatFriendlyDate(
    value
  )} • ${hours}:${minutes}`;
}

function reflectionDescription(
  metadata:
    | ReflectionJourneyMeta
    | undefined
): string {
  if (!metadata) {
    return "a reflection";
  }

  if (metadata.title) {
    return `"${metadata.title}"`;
  }

  const content =
    metadata.content.trim();

  if (!content) {
    return "a reflection";
  }

  const preview =
    content.length > 80
      ? `${content.slice(
          0,
          80
        ).trim()}…`
      : content;

  return `"${preview}"`;
}

function parseProfileJourneyEvent(
  id: string,
  value: unknown
): ProfileJourneyEvent | null {
  if (
    typeof value !== "object" ||
    !value
  ) {
    return null;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const userId =
    typeof data.userId ===
    "string"
      ? data.userId
      : "";

  const createdAt =
    typeof data.createdAt ===
    "string"
      ? data.createdAt
      : "";

  const imagePath =
    typeof data.imagePath ===
    "string"
      ? data.imagePath
      : "";

  const changes =
    Array.isArray(data.changes)
      ? data.changes.filter(
          (
            value
          ): value is string =>
            typeof value ===
              "string" &&
            Boolean(
              value.trim()
            )
        )
      : [];

  if (
    !userId ||
    !changes.length ||
    !validDate(createdAt)
  ) {
    return null;
  }

  return {
    id,
    userId,
    changes,

    ...(imagePath
      ? {
          imagePath
        }
      : {}),

    createdAt
  };
}

function parseLike(
  id: string,
  value: unknown
): ReflectionLike | null {
  if (
    typeof value !== "object" ||
    !value
  ) {
    return null;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const reflectionId =
    typeof data.reflectionId ===
    "string"
      ? data.reflectionId
      : "";

  const postOwnerId =
    typeof data.postOwnerId ===
    "string"
      ? data.postOwnerId
      : "";

  const userId =
    typeof data.userId ===
    "string"
      ? data.userId
      : "";

  const createdAt =
    typeof data.createdAt ===
    "string"
      ? data.createdAt
      : "";

  if (
    !reflectionId ||
    !postOwnerId ||
    !userId ||
    !validDate(createdAt)
  ) {
    return null;
  }

  return {
    id,
    reflectionId,
    postOwnerId,
    userId,
    createdAt
  };
}

function parseComment(
  id: string,
  value: unknown
): ReflectionComment | null {
  if (
    typeof value !== "object" ||
    !value
  ) {
    return null;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const reflectionId =
    typeof data.reflectionId ===
    "string"
      ? data.reflectionId
      : "";

  const postOwnerId =
    typeof data.postOwnerId ===
    "string"
      ? data.postOwnerId
      : "";

  const userId =
    typeof data.userId ===
    "string"
      ? data.userId
      : "";

  const content =
    typeof data.content ===
    "string"
      ? data.content
      : "";

  const createdAt =
    typeof data.createdAt ===
    "string"
      ? data.createdAt
      : "";

  const updatedAt =
    typeof data.updatedAt ===
    "string"
      ? data.updatedAt
      : createdAt;

  const parentCommentId =
    typeof data.parentCommentId ===
    "string"
      ? data.parentCommentId
      : undefined;

  const replyToUserId =
    typeof data.replyToUserId ===
    "string"
      ? data.replyToUserId
      : undefined;

  if (
    !reflectionId ||
    !postOwnerId ||
    !userId ||
    !content ||
    !validDate(createdAt)
  ) {
    return null;
  }

  return {
    id,
    reflectionId,
    postOwnerId,
    userId,
    content,
    createdAt,
    updatedAt,

    ...(parentCommentId
      ? {
          parentCommentId
        }
      : {}),

    ...(replyToUserId
      ? {
          replyToUserId
        }
      : {})
  };
}
function JourneyImagePreview({
  imagePath
}: {
  imagePath: string;
}) {
  const {
    loading,
    mode,
    user
  } = useAuth();

  const [
    src,
    setSrc
  ] = useState(
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

      return () => {
        active = false;
      };
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

      return () => {
        active = false;
      };
    }

    if (
      loading ||
      !user
    ) {
      setSrc("");

      return () => {
        active = false;
      };
    }

    void downloadFirebaseProfileImage(
      imagePath
    )
      .then(
        (
          downloadUrl
        ) => {
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

  if (!src) {
    return null;
  }

  return (
    <div className="mt-4 max-w-sm overflow-hidden border border-sage-100 bg-paper p-2 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Profile picture saved in journey"
        className="max-h-72 w-full object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export function JourneyTimeline() {
  const { user } = useAuth();

  const [
    profile,
    setProfile
  ] =
    useState<PublicSpiritualProfile | null>(
      null
    );

  const [
    posts,
    setPosts
  ] =
    useState<
      ReflectionPost[]
    >([]);

  const [
    likes,
    setLikes
  ] =
    useState<
      ReflectionLike[]
    >([]);

  const [
    comments,
    setComments
  ] =
    useState<
      ReflectionComment[]
    >([]);

  const [
    profileEvents,
    setProfileEvents
  ] =
    useState<
      ProfileJourneyEvent[]
    >([]);

  const [
    reflectionMetadata,
    setReflectionMetadata
  ] = useState<
    Record<
      string,
      ReflectionJourneyMeta
    >
  >({});

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPosts([]);
      setLikes([]);
      setComments([]);
      setProfileEvents([]);
      setLoading(false);

      return;
    }

    setLoading(true);
    setError("");

    let profileReady = false;
    let postsReady = false;
    let likesReady = false;
    let commentsReady = false;
    let profileEventsReady =
      false;

    const ready = () => {
      if (
        profileReady &&
        postsReady &&
        likesReady &&
        commentsReady &&
        profileEventsReady
      ) {
        setLoading(false);
      }
    };

    const fail = (
      message: string
    ) => {
      setError(message);
      setLoading(false);
    };

    const unsubscribeProfile =
      appService.subscribeProfile(
        user.id,
        (nextProfile) => {
          setProfile(
            nextProfile
          );

          profileReady = true;

          ready();
        },
        fail
      );

    const unsubscribePosts =
      appService.subscribeReflections(
        user.id,
        "public",
        (nextPosts) => {
          setPosts(nextPosts);

          postsReady = true;

          ready();
        },
        fail
      );

    const services =
      getFirebaseServices();

    if (!services) {
      setLikes([]);
      setComments([]);
      setProfileEvents([]);

      likesReady = true;
      commentsReady = true;
      profileEventsReady = true;

      ready();

      return () => {
        unsubscribeProfile();
        unsubscribePosts();
      };
    }

    const unsubscribeLikes =
      onSnapshot(
        query(
          collection(
            services.db,
            "reflectionLikes"
          ),
          where(
            "userId",
            "==",
            user.id
          )
        ),
        (snapshot) => {
          const nextLikes =
            snapshot.docs
              .map((item) =>
                parseLike(
                  item.id,
                  item.data()
                )
              )
              .filter(
                (
                  like
                ): like is ReflectionLike =>
                  Boolean(like)
              );

          setLikes(
            nextLikes
          );

          likesReady = true;

          ready();
        },
        () => {
          likesReady = true;

          setLikes([]);

          ready();
        }
      );

    const unsubscribeComments =
      onSnapshot(
        query(
          collection(
            services.db,
            "reflectionComments"
          ),
          where(
            "userId",
            "==",
            user.id
          )
        ),
        (snapshot) => {
          const nextComments =
            snapshot.docs
              .map((item) =>
                parseComment(
                  item.id,
                  item.data()
                )
              )
              .filter(
                (
                  comment
                ): comment is ReflectionComment =>
                  Boolean(
                    comment
                  )
              );

          setComments(
            nextComments
          );

          commentsReady =
            true;

          ready();
        },
        () => {
          commentsReady =
            true;

          setComments([]);

          ready();
        }
      );

    const unsubscribeProfileEvents =
      onSnapshot(
        query(
          collection(
            services.db,
            "profileJourneyEvents"
          ),
          where(
            "userId",
            "==",
            user.id
          )
        ),
        (snapshot) => {
          const events =
            snapshot.docs
              .map((item) =>
                parseProfileJourneyEvent(
                  item.id,
                  item.data()
                )
              )
              .filter(
                (
                  event
                ): event is ProfileJourneyEvent =>
                  Boolean(
                    event
                  )
              );

          setProfileEvents(
            events
          );

          profileEventsReady =
            true;

          ready();
        },
        () => {
          profileEventsReady =
            true;

          setProfileEvents([]);

          ready();
        }
      );

    return () => {
      unsubscribeProfile();
      unsubscribePosts();
      unsubscribeLikes();
      unsubscribeComments();
      unsubscribeProfileEvents();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setReflectionMetadata(
        {}
      );

      return;
    }

    const reflectionIds =
      Array.from(
        new Set([
          ...likes.map(
            (like) =>
              like.reflectionId
          ),

          ...comments.map(
            (comment) =>
              comment.reflectionId
          )
        ])
      );

    if (
      !reflectionIds.length
    ) {
      setReflectionMetadata(
        {}
      );

      return;
    }

    const services =
      getFirebaseServices();

    if (!services) {
      setReflectionMetadata(
        {}
      );

      return;
    }

    let active = true;

    const loadMetadata =
      async () => {
        const entries =
          await Promise.all(
            reflectionIds.map(
              async (
                reflectionId
              ) => {
                try {
                  const reflectionSnapshot =
                    await getDoc(
                      doc(
                        services.db,
                        "reflectionPosts",
                        reflectionId
                      )
                    );

                  if (
                    !reflectionSnapshot.exists()
                  ) {
                    return null;
                  }

                  const reflectionData =
                    reflectionSnapshot.data();

                  const ownerId =
                    typeof reflectionData.userId ===
                    "string"
                      ? reflectionData.userId
                      : "";

                  const title =
                    typeof reflectionData.title ===
                    "string"
                      ? reflectionData.title
                      : "";

                  const content =
                    typeof reflectionData.content ===
                    "string"
                      ? reflectionData.content
                      : "";

                  let ownerName =
                    "another user";

                  if (ownerId) {
                    try {
                      const profileSnapshot =
                        await getDoc(
                          doc(
                            services.db,
                            "socialProfiles",
                            ownerId
                          )
                        );

                      if (
                        profileSnapshot.exists()
                      ) {
                        const socialData =
                          profileSnapshot.data();

                        if (
                          typeof socialData.profileName ===
                          "string" &&
                          socialData.profileName.trim()
                        ) {
                          ownerName =
                            socialData.profileName;
                        }
                      }
                    } catch {
                      // Keep generic owner name.
                    }
                  }

                  return [
                    reflectionId,
                    {
                      reflectionId,
                      title,
                      content,
                      ownerId,
                      ownerName
                    }
                  ] as const;
                } catch {
                  return null;
                }
              }
            )
          );

        if (!active) {
          return;
        }

        setReflectionMetadata(
          Object.fromEntries(
            entries.filter(
              (
                entry
              ): entry is NonNullable<
                typeof entry
              > =>
                Boolean(entry)
            )
          )
        );
      };

    void loadMetadata();

    return () => {
      active = false;
    };
  }, [
    comments,
    likes,
    user?.id
  ]);

  const items =
    useMemo<
      JourneyItem[]
    >(() => {
      if (!user) {
        return [];
      }

      const journey:
        JourneyItem[] = [];

      /*
       * 1. ACCOUNT CREATION
       *
       * This is always the first
       * Saintagram journey event.
       */
      journey.push({
        id: `account-${user.id}`,
        date: user.createdAt,
        title:
          "Saintagram account created",
        description:
          "Your Saintagram journey began.",
        type: "account",
        priority: 0
      });

      /*
       * 2. PROFILE CREATED
       *
       * The image chosen while the
       * account/profile was being created
       * is intentionally NOT added.
       */
      if (profile) {
        journey.push({
          id: "profile-created",
          date: profile.createdAt,
          title:
            "Profile Before God created",
          description:
            "You completed your Profile Before God.",
          type:
            "profile-created",
          priority: 10
        });
      }

      /*
       * 3. USER'S PUBLIC REFLECTIONS
       */
      posts.forEach(
        (post) => {
          journey.push({
            id: `reflection-${post.id}`,
            date:
              post.createdAt,
            title:
              post.title ||
              "A moment God saw",
            description:
              post.content,
            type:
              "reflection",
            priority: 20,
            ...(post.media?.length ? { media: post.media } : {})
          });
        }
      );

      /*
       * 4. SPECIFIC PROFILE CHANGES
       *
       * No current-profile snapshot is
       * placed in the journey.
       */
      profileEvents.forEach(
        (event) => {
          journey.push({
            id:
              `profile-update-${event.id}`,

            date:
              event.createdAt,

            title:
              event.imagePath
                ? "Profile picture updated"
                : "Profile updated",

            description:
              event.changes
                .map(
                  (change) =>
                    `• ${change}`
                )
                .join("\n"),

            type:
              "profile-update",

            priority: 30,

            ...(event.imagePath
              ? {
                  imagePath:
                    event.imagePath
                }
              : {})
          });
        }
      );

      /*
       * 5. LIKES MADE BY USER
       */
      likes.forEach(
        (like) => {
          const metadata =
            reflectionMetadata[
              like.reflectionId
            ];

          const ownerName =
            metadata?.ownerName ??
            "another user";

          journey.push({
            id: `like-${like.id}`,
            date:
              like.createdAt,
            title:
              "Liked a reflection",
            description:
              `You liked ${ownerName}'s ${reflectionDescription(
                metadata
              )}.`,
            type: "like",
            priority: 40
          });
        }
      );

      /*
       * 6. COMMENTS AND REPLIES
       */
      comments.forEach(
        (comment) => {
          const metadata =
            reflectionMetadata[
              comment.reflectionId
            ];

          const ownerName =
            metadata?.ownerName ??
            "another user";

          const isReply =
            Boolean(
              comment.parentCommentId
            );

          journey.push({
            id:
              `${
                isReply
                  ? "reply"
                  : "comment"
              }-${comment.id}`,

            date:
              comment.createdAt,

            title: isReply
              ? "Replied to a comment"
              : "Commented on a reflection",

            description:
              `${
                isReply
                  ? "You replied in"
                  : "You commented on"
              } ${ownerName}'s ${reflectionDescription(
                metadata
              )}:\n\n“${comment.content}”`,

            type: isReply
              ? "reply"
              : "comment",

            priority: isReply
              ? 51
              : 50
          });
        }
      );

      /*
       * OLDEST AT TOP,
       * NEWEST AT BOTTOM.
       *
       * priority resolves events with
       * identical timestamps.
       */
      return journey.sort(
        (a, b) => {
          const timeDifference =
            new Date(
              a.date
            ).getTime() -
            new Date(
              b.date
            ).getTime();

          if (
            timeDifference !== 0
          ) {
            return timeDifference;
          }

          const priorityDifference =
            a.priority -
            b.priority;

          if (
            priorityDifference !==
            0
          ) {
            return priorityDifference;
          }

          return a.id.localeCompare(
            b.id
          );
        }
      );
    }, [
      comments,
      likes,
      posts,
      profile,
      profileEvents,
      reflectionMetadata,
      user
    ]);

  if (loading) {
    return (
      <LoadingState label="Tracing your journey…" />
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

  if (!items.length) {
    return (
      <EmptyState
        icon={BookHeart}
        title="Your journey is just beginning"
        description="Your Saintagram activity will appear here as your journey grows."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <section
        className="surface p-5 sm:p-8 lg:mx-auto lg:w-full lg:max-w-4xl"
        aria-labelledby="timeline-title"
      >
        <div className="mb-7">

          <h2
            id="timeline-title"
            className="mt-2 font-serif text-2xl font-bold"
          >
            Your spiritual timeline
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted">
            Your journey from
            oldest to newest.
          </p>
        </div>

        <ol className="relative ml-4 border-l-2 border-sage-100 pl-8">
          {items.map(
            (item) => {
              const Icon =
                item.type ===
                "account"
                  ? UserRoundPlus
                  : item.type ===
                      "profile-created"
                    ? BookHeart
                    : item.type ===
                        "reflection"
                      ? Sparkles
                      : item.type ===
                          "profile-update"
                        ? Edit3
                        : item.type ===
                            "like"
                          ? Heart
                          : MessageCircle;

              const markerClass =
                item.type ===
                "account"
                  ? "bg-violet-600 text-white"
                  : item.type ===
                      "profile-created"
                    ? "bg-clay-50 text-clay-600"
                    : item.type ===
                        "reflection"
                      ? "bg-sage-600 text-white"
                      : item.type ===
                          "profile-update"
                        ? "bg-gray-100 text-gold-700"
                        : item.type ===
                            "like"
                          ? "bg-clay-50 text-clay-600"
                          : "bg-sage-100 text-sage-700";

              return (
                <li
                  key={
                    item.id
                  }
                  className="relative pb-9 last:pb-0"
                >
                  <span
                    className={`absolute -left-[3rem] top-0 grid size-8 place-items-center rounded-full border-4 border-paper ${markerClass}`}
                  >
                    <Icon
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  </span>

                  <time
                    dateTime={
                      item.date
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sage-600"
                  >
                    <CalendarDays
                      className="size-3.5"
                      aria-hidden="true"
                    />

                    {formatMilitaryDateTime(
                      item.date
                    )}
                  </time>

                  <h3 className="mt-2 font-serif text-xl font-bold">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="user-content mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">
                      {item.description}
                    </p>
                  )}

                  {item.media?.length ? (
                    <ReflectionMediaView media={item.media} />
                  ) : null}

                  {item.imagePath && (
                    <JourneyImagePreview
                      imagePath={item.imagePath}
                    />
                  )}
                </li>
              );
            }
          )}
        </ol>
      </section>
    </div>
  );
}
