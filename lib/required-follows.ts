import "server-only";

import { FieldValue, type DocumentReference, type WriteBatch } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";

const FOLLOW_GRAPH_VERSION = "2026-08-21-v2";
const ADMIN_PROFILE_NAME = "Saintagram Admin";
const ADMIN_PROFILE_BIO = "Official reflections from Saintagram.";
const ADMIN_HASHTAG = "#Saintagram";
const BATCH_SIZE = 400;

type StoredDoc = {
  ref: DocumentReference;
  data: Record<string, unknown>;
};

type RequiredFollow = {
  id: string;
  followerId: string;
  followingId: string;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function commitChunks(
  operations: Array<(batch: WriteBatch) => void>
): Promise<void> {
  const db = getFirebaseAdminFirestore();
  for (let index = 0; index < operations.length; index += BATCH_SIZE) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + BATCH_SIZE)) {
      operation(batch);
    }
    await batch.commit();
  }
}

function requiredFollowMap(
  userIds: string[],
  coreAdminIds: string[],
  sharedAdminIds: string[]
): Map<string, RequiredFollow> {
  const required = new Map<string, RequiredFollow>();

  const add = (followerId: string, followingId: string) => {
    if (!followerId || !followingId || followerId === followingId) return;
    const id = `${followerId}_${followingId}`;
    required.set(id, { id, followerId, followingId });
  };

  for (const userId of userIds) {
    for (const adminId of coreAdminIds) add(userId, adminId);
    for (const sharedAdminId of sharedAdminIds) {
      add(userId, sharedAdminId);
      add(sharedAdminId, userId);
    }
  }

  return required;
}

async function loadOfficialAdminIds(): Promise<string[]> {
  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();
  const profiles = await db
    .collection("socialProfiles")
    .where("profileName", "==", ADMIN_PROFILE_NAME)
    .get();

  const adminIds: string[] = [];

  for (const profile of profiles.docs) {
    const data = profile.data() ?? {};
    if (
      stringValue(data.spiritualBio) !== ADMIN_PROFILE_BIO ||
      stringValue(data.heavenlyHashtag) !== ADMIN_HASHTAG
    ) {
      continue;
    }

    try {
      const authUser = await auth.getUser(profile.id);
      if (authUser.customClaims?.admin === true) {
        adminIds.push(profile.id);
      }
    } catch {
      // Ignore stale profile documents whose Firebase Auth account no longer exists.
    }
  }

  return Array.from(new Set(adminIds));
}

async function loadUserRoles() {
  const db = getFirebaseAdminFirestore();
  const [usersSnapshot, officialAdminIds] = await Promise.all([
    db.collection("users").get(),
    loadOfficialAdminIds()
  ]);
  const userIds: string[] = [];
  const sharedAdminIds: string[] = [];

  for (const document of usersSnapshot.docs) {
    const data = document.data() ?? {};
    userIds.push(document.id);
    if (data.adminAccessGranted === true) sharedAdminIds.push(document.id);
  }

  return {
    userIds,
    coreAdminIds: officialAdminIds,
    sharedAdminIds
  };
}

async function createMissingRequiredFollows(
  required: Map<string, RequiredFollow>
): Promise<void> {
  if (!required.size) return;
  const db = getFirebaseAdminFirestore();
  const followsSnapshot = await db.collection("follows").get();
  const existing = new Set(followsSnapshot.docs.map((document) => document.id));
  const missing = Array.from(required.values()).filter(({ id }) => !existing.has(id));
  if (!missing.length) return;

  const createdIds: string[] = [];
  try {
    for (let index = 0; index < missing.length; index += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = missing.slice(index, index + BATCH_SIZE);
      for (const follow of chunk) {
        const ref = db.collection("follows").doc(follow.id);
        batch.set(ref, {
          id: follow.id,
          followerId: follow.followerId,
          followingId: follow.followingId,
          createdAt: FieldValue.serverTimestamp()
        });
      }
      await batch.commit();
      createdIds.push(...chunk.map(({ id }) => id));
    }
  } catch (error) {
    await commitChunks(
      createdIds.map((id) => (batch) => batch.delete(db.collection("follows").doc(id)))
    ).catch(() => undefined);
    throw error;
  }

  const requestsSnapshot = await db.collection("followRequests").get();
  const obsolete = requestsSnapshot.docs.filter((document) => required.has(document.id));
  await commitChunks(
    obsolete.map((document) => (batch) => batch.delete(document.ref))
  ).catch((error) => {
    console.error("Obsolete follow requests could not be cleaned up", error);
  });
}

export async function syncRequiredFollowsForUser(userId: string): Promise<void> {
  const { userIds, coreAdminIds, sharedAdminIds } = await loadUserRoles();
  if (!userIds.includes(userId)) return;

  const allRequired = requiredFollowMap(
    userIds,
    coreAdminIds,
    sharedAdminIds
  );
  const involvingUser = new Map(
    Array.from(allRequired.entries()).filter(
      ([, follow]) =>
        follow.followerId === userId || follow.followingId === userId
    )
  );
  await createMissingRequiredFollows(involvingUser);
}

export async function grantSharedAdminFollowGraph(userId: string): Promise<void> {
  const { userIds } = await loadUserRoles();
  if (!userIds.includes(userId)) throw new Error("USER_NOT_FOUND");

  const required = new Map<string, RequiredFollow>();
  for (const otherUserId of userIds) {
    if (otherUserId === userId) continue;
    for (const [followerId, followingId] of [
      [userId, otherUserId],
      [otherUserId, userId]
    ] as const) {
      const id = `${followerId}_${followingId}`;
      required.set(id, { id, followerId, followingId });
    }
  }
  await createMissingRequiredFollows(required);
}

export async function revokeSharedAdminFollowGraph(userId: string): Promise<void> {
  const db = getFirebaseAdminFirestore();
  const [outgoing, incoming, outgoingRequests, incomingRequests] = await Promise.all([
    db.collection("follows").where("followerId", "==", userId).get(),
    db.collection("follows").where("followingId", "==", userId).get(),
    db.collection("followRequests").where("requesterId", "==", userId).get(),
    db.collection("followRequests").where("targetUserId", "==", userId).get()
  ]);

  const byPath = new Map<string, StoredDoc>();
  for (const document of [
    ...outgoing.docs,
    ...incoming.docs,
    ...outgoingRequests.docs,
    ...incomingRequests.docs
  ]) {
    const path = (document.ref as unknown as { path?: string }).path ?? `${document.id}`;
    if (!byPath.has(path)) {
      byPath.set(path, {
        ref: document.ref as StoredDoc["ref"],
        data: (document.data() ?? {}) as Record<string, unknown>
      });
    }
  }

  const stored = Array.from(byPath.values());
  try {
    await commitChunks(stored.map((item) => (batch) => batch.delete(item.ref)));

    // Restore only relationships that are mandatory for other active admins.
    await syncRequiredFollowsForUser(userId);
  } catch (error) {
    await commitChunks(
      stored.map((item) => (batch) => batch.set(item.ref, item.data))
    ).catch(() => undefined);
    throw error;
  }
}

export async function ensureRequiredFollowGraphBackfilled(): Promise<void> {
  const db = getFirebaseAdminFirestore();
  const markerRef = db.collection("systemState").doc("requiredFollowGraph");
  const marker = await markerRef.get();
  if (marker.exists && stringValue(marker.data()?.version) === FOLLOW_GRAPH_VERSION) {
    return;
  }

  const { userIds, coreAdminIds, sharedAdminIds } = await loadUserRoles();
  await createMissingRequiredFollows(
    requiredFollowMap(userIds, coreAdminIds, sharedAdminIds)
  );
  await markerRef.set({
    version: FOLLOW_GRAPH_VERSION,
    completedAt: FieldValue.serverTimestamp()
  });
}
