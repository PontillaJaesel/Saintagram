import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const MAXIMUM_AUTHORIZATION_HEADER_LENGTH = 16_384;
const FIREBASE_ID_TOKEN =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function jsonResponse(
  body: Record<string, unknown>,
  status: number
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (
    !authorization ||
    authorization.length > MAXIMUM_AUTHORIZATION_HEADER_LENGTH
  ) {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  const token = match?.[1] ?? "";
  return FIREBASE_ID_TOKEN.test(token) ? token : null;
}

function authenticationFailure(): NextResponse {
  return jsonResponse(
    {
      error:
        "Your sign-in session could not be verified. Sign out and sign in again."
    },
    401
  );
}

function setupFailure(): NextResponse {
  return jsonResponse(
    {
      error:
        "Automatic image access setup is unavailable. Please contact the site owner."
    },
    503
  );
}

function firebaseErrorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
}

function isFirebaseSessionFailure(error: unknown): boolean {
  return new Set([
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/invalid-id-token",
    "auth/user-disabled",
    "auth/user-not-found"
  ]).has(firebaseErrorCode(error));
}

/**
 * Idempotently enables Supabase's authenticated Postgres role for the exact
 * Firebase user represented by the verified bearer token. The request cannot
 * select another UID or provide its own claim value.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) return authenticationFailure();

  let auth: ReturnType<typeof getFirebaseAdminAuth>;
  try {
    auth = getFirebaseAdminAuth();
  } catch (error) {
    console.error("Firebase Admin image-access setup is unavailable.", error);
    return setupFailure();
  }

  let decodedToken: Awaited<ReturnType<typeof auth.verifyIdToken>>;
  try {
    decodedToken = await auth.verifyIdToken(token, true);
  } catch (error) {
    if (isFirebaseSessionFailure(error)) return authenticationFailure();
    console.error("Firebase ID-token verification is unavailable.", error);
    return setupFailure();
  }

  try {
    const user = await auth.getUser(decodedToken.uid);
    if (user.disabled) return authenticationFailure();

    const existingRole = user.customClaims?.role;
    if (existingRole && existingRole !== "authenticated") {
      console.error(
        "Firebase user has a reserved role claim that cannot be changed automatically."
      );
      return setupFailure();
    }

    if (existingRole !== "authenticated") {
      await auth.setCustomUserClaims(user.uid, {
        ...user.customClaims,
        role: "authenticated"
      });
    }
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (code === "auth/user-not-found" || code === "auth/user-disabled") {
      return authenticationFailure();
    }
    console.error("Firebase image-access claim could not be updated.", error);
    return setupFailure();
  }

  return jsonResponse({ ok: true }, 200);
}
