import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { getFirebaseAuthUser } from "@/lib/firebase-auth-rest";
import { createFirebaseCustomToken } from "@/lib/firebase-custom-token";
import { getGoogleServiceAccountAccessToken } from "@/lib/google-service-account";

const HANDOFF_LIFETIME_MS = 2 * 60 * 1000;
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function handoffCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function projectId(): string {
  const value =
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (!value) {
    throw new Error("The Firebase project ID is not configured.");
  }

  return value;
}

type RawHandoffDocument = {
  updateTime?: string;
  fields?: {
    userId?: { stringValue?: string };
    expiresAt?: { stringValue?: string };
  };
};

async function claimAdminHandoff(code: string): Promise<{
  userId: string;
  expiresAt: number;
}> {
  const documentUrl = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId()
    )}/databases/(default)/documents/adminHandoffs/${encodeURIComponent(code)}`
  );
  const accessToken = await getGoogleServiceAccountAccessToken([FIRESTORE_SCOPE]);
  const response = await fetch(documentUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });

  if (response.status === 404) {
    throw new Error("INVALID_HANDOFF");
  }
  if (!response.ok) {
    throw new Error(`Admin handoff lookup failed (${response.status}).`);
  }

  const document = (await response.json()) as RawHandoffDocument;
  const updateTime = document.updateTime?.trim() ?? "";
  const userId = document.fields?.userId?.stringValue?.trim() ?? "";
  const expiresAtText = document.fields?.expiresAt?.stringValue?.trim() ?? "";
  const expiresAt = Date.parse(expiresAtText);

  if (
    !updateTime ||
    !/^[A-Za-z0-9:_-]{1,128}$/.test(userId) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    // Expired/malformed handoffs are consumed best-effort below as well, but
    // they are never accepted even if cleanup is unavailable.
    const cleanupUrl = new URL(documentUrl);
    cleanupUrl.searchParams.set("currentDocument.updateTime", updateTime);
    await fetch(cleanupUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    }).catch(() => undefined);
    throw new Error("INVALID_HANDOFF");
  }

  // Atomically consume this exact document version. Two concurrent redemption
  // attempts can both read the code, but only one can satisfy this precondition.
  const deleteUrl = new URL(documentUrl);
  deleteUrl.searchParams.set("currentDocument.updateTime", updateTime);
  const deletion = await fetch(deleteUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });

  if (deletion.status === 404 || deletion.status === 409 || deletion.status === 412) {
    throw new Error("INVALID_HANDOFF");
  }
  if (!deletion.ok) {
    throw new Error(`Admin handoff consumption failed (${deletion.status}).`);
  }

  return { userId, expiresAt };
}

export async function createAdminHandoff(userId: string): Promise<string> {
  const db = getFirebaseAdminFirestore();
  const userRef = db.collection("users").doc(userId);
  const [userSnapshot, existing] = await Promise.all([
    userRef.get(),
    db.collection("adminHandoffs").where("userId", "==", userId).get()
  ]);

  if (!userSnapshot.exists || userSnapshot.data()?.adminAccessGranted !== true) {
    throw new Error("SHARED_ADMIN_ACCESS_REQUIRED");
  }

  const code = handoffCode();
  const handoffRef = db.collection("adminHandoffs").doc(code);
  const batch = db.batch();

  for (const document of existing.docs) {
    batch.delete(document.ref);
  }

  batch.set(handoffRef, {
    id: code,
    userId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + HANDOFF_LIFETIME_MS).toISOString()
  });

  await batch.commit();
  return code;
}

export async function redeemAdminHandoff(code: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(code)) {
    throw new Error("INVALID_HANDOFF");
  }

  const { userId } = await claimAdminHandoff(code);
  const db = getFirebaseAdminFirestore();
  const [userSnapshot, authUser] = await Promise.all([
    db.collection("users").doc(userId).get(),
    getFirebaseAuthUser(userId)
  ]);

  if (
    !userSnapshot.exists ||
    userSnapshot.data()?.adminAccessGranted !== true ||
    !authUser ||
    authUser.disabled ||
    authUser.customClaims.admin !== true
  ) {
    throw new Error("SHARED_ADMIN_ACCESS_REQUIRED");
  }

  return createFirebaseCustomToken(userId);
}
