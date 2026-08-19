"use client";

import {
  useEffect,
  useState
} from "react";

import {
  Clock3,
  UserCheck,
  UserPlus
} from "lucide-react";

import {
  useAuth
} from "@/components/providers/auth-provider";

import {
  useToast
} from "@/components/providers/toast-provider";

import {
  followOrRequest,
  getFollowState,
  unfollowOrCancelRequest,
  type FollowState
} from "@/lib/social-community";

export function FollowButton({
  targetUserId,
  targetIsPrivate
}: {
  targetUserId: string;
  targetIsPrivate?: boolean;
}) {
  const { user } =
    useAuth();

  const { notify } =
    useToast();

  const [
    state,
    setState
  ] =
    useState<FollowState>(
      "none"
    );

  const [
    privateAccount,
    setPrivateAccount
  ] =
    useState(
      targetIsPrivate ??
        false
    );

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    saving,
    setSaving
  ] =
    useState(false);

  /*
   * ==========================================================
   * LOAD CURRENT FOLLOW STATE
   * ==========================================================
   */
  useEffect(() => {
    if (
      !user ||
      user.id ===
        targetUserId
    ) {
      setLoading(false);
      return;
    }

    let active = true;

    setLoading(true);

    void getFollowState(
      user.id,
      targetUserId
    )
      .then(
        (result) => {
          if (!active) {
            return;
          }

          setState(
            result.state
          );

          setPrivateAccount(
            result
              .targetIsPrivate
          );
        }
      )
      .catch(() => {
        if (!active) {
          return;
        }

        setState(
          "none"
        );

        setPrivateAccount(
          targetIsPrivate ??
            false
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    targetIsPrivate,
    targetUserId,
    user?.id
  ]);

  if (
    !user ||
    user.id === targetUserId
  ) {
    return null;
  }

  /*
   * ==========================================================
   * BUTTON ACTION
   * ==========================================================
   */
  const toggleFollow =
    async () => {
      if (
        saving ||
        loading
      ) {
        return;
      }

      console.log(
        "[FOLLOW BUTTON] Click",
        {
          currentUserId:
            user.id,

          targetUserId,

          currentState:
            state,

          privateAccount
        }
      );

      setSaving(true);

      try {
        /*
        * ========================================================
        * FOLLOWING -> UNFOLLOW
        * ========================================================
        */
        if (
          state ===
          "following"
        ) {
          console.log(
            "[FOLLOW BUTTON] Branch = UNFOLLOW"
          );

          const result =
            await unfollowOrCancelRequest(
              user.id,
              targetUserId
            );

          setState(
            result.state
          );

          setPrivateAccount(
            result.targetIsPrivate
          );

          notify(
            "You unfollowed this profile."
          );

          return;
        }

        /*
        * ========================================================
        * REQUESTED -> CANCEL REQUEST
        * ========================================================
        */
        if (
          state ===
          "requested"
        ) {
          console.log(
            "[FOLLOW BUTTON] Branch = CANCEL REQUEST"
          );

          const result =
            await unfollowOrCancelRequest(
              user.id,
              targetUserId
            );

          setState(
            result.state
          );

          setPrivateAccount(
            result.targetIsPrivate
          );

          notify(
            "Follow request cancelled."
          );

          return;
        }

        /*
        * ========================================================
        * NONE -> FOLLOW OR REQUEST
        * ========================================================
        */
        console.log(
          "[FOLLOW BUTTON] Branch = CREATE",
          {
            targetIsPrivate:
              privateAccount
          }
        );

        const result =
          await followOrRequest(
            user.id,
            targetUserId
          );

        console.log(
          "[FOLLOW BUTTON] CREATE completed",
          result
        );

        setState(
          result.state
        );

        setPrivateAccount(
          result.targetIsPrivate
        );

        if (
          result.state ===
          "requested"
        ) {
          notify(
            "Follow request sent."
          );
        } else {
          notify(
            "You are now following this profile."
          );
        }
      } catch (error) {
        console.error(
          "[FOLLOW BUTTON] Action failed",
          {
            state,
            privateAccount,
            currentUserId:
              user.id,
            targetUserId,
            error
          }
        );

        notify(
          error instanceof Error
            ? error.message
            : "The follow action could not be completed.",
          "error"
        );
      } finally {
        setSaving(false);
      }
    };

  /*
   * ==========================================================
   * LABEL
   * ==========================================================
   */
  let label =
    privateAccount
      ? "Request"
      : "Follow";

  if (
    state ===
    "following"
  ) {
    label =
      "Following";
  }

  if (
    state ===
    "requested"
  ) {
    label =
      "Requested";
  }

  if (loading) {
    label =
      "Loading…";
  }

  if (saving) {
    label =
      "Saving…";
  }

  return (
    <button
      type="button"
      className={
        state === "none"
          ? "btn-primary"
          : "btn-secondary"
      }
      disabled={
        loading ||
        saving
      }
      aria-pressed={
        state ===
        "following"
      }
      onClick={() =>
        void toggleFollow()
      }
      title={
        state ===
        "requested"
          ? "Click to cancel this follow request."
          : state ===
              "following"
            ? "Click to unfollow this profile."
            : privateAccount
              ? "Send a follow request."
              : "Follow this profile."
      }
    >
      {state ===
      "following" ? (
        <UserCheck
          className="size-4"
          aria-hidden="true"
        />
      ) : state ===
        "requested" ? (
        <Clock3
          className="size-4"
          aria-hidden="true"
        />
      ) : (
        <UserPlus
          className="size-4"
          aria-hidden="true"
        />
      )}

      {label}
    </button>
  );
}