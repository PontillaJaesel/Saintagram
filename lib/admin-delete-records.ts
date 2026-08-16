import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { ADMIN_COLLECTIONS } from "@/lib/admin-data";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage
} from "@/lib/firebase-admin";
import { findTemporaryAccount } from "@/lib/temporary-accounts.server";

const FIRESTORE_COLLECTIONS = [...ADMIN_COLLECTIONS, "adminAuditLogs"] as const;

const USER_DATA_COLLECTIONS = ADMIN_COLLECTIONS.filter(
  (collectionName) => collectionName !== "users"
);

function containsUserId(value: unknown, userId: string, seen = new WeakSet<object>()): boolean {
  if (value === userId) return true;
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsUserId(item, userId, seen));
  return Object.values(value).some((item) => containsUserId(item, userId, seen));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function getNonAdminAuthUser(
  userId: string,
  requestingAdminId: string
) {
  if (!userId || userId === requestingAdminId) {
    throw new Error("ADMIN_ACCOUNT_PROTECTED");
  }

  const auth = getFirebaseAdminAuth();

  const authUser = await auth
    .getUser(userId)
    .catch((error: { code?: string }) => {
      if (error.code === "auth/user-not-found") {
        return null;
      }

      throw error;
    });

  if (authUser?.customClaims?.admin === true) {
    throw new Error("ADMIN_ACCOUNT_PROTECTED");
  }

  return authUser;
}

async function deleteMatchingFirestoreRecords(
  userId: string,
  collectionNames: readonly string[]
) {
  const db = getFirebaseAdminFirestore();

  const references: FirebaseFirestore.DocumentReference[] = [];

  for (const collectionName of collectionNames) {
    const snapshot = await db.collection(collectionName).get();

    snapshot.docs.forEach((document) => {
      if (
        document.id === userId ||
        containsUserId(document.data(), userId)
      ) {
        references.push(document.ref);
      }
    });
  }

  let firestoreRecords = 0;

  for (let index = 0; index < references.length; index += 400) {
    const batch = db.batch();

    references
      .slice(index, index + 400)
      .forEach((reference) => batch.delete(reference));

    await batch.commit();

    firestoreRecords += Math.min(
      400,
      references.length - index
    );
  }

  return firestoreRecords;
}

async function deleteUserMedia(userId: string) {
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  if (!bucketName) {
    return 0;
  }

  const [files] = await getFirebaseAdminStorage()
    .bucket(bucketName)
    .getFiles({
      prefix: `users/${userId}/`
    });

  await Promise.all(
    files.map((file) =>
      file.delete({
        ignoreNotFound: true
      })
    )
  );

  return files.length;
}

async function writeDeletionAudit(
  requestingAdminId: string,
  action: "user_data_reset" | "user_account_deleted",
  targetUserId: string,
  metadata: Record<string, unknown>
) {
  await getFirebaseAdminFirestore()
    .collection("adminAuditLogs")
    .add({
      adminId: requestingAdminId,
      action,
      targetUserId,
      createdAt: FieldValue.serverTimestamp(),
      metadata
    });
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

export async function resetOneNonAdminUserData(
  userId: string,
  requestingAdminId: string
) {
  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();

  /*
   * 1. Protect administrator accounts.
   */
  const authUser = await getNonAdminAuthUser(
    userId,
    requestingAdminId
  );

  if (!authUser) {
    throw new Error("USER_ACCOUNT_NOT_FOUND");
  }

  /*
   * 2. Retrieve the permanent account record.
   */
  const userRef = db.collection("users").doc(userId);
  const userSnapshot = await userRef.get();

  if (!userSnapshot.exists) {
    throw new Error("USER_RECORD_NOT_FOUND");
  }

  const existing = userSnapshot.data() ?? {};

  /*
   * 3. Find the originally-issued username/password.
   *
   * Do this BEFORE deleting anything.
   */
  const username =
    stringValue(existing.username) ||
    stringValue(authUser.displayName);

  const issued = findTemporaryAccount(username);

  if (!issued) {
    throw new Error("DEFAULT_PASSWORD_NOT_FOUND");
  }

  /*
   * 4. Restore the original temporary/default password.
   */
  await auth.updateUser(userId, {
    password: issued.temporaryPassword
  });

  /*
   * 5. Revoke old sessions.
   */
  await auth.revokeRefreshTokens(userId);

  /*
   * 6. Delete Firebase Storage data first.
   */
  const mediaFiles = await deleteUserMedia(userId);

  /*
   * 7. Delete all application data EXCEPT users/{uid}.
   */
  const firestoreRecords =
    await deleteMatchingFirestoreRecords(
      userId,
      USER_DATA_COLLECTIONS
    );

  /*
   * 8. Reset the users/{uid} document.
   */
  const now = new Date().toISOString();

  await userRef.set({
    id: userId,

    email:
      stringValue(authUser.email) ||
      stringValue(existing.email),

    username: issued.username,

    fullName:
      stringValue(existing.fullName) ||
      issued.fullName,

    role:
      existing.role === "tester" ||
      existing.role === "user"
        ? existing.role
        : issued.role,

    authProvider: "password",

    createdAt:
      stringValue(existing.createdAt) || now,

    updatedAt: now,

    privacyConsentAt: null,

    spiritualIntroSeenAt: null,

    profileCompleted: false,

    mustChangePassword: true,

    privacyPreferences: {
      requirePrivateCheck: true,
      showReflectionDates: true
    }
  });

  /*
   * 9. Keep an administrator audit record.
   */
  await writeDeletionAudit(
    requestingAdminId,
    "user_data_reset",
    userId,
    {
      firestoreRecords,
      mediaFiles,
      userAccounts: 0,
      accountPreserved: true
    }
  );

  return {
    firestoreRecords,
    mediaFiles,
    userAccounts: 0,
    accountPreserved: true
  };
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

export async function deleteOneNonAdminUser(
  userId: string,
  requestingAdminId: string
) {
  const auth = getFirebaseAdminAuth();

  const authUser = await getNonAdminAuthUser(
    userId,
    requestingAdminId
  );

  /*
   * Delete Storage first.
   */
  const mediaFiles = await deleteUserMedia(userId);

  /*
   * This time ADMIN_COLLECTIONS includes "users",
   * so users/{uid} is also deleted.
   */
  const firestoreRecords =
    await deleteMatchingFirestoreRecords(
      userId,
      ADMIN_COLLECTIONS
    );

  /*
   * Delete Firebase Authentication account.
   */
  if (authUser) {
    await auth.deleteUser(userId);
  }

  await writeDeletionAudit(
    requestingAdminId,
    "user_account_deleted",
    userId,
    {
      firestoreRecords,
      mediaFiles,
      userAccounts: authUser ? 1 : 0
    }
  );

  return {
    firestoreRecords,
    mediaFiles,
    userAccounts: authUser ? 1 : 0
  };
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
