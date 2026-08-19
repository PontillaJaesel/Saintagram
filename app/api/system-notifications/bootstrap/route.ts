import "server-only";

import {
  FieldValue,
  type DocumentData,
  type Firestore
} from "firebase-admin/firestore";

import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";

export const runtime = "nodejs";

const TOKEN_PATTERN =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const BATCH_WRITE_LIMIT = 400;

const ADMIN_PROFILE_NAME =
  "Saintagram Admin";

const ADMIN_PROFILE_BIO =
  "Official reflections from Saintagram.";

const ADMIN_HASHTAG =
  "#Saintagram";

interface AdminReflectionRecord {
  id: string;
  adminId: string;
  title: string;
  content: string;
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

function bearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get(
      "authorization"
    ) ?? "";

  if (
    authorization.length >
    16_384
  ) {
    return null;
  }

  const token =
    /^Bearer ([^\s]+)$/.exec(
      authorization
    )?.[1] ?? "";

  return TOKEN_PATTERN.test(
    token
  )
    ? token
    : null;
}

function response(
  body: Record<
    string,
    unknown
  >,
  status = 200
): Response {
  return Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store"
      }
    }
  );
}

/*
 * ============================================================
 * FIND OFFICIAL SAINTAGRAM ADMIN IDS
 * ============================================================
 *
 * We do NOT simply trust the profile name.
 *
 * A normal user could theoretically choose:
 *
 *   Saintagram Admin
 *
 * as their profile name.
 *
 * Therefore:
 *
 * 1. Find profiles matching the official Admin profile.
 * 2. Verify the Firebase Authentication account.
 * 3. Require the `admin: true` custom claim.
 * ============================================================
 */

async function getAdminIds(
  db: Firestore
): Promise<string[]> {
  const auth =
    getFirebaseAdminAuth();

  const profiles =
    await db
      .collection(
        "socialProfiles"
      )
      .where(
        "profileName",
        "==",
        ADMIN_PROFILE_NAME
      )
      .get();

  const adminIds:
    string[] = [];

  for (
    const profile
    of profiles.docs
  ) {
    const data =
      profile.data();

    /*
     * Verify that this looks like the
     * Saintagram-created Admin profile.
     */
    if (
      stringValue(
        data.spiritualBio
      ) !== ADMIN_PROFILE_BIO ||
      stringValue(
        data.heavenlyHashtag
      ) !== ADMIN_HASHTAG
    ) {
      continue;
    }

    try {
      const authUser =
        await auth.getUser(
          profile.id
        );

      if (
        authUser
          .customClaims
          ?.admin === true
      ) {
        adminIds.push(
          profile.id
        );
      }
    } catch {
      /*
       * Ignore stale Admin profile
       * documents whose Authentication
       * account no longer exists.
       */
    }
  }

  return Array.from(
    new Set(adminIds)
  );
}

/*
 * ============================================================
 * LOAD ALL EXISTING ADMIN REFLECTIONS
 * ============================================================
 */

async function getAdminReflections(
  db: Firestore,
  adminIds: string[]
): Promise<
  AdminReflectionRecord[]
> {
  const reflections =
    new Map<
      string,
      AdminReflectionRecord
    >();

  for (
    const adminId
    of adminIds
  ) {
    const snapshot =
      await db
        .collection(
          "reflectionPosts"
        )
        .where(
          "userId",
          "==",
          adminId
        )
        .get();

    for (
      const document
      of snapshot.docs
    ) {
      const data =
        document.data();

      /*
       * Only official PUBLIC Admin
       * reflections qualify.
       */
      if (
        data.isPrivate !==
          false ||
        data.accountPrivate ===
          true
      ) {
        continue;
      }

      const content =
        stringValue(
          data.content
        ).trim();

      if (!content) {
        continue;
      }

      reflections.set(
        document.id,
        {
          id:
            document.id,

          adminId,

          title:
            stringValue(
              data.title
            ).trim(),

          content
        }
      );
    }
  }

  return Array.from(
    reflections.values()
  );
}

/*
 * ============================================================
 * FIND ADMIN REFLECTIONS THE USER ALREADY RECEIVED
 * ============================================================
 *
 * This is important because your older Admin notifications use
 * random Firestore document IDs.
 *
 * We therefore do NOT determine duplication from the document ID.
 *
 * Instead we compare:
 *
 *   type == "admin_reflection"
 *   reflectionId == reflectionId
 *
 * That means existing users will not receive duplicates.
 * ============================================================
 */

async function getExistingReflectionIds(
  db: Firestore,
  userId: string
): Promise<Set<string>> {
  const snapshot =
    await db
      .collection(
        "systemNotifications"
      )
      .where(
        "userId",
        "==",
        userId
      )
      .get();

  const existing =
    new Set<string>();

  for (
    const document
    of snapshot.docs
  ) {
    const data =
      document.data();

    if (
      data.type !==
      "admin_reflection"
    ) {
      continue;
    }

    const reflectionId =
      stringValue(
        data.reflectionId
      );

    if (reflectionId) {
      existing.add(
        reflectionId
      );
    }
  }

  return existing;
}

/*
 * ============================================================
 * CREATE MISSING NOTIFICATIONS
 * ============================================================
 */

async function createMissingNotifications(
  db: Firestore,
  userId: string,
  reflections:
    AdminReflectionRecord[],
  existing:
    Set<string>
): Promise<number> {
  const missing =
    reflections.filter(
      (reflection) =>
        !existing.has(
          reflection.id
        )
    );

  let created = 0;

  for (
    let offset = 0;
    offset < missing.length;
    offset += BATCH_WRITE_LIMIT
  ) {
    const batch =
      db.batch();

    const group =
      missing.slice(
        offset,
        offset +
          BATCH_WRITE_LIMIT
      );

    for (
      const reflection
      of group
    ) {
      /*
       * Deterministic document ID.
       *
       * Even if the bootstrap endpoint accidentally
       * runs twice at the same time, this will target
       * the SAME Firestore document.
       */
      const notificationId =
        `admin_reflection_${reflection.id}_${userId}`;

      const ref =
        db
          .collection(
            "systemNotifications"
          )
          .doc(
            notificationId
          );

      batch.set(
        ref,
        {
          id:
            notificationId,

          userId,

          type:
            "admin_reflection",

          title:
            reflection.title ||
            "New reflection from Saintagram",

          message:
            reflection.content,

          missingFields:
            [],

          reflectionId:
            reflection.id,

          createdByAdminId:
            reflection.adminId,

          /*
           * Historical Admin reflections should
           * appear as NEW notifications to the
           * newly-created account.
           */
          createdAt:
            FieldValue
              .serverTimestamp(),

          readAt:
            null
        }
      );

      created += 1;
    }

    await batch.commit();
  }

  return created;
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request: Request
): Promise<Response> {
  const token =
    bearerToken(
      request
    );

  if (!token) {
    return response(
      {
        error:
          "Your sign-in session could not be verified."
      },
      401
    );
  }

  try {
    /*
     * Verify the caller.
     *
     * The request never accepts a userId from the browser.
     * The Firebase token determines which account receives
     * notifications.
     */
    const verified =
      await getFirebaseAdminAuth()
        .verifyIdToken(
          token,
          true
        );

    if (
      verified.email_verified !==
      true
    ) {
      return response(
        {
          error:
            "Verify your email before continuing."
        },
        403
      );
    }

    const userId =
      verified.uid;

    const db =
      getFirebaseAdminFirestore();

    /*
     * Only bootstrap accounts that have actually been
     * initialized in Saintagram's users collection.
     */
    const userSnapshot =
      await db
        .collection(
          "users"
        )
        .doc(
          userId
        )
        .get();

    if (
      !userSnapshot.exists
    ) {
      return response(
        {
          error:
            "Your Saintagram account has not finished initializing."
        },
        409
      );
    }

    /*
     * 1. Find official Admin account(s).
     */
    const adminIds =
      await getAdminIds(
        db
      );

    if (
      adminIds.length ===
      0
    ) {
      /*
       * This is not fatal for the user.
       * There are simply no detectable Admin
       * reflections to bootstrap.
       */
      return response({
        ok: true,
        created: 0,
        adminReflections: 0
      });
    }

    /*
     * 2. Load every currently-existing
     *    Saintagram Admin reflection.
     */
    const reflections =
      await getAdminReflections(
        db,
        adminIds
      );

    /*
     * 3. Find notifications this user
     *    already received.
     */
    const existing =
      await getExistingReflectionIds(
        db,
        userId
      );

    /*
     * 4. Create ONLY missing notifications.
     */
    const created =
      await createMissingNotifications(
        db,
        userId,
        reflections,
        existing
      );

    return response({
      ok: true,
      created,
      adminReflections:
        reflections.length
    });
  } catch (error) {
    console.error(
      "[ADMIN REFLECTION BOOTSTRAP]",
      error
    );

    return response(
      {
        error:
          "Admin reflection notifications could not be initialized."
      },
      500
    );
  }
}