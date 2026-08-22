import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";
import {
  PENDING_OPEN_COOKIE,
  VISIT_ID_PATTERN,
  hashOpenEventTrackingToken
} from "@/lib/link-tracking";
import { validOpenEventClientTarget } from "@/lib/link-tracking-shared";

const json = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";

    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "Authentication is required." }, 401);
    }

    // Use the same server-side Firebase ID-token verification path already used
    // by Saintagram's other authenticated Worker APIs. The previous
    // accounts:lookup REST path depended on NEXT_PUBLIC_FIREBASE_API_KEY being
    // present at Worker runtime, which can leave otherwise valid production
    // sessions unclaimed when that build-time public value is not a runtime
    // binding.
    let authUser: DecodedIdToken;
    try {
      authUser = await getFirebaseAdminAuth().verifyIdToken(
        authorization.slice(7)
      );
    } catch {
      return json({ error: "Authentication is invalid or expired." }, 401);
    }

    const rawBody = (await request.json().catch(() => ({}))) as {
      eventId?: unknown;
      trackingToken?: unknown;
    };
    const explicitTarget = validOpenEventClientTarget(
      rawBody.eventId,
      rawBody.trackingToken
    );

    const jar = await cookies();
    const cookieEventId = jar.get(PENDING_OPEN_COOKIE)?.value;
    const eventId =
      explicitTarget?.eventId ??
      (cookieEventId && VISIT_ID_PATTERN.test(cookieEventId)
        ? cookieEventId
        : null);

    if (!eventId) {
      return json({ claimed: false, reason: "missing_target" });
    }

    const explicitTokenHash = explicitTarget
      ? await hashOpenEventTrackingToken(explicitTarget.trackingToken)
      : null;

    if (explicitTarget && !explicitTokenHash) {
      return json({ error: "Invalid tracking target." }, 400);
    }

    const db = getFirebaseAdminFirestore();
    const ref = db.collection("linkOpenEvents").doc(eventId);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        throw new Error("missing");
      }

      if (
        explicitTokenHash &&
        snapshot.get("browserTrackingTokenHash") !== explicitTokenHash
      ) {
        throw new Error("target");
      }

      const owner = snapshot.get("userId") as string | null;

      if (owner && owner !== authUser.uid) {
        throw new Error("owned");
      }

      transaction.update(ref, {
        userId: authUser.uid,
        claimedAt: FieldValue.serverTimestamp()
      });
    });

    const result = json({ claimed: true, userId: authUser.uid });
    if (cookieEventId === eventId) {
      result.cookies.delete(PENDING_OPEN_COOKIE);
    }
    // Do not clear the separate precise-location cookie here. GPS can resolve
    // after an already-authenticated visit has been claimed.
    return result;
  } catch (error) {
    const status =
      error instanceof Error && error.message === "owned"
        ? 409
        : error instanceof Error && error.message === "missing"
          ? 404
          : error instanceof Error && error.message === "target"
            ? 403
            : 500;

    console.error("Open-event claim failed.", error);

    return json(
      {
        error:
          status === 409
            ? "This open event is already associated with another account."
            : status === 404
              ? "The pending open event no longer exists."
              : status === 403
                ? "The tracking target is no longer valid."
                : "The open event could not be associated with this account."
      },
      status
    );
  }
}
