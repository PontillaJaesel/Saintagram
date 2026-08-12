"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState
} from "react";

import Link from "next/link";

import {
  CalendarDays,
  Heart,
  LoaderCircle,
  MessageCircle,
  Send,
  UserPlus
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";

import { appService } from "@/lib/app-service";
import { fiatCategoryLabel } from "@/lib/fiat";

import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";

import {
  formatFriendlyDate
} from "@/lib/validation";

import type {
  ReflectionComment,
  ReflectionLike,
  SocialFeedPost,
  SocialProfile
} from "@/types";

function SocialAvatar({
  imagePath,
  profileName,
  compact = false
}: {
  imagePath: string;
  profileName: string;
  compact?: boolean;
}) {
  const {
    loading,
    mode,
    user
  } = useAuth();

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

  const initial =
    profileName
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  if (src) {
    return (
      <div
        className={
          compact
            ? "size-9 shrink-0 overflow-hidden rounded-full border border-sage-100 bg-sage-50"
            : "size-12 shrink-0 overflow-hidden rounded-full border border-sage-100 bg-sage-50"
        }
      >
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

  return (
    <div
      className={
        compact
          ? "grid size-9 shrink-0 place-items-center rounded-full bg-sage-100 font-serif text-sm font-bold text-sage-700"
          : "grid size-12 shrink-0 place-items-center rounded-full bg-sage-100 font-serif text-lg font-bold text-sage-700"
      }
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function CommentItem({
  comment,
  profile,
  onReply
}: {
  comment: ReflectionComment;
  profile: SocialProfile | null;
  onReply?: () => void;
}) {
  const profileName =
    profile?.profileName ??
    "Saintagram user";

  const imagePath =
    profile?.imagePath ?? "";

  return (
    <div
      id={`comment-${comment.id}`}
      className="flex items-start gap-3"
    >
      <SocialAvatar
        imagePath={imagePath}
        profileName={profileName}
        compact
      />

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-sage-50 px-4 py-3">
          {profile ? (
            <Link
              href={`/users/${comment.userId}`}
              className="text-sm font-bold text-ink transition hover:text-sage-700"
            >
              {profileName}
            </Link>
          ) : (
            <p className="text-sm font-bold text-ink">
              {profileName}
            </p>
          )}

          <p className="user-content mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink">
            {comment.content}
          </p>
        </div>

        <div className="mt-1 flex items-center gap-3 px-2">
          <span className="text-xs text-muted">
            {formatFriendlyDate(
              comment.createdAt
            )}
          </span>

          {onReply && (
            <button
              type="button"
              className="text-xs font-bold text-sage-700 hover:underline"
              onClick={onReply}
            >
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SocialReflectionCard({
  post,
  initialFollowing = false,
  initialCommentsOpen = false
}: {
  post: SocialFeedPost;
  initialFollowing?: boolean;
  initialCommentsOpen?: boolean;
}) {
  const { user } = useAuth();
  const { notify } = useToast();

  const [likes, setLikes] =
    useState<ReflectionLike[]>([]);

  const [comments, setComments] =
    useState<ReflectionComment[]>([]);

  const [
    commentProfiles,
    setCommentProfiles
  ] = useState<
    Record<
      string,
      SocialProfile | null
    >
  >({});

  const [
    commentsOpen,
    setCommentsOpen
    ] = useState(
    initialCommentsOpen
    );
  
  const [
    ownerReminderVisible,
    setOwnerReminderVisible
    ] = useState(true);

  const [
    commentContent,
    setCommentContent
  ] = useState("");

  const [
    replyTarget,
    setReplyTarget
    ] =
    useState<ReflectionComment | null>(
        null
    );
  
  const [
    expandedThreads,
    setExpandedThreads
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    replyContent,
    setReplyContent
    ] = useState("");

  const [
    replyBusy,
    setReplyBusy
    ] = useState(false);

  const [
    following,
    setFollowing
  ] = useState(initialFollowing);

  const [
    checkingFollow,
    setCheckingFollow
  ] = useState(
    !initialFollowing
  );

  const [
    followBusy,
    setFollowBusy
  ] = useState(false);

  const [
    likeBusy,
    setLikeBusy
  ] = useState(false);

  const [
    commentBusy,
    setCommentBusy
  ] = useState(false);

  const [error, setError] =
    useState("");

  const isOwnPost =
    Boolean(
      user &&
      user.id === post.author.userId
    );

  const isPublic =
    post.isPrivate === false;

  const canInteract =
    Boolean(
      user &&
      isPublic &&
      !isOwnPost &&
      following
    );

  const topLevelComments =
    useMemo(
      () =>
        comments.filter(
          (comment) =>
            !comment.parentCommentId
        ),
      [comments]
    );

  const repliesByParent =
    useMemo(() => {
      const grouped:
        Record<
          string,
          ReflectionComment[]
        > = {};

      comments.forEach(
        (comment) => {
          if (
            !comment.parentCommentId
          ) {
            return;
          }

          if (
            !grouped[
              comment.parentCommentId
            ]
          ) {
            grouped[
              comment.parentCommentId
            ] = [];
          }

          grouped[
            comment.parentCommentId
          ].push(comment);
        }
      );

      return grouped;
    }, [comments]);

  const likedByCurrentUser =
    useMemo(
      () =>
        Boolean(
          user &&
          likes.some(
            (like) =>
              like.userId === user.id
          )
        ),
      [likes, user]
    );

  useEffect(() => {
    if (
      !user ||
      isOwnPost ||
      !isPublic
    ) {
      setCheckingFollow(false);
      return;
    }

    let active = true;

    void appService
      .isFollowing(
        user.id,
        post.author.userId
      )
      .then((result) => {
        if (active) {
          setFollowing(result);
        }
      })
      .catch(() => {
        if (active) {
          setFollowing(
            initialFollowing
          );
        }
      })
      .finally(() => {
        if (active) {
          setCheckingFollow(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    initialFollowing,
    isOwnPost,
    isPublic,
    post.author.userId,
    user
  ]);

  useEffect(() => {
    if (!isPublic) {
      setLikes([]);
      return;
    }

    return appService
      .subscribeReflectionLikes(
        post.id,
        (nextLikes) => {
          setLikes(nextLikes);
        },
        (message) => {
          setError(message);
        }
      );
  }, [
    isPublic,
    post.id
  ]);

  useEffect(() => {
    if (!isPublic) {
      setComments([]);
      return;
    }

    return appService
      .subscribeReflectionComments(
        post.id,
        (nextComments) => {
          setComments(
            nextComments
          );

          setError("");
        },
        (message) => {
          setError(message);
        }
      );
  }, [
    isPublic,
    post.id
  ]);

  useEffect(() => {
    let active = true;

    const userIds =
      Array.from(
        new Set(
          comments.map(
            (comment) =>
              comment.userId
          )
        )
      );

    if (!userIds.length) {
      setCommentProfiles({});
      return () => undefined;
    }

    void Promise.all(
      userIds.map(
        async (userId) => {
          try {
            const profile =
              await appService
                .getSocialProfile(
                  userId
                );

            return [
              userId,
              profile
            ] as const;
          } catch {
            return [
              userId,
              null
            ] as const;
          }
        }
      )
    ).then((entries) => {
      if (!active) {
        return;
      }

      setCommentProfiles(
        Object.fromEntries(
          entries
        )
      );
    });

    return () => {
      active = false;
    };
  }, [comments]);

  const followAuthor =
    async () => {
      if (
        !user ||
        isOwnPost ||
        following
      ) {
        return;
      }

      setFollowBusy(true);
      setError("");

      try {
        await appService.followUser(
          user.id,
          post.author.userId
        );

        setFollowing(true);

        notify(
          `You are now following ${post.author.profileName}.`
        );
      } catch (followError) {
        const message =
          followError instanceof Error
            ? followError.message
            : "This person could not be followed.";

        setError(message);
      } finally {
        setFollowBusy(false);
      }
    };

  const toggleLike =
    async () => {
      if (
        !user ||
        !canInteract ||
        likeBusy
      ) {
        return;
      }

      setLikeBusy(true);
      setError("");

      try {
        const nowLiked =
          await appService
            .toggleReflectionLike(
              user.id,
              post.id
            );

        notify(
          nowLiked
            ? "Reflection liked."
            : "Like removed."
        );
      } catch (likeError) {
        const message =
          likeError instanceof Error
            ? likeError.message
            : "The reflection could not be liked.";

        setError(message);
      } finally {
        setLikeBusy(false);
      }
    };

  const submitComment =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !user ||
        !canInteract ||
        commentBusy
      ) {
        return;
      }

      const content =
        commentContent.trim();

      if (!content) {
        setError(
          "Write a comment first."
        );

        return;
      }

      setCommentBusy(true);
      setError("");

      try {
        await appService
          .addReflectionComment(
            user.id,
            post.id,
            content
          );

        setCommentContent("");
        setCommentsOpen(true);

        notify(
          "Your comment was posted."
        );
      } catch (commentError) {
        const message =
          commentError instanceof Error
            ? commentError.message
            : "Your comment could not be posted.";

        setError(message);
      } finally {
        setCommentBusy(false);
      }
    };

    const submitReply =
        async (
            event:
            FormEvent<HTMLFormElement>
        ) => {
            event.preventDefault();

            if (
            !user ||
            !replyTarget ||
            replyBusy
            ) {
            return;
            }

            const content =
            replyContent.trim();

            if (!content) {
            setError(
                "Write a reply first."
            );

            return;
            }

            setReplyBusy(true);
            setError("");

            try {
            await appService
                .addReflectionReply(
                user.id,
                post.id,
                replyTarget.id,
                content
                );

            setReplyContent("");
            setReplyTarget(null);

            notify(
                "Your reply was posted."
            );
            } catch (replyError) {
            const message =
                replyError instanceof Error
                ? replyError.message
                : "Your reply could not be posted.";

            setError(message);
            } finally {
            setReplyBusy(false);
            }
        };

  /*
   * IMPORTANT:
   * This component is social/public only.
   *
   * If a private reflection is accidentally
   * passed here, render absolutely nothing.
   *
   * Private reflections continue using the
   * normal ReflectionCard component.
   */
  if (!isPublic) {
    return null;
  }

  const countDescendants = (
    commentId: string
  ): number => {
    const children =
      repliesByParent[
        commentId
      ] ?? [];

    return children.reduce(
      (total, child) =>
        total +
        1 +
        countDescendants(
          child.id
        ),
      0
    );
  };

  const renderReplyThread = (
    comment: ReflectionComment,
    rootCommentId: string,
    depth: number
  ): ReactNode => {
    const children =
      repliesByParent[
        comment.id
      ] ?? [];

    const expanded =
      expandedThreads[
        rootCommentId
      ] ?? false;

    /*
    * We visually indent only two levels.
    *
    * After that we keep the same indentation
    * so the conversation still fits on mobile.
    */
    const indentClass =
      depth === 0
        ? ""
        : depth === 1
          ? "ml-7 sm:ml-10"
          : "ml-10 sm:ml-14";

    /*
    * Before the thread is expanded:
    *
    * - show at most 2 children per level
    * - stop automatically expanding very
    *   deep reply chains
    */
    const visibleChildren =
      expanded
        ? children
        : depth >= 2
          ? []
          : children.slice(
              0,
              2
            );

    const hiddenDirectReplies =
      Math.max(
        0,
        children.length -
          visibleChildren.length
      );

    const hiddenDescendants =
      !expanded &&
      depth >= 2
        ? countDescendants(
            comment.id
          )
        : hiddenDirectReplies;

    const replyingToName =
      comment.replyToUserId
        ? commentProfiles[
            comment.replyToUserId
          ]?.profileName
        : null;

    return (
      <div
        key={comment.id}
        className={`${indentClass} space-y-3`}
      >
        <div>
          {replyingToName && (
            <p className="mb-1 ml-12 text-[11px] text-muted">
              Replying to{" "}
              <span className="font-semibold text-sage-700">
                {replyingToName}
              </span>
            </p>
          )}

          <CommentItem
            comment={comment}
            profile={
              commentProfiles[
                comment.userId
              ] ?? null
            }
            onReply={
              user
                ? () => {
                    setReplyTarget(
                      comment
                    );

                    setReplyContent(
                      ""
                    );

                    setError("");
                  }
                : undefined
            }
          />
        </div>

        {replyTarget?.id ===
          comment.id && (
          <form
            className="ml-10 border-l border-sage-100 pl-3"
            onSubmit={
              submitReply
            }
          >
            <p className="mb-2 text-xs text-muted">
              Replying to{" "}
              <strong className="text-ink">
                {
                  commentProfiles[
                    comment.userId
                  ]?.profileName ??
                  "this person"
                }
              </strong>
            </p>

            <div className="flex items-end gap-2">
              <textarea
                value={
                  replyContent
                }
                onChange={(
                  event
                ) =>
                  setReplyContent(
                    event.target.value
                  )
                }
                maxLength={500}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-2xl border border-sage-200 bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-muted focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                placeholder={`Reply to ${
                  commentProfiles[
                    comment.userId
                  ]?.profileName ??
                  "this person"
                }…`}
                disabled={
                  replyBusy
                }
                aria-label="Write a reply"
              />

              <button
                type="submit"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-700 text-white transition hover:bg-sage-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  replyBusy ||
                  !replyContent.trim()
                }
                aria-label="Post reply"
              >
                {replyBusy ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send
                    className="size-4"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-xs font-bold text-muted hover:text-ink"
                disabled={
                  replyBusy
                }
                onClick={() => {
                  setReplyTarget(
                    null
                  );

                  setReplyContent(
                    ""
                  );
                }}
              >
                Cancel
              </button>

              <span className="text-[11px] tabular-nums text-muted">
                {
                  replyContent.length
                }{" "}
                / 500
              </span>
            </div>
          </form>
        )}

        {visibleChildren.length >
          0 && (
          <div className="space-y-3">
            {visibleChildren.map(
              (child) =>
                renderReplyThread(
                  child,
                  rootCommentId,
                  depth + 1
                )
            )}
          </div>
        )}

        {hiddenDescendants > 0 &&
          !expanded && (
          <button
            type="button"
            className="ml-10 text-xs font-bold text-sage-700 transition hover:text-sage-800 hover:underline"
            onClick={() =>
              setExpandedThreads(
                (current) => ({
                  ...current,
                  [rootCommentId]:
                    true
                })
              )
            }
          >
            View{" "}
            {hiddenDescendants}{" "}
            more{" "}
            {hiddenDescendants === 1
              ? "reply"
              : "replies"}
          </button>
        )}
      </div>
    );
  };

  return (
    <article
        id={`reflection-${post.id}`}
        className="scroll-mt-24 overflow-hidden rounded-3xl border border-sage-100 bg-white shadow-sm"
    >
      {/* AUTHOR HEADER */}
      <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
        <Link
          href={`/users/${post.author.userId}`}
          className="group flex min-w-0 items-center gap-3"
        >
          <SocialAvatar
            imagePath={
              post.author.imagePath
            }
            profileName={
              post.author.profileName
            }
          />

          <div className="min-w-0">
            <p className="truncate font-serif text-base font-bold text-ink transition group-hover:text-sage-700">
              {
                post.author
                  .profileName
              }
            </p>

            {post.author
              .heavenlyHashtag && (
              <p className="mt-0.5 truncate text-xs font-semibold text-sage-600">
                {
                  post.author
                    .heavenlyHashtag
                }
              </p>
            )}
          </div>
        </Link>

        <Link
          href={`/users/${post.author.userId}`}
          className="profile-view-link shrink-0 rounded-full px-3 py-2 text-xs font-bold text-sage-700 transition hover:bg-sage-50"
        >
          View profile
        </Link>
      </header>

      {/* REFLECTION */}
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="ml-[3.75rem]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays
                className="size-3.5"
                aria-hidden="true"
              />

              <time
                dateTime={
                  post.createdAt
                }
              >
                {formatFriendlyDate(
                  post.createdAt
                )}
              </time>
            </span>

            {post.editedAt && (
              <span>
                Edited
              </span>
            )}
            {post.fiatCategory && <span className="rounded-full bg-gold-50 px-2.5 py-1 font-bold text-gold-700">Fi@ · {fiatCategoryLabel(post.fiatCategory)}</span>}
          </div>

          {post.title && (
            <h2 className="user-content mt-3 font-serif text-lg font-bold leading-7 text-ink">
              {post.title}
            </h2>
          )}

          <p className="user-content mt-3 whitespace-pre-wrap break-words text-base leading-7 text-ink">
            {post.content}
          </p>
        </div>
      </div>

      {/* LIKE + COMMENT ACTIONS */}
      <div className="border-t border-sage-100">
        <div className="grid grid-cols-2">
          <button
            type="button"
            className={`flex min-h-12 items-center justify-center gap-2 border-r border-sage-100 px-4 text-sm font-semibold transition ${
              likedByCurrentUser
                ? "text-clay-600"
                : canInteract
                  ? "text-muted hover:bg-clay-50 hover:text-clay-600"
                  : "cursor-not-allowed text-muted/60"
            }`}
            disabled={
              !canInteract ||
              likeBusy
            }
            aria-pressed={
              likedByCurrentUser
            }
            title={
              isOwnPost
                ? "You cannot like your own reflection."
                : !following
                  ? "Follow this person to like their reflection."
                  : undefined
            }
            onClick={() =>
              void toggleLike()
            }
          >
            {likeBusy ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Heart
                className={`size-4 ${
                  likedByCurrentUser
                    ? "fill-current"
                    : ""
                }`}
                aria-hidden="true"
              />
            )}

            <span>
              {likes.length === 0
                ? "Like"
                : likes.length === 1
                  ? "1 Like"
                  : `${likes.length} Likes`}
            </span>
          </button>

          <button
            type="button"
            className="flex min-h-12 items-center justify-center gap-2 px-4 text-sm font-semibold text-muted transition hover:bg-sage-50 hover:text-sage-700"
            aria-expanded={
              commentsOpen
            }
            aria-controls={`comments-${post.id}`}
            onClick={() =>
              setCommentsOpen(
                (current) =>
                  !current
              )
            }
          >
            <MessageCircle
              className="size-4"
              aria-hidden="true"
            />

            <span>
              {comments.length === 0
                ? "Comment"
                : comments.length === 1
                  ? "1 Comment"
                  : `${comments.length} Comments`}
            </span>
          </button>
        </div>
      </div>

      {/* FOLLOW REQUIREMENT */}
      {!isOwnPost &&
        !checkingFollow &&
        !following && (
          <div className="border-t border-sage-100 bg-sage-50/60 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted">
                Follow{" "}
                <strong className="text-ink">
                  {
                    post.author
                      .profileName
                  }
                </strong>{" "}
                to like or comment on
                this reflection.
              </p>

              <button
                type="button"
                className="btn-primary shrink-0"
                disabled={followBusy}
                onClick={() =>
                  void followAuthor()
                }
              >
                {followBusy ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <UserPlus
                    className="size-4"
                    aria-hidden="true"
                  />
                )}

                {followBusy
                  ? "Following…"
                  : "Follow"}
              </button>
            </div>
          </div>
        )}

      {/* OWNER MESSAGE */}
      {isOwnPost && ownerReminderVisible && (
        <div className="relative border border-sage-100 bg-sage-50 px-4 py-3 pr-11">
          <p className="text-xs leading-5 text-muted">
            This is your reflection. Likes and comments are for people who follow you.
          </p>

          <button
            type="button"
            className="absolute right-3 top-3 grid size-6 place-items-center rounded-full text-muted transition hover:bg-sage-100 hover:text-ink"
            aria-label="Close reminder"
            onClick={() =>
              setOwnerReminderVisible(
                false
              )
            }
          >
            <span
              className="text-base leading-none"
              aria-hidden="true"
            >
              ×
            </span>
          </button>
        </div>
      )}

      {/* COMMENTS */}
      {commentsOpen && (
        <section
          id={`comments-${post.id}`}
          className="border-t border-sage-100 px-5 py-5 sm:px-6"
          aria-label={`Comments on ${post.author.profileName}'s reflection`}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg font-bold text-ink">
              Comments
            </h3>

            <span className="text-xs font-semibold text-muted">
              {comments.length}
            </span>
          </div>

          {topLevelComments.length ? (
            <div className="space-y-5">
                {topLevelComments.map(
                (comment) => {
                  const replyCount =
                    countDescendants(
                      comment.id
                    );

                  return (
                    <div
                      key={comment.id}
                      className="space-y-3"
                    >
                      <CommentItem
                        comment={comment}
                        profile={
                          commentProfiles[
                            comment.userId
                          ] ?? null
                        }
                        onReply={
                          user
                            ? () => {
                                setReplyTarget(
                                  comment
                                );

                                setReplyContent(
                                  ""
                                );

                                setError("");
                              }
                            : undefined
                        }
                      />

                      {replyTarget?.id ===
                        comment.id && (
                        <form
                          className="ml-10 border-l border-sage-100 pl-3 sm:ml-12"
                          onSubmit={
                            submitReply
                          }
                        >
                          <p className="mb-2 text-xs text-muted">
                            Replying to{" "}
                            <strong className="text-ink">
                              {
                                commentProfiles[
                                  comment.userId
                                ]?.profileName ??
                                "this person"
                              }
                            </strong>
                          </p>

                          <div className="flex items-end gap-2">
                            <textarea
                              value={
                                replyContent
                              }
                              onChange={(
                                event
                              ) =>
                                setReplyContent(
                                  event.target.value
                                )
                              }
                              maxLength={500}
                              rows={2}
                              className="min-w-0 flex-1 resize-none rounded-2xl border border-sage-200 bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-muted focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                              placeholder="Write a reply…"
                              disabled={
                                replyBusy
                              }
                            />

                            <button
                              type="submit"
                              className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-700 text-white transition hover:bg-sage-800 disabled:opacity-50"
                              disabled={
                                replyBusy ||
                                !replyContent.trim()
                              }
                              aria-label="Post reply"
                            >
                              {replyBusy ? (
                                <LoaderCircle
                                  className="size-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Send
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          </div>
                        </form>
                      )}

                      {replyCount > 0 && (
                        <div className="space-y-3">
                          {(
                            repliesByParent[
                              comment.id
                            ] ?? []
                          )
                            .slice(
                              0,
                              expandedThreads[
                                comment.id
                              ]
                                ? undefined
                                : 2
                            )
                            .map(
                              (reply) =>
                                renderReplyThread(
                                  reply,
                                  comment.id,
                                  1
                                )
                            )}

                          {!expandedThreads[
                            comment.id
                          ] &&
                            replyCount > 2 && (
                            <button
                              type="button"
                              className="ml-10 text-xs font-bold text-sage-700 transition hover:underline sm:ml-12"
                              onClick={() =>
                                setExpandedThreads(
                                  (current) => ({
                                    ...current,
                                    [comment.id]:
                                      true
                                  })
                                )
                              }
                            >
                              View all{" "}
                              {replyCount} replies
                            </button>
                          )}

                          {expandedThreads[
                            comment.id
                          ] &&
                            replyCount > 2 && (
                            <button
                              type="button"
                              className="ml-10 text-xs font-bold text-muted transition hover:text-ink hover:underline sm:ml-12"
                              onClick={() =>
                                setExpandedThreads(
                                  (current) => ({
                                    ...current,
                                    [comment.id]:
                                      false
                                  })
                                )
                              }
                            >
                              Hide replies
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
            ) : (
            <p className="rounded-2xl bg-sage-50 px-4 py-5 text-center text-sm italic text-muted">
              No comments yet.
            </p>
          )}

          {/* COMMENT FORM:
              only followers can post */}
          {canInteract && (
            <form
              className="mt-5 flex items-end gap-2 border-t border-sage-100 pt-5"
              onSubmit={
                submitComment
              }
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`comment-${post.id}`}
                  className="sr-only"
                >
                  Write a comment
                </label>

                <textarea
                  id={`comment-${post.id}`}
                  value={
                    commentContent
                  }
                  onChange={(
                    event
                  ) =>
                    setCommentContent(
                      event.target
                        .value
                    )
                  }
                  maxLength={500}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-sage-200 bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-muted focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                  placeholder="Write a comment…"
                  disabled={
                    commentBusy
                  }
                />

                <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
                  {
                    commentContent
                      .length
                  }{" "}
                  / 500
                </p>
              </div>

              <button
                type="submit"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-700 text-white transition hover:bg-sage-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  commentBusy ||
                  !commentContent.trim()
                }
                aria-label="Post comment"
              >
                {commentBusy ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send
                    className="size-4"
                    aria-hidden="true"
                  />
                )}
              </button>
            </form>
          )}

          {!canInteract &&
            !isOwnPost && (
              <p className="mt-5 border-t border-sage-100 pt-4 text-center text-sm text-muted">
                Follow{" "}
                <strong>
                  {
                    post.author
                      .profileName
                  }
                </strong>{" "}
                to join the
                conversation.
              </p>
            )}
        </section>
      )}

      {error && (
        <div
          className="border-t border-clay-100 bg-clay-50 px-5 py-3 text-sm font-semibold text-clay-600 sm:px-6"
          role="alert"
        >
          {error}
        </div>
      )}
    </article>
  );
}
