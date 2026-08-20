import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { ADMIN_COLLECTIONS } from "@/lib/admin-data";

import {
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";

import {
  deleteFirebaseAuthUser,
  getFirebaseAuthUser,
  setFirebaseAuthPassword
} from "@/lib/firebase-auth-rest";

import {
  deleteFirebaseStoragePrefix
} from "@/lib/firebase-storage-rest";

import {
  findTemporaryAccount
} from "@/lib/temporary-accounts.server";

/**
 * Collections that contain Saintagram user data.
 *
 * adminAuditLogs is deliberately NOT included here.
 * Audit logs should remain available even after a user
 * is reset or permanently deleted.
 */
const USER_COLLECTIONS = [
  ...ADMIN_COLLECTIONS
] as const;

/**
 * Same collections except the main users collection.
 *
 * Used for "Delete User Data" so users/{uid} survives
 * and can be recreated/reset afterward.
 */
const RESETTABLE_USER_COLLECTIONS =
  ADMIN_COLLECTIONS.filter(
    (collectionName) =>
      collectionName !== "users"
  );

/**
 * Detect a user ID anywhere inside a Firestore document.
 *
 * This allows us to remove things such as:
 *
 * - reflections owned by the user
 * - follows involving the user
 * - likes/comments created by the user
 * - notifications targeting the user
 * - journey events
 * - link-open events
 *
 * even when the document ID itself is not the user's UID.
 */
function containsUserId(
  value: unknown,
  userId: string,
  seen = new WeakSet<object>()
): boolean {
  if (value === userId) {
    return true;
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) =>
      containsUserId(
        item,
        userId,
        seen
      )
    );
  }

  return Object.values(value).some(
    (item) =>
      containsUserId(
        item,
        userId,
        seen
      )
  );
}

/**
 * Safely turn unknown Firestore values into strings.
 */
function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

/**
 * Check whether the requested user is safe for destructive
 * administrator actions.
 *
 * The currently authenticated administrator can never
 * delete/reset themselves.
 *
 * Other Firebase users with the admin custom claim are also
 * protected.
 */
async function getNonAdminAuthUser(
  userId: string,
  requestingAdminId: string
) {
  if (
    !userId ||
    userId === requestingAdminId
  ) {
    throw new Error(
      "ADMIN_ACCOUNT_PROTECTED"
    );
  }

  const authUser =
    await getFirebaseAuthUser(
      userId
    );

  if (
    authUser?.customClaims?.admin ===
    true
  ) {
    throw new Error(
      "ADMIN_ACCOUNT_PROTECTED"
    );
  }

  return authUser;
}

/**
 * Delete all Firestore documents in the supplied collections
 * that belong to or reference a specific user.
 */
async function deleteMatchingFirestoreRecords(
  userId: string,
  collectionNames: readonly string[]
) {
  const db =
    getFirebaseAdminFirestore();

  const references: FirebaseFirestore.DocumentReference[] =
    [];

  for (
    const collectionName of collectionNames
  ) {
    const snapshot =
      await db
        .collection(collectionName)
        .get();

    snapshot.docs.forEach(
      (document) => {
        if (
          document.id === userId ||
          containsUserId(
            document.data(),
            userId
          )
        ) {
          references.push(
            document.ref
          );
        }
      }
    );
  }

  let firestoreRecords = 0;

  /**
   * Keep batches comfortably below Firestore's write limit.
   */
  for (
    let index = 0;
    index < references.length;
    index += 400
  ) {
    const batch = db.batch();

    const referencesToDelete =
      references.slice(
        index,
        index + 400
      );

    referencesToDelete.forEach(
      (reference) => {
        batch.delete(reference);
      }
    );

    await batch.commit();

    firestoreRecords +=
      referencesToDelete.length;
  }

  return firestoreRecords;
}

/**
 * Delete every Firebase Storage object belonging to a user.
 *
 * Your Saintagram storage structure currently puts user media
 * under:
 *
 * users/{uid}/...
 *
 * This covers profile images and reflection media.
 */
async function deleteUserMedia(
  userId: string
) {
  const bucketName =
    process.env
      .NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      ?.trim();

  /**
   * Preserve the old behavior where a project without
   * Storage configured simply reports zero deleted files.
   */
  if (!bucketName) {
    return 0;
  }

  return deleteFirebaseStoragePrefix(
    `users/${userId}/`
  );
}

/**
 * Keep a permanent audit record of destructive administrator
 * actions.
 */
async function writeDeletionAudit(
  requestingAdminId: string,
  action:
    | "user_data_reset"
    | "user_account_deleted",
  targetUserId: string,
  metadata: Record<
    string,
    string | number | boolean | null
  >
) {
  const db =
    getFirebaseAdminFirestore();

  await db
    .collection("adminAuditLogs")
    .add({
      adminId:
        requestingAdminId,

      action,

      targetUserId,

      createdAt:
        FieldValue.serverTimestamp(),

      metadata
    });
}

/* ============================================================
   DELETE USER DATA ONLY
   ============================================================ */

/**
 * OPTION 1:
 *
 * DELETE USER DATA
 *
 * This performs a factory-reset style operation.
 *
 * It:
 *
 * - keeps Firebase Authentication
 * - keeps the Firebase UID
 * - keeps username/email identity
 * - deletes Saintagram application data
 * - deletes uploaded media
 * - restores the originally issued password
 * - forces another password change
 * - resets onboarding/profile completion
 *
 * It does NOT delete the Firebase Authentication user.
 */
export async function resetOneNonAdminUserData(
  userId: string,
  requestingAdminId: string
) {
  const db =
    getFirebaseAdminFirestore();

  console.log(
    "[RESET USER DATA] Starting",
    {
      userId
    }
  );

  /*
   * ----------------------------------------------------------
   * 1. Verify that the Auth account exists and is not admin.
   * ----------------------------------------------------------
   */

  const authUser =
    await getNonAdminAuthUser(
      userId,
      requestingAdminId
    );

  if (!authUser) {
    throw new Error(
      "USER_ACCOUNT_NOT_FOUND"
    );
  }

  /*
   * ----------------------------------------------------------
   * 2. Retrieve permanent Saintagram account information.
   * ----------------------------------------------------------
   */

  const userRef =
    db.collection("users").doc(
      userId
    );

  const userSnapshot =
    await userRef.get();

  if (!userSnapshot.exists) {
    throw new Error(
      "USER_RECORD_NOT_FOUND"
    );
  }

  const existing =
    userSnapshot.data() ?? {};

  /*
   * ----------------------------------------------------------
   * 3. Find the originally issued account/password.
   *
   * IMPORTANT:
   * Do this BEFORE deleting anything.
   *
   * If there is no issued password we refuse the reset so the
   * administrator never wipes the user's data without being
   * able to restore login access afterward.
   * ----------------------------------------------------------
   */

  const username =
    stringValue(
      existing.username
    ) ||
    stringValue(
      authUser.displayName
    );

  const issued =
    findTemporaryAccount(
      username
    );

  if (!issued) {
    throw new Error(
      "DEFAULT_PASSWORD_NOT_FOUND"
    );
  }

  /*
   * ----------------------------------------------------------
   * 4. Reset the Firebase Authentication password.
   *
   * This now uses the Worker-compatible Identity Toolkit REST
   * API instead of firebase-admin Auth.
   * ----------------------------------------------------------
   */

  console.log(
    "[RESET USER DATA] Resetting password",
    {
      userId
    }
  );

  await setFirebaseAuthPassword(
    userId,
    issued.temporaryPassword
  );

  /*
   * ----------------------------------------------------------
   * 5. Delete uploaded media.
   * ----------------------------------------------------------
   */

  console.log(
    "[RESET USER DATA] Deleting media",
    {
      userId
    }
  );

  const mediaFiles =
    await deleteUserMedia(
      userId
    );

  /*
   * ----------------------------------------------------------
   * 6. Delete all Saintagram user data except users/{uid}.
   * ----------------------------------------------------------
   */

  console.log(
    "[RESET USER DATA] Deleting Firestore data",
    {
      userId
    }
  );

  const firestoreRecords =
    await deleteMatchingFirestoreRecords(
      userId,
      RESETTABLE_USER_COLLECTIONS
    );

  /*
   * ----------------------------------------------------------
   * 7. Reset users/{uid} into a fresh-account state.
   * ----------------------------------------------------------
   */

  const now =
    new Date().toISOString();

  await userRef.set({
    id: userId,

    email:
      authUser.email ||
      stringValue(
        existing.email
      ),

    username:
      issued.username,

    fullName:
      stringValue(
        existing.fullName
      ) ||
      issued.fullName,

    role:
      existing.role === "tester" ||
      existing.role === "user" ||
      existing.role === "app_admin"
        ? existing.role
        : issued.role,

    authProvider:
      "password",

    createdAt:
      stringValue(
        existing.createdAt
      ) || now,

    updatedAt: now,

    /*
     * Reset onboarding.
     */
    privacyConsentAt:
      null,

    spiritualIntroSeenAt:
      null,

    fiatIntroSeenAt:
      null,

    profileCompleted:
      false,

    /*
     * The restored issued password must be changed before
     * continuing with the account.
     */
    mustChangePassword:
      true,

    /*
     * Restore default privacy behavior.
     */
    privacyPreferences: {
      accountPrivate: false,

      requirePrivateCheck:
        true,

      showReflectionDates:
        true
    }
  });

  /*
   * ----------------------------------------------------------
   * 8. Keep an audit trail.
   * ----------------------------------------------------------
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

  console.log(
    "[RESET USER DATA] Completed",
    {
      userId,
      firestoreRecords,
      mediaFiles
    }
  );

  return {
    firestoreRecords,
    mediaFiles,

    /*
     * Zero means the Firebase Authentication account was not
     * deleted.
     */
    userAccounts: 0,

    accountPreserved: true
  };
}

/* ============================================================
   DELETE ENTIRE ACCOUNT
   ============================================================ */

/**
 * OPTION 2:
 *
 * DELETE ACCOUNT & ALL DATA
 *
 * This permanently removes:
 *
 * - Saintagram user data
 * - users/{uid}
 * - uploaded media
 * - Firebase Authentication account
 *
 * After this operation, the user cannot log in anymore.
 */
export async function deleteOneNonAdminUser(
  userId: string,
  requestingAdminId: string
) {
  console.log(
    "[DELETE USER ACCOUNT] Starting",
    {
      userId
    }
  );

  /*
   * ----------------------------------------------------------
   * 1. Make sure we're not deleting an administrator.
   * ----------------------------------------------------------
   */

  const authUser =
    await getNonAdminAuthUser(
      userId,
      requestingAdminId
    );

  /*
   * ----------------------------------------------------------
   * 2. Delete uploaded media.
   * ----------------------------------------------------------
   */

  console.log(
    "[DELETE USER ACCOUNT] Deleting media",
    {
      userId
    }
  );

  const mediaFiles =
    await deleteUserMedia(
      userId
    );

  /*
   * ----------------------------------------------------------
   * 3. Delete all matching application records.
   *
   * Unlike Delete User Data, this collection list includes
   * "users", so users/{uid} is also deleted.
   * ----------------------------------------------------------
   */

  console.log(
    "[DELETE USER ACCOUNT] Deleting Firestore data",
    {
      userId
    }
  );

  const firestoreRecords =
    await deleteMatchingFirestoreRecords(
      userId,
      USER_COLLECTIONS
    );

  /*
   * ----------------------------------------------------------
   * 4. Permanently delete Firebase Authentication.
   *
   * This uses the Worker-compatible Identity Toolkit REST API.
   * ----------------------------------------------------------
   */

  if (authUser) {
    console.log(
      "[DELETE USER ACCOUNT] Deleting Firebase Auth account",
      {
        userId
      }
    );

    await deleteFirebaseAuthUser(
      userId
    );
  }

  /*
   * ----------------------------------------------------------
   * 5. Preserve the deletion in the audit log.
   *
   * This happens after application data cleanup so the new
   * audit record itself is not removed.
   * ----------------------------------------------------------
   */

  await writeDeletionAudit(
    requestingAdminId,
    "user_account_deleted",
    userId,
    {
      firestoreRecords,
      mediaFiles,

      userAccounts:
        authUser ? 1 : 0
    }
  );

  console.log(
    "[DELETE USER ACCOUNT] Completed",
    {
      userId,
      firestoreRecords,
      mediaFiles,
      userAccounts:
        authUser ? 1 : 0
    }
  );

  return {
    firestoreRecords,
    mediaFiles,

    userAccounts:
      authUser ? 1 : 0
  };
}

/* ============================================================
   DELETE SELECTED USERS
   ============================================================ */

/**
 * Permanently delete multiple selected users.
 *
 * This is the bulk equivalent of:
 *
 * Delete Account & All Data
 *
 * We validate every selected account BEFORE deleting the first
 * one. That prevents a selection containing an administrator
 * from deleting some users and then failing halfway through.
 */
export async function deleteSelectedNonAdminUsers(
  userIds: string[],
  requestingAdminId: string
) {
  const uniqueIds = [
    ...new Set(
      userIds.filter(Boolean)
    )
  ];

  if (!uniqueIds.length) {
    throw new Error(
      "NO_USERS_SELECTED"
    );
  }

  /*
   * Validate everybody before performing any destructive work.
   */
  for (
    const userId of uniqueIds
  ) {
    await getNonAdminAuthUser(
      userId,
      requestingAdminId
    );
  }

  const total = {
    firestoreRecords: 0,
    mediaFiles: 0,
    userAccounts: 0
  };

  /*
   * Delete sequentially.
   *
   * This avoids sending a large number of simultaneous
   * external REST requests from Cloudflare Workers.
   */
  for (
    const userId of uniqueIds
  ) {
    const result =
      await deleteOneNonAdminUser(
        userId,
        requestingAdminId
      );

    total.firestoreRecords +=
      result.firestoreRecords;

    total.mediaFiles +=
      result.mediaFiles;

    total.userAccounts +=
      result.userAccounts;
  }

  return {
    ...total,

    selectedUsers:
      uniqueIds.length
  };
}

/* ============================================================
   DELETE ALL NON-ADMIN RECORDS
   ============================================================ */

/**
 * Permanently delete all KNOWN non-admin Saintagram users.
 *
 * This version intentionally does NOT use:
 *
 * - auth.listUsers()
 * - auth.deleteUsers()
 * - Firebase Admin Storage
 *
 * because those paths use the Firebase Admin OAuth credential
 * refresh mechanism that fails inside the Cloudflare Worker.
 *
 * Instead, Saintagram's users collection is used as the list of
 * known application users and each Auth account is checked via
 * the Worker-compatible REST client.
 */
export async function deleteAllNonAdminRecords(
  requestingAdminId: string
) {
  const db =
    getFirebaseAdminFirestore();

  console.log(
    "[DELETE ALL USERS] Starting",
    {
      requestingAdminId
    }
  );

  /*
   * ----------------------------------------------------------
   * 1. Get all Saintagram application accounts.
   * ----------------------------------------------------------
   */

  const usersSnapshot =
    await db
      .collection("users")
      .get();

  const knownUserIds =
    usersSnapshot.docs.map(
      (document) =>
        document.id
    );

  /*
   * ----------------------------------------------------------
   * 2. Determine which accounts are administrators.
   * ----------------------------------------------------------
   */

  const adminIds =
    new Set<string>();

  adminIds.add(
    requestingAdminId
  );

  const authUsers =
    new Map<
      string,
      Awaited<
        ReturnType<
          typeof getFirebaseAuthUser
        >
      >
    >();

  /*
   * Process a small number at a time rather than creating
   * hundreds of simultaneous Worker subrequests.
   */
  for (
    let index = 0;
    index < knownUserIds.length;
    index += 10
  ) {
    const chunk =
      knownUserIds.slice(
        index,
        index + 10
      );

    const results =
      await Promise.all(
        chunk.map(
          async (userId) => ({
            userId,

            authUser:
              await getFirebaseAuthUser(
                userId
              )
          })
        )
      );

    results.forEach(
      ({
        userId,
        authUser
      }) => {
        authUsers.set(
          userId,
          authUser
        );

        if (
          authUser
            ?.customClaims
            ?.admin === true
        ) {
          adminIds.add(
            userId
          );
        }
      }
    );
  }

  const nonAdminIds =
    knownUserIds.filter(
      (userId) =>
        !adminIds.has(
          userId
        )
    );

  /*
   * ----------------------------------------------------------
   * 3. Delete Firestore records belonging to non-admin users.
   *
   * Rather than deleting the entire collection blindly, check
   * each document for administrator references so administrator
   * account data remains protected.
   * ----------------------------------------------------------
   */

  let firestoreRecords = 0;

  for (
    const collectionName of USER_COLLECTIONS
  ) {
    const snapshot =
      await db
        .collection(
          collectionName
        )
        .get();

    const deletable =
      snapshot.docs.filter(
        (document) => {
          /*
           * Preserve documents whose ID is an administrator UID.
           */
          if (
            adminIds.has(
              document.id
            )
          ) {
            return false;
          }

          /*
           * Preserve documents referencing an administrator.
           */
          for (
            const adminId of adminIds
          ) {
            if (
              containsUserId(
                document.data(),
                adminId
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );

    for (
      let index = 0;
      index < deletable.length;
      index += 400
    ) {
      const batch =
        db.batch();

      const documents =
        deletable.slice(
          index,
          index + 400
        );

      documents.forEach(
        (document) => {
          batch.delete(
            document.ref
          );
        }
      );

      await batch.commit();

      firestoreRecords +=
        documents.length;
    }
  }

  /*
   * ----------------------------------------------------------
   * 4. Delete media belonging to non-admin users.
   * ----------------------------------------------------------
   */

  let mediaFiles = 0;

  for (
    const userId of nonAdminIds
  ) {
    mediaFiles +=
      await deleteUserMedia(
        userId
      );
  }

  /*
   * ----------------------------------------------------------
   * 5. Delete Firebase Authentication accounts.
   * ----------------------------------------------------------
   */

  let userAccounts = 0;

  for (
    const userId of nonAdminIds
  ) {
    const authUser =
      authUsers.get(
        userId
      );

    /*
     * A Firestore user record may theoretically exist without
     * a matching Firebase Authentication account.
     */
    if (!authUser) {
      continue;
    }

    await deleteFirebaseAuthUser(
      userId
    );

    userAccounts += 1;
  }

  /*
   * ----------------------------------------------------------
   * 6. Audit the destructive action.
   * ----------------------------------------------------------
   */

  await db
    .collection(
      "adminAuditLogs"
    )
    .add({
      adminId:
        requestingAdminId,

      action:
        "all_non_admin_records_deleted",

      targetUserId:
        null,

      createdAt:
        FieldValue.serverTimestamp(),

      metadata: {
        firestoreRecords,
        mediaFiles,
        userAccounts,

        affectedUsers:
          nonAdminIds.length
      }
    });

  console.log(
    "[DELETE ALL USERS] Completed",
    {
      firestoreRecords,
      mediaFiles,
      userAccounts,
      affectedUsers:
        nonAdminIds.length
    }
  );

  return {
    firestoreRecords,
    mediaFiles,
    userAccounts
  };
}