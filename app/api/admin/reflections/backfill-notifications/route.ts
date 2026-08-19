import "server-only";

import {
  FieldValue
} from "firebase-admin/firestore";

import {
  requireAdmin,
  adminError,
  noStoreHeaders
} from "@/lib/admin-auth";

import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";

export const runtime =
  "nodejs";

const BATCH_LIMIT = 400;

interface AdminReflection {
  id: string;
  adminId: string;
  title: string;
  content: string;
}

function textValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

/*
 * ============================================================
 * FIND ALL ADMIN ACCOUNTS
 * ============================================================
 */
async function getAdminUserIds(): Promise<
  Set<string>
> {
  const auth =
    getFirebaseAdminAuth();

  const ids =
    new Set<string>();

  let pageToken:
    string | undefined;

  do {
    const page =
      await auth.listUsers(
        1000,
        pageToken
      );

    for (
      const user
      of page.users
    ) {
      if (
        user.customClaims
          ?.admin === true
      ) {
        ids.add(
          user.uid
        );
      }
    }

    pageToken =
      page.pageToken;
  } while (pageToken);

  return ids;
}

/*
 * ============================================================
 * FIND ALL EXISTING ADMIN REFLECTIONS
 * ============================================================
 */
async function getAdminReflections(
  adminIds: Set<string>
): Promise<
  AdminReflection[]
> {
  const db =
    getFirebaseAdminFirestore();

  const reflections:
    AdminReflection[] = [];

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
       * Only public Admin
       * reflections should
       * generate notifications.
       */
      if (
        data.isPrivate !==
        false
      ) {
        continue;
      }

      const content =
        textValue(
          data.content
        ).trim();

      if (!content) {
        continue;
      }

      reflections.push({
        id:
          document.id,

        adminId,

        title:
          textValue(
            data.title
          ).trim(),

        content
      });
    }
  }

  return reflections;
}

/*
 * ============================================================
 * POST
 * ============================================================
 *
 * Backfills missing Admin reflection
 * notifications for EVERY current
 * Saintagram user.
 * ============================================================
 */
export async function POST(
  request: Request
): Promise<Response> {
  try {
    /*
     * Only an authenticated Admin
     * may run the backfill.
     */
    const requestingAdmin =
      await requireAdmin(
        request
      );

    const db =
      getFirebaseAdminFirestore();

    /*
     * ========================================================
     * 1. FIND ADMIN ACCOUNTS
     * ========================================================
     */
    const adminIds =
      await getAdminUserIds();

    /*
     * Make sure the currently
     * authenticated Admin is included.
     */
    adminIds.add(
      requestingAdmin.uid
    );

    /*
     * ========================================================
     * 2. LOAD ALL HISTORICAL ADMIN REFLECTIONS
     * ========================================================
     */
    const reflections =
      await getAdminReflections(
        adminIds
      );

    if (
      reflections.length ===
      0
    ) {
      return Response.json(
        {
          ok: true,

          usersChecked:
            0,

          reflectionsChecked:
            0,

          notificationsCreated:
            0
        },
        {
          headers:
            noStoreHeaders
        }
      );
    }

    /*
     * ========================================================
     * 3. LOAD ALL CURRENT SAINTAGRAM USERS
     * ========================================================
     */
    const users =
      await db
        .collection(
          "users"
        )
        .get();

    let notificationsCreated =
      0;

    let usersChecked =
      0;

    /*
     * ========================================================
     * 4. CHECK EACH USER
     * ========================================================
     */
    for (
      const userDocument
      of users.docs
    ) {
      const userId =
        userDocument.id;

      /*
       * Do not send Admin reflection
       * notifications to Admin accounts.
       */
      if (
        adminIds.has(
          userId
        )
      ) {
        continue;
      }

      usersChecked += 1;

      /*
       * ======================================================
       * FIND ADMIN REFLECTION NOTIFICATIONS
       * THIS USER ALREADY HAS
       * ======================================================
       *
       * Older notifications may use
       * random Firestore document IDs,
       * so compare reflectionId instead.
       */
      const existingSnapshot =
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

      const existingReflectionIds =
        new Set<string>();

      for (
        const notification
        of existingSnapshot.docs
      ) {
        const data =
          notification.data();

        if (
          data.type !==
          "admin_reflection"
        ) {
          continue;
        }

        const reflectionId =
          textValue(
            data.reflectionId
          );

        if (
          reflectionId
        ) {
          existingReflectionIds.add(
            reflectionId
          );
        }
      }

      /*
       * ======================================================
       * FIND MISSING REFLECTION NOTIFICATIONS
       * ======================================================
       */
      const missing =
        reflections.filter(
          (
            reflection
          ) =>
            !existingReflectionIds.has(
              reflection.id
            )
        );

      /*
       * ======================================================
       * CREATE MISSING NOTIFICATIONS
       * ======================================================
       */
      for (
        let offset = 0;
        offset <
        missing.length;
        offset +=
          BATCH_LIMIT
      ) {
        const group =
          missing.slice(
            offset,
            offset +
              BATCH_LIMIT
          );

        const batch =
          db.batch();

        for (
          const reflection
          of group
        ) {
          /*
           * Deterministic ID means
           * rerunning the backfill
           * will target the same
           * notification.
           */
          const notificationId =
            `admin_reflection_${reflection.id}_${userId}`;

          const notificationRef =
            db
              .collection(
                "systemNotifications"
              )
              .doc(
                notificationId
              );

          batch.set(
            notificationRef,
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
               * It should appear as a
               * new notification when
               * backfilled.
               */
              createdAt:
                FieldValue
                  .serverTimestamp(),

              readAt:
                null
            }
          );

          notificationsCreated +=
            1;
        }

        await batch.commit();
      }
    }

    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */
    return Response.json(
      {
        ok: true,

        usersChecked,

        reflectionsChecked:
          reflections.length,

        notificationsCreated
      },
      {
        headers:
          noStoreHeaders
      }
    );
  } catch (error) {
    /*
     * Your current admin-auth.ts
     * exports adminError(), NOT
     * adminErrorResponse().
     */
    return adminError(
      error
    );
  }
}