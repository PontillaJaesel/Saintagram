import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { ADMIN_COLLECTIONS } from "@/lib/admin-data";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage
} from "@/lib/firebase-admin";

const FIRESTORE_COLLECTIONS = [...ADMIN_COLLECTIONS, "adminAuditLogs"] as const;

function containsUserId(value: unknown, userId: string, seen = new WeakSet<object>()): boolean {
  if (value === userId) return true;
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsUserId(item, userId, seen));
  return Object.values(value).some((item) => containsUserId(item, userId, seen));
}

async function allAuthUsers() {
  const auth = getFirebaseAdminAuth();
  const users: Awaited<ReturnType<typeof auth.listUsers>>["users"] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

export async function deleteAllNonAdminRecords(requestingAdminId: string) {
  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();
  const authUsers = await allAuthUsers();
  const adminIds = new Set(authUsers.filter((user) => user.customClaims?.admin === true).map((user) => user.uid));
  adminIds.add(requestingAdminId);

  let firestoreRecords = 0;
  for (const collectionName of FIRESTORE_COLLECTIONS) {
    while (true) {
      const snapshot = await db.collection(collectionName).limit(400).get();
      const deletable = snapshot.docs.filter((document) => collectionName !== "users" || !adminIds.has(document.id));
      if (!deletable.length) break;
      const batch = db.batch();
      deletable.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      firestoreRecords += deletable.length;
      if (snapshot.size < 400) break;
    }
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  let mediaFiles = 0;
  if (bucketName) {
    const bucket = getFirebaseAdminStorage().bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: "users/" });
    const deletableFiles = files.filter((file) => {
      const ownerId = file.name.split("/")[1];
      return ownerId && !adminIds.has(ownerId);
    });
    await Promise.all(deletableFiles.map((file) => file.delete({ ignoreNotFound: true })));
    mediaFiles = deletableFiles.length;
  }

  const nonAdminIds = authUsers.filter((user) => !adminIds.has(user.uid)).map((user) => user.uid);
  for (let index = 0; index < nonAdminIds.length; index += 1000) {
    await auth.deleteUsers(nonAdminIds.slice(index, index + 1000));
  }

  return { firestoreRecords, mediaFiles, userAccounts: nonAdminIds.length };
}

export async function deleteOneNonAdminUser(userId: string, requestingAdminId: string) {
  if (!userId || userId === requestingAdminId) throw new Error("ADMIN_ACCOUNT_PROTECTED");
  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();
  const authUser = await auth.getUser(userId).catch((error: { code?: string }) => {
    if (error.code === "auth/user-not-found") return null;
    throw error;
  });
  if (authUser?.customClaims?.admin === true) throw new Error("ADMIN_ACCOUNT_PROTECTED");

  const references: FirebaseFirestore.DocumentReference[] = [];
  for (const collectionName of FIRESTORE_COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    snapshot.docs.forEach((document) => {
      if (document.id === userId || containsUserId(document.data(), userId)) references.push(document.ref);
    });
  }
  let firestoreRecords = 0;
  for (let index = 0; index < references.length; index += 400) {
    const batch = db.batch();
    references.slice(index, index + 400).forEach((reference) => batch.delete(reference));
    await batch.commit();
    firestoreRecords += Math.min(400, references.length - index);
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  let mediaFiles = 0;
  if (bucketName) {
    const [files] = await getFirebaseAdminStorage().bucket(bucketName).getFiles({ prefix: `users/${userId}/` });
    await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
    mediaFiles = files.length;
  }
  if (authUser) await auth.deleteUser(userId);
  await db.collection("adminAuditLogs").add({ adminId: requestingAdminId, action: "user_data_deleted", targetUserId: null, createdAt: FieldValue.serverTimestamp(), metadata: { firestoreRecords, mediaFiles, userAccounts: authUser ? 1 : 0 } });
  return { firestoreRecords, mediaFiles, userAccounts: authUser ? 1 : 0 };
}

export async function deleteSelectedNonAdminUsers(userIds: string[], requestingAdminId: string) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) throw new Error("NO_USERS_SELECTED");
  const auth = getFirebaseAdminAuth();
  for (const userId of uniqueIds) {
    if (userId === requestingAdminId) throw new Error("ADMIN_ACCOUNT_PROTECTED");
    const user = await auth.getUser(userId).catch((error: { code?: string }) => {
      if (error.code === "auth/user-not-found") return null;
      throw error;
    });
    if (user?.customClaims?.admin === true) throw new Error("ADMIN_ACCOUNT_PROTECTED");
  }
  const total = { firestoreRecords: 0, mediaFiles: 0, userAccounts: 0 };
  for (const userId of uniqueIds) {
    const result = await deleteOneNonAdminUser(userId, requestingAdminId);
    total.firestoreRecords += result.firestoreRecords;
    total.mediaFiles += result.mediaFiles;
    total.userAccounts += result.userAccounts;
  }
  return { ...total, selectedUsers: uniqueIds.length };
}
