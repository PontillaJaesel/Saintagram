import "server-only";

import { ADMIN_COLLECTIONS } from "@/lib/admin-data";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage
} from "@/lib/firebase-admin";

const FIRESTORE_COLLECTIONS = [...ADMIN_COLLECTIONS, "adminAuditLogs"] as const;

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
