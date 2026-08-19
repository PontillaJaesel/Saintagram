import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { getFirebaseAuthUserFromIdToken } from "@/lib/firebase-auth-rest";
import {
  PENDING_OPEN_COOKIE,
  VISIT_ID_PATTERN
} from "@/lib/link-tracking";

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

    // Do not use firebase-admin Auth here. The app already has a valid client
    // ID token, and Identity Toolkit can resolve it directly on Workers.
    const authUser = await getFirebaseAuthUserFromIdToken(
      authorization.slice(7)
    );

    if (!authUser || authUser.disabled) {
      return json({ error: "Authentication is invalid or expired." }, 401);
    }

    const jar = await cookies();
    const eventId = jar.get(PENDING_OPEN_COOKIE)?.value;

    if (!eventId || !VISIT_ID_PATTERN.test(eventId)) {
      return json({ claimed: false });
    }

    const db = getFirebaseAdminFirestore();
    const ref = db.collection("linkOpenEvents").doc(eventId);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        throw new Error("missing");
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

    const result = json({ claimed: true });
    result.cookies.delete(PENDING_OPEN_COOKIE);
    return result;
  } catch (error) {
    const status =
      error instanceof Error && error.message === "owned"
        ? 409
        : error instanceof Error && error.message === "missing"
          ? 404
          : 500;

    console.error("Open-event claim failed.", error);

    return json(
      {
        error:
          status === 409
            ? "This open event is already associated with another account."
            : status === 404
              ? "The pending open event no longer exists."
              : "The open event could not be associated with this account."
      },
      status
    );
  }
}
