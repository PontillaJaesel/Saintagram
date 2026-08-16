import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { usernameAccountEmail } from "@/lib/account-identity";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { findTemporaryAccount } from "@/lib/temporary-accounts.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const generic = NextResponse.json({ requested: true, message: "If this issued account exists, an administrator will review the password reset request." }, { headers: { "Cache-Control": "no-store" } });
  try {
    const body = await request.json() as { username?: unknown };
    const issued = findTemporaryAccount(typeof body.username === "string" ? body.username : "");
    if (!issued) return generic;
    const email = usernameAccountEmail(issued.username);
    if (!email) return generic;
    let user;
    try { user = await getFirebaseAdminAuth().getUserByEmail(email); } catch { return generic; }
    const db = getFirebaseAdminFirestore();
    const previous = await db.collection("passwordResetRequests").where("userId", "==", user.uid).get();
    if (previous.docs.some((item) => item.get("status") === "pending")) return generic;
    const ref = db.collection("passwordResetRequests").doc();
    await ref.set({ id: ref.id, userId: user.uid, username: issued.username, status: "pending", requestedAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedByAdminId: null });
    return generic;
  } catch {
    return NextResponse.json({ error: "The request could not be sent. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
