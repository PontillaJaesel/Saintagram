"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LockKeyhole, UsersRound } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { FollowButton } from "@/components/social/follow-button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  downloadFirebaseProfileImage,
  isLocalProfileImageSource
} from "@/lib/profile-images";
import {
  getSocialConnections,
  type SocialConnectionsResponse
} from "@/lib/social-connections";
import type { SocialProfile } from "@/types";

type ConnectionsTab = "following" | "followers";

function ConnectionAvatar({ profile }: { profile: SocialProfile }) {
  const { mode, user } = useAuth();
  const [src, setSrc] = useState(
    profile.imagePath.startsWith("data:image/") ? profile.imagePath : ""
  );

  useEffect(() => {
    let active = true;
    const path = profile.imagePath;
    if (!path) {
      setSrc("");
      return () => undefined;
    }
    if (isLocalProfileImageSource(path)) {
      setSrc(mode === "local" ? path : "");
      return () => undefined;
    }
    if (!user) return () => undefined;
    void downloadFirebaseProfileImage(path)
      .then((url) => active && setSrc(url))
      .catch(() => active && setSrc(""));
    return () => {
      active = false;
    };
  }, [mode, profile.imagePath, user?.id]);

  return src ? (
    <img
      src={src}
      alt={`${profile.profileName} profile picture`}
      className="size-12 shrink-0 rounded-full border border-sage-100 object-cover shadow-sm"
    />
  ) : (
    <span className="grid size-12 shrink-0 place-items-center rounded-full border border-sage-100 bg-sage-50 font-serif text-lg font-bold text-sage-700 shadow-sm">
      {profile.profileName.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function SocialConnectionsView({ userId }: { userId: string }) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const searchParams = useSearchParams();
  const initialTab: ConnectionsTab =
    searchParams.get("tab") === "followers" ? "followers" : "following";
  const [tab, setTab] = useState<ConnectionsTab>(initialTab);
  const [data, setData] = useState<SocialConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!currentUserId || !userId) return;
    setLoading(true);
    setError("");
    try {
      setData(await getSocialConnections(userId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The follower list could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [currentUserId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Opening connections…" />;

  if (error || !data?.profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href={currentUserId === userId ? "/profile" : `/users/${userId}`}
          aria-label="Back to profile"
          title="Back to profile"
          className="grid size-11 place-items-center rounded-full border border-sage-100 bg-paper text-ink shadow-sm transition hover:bg-sage-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="surface p-7 text-center" role="alert">
          <p className="font-bold text-clay-600">{error || "Profile not found."}</p>
        </div>
      </div>
    );
  }

  const profile = data.profile;
  const entries = tab === "followers" ? data.followers : data.following;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href={currentUserId === userId ? "/profile" : `/users/${userId}`}
        aria-label="Back to profile"
        title="Back to profile"
        className="grid size-11 place-items-center rounded-full border border-sage-100 bg-paper text-ink shadow-sm transition hover:bg-sage-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Link>

      <section className="surface overflow-hidden p-0">
        <div className="border-b border-sage-100 px-5 py-5 sm:px-7">
          <p className="eyebrow">Connections</p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-ink sm:text-3xl">
            {profile.profileName}
          </h1>
        </div>

        <div className="relative grid grid-cols-2 border-b border-sage-100" role="tablist">
          <span
            className="absolute bottom-0 left-0 h-[3px] w-1/2 rounded-t-full bg-sage-600 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${tab === "following" ? 0 : 100}%)` }}
            aria-hidden="true"
          />
          <button
            type="button"
            role="tab"
            aria-selected={tab === "following"}
            className={`min-h-14 px-4 text-sm transition-colors ${
              tab === "following" ? "font-bold text-ink" : "font-semibold text-muted hover:text-ink"
            }`}
            onClick={() => setTab("following")}
          >
            <strong>{data.followingCount}</strong> Following
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "followers"}
            className={`min-h-14 px-4 text-sm transition-colors ${
              tab === "followers" ? "font-bold text-ink" : "font-semibold text-muted hover:text-ink"
            }`}
            onClick={() => setTab("followers")}
          >
            <strong>{data.followersCount}</strong> Followers
          </button>
        </div>

        <div className="min-h-64 p-4 sm:p-5">
          {!data.canViewConnections ? (
            <EmptyState
              icon={LockKeyhole}
              title="This connection list is private"
              description={`Follow ${profile.profileName} and wait for approval before viewing who they follow and who follows them.`}
            />
          ) : entries.length ? (
            <div className="space-y-2" role="tabpanel">
              {entries.map((entry) => (
                <div
                  key={entry.userId}
                  className="flex items-center gap-3 rounded-2xl border border-sage-100 bg-paper px-3 py-3 transition hover:bg-sage-50/50 sm:px-4"
                >
                  <Link
                    href={`/users/${entry.userId}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <ConnectionAvatar profile={entry} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-serif text-base font-bold text-ink">
                          {entry.profileName}
                        </p>
                        {entry.isPrivateAccount && (
                          <LockKeyhole className="size-3.5 shrink-0 text-muted" aria-label="Private account" />
                        )}
                      </div>
                      {entry.heavenlyHashtag && (
                        <p className="truncate text-xs font-semibold text-sage-600">
                          {entry.heavenlyHashtag}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="shrink-0 [&_button]:min-h-9 [&_button]:px-3 [&_button]:text-xs">
                    <FollowButton
                      targetUserId={entry.userId}
                      targetIsPrivate={entry.isPrivateAccount}
                      onStateChange={() => void load()}
                      followingLabel="Unfollow"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={UsersRound}
              title={tab === "followers" ? "No followers yet" : "Not following anyone yet"}
              description={
                tab === "followers"
                  ? `${profile.profileName} does not have any followers yet.`
                  : `${profile.profileName} is not following anyone yet.`
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
