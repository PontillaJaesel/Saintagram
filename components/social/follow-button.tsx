"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { appService } from "@/lib/app-service";

export function FollowButton({
  targetUserId
}: {
  targetUserId: string;
}) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetUserId) {
      setLoading(false);
      return;
    }

    let active = true;

    void appService
      .isFollowing(user.id, targetUserId)
      .then((value) => {
        if (active) setFollowing(value);
      })
      .catch(() => {
        if (active) setFollowing(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [targetUserId, user]);

  if (!user || user.id === targetUserId) return null;

  const toggle = async () => {
    if (saving) return;

    setSaving(true);

    try {
      if (following) {
        await appService.unfollowUser(user.id, targetUserId);
        setFollowing(false);
        notify("You unfollowed this profile.");
      } else {
        await appService.followUser(user.id, targetUserId);
        setFollowing(true);
        notify("You are now following this profile.");
      }
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "The follow request could not be completed.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      className={following ? "btn-secondary" : "btn-primary"}
      disabled={loading || saving}
      onClick={() => void toggle()}
    >
      {following ? (
        <UserCheck className="size-4" aria-hidden="true" />
      ) : (
        <UserPlus className="size-4" aria-hidden="true" />
      )}

      {saving
        ? "Saving…"
        : following
          ? "Following"
          : "Follow"}
    </button>
  );
}