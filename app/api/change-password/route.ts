import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { passwordError } from "@/lib/validation";
import {
  setFirebaseAuthPassword
} from "@/lib/firebase-auth-rest";

export const runtime = "nodejs";

const reply = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) {
      return reply({ error: "Authentication is required." }, 401);
    }
    const auth = getFirebaseAdminAuth();
    const token = await auth.verifyIdToken(
      authorization.slice(7)
    );
    const body = await request.json() as { newPassword?: string };
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const validationError = passwordError(newPassword);
    if (validationError) return reply({ error: validationError }, 400);

    const userRef = getFirebaseAdminFirestore().collection("users").doc(token.uid);
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) return reply({ error: "Your account record could not be found." }, 404);

    const updatedAt = new Date().toISOString();
    await userRef.update({ mustChangePassword: false, updatedAt });
    try {
      await setFirebaseAuthPassword(token.uid, newPassword);
    } catch (passwordUpdateError) {
      await userRef.update({ mustChangePassword: true, updatedAt: new Date().toISOString() });
      throw passwordUpdateError;
    }
    return reply({ ok: true }, 200);
  } catch (error) {
    console.error("Password change failed.", error);
    return reply({ error: "Your password could not be saved. Please sign in again and retry." }, 500);
  }
}
