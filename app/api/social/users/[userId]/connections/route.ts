import { NextResponse } from "next/server";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return "";
    }
  }
  return "";
}

function socialProfile(documentId: string, value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const userId = asString(data.userId);
  const profileName = asString(data.profileName).trim();
  if (!userId || userId !== documentId || !profileName) return null;

  return {
    id: documentId,
    userId,
    profileName,
    coverColor: asString(data.coverColor),
    coverImageId: asString(data.coverImageId),
    coverImagePath: asString(data.coverImagePath),
    imagePath: asString(data.imagePath),
    spiritualBio: asString(data.spiritualBio),
    heavenlyHashtag: asString(data.heavenlyHashtag),
    isPrivateAccount: data.isPrivateAccount === true,
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt)
  };
}

type ServerSocialProfile = NonNullable<ReturnType<typeof socialProfile>>;

function tokenFrom(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return /^Bearer ([^\s]+)$/.exec(authorization)?.[1] ?? "";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = tokenFrom(request);
    if (!token) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401, headers: noStoreHeaders }
      );
    }

    // Verify the Firebase ID token locally. Do not pass `true` here: that
    // performs an additional remote revocation/user lookup, which is unreliable
    // in the Cloudflare Workers runtime and can reject otherwise valid sessions.
    const verified = await getFirebaseAdminAuth().verifyIdToken(token);
    const { userId } = await params;
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const db = getFirebaseAdminFirestore();
    const targetSnapshot = await db.collection("socialProfiles").doc(userId).get();
    if (!targetSnapshot.exists) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const profile = socialProfile(targetSnapshot.id, targetSnapshot.data());
    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const [followersSnapshot, followingSnapshot] = await Promise.all([
      db.collection("follows").where("followingId", "==", userId).get(),
      db.collection("follows").where("followerId", "==", userId).get()
    ]);

    const isOwner = verified.uid === userId;
    let followingTarget = isOwner;
    if (!followingTarget && profile.isPrivateAccount) {
      const followSnapshot = await db
        .collection("follows")
        .doc(`${verified.uid}_${userId}`)
        .get();
      followingTarget = followSnapshot.exists;
    }

    const canViewConnections =
      isOwner || !profile.isPrivateAccount || followingTarget;
    const summaryOnly = new URL(request.url).searchParams.get("summary") === "1";

    const basePayload = {
      profile,
      followersCount: followersSnapshot.size,
      followingCount: followingSnapshot.size,
      canViewConnections
    };

    if (summaryOnly || !canViewConnections) {
      return NextResponse.json(
        { ...basePayload, followers: [], following: [] },
        { headers: noStoreHeaders }
      );
    }

    const followerIds = followersSnapshot.docs
      .map((document) => asString(document.data().followerId))
      .filter(Boolean);
    const followingIds = followingSnapshot.docs
      .map((document) => asString(document.data().followingId))
      .filter(Boolean);
    const uniqueIds = Array.from(new Set([...followerIds, ...followingIds]));

    const profilePairs = await Promise.all(
      uniqueIds.map(async (id) => {
        const snapshot = await db.collection("socialProfiles").doc(id).get();
        return [id, snapshot.exists ? socialProfile(snapshot.id, snapshot.data()) : null] as const;
      })
    );
    const profileMap = new Map(profilePairs);
    const sortProfiles = (ids: string[]) =>
      ids
        .map((id) => profileMap.get(id) ?? null)
        .filter((item): item is ServerSocialProfile => item !== null)
        .sort((a, b) => a.profileName.localeCompare(b.profileName));

    return NextResponse.json(
      {
        ...basePayload,
        followers: sortProfiles(followerIds),
        following: sortProfiles(followingIds)
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error("[SOCIAL CONNECTIONS]", error);
    return NextResponse.json(
      { error: "The follower list could not be loaded." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
