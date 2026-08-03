import { NextResponse } from "next/server";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";

export const runtime = "nodejs";

const TOKEN_PATTERN =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.length > 16_384) return null;
  const token = /^Bearer ([^\s]+)$/.exec(authorization)?.[1] ?? "";
  return TOKEN_PATTERN.test(token) ? token : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return response({ error: "Your sign-in session could not be verified." }, 401);
  }

  try {
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();
    const verified = await auth.verifyIdToken(token, true);
    const userRef = db.collection("users").doc(verified.uid);
    const userSnapshot = await userRef.get();

    if (userSnapshot.exists && userSnapshot.get("profileCompleted") === true) {
      return response(
        { error: "A completed account must be deleted from Settings." },
        409
      );
    }

    while (true) {
      const reflections = await db
        .collection("reflectionPosts")
        .where("userId", "==", verified.uid)
        .limit(400)
        .get();
      if (reflections.empty) break;
      const batch = db.batch();
      reflections.docs.forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }

    const batch = db.batch();
    batch.delete(db.collection("profiles").doc(verified.uid));
    batch.delete(db.collection("privateProfiles").doc(verified.uid));
    batch.delete(db.collection("drafts").doc(verified.uid));
    batch.delete(userRef);
    await batch.commit();
    await auth.deleteUser(verified.uid);

    return response({ ok: true }, 200);
  } catch (error) {
    console.error("Account creation cancellation failed.", error);
    return response(
      {
        error:
          "The account could not be removed. Please try again."
      },
      500
    );
  }
}
