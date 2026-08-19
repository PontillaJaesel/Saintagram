"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
  type WriteBatch
} from "firebase/firestore";

import { getFirebaseServices } from "@/lib/firebase";

import type {
  FollowRelationship,
  FollowRequest,
  PrivacyPreferences
} from "@/types";

export type FollowState =
  | "none"
  | "requested"
  | "following";

function nowIso(): string {
  return new Date().toISOString();
}

function servicesForOwner(
  userId: string
) {
  const services =
    getFirebaseServices();

  if (
    !services?.auth.currentUser ||
    services.auth.currentUser.uid !==
      userId
  ) {
    throw new Error(
      "Please log in again before changing follow or privacy settings."
    );
  }

  return services;
}

function storedFollowRequest(
  snapshot:
    QueryDocumentSnapshot<DocumentData>
): FollowRequest | null {
  const data =
    snapshot.data();

  if (
    data.id !== snapshot.id ||
    typeof data.requesterId !==
      "string" ||
    typeof data.targetUserId !==
      "string" ||
    typeof data.createdAt !==
      "string"
  ) {
    return null;
  }

  return {
    id: snapshot.id,
    requesterId:
      data.requesterId,
    targetUserId:
      data.targetUserId,
    createdAt:
      data.createdAt
  };
}

export async function getFollowState(
  requesterId: string,
  targetUserId: string
): Promise<FollowState> {
  const services =
    servicesForOwner(
      requesterId
    );

  const relationshipId =
    `${requesterId}_${targetUserId}`;

  const [
    followSnapshot,
    requestSnapshot
  ] =
    await Promise.all([
      getDoc(
        doc(
          services.db,
          "follows",
          relationshipId
        )
      ),

      getDoc(
        doc(
          services.db,
          "followRequests",
          relationshipId
        )
      )
    ]);

  if (followSnapshot.exists()) {
    return "following";
  }

  if (requestSnapshot.exists()) {
    return "requested";
  }

  return "none";
}

export async function createFollowRequest(
  requesterId: string,
  targetUserId: string
): Promise<void> {
  const services =
    servicesForOwner(
      requesterId
    );

  if (
    requesterId ===
    targetUserId
  ) {
    throw new Error(
      "You cannot follow your own account."
    );
  }

  const requestId =
    `${requesterId}_${targetUserId}`;

  const targetProfileRef =
    doc(
      services.db,
      "socialProfiles",
      targetUserId
    );

  const followRef =
    doc(
      services.db,
      "follows",
      requestId
    );

  const requestRef =
    doc(
      services.db,
      "followRequests",
      requestId
    );

  await runTransaction(
    services.db,

    async (
      transaction
    ) => {
      const targetProfile =
        await transaction.get(
          targetProfileRef
        );

      if (
        !targetProfile.exists()
      ) {
        throw new Error(
          "That Saintagram user could not be found."
        );
      }

      if (
        targetProfile.data()
          .isPrivateAccount !== true
      ) {
        throw new Error(
          "This account is public now. Refresh the page and tap Follow again."
        );
      }

      const existingFollow =
        await transaction.get(
          followRef
        );

      if (
        existingFollow.exists()
      ) {
        return;
      }

      const existingRequest =
        await transaction.get(
          requestRef
        );

      if (
        existingRequest.exists()
      ) {
        return;
      }

      const request:
        FollowRequest = {
        id: requestId,
        requesterId,
        targetUserId,
        createdAt:
          nowIso()
      };

      transaction.set(
        requestRef,
        request
      );
    }
  );
}

export async function cancelFollowRequest(
  requesterId: string,
  targetUserId: string
): Promise<void> {
  const services =
    servicesForOwner(
      requesterId
    );

  const requestRef =
    doc(
      services.db,
      "followRequests",
      `${requesterId}_${targetUserId}`
    );

  await runTransaction(
    services.db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          requestRef
        );

      if (
        !snapshot.exists()
      ) {
        return;
      }

      if (
        snapshot.data()
          .requesterId !==
        requesterId
      ) {
        throw new Error(
          "That follow request could not be cancelled."
        );
      }

      transaction.delete(
        requestRef
      );
    }
  );
}

export function subscribeFollowRequests(
  targetUserId: string,
  onChange: (
    requests: FollowRequest[]
  ) => void,
  onError?: (
    message: string
  ) => void
): Unsubscribe {
  const services =
    servicesForOwner(
      targetUserId
    );

  return onSnapshot(
    query(
      collection(
        services.db,
        "followRequests"
      ),

      where(
        "targetUserId",
        "==",
        targetUserId
      )
    ),

    (
      snapshot
    ) => {
      const requests =
        snapshot.docs
          .map(
            storedFollowRequest
          )
          .filter(
            (
              request
            ): request is FollowRequest =>
              Boolean(
                request
              )
          )
          .sort(
            (a, b) =>
              b.createdAt.localeCompare(
                a.createdAt
              )
          );

      onChange(
        requests
      );
    },

    (
      error
    ) => {
      onError?.(
        error instanceof Error
          ? error.message
          : "Follow requests could not be loaded."
      );
    }
  );
}

export async function acceptFollowRequest(
  targetUserId: string,
  requestId: string
): Promise<void> {
  const services =
    servicesForOwner(
      targetUserId
    );

  const requestRef =
    doc(
      services.db,
      "followRequests",
      requestId
    );

  await runTransaction(
    services.db,

    async (
      transaction
    ) => {
      const requestSnapshot =
        await transaction.get(
          requestRef
        );

      if (
        !requestSnapshot.exists()
      ) {
        return;
      }

      const data =
        requestSnapshot.data();

      if (
        data.targetUserId !==
          targetUserId ||
        typeof data.requesterId !==
          "string" ||
        !data.requesterId
      ) {
        throw new Error(
          "That follow request could not be accepted."
        );
      }

      const followerId =
        data.requesterId;

      const followId =
        `${followerId}_${targetUserId}`;

      const followRef =
        doc(
          services.db,
          "follows",
          followId
        );

      const existingFollow =
        await transaction.get(
          followRef
        );

      if (
        !existingFollow.exists()
      ) {
        const relationship:
          FollowRelationship = {
          id: followId,
          followerId,
          followingId:
            targetUserId,
          createdAt:
            nowIso()
        };

        transaction.set(
          followRef,
          relationship
        );
      }

      transaction.delete(
        requestRef
      );
    }
  );
}

export async function rejectFollowRequest(
  targetUserId: string,
  requestId: string
): Promise<void> {
  const services =
    servicesForOwner(
      targetUserId
    );

  const requestRef =
    doc(
      services.db,
      "followRequests",
      requestId
    );

  await runTransaction(
    services.db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          requestRef
        );

      if (
        !snapshot.exists()
      ) {
        return;
      }

      if (
        snapshot.data()
          .targetUserId !==
        targetUserId
      ) {
        throw new Error(
          "That follow request could not be rejected."
        );
      }

      transaction.delete(
        requestRef
      );
    }
  );
}

async function commitBatches(
  operations:
    Array<
      (
        batch: WriteBatch
      ) => void
    >,

  db: Firestore
): Promise<void> {
  const maximumWrites =
    400;

  for (
    let index = 0;
    index <
    operations.length;
    index +=
      maximumWrites
  ) {
    const batch =
      writeBatch(
        db
      );

    operations
      .slice(
        index,
        index +
          maximumWrites
      )
      .forEach(
        (
          operation
        ) =>
          operation(
            batch
          )
      );

    await batch.commit();
  }
}

export async function setAccountPrivate(
  userId: string,
  accountPrivate: boolean
): Promise<void> {
  const services =
    servicesForOwner(
      userId
    );

  const userRef =
    doc(
      services.db,
      "users",
      userId
    );

  const socialProfileRef =
    doc(
      services.db,
      "socialProfiles",
      userId
    );

  const [
    userSnapshot,
    socialProfileSnapshot,
    reflectionSnapshot
  ] =
    await Promise.all([
      getDoc(
        userRef
      ),

      getDoc(
        socialProfileRef
      ),

      getDocs(
        query(
          collection(
            services.db,
            "reflectionPosts"
          ),

          where(
            "userId",
            "==",
            userId
          )
        )
      )
    ]);

  if (
    !userSnapshot.exists()
  ) {
    throw new Error(
      "Your account record could not be found."
    );
  }

  const current =
    userSnapshot.data()
      .privacyPreferences as
      | Partial<
          PrivacyPreferences
        >
      | undefined;

  const privacyPreferences:
    PrivacyPreferences = {
    accountPrivate,

    requirePrivateCheck:
      current
        ?.requirePrivateCheck ??
      true,

    showReflectionDates:
      current
        ?.showReflectionDates ??
      true
  };

  /*
   * Update the user document
   * and searchable profile.
   */
  const metadataBatch =
    writeBatch(
      services.db
    );

  metadataBatch.update(
    userRef,
    {
      privacyPreferences,
      updatedAt:
        nowIso()
    }
  );

  if (
    socialProfileSnapshot.exists()
  ) {
    metadataBatch.update(
      socialProfileRef,
      {
        isPrivateAccount:
          accountPrivate,

        updatedAt:
          nowIso()
      }
    );
  }

  await metadataBatch.commit();

  /*
   * Synchronize all existing
   * reflections.
   */
  const operations =
    reflectionSnapshot.docs.map(
      (
        reflection
      ) =>
        (
          batch:
            WriteBatch
        ) => {
          batch.update(
            reflection.ref,
            {
              accountPrivate
            }
          );
        }
    );

  await commitBatches(
    operations,
    services.db
  );

  /*
   * If the account becomes
   * public, pending approval
   * is no longer required.
   */
  if (
    !accountPrivate
  ) {
    const pending =
      await getDocs(
        query(
          collection(
            services.db,
            "followRequests"
          ),

          where(
            "targetUserId",
            "==",
            userId
          )
        )
      );

    for (
      const request
      of pending.docs
    ) {
      await acceptFollowRequest(
        userId,
        request.id
      );
    }
  }
}