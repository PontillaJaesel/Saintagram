import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import type { SocialProfile } from "@/types";

export interface SocialConnectionsResponse {
  profile: SocialProfile | null;
  followersCount: number;
  followingCount: number;
  canViewConnections: boolean;
  followers: SocialProfile[];
  following: SocialProfile[];
}

async function connectionRequest(
  userId: string,
  summaryOnly: boolean
): Promise<SocialConnectionsResponse> {
  if (!isFirebaseConfigured) {
    return {
      profile: null,
      followersCount: 0,
      followingCount: 0,
      canViewConnections: true,
      followers: [],
      following: []
    };
  }

  const services = getFirebaseServices();
  const currentUser = services?.auth.currentUser;
  if (!currentUser) {
    throw new Error("Please log in again.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch(
    `/api/social/users/${encodeURIComponent(userId)}/connections${summaryOnly ? "?summary=1" : ""}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | (Partial<SocialConnectionsResponse> & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "The follower list could not be loaded.");
  }

  return {
    profile: payload?.profile ?? null,
    followersCount:
      typeof payload?.followersCount === "number" ? payload.followersCount : 0,
    followingCount:
      typeof payload?.followingCount === "number" ? payload.followingCount : 0,
    canViewConnections: payload?.canViewConnections === true,
    followers: Array.isArray(payload?.followers) ? payload.followers : [],
    following: Array.isArray(payload?.following) ? payload.following : []
  };
}

export function getSocialConnectionSummary(userId: string) {
  return connectionRequest(userId, true);
}

export function getSocialConnections(userId: string) {
  return connectionRequest(userId, false);
}
