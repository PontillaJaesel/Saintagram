import { NextResponse } from "next/server";

import {
  adminError,
  noStoreHeaders,
  requireAdmin
} from "@/lib/admin-auth";

import {
  resetOneNonAdminUserData
} from "@/lib/admin-delete-records";

export const runtime = "nodejs";

const CONFIRMATION = "RESET USER DATA";

export async function POST(
  request: Request,
  {
    params
  }: {
    params: Promise<{
      userId: string;
    }>;
  }
) {
  let targetUserId = "";

  try {
    /*
     * ==========================================================
     * 1. VERIFY ADMIN
     * ==========================================================
     */
    const admin =
      await requireAdmin(request);

    /*
     * ==========================================================
     * 2. GET TARGET USER ID
     * ==========================================================
     */
    const { userId } = await params;

    targetUserId =
      userId?.trim() ?? "";

    console.log(
      "[RESET USER DATA ROUTE] Request received",
      {
        targetUserId,
        requestingAdminId:
          admin.uid
      }
    );

    if (!targetUserId) {
      console.error(
        "[RESET USER DATA ROUTE] Missing target user ID"
      );

      return NextResponse.json(
        {
          error:
            "The target user ID is missing.",
          code:
            "USER_ID_MISSING"
        },
        {
          status: 400,
          headers: noStoreHeaders
        }
      );
    }

    /*
     * ==========================================================
     * 3. READ REQUEST BODY
     * ==========================================================
     */
    const body = (
      await request
        .json()
        .catch(() => ({}))
    ) as {
      confirmation?: unknown;
    };

    /*
     * ==========================================================
     * 4. VERIFY CONFIRMATION PHRASE
     * ==========================================================
     */
    if (
      body.confirmation !==
      CONFIRMATION
    ) {
      console.warn(
        "[RESET USER DATA ROUTE] Invalid confirmation",
        {
          targetUserId,
          receivedConfirmation:
            typeof body.confirmation ===
            "string"
              ? body.confirmation
              : null
        }
      );

      return NextResponse.json(
        {
          error:
            `Type ${CONFIRMATION} to confirm.`,
          code:
            "INVALID_CONFIRMATION"
        },
        {
          status: 400,
          headers: noStoreHeaders
        }
      );
    }

    /*
     * ==========================================================
     * 5. START RESET
     * ==========================================================
     */
    console.log(
      "[RESET USER DATA ROUTE] Starting reset",
      {
        targetUserId,
        requestingAdminId:
          admin.uid
      }
    );

    const result =
      await resetOneNonAdminUserData(
        targetUserId,
        admin.uid
      );

    /*
     * ==========================================================
     * 6. SUCCESS
     * ==========================================================
     */
    console.log(
      "[RESET USER DATA ROUTE] Reset completed successfully",
      {
        targetUserId,
        requestingAdminId:
          admin.uid,
        result
      }
    );

    return NextResponse.json(
      {
        success: true,
        userId: targetUserId,
        ...result
      },
      {
        status: 200,
        headers: noStoreHeaders
      }
    );
  } catch (error) {
    /*
     * ==========================================================
     * DEBUG THE ORIGINAL ERROR
     * ==========================================================
     *
     * This is intentionally logged before converting the error
     * into a user-friendly API response.
     *
     * Check the terminal / Cloudflare logs when a reset fails.
     */
    console.error(
      "[RESET USER DATA ROUTE] Reset failed",
      {
        targetUserId:
          targetUserId || null,

        errorName:
          error instanceof Error
            ? error.name
            : null,

        errorMessage:
          error instanceof Error
            ? error.message
            : String(error),

        errorStack:
          error instanceof Error
            ? error.stack
            : null
      }
    );

    /*
     * ==========================================================
     * ADMIN ACCOUNT PROTECTION
     * ==========================================================
     */
    if (
      error instanceof Error &&
      error.message ===
        "ADMIN_ACCOUNT_PROTECTED"
    ) {
      console.warn(
        "[RESET USER DATA ROUTE] Protected administrator account",
        {
          targetUserId
        }
      );

      return NextResponse.json(
        {
          error:
            "Administrator accounts cannot be reset here.",
          code:
            "ADMIN_ACCOUNT_PROTECTED"
        },
        {
          status: 403,
          headers: noStoreHeaders
        }
      );
    }

    /*
     * ==========================================================
     * FIREBASE AUTH ACCOUNT NOT FOUND
     * ==========================================================
     *
     * This means:
     *
     * getFirebaseAuthUser(userId)
     *
     * did not return a matching Firebase Authentication user.
     *
     * This is NOT the same as users/{uid} being missing.
     */
    if (
      error instanceof Error &&
      error.message ===
        "USER_ACCOUNT_NOT_FOUND"
    ) {
      console.error(
        "[RESET USER DATA ROUTE] Firebase Authentication user not found",
        {
          targetUserId
        }
      );

      return NextResponse.json(
        {
          error:
            "The Firebase Authentication account could not be found.",
          code:
            "USER_ACCOUNT_NOT_FOUND",
          userId:
            targetUserId || null
        },
        {
          status: 404,
          headers: noStoreHeaders
        }
      );
    }

    /*
     * ==========================================================
     * FIRESTORE USER RECORD NOT FOUND
     * ==========================================================
     *
     * Firebase Authentication was found, but:
     *
     * users/{uid}
     *
     * could not be found by the Firebase Admin Firestore
     * connection.
     */
    if (
      error instanceof Error &&
      error.message ===
        "USER_RECORD_NOT_FOUND"
    ) {
      console.error(
        "[RESET USER DATA ROUTE] Firestore user record not found",
        {
          targetUserId,

          expectedFirestorePath:
            targetUserId
              ? `users/${targetUserId}`
              : null
        }
      );

      return NextResponse.json(
        {
          error:
            "The Firebase Authentication account exists, but its Firestore users document could not be found.",
          code:
            "USER_RECORD_NOT_FOUND",
          userId:
            targetUserId || null
        },
        {
          status: 404,
          headers: noStoreHeaders
        }
      );
    }

    /*
     * ==========================================================
     * DEFAULT PASSWORD NOT FOUND
     * ==========================================================
     *
     * Preserve the existing protection:
     *
     * The account must NOT be wiped if Saintagram cannot restore
     * its originally-issued password afterward.
     */
    if (
      error instanceof Error &&
      error.message ===
        "DEFAULT_PASSWORD_NOT_FOUND"
    ) {
      console.error(
        "[RESET USER DATA ROUTE] Default password not found",
        {
          targetUserId
        }
      );

      return NextResponse.json(
        {
          error:
            "This user cannot be reset because they do not have a verified issued/default password. To permanently remove this user, choose Delete Account & All Data instead.",
          code:
            "DEFAULT_PASSWORD_NOT_FOUND",
          userId:
            targetUserId || null
        },
        {
          status: 409,
          headers: noStoreHeaders
        }
      );
    }

    /*
     * ==========================================================
     * UNKNOWN / FIREBASE / SERVER ERROR
     * ==========================================================
     *
     * Preserve Saintagram's existing admin error handling.
     */
    return adminError(error);
  }
}