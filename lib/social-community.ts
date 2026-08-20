import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where
} from "firebase/firestore";

import { getFirebaseServices } from "@/lib/firebase";

import type {
  ReflectionPost,
  SocialProfile
} from "@/types";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type FollowState =
  | "none"
  | "requested"
  | "following";

export type CommunityProfile =
  SocialProfile & {
    isPrivateAccount: boolean;
  };

export interface FollowStateInfo {
  state: FollowState;
  targetIsPrivate: boolean;
}

export interface PublicProfileBundle {
  profile: CommunityProfile | null;
  posts: ReflectionPost[];
  canViewPosts: boolean;
  following: boolean;
}

export interface IncomingFollowRequest {
  id: string;
  requesterId: string;
  targetUserId: string;
  createdAt: string;
  requesterProfile: CommunityProfile | null;
}

/*
 * ============================================================
 * SMALL HELPERS
 * ============================================================
 */

function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

function dateValue(
  value: unknown
): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    try {
      return (
        value as {
          toDate: () => Date;
        }
      )
        .toDate()
        .toISOString();
    } catch {
      return "";
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return "";
}

function nowIso(): string {
  return new Date().toISOString();
}

function getSignedInServices() {
  const services =
    getFirebaseServices();

  if (
    !services ||
    !services.auth.currentUser
  ) {
    throw new Error(
      "Please log in again."
    );
  }

  return services;
}

function assertCurrentUser(
  expectedUserId: string
) {
  const services =
    getSignedInServices();

  if (
    services.auth.currentUser?.uid !==
    expectedUserId
  ) {
    throw new Error(
      "You can only perform this action using your own account."
    );
  }

  return services;
}

/*
 * ============================================================
 * SOCIAL PROFILE NORMALIZER
 * ============================================================
 */

function storedCommunityProfile(
  documentId: string,
  value: unknown
): CommunityProfile | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const userId =
    stringValue(data.userId);

  const profileName =
    stringValue(
      data.profileName
    ).trim();

  const createdAt =
    dateValue(data.createdAt);

  const updatedAt =
    dateValue(data.updatedAt);

  if (
    !userId ||
    documentId !== userId ||
    !profileName
  ) {
    return null;
  }

  return {
    id: documentId,
    userId,

    profileName,

    coverColor:
      stringValue(data.coverColor),

    coverImageId:
      stringValue(data.coverImageId),

    coverImagePath:
      stringValue(data.coverImagePath),

    imagePath:
      stringValue(
        data.imagePath
      ),

    spiritualBio:
      stringValue(
        data.spiritualBio
      ),

    heavenlyHashtag:
      stringValue(
        data.heavenlyHashtag
      ),

    isPrivateAccount:
      data.isPrivateAccount === true,

    createdAt,
    updatedAt
  } as CommunityProfile;
}

/*
 * ============================================================
 * REFLECTION NORMALIZER
 * ============================================================
 */

function storedPublicReflection(
  documentId: string,
  value: unknown,
  expectedUserId: string
): ReflectionPost | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const userId =
    stringValue(data.userId);

  const content =
    stringValue(data.content);

  const createdAt =
    dateValue(data.createdAt);

  const updatedAt =
    dateValue(data.updatedAt);

  if (
    userId !== expectedUserId ||
    !content ||
    data.isPrivate !== false ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  const editedAt =
    dateValue(data.editedAt);

  const fiatCategory =
    stringValue(
      data.fiatCategory
    );

  const fiatDateKey =
    stringValue(
      data.fiatDateKey
    );

  const fiatOther =
    stringValue(
      data.fiatOther
    );

  const result = {
    id: documentId,

    userId,

    title:
      stringValue(
        data.title
      ),

    content,

    isPrivate: false,

    /*
     * Keep the privacy state that was
     * written on the reflection.
     */
    accountPrivate:
      data.accountPrivate ===
      true,

    createdAt,
    updatedAt,

    ...(editedAt
      ? {
          editedAt
        }
      : {}),

    ...(fiatCategory
      ? {
          fiatCategory
        }
      : {}),

    ...(fiatDateKey
      ? {
          fiatDateKey
        }
      : {}),

    ...(fiatOther
      ? {
          fiatOther
        }
      : {}),

    ...(Array.isArray(data.media)
      ? {
          media: data.media
        }
      : {})
  };

  return result as ReflectionPost;
}

/*
 * ============================================================
 * COMMUNITY DIRECTORY
 * ============================================================
 */

export async function getCommunityProfiles(
  currentUserId: string
): Promise<CommunityProfile[]> {
  const services =
    assertCurrentUser(
      currentUserId
    );

  const snapshot =
    await getDocs(
      collection(
        services.db,
        "socialProfiles"
      )
    );

  return snapshot.docs
    .map((item) =>
      storedCommunityProfile(
        item.id,
        item.data()
      )
    )
    .filter(
      (
        profile
      ): profile is CommunityProfile =>
        profile !== null &&
        profile.userId !==
          currentUserId
    )
    .sort((first, second) =>
      first.profileName.localeCompare(
        second.profileName
      )
    );
}

/*
 * ============================================================
 * SINGLE SOCIAL PROFILE
 * ============================================================
 */

export async function getCommunityProfile(
  userId: string
): Promise<CommunityProfile | null> {
  const services =
    getSignedInServices();

  const snapshot =
    await getDoc(
      doc(
        services.db,
        "socialProfiles",
        userId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return storedCommunityProfile(
    snapshot.id,
    snapshot.data()
  );
}

/*
 * ============================================================
 * PUBLIC PROFILE + REFLECTIONS
 * ============================================================
 *
 * IMPORTANT:
 *
 * The old query only used:
 *
 *   userId == target
 *   isPrivate == false
 *
 * But Firestore rules also depend on:
 *
 *   accountPrivate
 *
 * Firestore list/query rules must be able to prove
 * that EVERY returned document is readable.
 *
 * We therefore include accountPrivate in the query.
 * ============================================================
 */

export async function getPublicProfileBundle(
  currentUserId: string,
  profileUserId: string
): Promise<PublicProfileBundle> {
  const services =
    assertCurrentUser(
      currentUserId
    );

  const profileRef =
    doc(
      services.db,
      "socialProfiles",
      profileUserId
    );

  const followId =
    `${currentUserId}_${profileUserId}`;

  const followRef =
    doc(
      services.db,
      "follows",
      followId
    );

  const [
    profileSnapshot,
    followSnapshot
  ] =
    await Promise.all([
      getDoc(profileRef),

      currentUserId ===
      profileUserId
        ? Promise.resolve(null)
        : getDoc(followRef)
    ]);

  if (
    !profileSnapshot.exists()
  ) {
    return {
      profile: null,
      posts: [],
      canViewPosts: false,
      following: false
    };
  }

  const profile =
    storedCommunityProfile(
      profileSnapshot.id,
      profileSnapshot.data()
    );

  if (!profile) {
    return {
      profile: null,
      posts: [],
      canViewPosts: false,
      following: false
    };
  }

  const isOwnProfile =
    currentUserId ===
    profileUserId;

  const following =
    Boolean(
      followSnapshot &&
      followSnapshot.exists()
    );

  const canViewPosts =
    isOwnProfile ||
    !profile.isPrivateAccount ||
    following;

  /*
   * Private-account profile information
   * remains visible/searchable, but its
   * reflections stay hidden until the
   * follow request is approved.
   */
  if (!canViewPosts) {
    return {
      profile,
      posts: [],
      canViewPosts: false,
      following
    };
  }

  /*
   * THIS is the important permission fix.
   *
   * The accountPrivate constraint now matches
   * canViewReflection() in firestore.rules.
   *
   * Public profile:
   *     accountPrivate == false
   *
   * Private approved profile:
   *     accountPrivate == true
   */
  const postsSnapshot =
    await getDocs(
      query(
        collection(
          services.db,
          "reflectionPosts"
        ),

        where(
          "userId",
          "==",
          profileUserId
        ),

        where(
          "isPrivate",
          "==",
          false
        ),

        where(
          "accountPrivate",
          "==",
          profile.isPrivateAccount
        )
      )
    );

  const posts =
    postsSnapshot.docs
      .map((item) =>
        storedPublicReflection(
          item.id,
          item.data(),
          profileUserId
        )
      )
      .filter(
        (
          post
        ): post is ReflectionPost =>
          post !== null
      )
      .sort(
        (first, second) =>
          new Date(
            second.createdAt
          ).getTime() -
          new Date(
            first.createdAt
          ).getTime()
      );

  return {
    profile,
    posts,
    canViewPosts: true,
    following
  };
}

/*
 * ============================================================
 * FOLLOW STATE
 * ============================================================
 */

export async function getFollowState(
  currentUserId: string,
  targetUserId: string
): Promise<FollowStateInfo> {
  const services =
    assertCurrentUser(
      currentUserId
    );

  if (
    currentUserId ===
    targetUserId
  ) {
    return {
      state: "none",
      targetIsPrivate: false
    };
  }

  const relationshipId =
    `${currentUserId}_${targetUserId}`;

  /*
   * Read the target profile FIRST.
   *
   * This gives us the authoritative privacy state before
   * deciding whether a followRequests document should even
   * be queried.
   */
  const targetSnapshot =
    await getDoc(
      doc(
        services.db,
        "socialProfiles",
        targetUserId
      )
    );

  if (
    !targetSnapshot.exists()
  ) {
    throw new Error(
      "That Saintagram profile could not be found."
    );
  }

  const targetProfile =
    storedCommunityProfile(
      targetSnapshot.id,
      targetSnapshot.data()
    );

  if (!targetProfile) {
    throw new Error(
      "That Saintagram profile is not valid."
    );
  }

  const targetIsPrivate =
    targetSnapshot.data()
      .isPrivateAccount === true;

  const followRef =
    doc(
      services.db,
      "follows",
      relationshipId
    );

  const followSnapshot =
    await getDoc(
      followRef
    );

  if (
    followSnapshot.exists()
  ) {
    return {
      state: "following",
      targetIsPrivate
    };
  }

  /*
   * Only private accounts can have a pending request.
   * Do not query followRequests for normal public accounts.
   */
  if (targetIsPrivate) {
    const requestSnapshot =
      await getDoc(
        doc(
          services.db,
          "followRequests",
          relationshipId
        )
      );

    if (
      requestSnapshot.exists()
    ) {
      return {
        state: "requested",
        targetIsPrivate: true
      };
    }
  }

  return {
    state: "none",
    targetIsPrivate
  };
}

/*
 * ============================================================
 * FOLLOW OR REQUEST
 * ============================================================
 */

export async function followOrRequest(
  currentUserId: string,
  targetUserId: string
): Promise<FollowStateInfo> {
  const services =
    assertCurrentUser(
      currentUserId
    );

  if (
    currentUserId ===
    targetUserId
  ) {
    throw new Error(
      "You cannot follow your own account."
    );
  }

  const relationshipId =
    `${currentUserId}_${targetUserId}`;

  const targetRef =
    doc(
      services.db,
      "socialProfiles",
      targetUserId
    );

  /*
   * ==========================================================
   * 1. READ TARGET PROFILE
   * ==========================================================
   */
  let targetSnapshot;

  try {
    targetSnapshot =
      await getDoc(
        targetRef
      );
  } catch (error) {
    console.error(
      "[FOLLOW] Target profile read failed",
      {
        currentUserId,
        targetUserId,
        error
      }
    );

    throw new Error(
      "The target profile could not be checked."
    );
  }

  if (
    !targetSnapshot.exists()
  ) {
    throw new Error(
      "That Saintagram profile could not be found."
    );
  }

  const target =
    storedCommunityProfile(
      targetSnapshot.id,
      targetSnapshot.data()
    );

  if (!target) {
    throw new Error(
      "That Saintagram profile is not valid."
    );
  }

  /*
   * IMPORTANT:
   *
   * Only the literal boolean true means private.
   *
   * false or a missing legacy field means public.
   * Firestore rules must use the same fallback.
   */
  const targetIsPrivate =
    targetSnapshot.data()
      .isPrivateAccount === true;

  console.log(
    "[FOLLOW PRIVACY CHECK]",
    {
      currentUserId,
      targetUserId,
      rawIsPrivateAccount:
        targetSnapshot.data()
          .isPrivateAccount,
      targetIsPrivate
    }
  );

  const followRef =
    doc(
      services.db,
      "follows",
      relationshipId
    );

  const requestRef =
    doc(
      services.db,
      "followRequests",
      relationshipId
    );

  /*
   * ==========================================================
   * 2. CHECK EXISTING FOLLOW
   * ==========================================================
   */
  let existingFollow;

  try {
    existingFollow =
      await getDoc(
        followRef
      );
  } catch (error) {
    console.error(
      "[FOLLOW] Existing follow read failed",
      {
        relationshipId,
        error
      }
    );

    throw new Error(
      "The existing follow relationship could not be checked."
    );
  }

  if (
    existingFollow.exists()
  ) {
    return {
      state: "following",
      targetIsPrivate
    };
  }

  /*
   * ==========================================================
   * 3. PRIVATE ACCOUNT -> FOLLOW REQUEST
   * ==========================================================
   */
  if (targetIsPrivate) {
    let existingRequest;

    try {
      existingRequest =
        await getDoc(
          requestRef
        );
    } catch (error) {
      console.error(
        "[FOLLOW] Existing follow request read failed",
        {
          relationshipId,
          currentUserId,
          targetUserId,
          error
        }
      );

      throw new Error(
        "The private follow request could not be checked."
      );
    }

    if (
      existingRequest.exists()
    ) {
      return {
        state: "requested",
        targetIsPrivate: true
      };
    }

    const createdAt =
      nowIso();

    const requestData = {
      id:
        relationshipId,
      requesterId:
        currentUserId,
      targetUserId,
      createdAt
    };

    console.log(
      "[FOLLOW] Creating private follow request",
      {
        path:
          `followRequests/${relationshipId}`,
        requestData
      }
    );

    try {
      await setDoc(
        requestRef,
        requestData
      );
    } catch (error) {
      console.error(
        "[FOLLOW] Private follow request CREATE failed",
        {
          path:
            `followRequests/${relationshipId}`,
          requestData,
          authenticatedUid:
            services.auth.currentUser?.uid,
          emailVerified:
            services.auth.currentUser?.emailVerified,
          providerIds:
            services.auth.currentUser
              ?.providerData
              .map(
                (provider) =>
                  provider.providerId
              ),
          error
        }
      );

      throw new Error(
        "The private follow request could not be created."
      );
    }

    return {
      state: "requested",
      targetIsPrivate: true
    };
  }

  /*
   * ==========================================================
   * 4. PUBLIC ACCOUNT -> DIRECT FOLLOW
   * ==========================================================
   *
   * The follow and its notification stay in ONE transaction
   * because the current notification Firestore rule validates
   * the new follow using existsAfter().
   * ==========================================================
   */
  try {
    await runTransaction(
      services.db,
      async (
        transaction
      ) => {
        const followSnapshot =
          await transaction.get(
            followRef
          );

        if (
          followSnapshot.exists()
        ) {
          return;
        }

        const createdAt =
          nowIso();

        const relationship = {
          id:
            relationshipId,
          followerId:
            currentUserId,
          followingId:
            targetUserId,
          createdAt
        };

        const notificationId =
          `${relationshipId}_${createdAt}`;

        const notificationRef =
          doc(
            services.db,
            "notifications",
            notificationId
          );

        const notification = {
          id:
            notificationId,
          userId:
            targetUserId,
          actorUserId:
            currentUserId,
          type:
            "follow",
          createdAt,
          readAt:
            null
        };

        transaction.set(
          followRef,
          relationship
        );

        transaction.set(
          notificationRef,
          notification
        );
      }
    );
  } catch (error) {
    console.error(
      "[FOLLOW] Public follow transaction failed",
      {
        relationshipId,
        currentUserId,
        targetUserId,
        rawIsPrivateAccount:
          targetSnapshot.data()
            .isPrivateAccount,
        targetIsPrivate,
        error
      }
    );

    throw new Error(
      "This public profile could not be followed. Check the deployed Firestore follows/notifications rules."
    );
  }

  return {
    state: "following",
    targetIsPrivate: false
  };
}

/*
 * ============================================================
 * UNFOLLOW OR CANCEL REQUEST
 * ============================================================
 */

export async function unfollowOrCancelRequest(
  currentUserId: string,
  targetUserId: string
): Promise<FollowStateInfo> {
  const services =
    assertCurrentUser(
      currentUserId
    );

  const relationshipId =
    `${currentUserId}_${targetUserId}`;

  const targetRef =
    doc(
      services.db,
      "socialProfiles",
      targetUserId
    );

  const followRef =
    doc(
      services.db,
      "follows",
      relationshipId
    );

  const requestRef =
    doc(
      services.db,
      "followRequests",
      relationshipId
    );

  /*
   * Read target privacy first so public accounts do not
   * unnecessarily query followRequests.
   */
  let targetSnapshot;

  try {
    targetSnapshot =
      await getDoc(
        targetRef
      );
  } catch (error) {
    console.error(
      "[FOLLOW CANCEL] Target profile read failed",
      {
        targetUserId,
        error
      }
    );

    throw new Error(
      "The target profile could not be checked."
    );
  }

  const target =
    targetSnapshot.exists()
      ? storedCommunityProfile(
          targetSnapshot.id,
          targetSnapshot.data()
        )
      : null;

  const targetIsPrivate =
    targetSnapshot.exists() &&
    targetSnapshot.data()
      .isPrivateAccount === true;

  /*
   * First remove a completed follow relationship if one exists.
   */
  let followSnapshot;

  try {
    followSnapshot =
      await getDoc(
        followRef
      );
  } catch (error) {
    console.error(
      "[FOLLOW CANCEL] Existing follow read failed",
      {
        relationshipId,
        error
      }
    );

    throw new Error(
      "The existing follow relationship could not be checked."
    );
  }

  if (
    followSnapshot.exists()
  ) {
    try {
      await deleteDoc(
        followRef
      );
    } catch (error) {
      console.error(
        "[FOLLOW CANCEL] Follow DELETE failed",
        {
          path:
            `follows/${relationshipId}`,
          currentUserId,
          targetUserId,
          error
        }
      );

      throw new Error(
        "The follow relationship could not be removed."
      );
    }

    return {
      state: "none",
      targetIsPrivate:
        target?.isPrivateAccount ??
        targetIsPrivate
    };
  }

  /*
   * Only private accounts should have a pending request.
   */
  if (targetIsPrivate) {
    let requestSnapshot;

    try {
      requestSnapshot =
        await getDoc(
          requestRef
        );
    } catch (error) {
      console.error(
        "[FOLLOW CANCEL] Follow request read failed",
        {
          relationshipId,
          error
        }
      );

      throw new Error(
        "The pending follow request could not be checked."
      );
    }

    if (
      requestSnapshot.exists()
    ) {
      try {
        await deleteDoc(
          requestRef
        );
      } catch (error) {
        console.error(
          "[FOLLOW CANCEL] Follow request DELETE failed",
          {
            path:
              `followRequests/${relationshipId}`,
            currentUserId,
            targetUserId,
            storedRequesterId:
              requestSnapshot.data()
                .requesterId,
            storedTargetUserId:
              requestSnapshot.data()
                .targetUserId,
            error
          }
        );

        throw new Error(
          "The pending follow request could not be cancelled."
        );
      }
    }
  }

  return {
    state: "none",
    targetIsPrivate
  };
}

/*
 * ============================================================
 * INCOMING PRIVATE FOLLOW REQUESTS
 * ============================================================
 */

export async function getIncomingFollowRequests(
  targetUserId: string
): Promise<IncomingFollowRequest[]> {
  const services =
    assertCurrentUser(
      targetUserId
    );

  const requestSnapshot =
    await getDocs(
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
      )
    );

  const rawRequests =
    requestSnapshot.docs.map(
      (item) => {
        const data =
          item.data();

        return {
          id:
            item.id,

          requesterId:
            stringValue(
              data.requesterId
            ),

          targetUserId:
            stringValue(
              data.targetUserId
            ),

          createdAt:
            dateValue(
              data.createdAt
            )
        };
      }
    );

  const requesterSnapshots =
    await Promise.all(
      rawRequests.map(
        (request) =>
          getDoc(
            doc(
              services.db,
              "socialProfiles",
              request.requesterId
            )
          )
      )
    );

  return rawRequests
    .map(
      (
        request,
        index
      ): IncomingFollowRequest => {
        const snapshot =
          requesterSnapshots[
            index
          ];

        const requesterProfile =
          snapshot?.exists()
            ? storedCommunityProfile(
                snapshot.id,
                snapshot.data()
              )
            : null;

        return {
          ...request,
          requesterProfile
        };
      }
    )
    .filter(
      (request) =>
        Boolean(
          request.requesterId
        )
    )
    .sort(
      (first, second) =>
        new Date(
          second.createdAt
        ).getTime() -
        new Date(
          first.createdAt
        ).getTime()
    );
}

/*
 * ============================================================
 * APPROVE PRIVATE FOLLOW REQUEST
 * ============================================================
 */

export async function approveFollowRequest(
  targetUserId: string,
  requesterId: string
): Promise<void> {
  const services =
    assertCurrentUser(
      targetUserId
    );

  const relationshipId =
    `${requesterId}_${targetUserId}`;

  const requestRef =
    doc(
      services.db,
      "followRequests",
      relationshipId
    );

  const followRef =
    doc(
      services.db,
      "follows",
      relationshipId
    );

  await runTransaction(
    services.db,
    async (transaction) => {
      /*
       * All reads first.
       */
      const requestSnapshot =
        await transaction.get(
          requestRef
        );

      const followSnapshot =
        await transaction.get(
          followRef
        );

      if (
        !requestSnapshot.exists()
      ) {
        throw new Error(
          "This follow request is no longer available."
        );
      }

      const requestData =
        requestSnapshot.data();

      if (
        requestData.requesterId !==
          requesterId ||
        requestData.targetUserId !==
          targetUserId
      ) {
        throw new Error(
          "This follow request is not valid."
        );
      }

      if (
        !followSnapshot.exists()
      ) {
        transaction.set(
          followRef,
          {
            id:
              relationshipId,

            followerId:
              requesterId,

            followingId:
              targetUserId,

            createdAt:
              nowIso()
          }
        );
      }

      /*
       * Remove the pending request after approval.
       */
      transaction.delete(
        requestRef
      );
    }
  );
}

/*
 * ============================================================
 * REJECT PRIVATE FOLLOW REQUEST
 * ============================================================
 */

export async function rejectFollowRequest(
  targetUserId: string,
  requesterId: string
): Promise<void> {
  const services =
    assertCurrentUser(
      targetUserId
    );

  const relationshipId =
    `${requesterId}_${targetUserId}`;

  await deleteDoc(
    doc(
      services.db,
      "followRequests",
      relationshipId
    )
  );
} 