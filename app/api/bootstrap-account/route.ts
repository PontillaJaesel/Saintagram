import { NextResponse } from "next/server";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";
import {
  findTemporaryAccount,
  usernameAccountEmail
} from "@/lib/temporary-accounts";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const issued = findTemporaryAccount(username);
    if (!issued || issued.temporaryPassword !== password) {
      return json({ error: "The username and password do not match." }, 401);
    }

    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();
    const email = usernameAccountEmail(issued.username);
    try {
      await auth.getUserByEmail(email);
      return json({ ok: true, email }, 200);
    } catch (error) {
      if (
        typeof error !== "object" ||
        !error ||
        !("code" in error) ||
        error.code !== "auth/user-not-found"
      ) {
        throw error;
      }
    }

    const created = await auth.createUser({
      email,
      password: issued.temporaryPassword,
      emailVerified: true,
      displayName: issued.username
    });
    const now = new Date().toISOString();
    await db.collection("users").doc(created.uid).set({
      id: created.uid,
      email,
      username: issued.username,
      authProvider: "password",
      createdAt: now,
      updatedAt: now,
      privacyConsentAt: null,
      spiritualIntroSeenAt: null,
      profileCompleted: false,
      mustChangePassword: true,
      privacyPreferences: {
        discoverable: true,
        showPosts: true,
        allowFollows: true
      }
    });
    return json({ ok: true, email }, 201);
  } catch (error) {
    console.error("Temporary account bootstrap failed.", error);
    return json({ error: "Sign-in could not be prepared. Please try again." }, 500);
  }
}
