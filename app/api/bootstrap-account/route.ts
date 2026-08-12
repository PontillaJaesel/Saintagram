import { NextResponse } from "next/server";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";
import {
  findTemporaryAccount
} from "@/lib/temporary-accounts.server";
import { usernameAccountEmail } from "@/lib/account-identity";

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
    if (!email) return json({ error: "The username and password do not match." }, 401);
    let existingUid: string | null = null;
    try {
      existingUid = (await auth.getUserByEmail(email)).uid;
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

    if (existingUid) {
      const accountSnapshot = await db.collection("users").doc(existingUid).get();
      if (
        accountSnapshot.exists &&
        accountSnapshot.get("mustChangePassword") !== true
      ) {
        return json({ error: "The username and password do not match." }, 401);
      }
      if (!accountSnapshot.exists) {
        const now = new Date().toISOString();
        await db.collection("users").doc(existingUid).set({
          id: existingUid,
          email,
          username: issued.username,
          fullName: issued.fullName,
          role: issued.role,
          authProvider: "password",
          createdAt: now,
          updatedAt: now,
          privacyConsentAt: null,
          spiritualIntroSeenAt: null,
          profileCompleted: false,
          mustChangePassword: true,
          privacyPreferences: {
            requirePrivateCheck: true,
            showReflectionDates: true
          }
        });
      }
      // An issued account may predate a rotated temporary credential. Repair
      // Firebase Auth only while the account is still in its mandatory
      // first-login state. Once mustChangePassword is false, the endpoint
      // returns 401 above and can never overwrite the permanent password.
      await auth.updateUser(existingUid, {
        password: issued.temporaryPassword,
        emailVerified: true,
        displayName: issued.username
      });
      return json({ ok: true, email }, 200);
    }

    const created = await auth.createUser({
      email,
      password: issued.temporaryPassword,
      emailVerified: true,
      displayName: issued.username
    });
    const now = new Date().toISOString();
    try {
      await db.collection("users").doc(created.uid).set({
        id: created.uid,
        email,
        username: issued.username,
        fullName: issued.fullName,
        role: issued.role,
        authProvider: "password",
        createdAt: now,
        updatedAt: now,
        privacyConsentAt: null,
        spiritualIntroSeenAt: null,
        profileCompleted: false,
        mustChangePassword: true,
        privacyPreferences: {
          requirePrivateCheck: true,
          showReflectionDates: true
        }
      });
    } catch (metadataError) {
      await auth.deleteUser(created.uid).catch(() => undefined);
      throw metadataError;
    }
    return json({ ok: true, email }, 201);
  } catch (error) {
    console.error("Temporary account bootstrap failed.", error);
    return json({ error: "Sign-in could not be prepared. Please try again." }, 500);
  }
}
