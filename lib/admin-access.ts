import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import {
  getFirebaseAuthUser,
  setFirebaseAuthCustomClaims
} from "@/lib/firebase-auth-rest";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { writeAudit } from "@/lib/admin-data";

export const SHARED_ADMIN_CLAIM = "saintagramSharedAdmin";

export type SharedAdminAccessResult = {
  granted: boolean;
  changed: boolean;
};

function notificationCopy(granted: boolean) {
  return granted
    ? {
        type: "admin_access_granted",
        title: "Admin access granted",
        message:
          "You can now open the Saintagram Admin Dashboard from Settings. Your admin session will end when you close its tab or browser window."
      }
    : {
        type: "admin_access_revoked",
        title: "Admin access removed",
        message:
          "Your shared Saintagram Admin Dashboard access has been removed."
      };
}

async function deletePendingHandoffs(userId: string): Promise<void> {
  const db = getFirebaseAdminFirestore();
  const snapshot = await db
    .collection("adminHandoffs")
    .where("userId", "==", userId)
    .get();

  if (!snapshot.docs.length) return;

  const batch = db.batch();
  for (const document of snapshot.docs) {
    batch.delete(document.ref);
  }
  await batch.commit();
}

export async function setSharedAdminAccess(
  actingAdminId: string,
  userId: string,
  granted: boolean
): Promise<SharedAdminAccessResult> {
  const db = getFirebaseAdminFirestore();
  const userRef = db.collection("users").doc(userId);
  const grantRef = db.collection("adminAccessGrants").doc(userId);

  const [userSnapshot, authUser, grantSnapshot] = await Promise.all([
    userRef.get(),
    getFirebaseAuthUser(userId),
    grantRef.get()
  ]);

  if (!userSnapshot.exists || !authUser) {
    throw new Error("USER_NOT_FOUND");
  }
  if (authUser.disabled) {
    throw new Error("AUTH_ACCOUNT_DISABLED");
  }
  if (!authUser.emailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const userData = userSnapshot.data() ?? {};
  const currentlyGranted = userData.adminAccessGranted === true;

  if (currentlyGranted === granted) {
    return { granted, changed: false };
  }

  const previousClaims = { ...authUser.customClaims };
  const nextClaims = { ...previousClaims };
  const alreadyAdministrator = previousClaims.admin === true;

  if (granted) {
    nextClaims.admin = true;
    if (!alreadyAdministrator) {
      nextClaims[SHARED_ADMIN_CLAIM] = true;
    }
  } else {
    if (!grantSnapshot.exists) {
      throw new Error("ADMIN_GRANT_METADATA_MISSING");
    }

    const preserveExistingAdminClaim =
      grantSnapshot.data()?.preserveExistingAdminClaim === true;

    if (!preserveExistingAdminClaim) {
      delete nextClaims.admin;
    }
    delete nextClaims[SHARED_ADMIN_CLAIM];
  }

  await setFirebaseAuthCustomClaims(userId, nextClaims);

  try {
    const batch = db.batch();
    const notificationRef = db.collection("systemNotifications").doc();
    const notification = notificationCopy(granted);

    batch.update(userRef, {
      adminAccessGranted: granted,
      updatedAt: FieldValue.serverTimestamp()
    });

    if (granted) {
      batch.set(grantRef, {
        id: userId,
        userId,
        grantedByAdminId: actingAdminId,
        grantedAt: FieldValue.serverTimestamp(),
        preserveExistingAdminClaim: alreadyAdministrator
      });
    } else {
      batch.delete(grantRef);
    }

    batch.set(notificationRef, {
      id: notificationRef.id,
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      missingFields: [],
      createdByAdminId: actingAdminId,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null
    });

    await batch.commit();
  } catch (error) {
    // Do not leave Authentication and Firestore disagreeing if the application
    // records fail to update after the custom claim was changed.
    await setFirebaseAuthCustomClaims(userId, previousClaims).catch(() => undefined);
    throw error;
  }

  if (!granted) {
    await deletePendingHandoffs(userId).catch((error) => {
      // Redemption also re-checks the Firestore entitlement, so a stale code
      // cannot restore revoked access even if cleanup is temporarily unavailable.
      console.error("Pending admin handoffs could not be cleaned up", error);
    });
  }

  await writeAudit(
    actingAdminId,
    granted ? "admin_access_granted" : "admin_access_revoked",
    userId,
    { sharedAdminAccess: granted }
  ).catch((error) => {
    console.error("Admin access audit log could not be written", error);
  });

  return { granted, changed: true };
}
