"use client";

import {
  getFirebaseServices
} from "@/lib/firebase";

/*
 * Avoid duplicate simultaneous
 * bootstrap requests.
 */
let currentRequest:
  Promise<void> | null =
    null;

export async function syncAdminReflectionNotifications(): Promise<void> {
  const services =
    getFirebaseServices();

  const firebaseUser =
    services
      ?.auth
      .currentUser;

  if (
    !services ||
    !firebaseUser
  ) {
    return;
  }

  /*
   * Saintagram does not initialize
   * Firestore account data until
   * email verification succeeds.
   */
  if (
    !firebaseUser
      .emailVerified
  ) {
    return;
  }

  if (currentRequest) {
    return currentRequest;
  }

  currentRequest =
    (async () => {
      /*
       * Force-refresh so email_verified
       * and other Firebase token values
       * are current.
       */
      const token =
        await firebaseUser
          .getIdToken(
            true
          );

      const response =
        await fetch(
          "/api/system-notifications/bootstrap",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`
            },

            cache:
              "no-store",

            credentials:
              "same-origin"
          }
        );

      if (
        !response.ok
      ) {
        const result =
          (await response
            .json()
            .catch(
              () => ({})
            )) as {
            error?: string;
          };

        throw new Error(
          result.error ??
            "Admin reflection notifications could not be synchronized."
        );
      }
    })();

  try {
    await currentRequest;
  } finally {
    currentRequest =
      null;
  }
}