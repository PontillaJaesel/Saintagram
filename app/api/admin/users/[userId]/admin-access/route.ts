import { NextResponse } from "next/server";
import { setSharedAdminAccess } from "@/lib/admin-access";
import {
  adminError,
  noStoreHeaders,
  requireAdmin
} from "@/lib/admin-auth";

function accessError(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : "";

  if (message === "USER_NOT_FOUND") {
    return NextResponse.json(
      { error: "User not found." },
      { status: 404, headers: noStoreHeaders }
    );
  }
  if (message === "AUTH_ACCOUNT_DISABLED") {
    return NextResponse.json(
      { error: "This Firebase Authentication account is disabled." },
      { status: 409, headers: noStoreHeaders }
    );
  }
  if (message === "EMAIL_NOT_VERIFIED") {
    return NextResponse.json(
      { error: "The user's email must be verified before admin access can be granted." },
      { status: 409, headers: noStoreHeaders }
    );
  }
  if (message === "ADMIN_GRANT_METADATA_MISSING") {
    return NextResponse.json(
      {
        error:
          "The shared-admin grant metadata is missing. No Firebase admin claim was removed."
      },
      { status: 409, headers: noStoreHeaders }
    );
  }

  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { userId } = await params;

    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      granted?: unknown;
    } | null;

    if (typeof body?.granted !== "boolean") {
      return NextResponse.json(
        { error: "A boolean granted value is required." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (admin.uid === userId) {
      return NextResponse.json(
        { error: "You cannot change your own shared administrator access." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const result = await setSharedAdminAccess(
      admin.uid,
      userId,
      body.granted
    );

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    return accessError(error) ?? adminError(error);
  }
}
