import { NextResponse } from "next/server";
import { usernameAccountEmail } from "@/lib/account-identity";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { findTemporaryAccount } from "@/lib/temporary-accounts.server";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;

function genericResponse() {
  return NextResponse.json(
    {
      requested: true,
      message:
        "If this issued account exists, an administrator will review the password reset request."
    },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: unknown };
    const username = typeof body.username === "string" ? body.username : "";
    const issued = findTemporaryAccount(username);

    // Keep the response neutral so this endpoint cannot be used to enumerate
    // issued usernames.
    if (!issued) return genericResponse();

    const email = usernameAccountEmail(issued.username);
    if (!email) return genericResponse();

    const db = getFirebaseAdminFirestore();

    // Do NOT call getFirebaseAdminAuth().getUserByEmail() here. In the
    // Cloudflare Workers runtime that Admin SDK call can fail while refreshing
    // its Google OAuth token. The previous implementation swallowed that error
    // and returned a success response without ever creating the admin request.
    // The user metadata already stores the Firebase UID as the document ID, so
    // resolve the issued account from Firestore instead.
    const users = await db.collection("users").get();
    const account = users.docs.find((item) => {
      const storedUsername = String(item.get("username") ?? "")
        .trim()
        .toLocaleUpperCase();
      const storedEmail = String(item.get("email") ?? "")
        .trim()
        .toLocaleLowerCase();

      return storedUsername === issued.username || storedEmail === email;
    });

    if (!account) return genericResponse();

    const previous = await db
      .collection("passwordResetRequests")
      .where("userId", "==", account.id)
      .get();

    if (previous.docs.some((item) => item.get("status") === "pending")) {
      return genericResponse();
    }

    const ref = db.collection("passwordResetRequests").doc();
    await ref.set({
      id: ref.id,
      userId: account.id,
      username: issued.username,
      status: "pending",
      requestedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedByAdminId: null
    });

    return genericResponse();
  } catch (error) {
    console.error("Password reset request failed.", error);
    return NextResponse.json(
      { error: "The request could not be sent. Please try again." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
