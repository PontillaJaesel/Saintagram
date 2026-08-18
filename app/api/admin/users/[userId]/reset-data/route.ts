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
    params: Promise<{ userId: string }>;
  }
) {
  try {
    const admin = await requireAdmin(request);

    const { userId } = await params;

    const body = (
      await request.json().catch(() => ({}))
    ) as {
      confirmation?: unknown;
    };

    if (body.confirmation !== CONFIRMATION) {
      return NextResponse.json(
        {
          error: `Type ${CONFIRMATION} to confirm.`
        },
        {
          status: 400,
          headers: noStoreHeaders
        }
      );
    }

    const result =
      await resetOneNonAdminUserData(
        userId,
        admin.uid
      );

    return NextResponse.json(
      result,
      {
        headers: noStoreHeaders
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ADMIN_ACCOUNT_PROTECTED"
    ) {
      return NextResponse.json(
        {
          error:
            "Administrator accounts cannot be reset here."
        },
        {
          status: 403,
          headers: noStoreHeaders
        }
      );
    }

    if (
      error instanceof Error &&
      error.message === "DEFAULT_PASSWORD_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          error:
            "This user cannot be reset because they do not have a verified issued/default password. To permanently remove this user, choose Delete Account & All Data instead."
        },
        {
          status: 409,
          headers: noStoreHeaders
        }
      );
    }

    if (
      error instanceof Error &&
      (
        error.message === "USER_ACCOUNT_NOT_FOUND" ||
        error.message === "USER_RECORD_NOT_FOUND"
      )
    ) {
      return NextResponse.json(
        {
          error: "The user account could not be found."
        },
        {
          status: 404,
          headers: noStoreHeaders
        }
      );
    }

    return adminError(error);
  }
}
