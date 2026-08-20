import "server-only";
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export class AdminAuthError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } }
export async function requireAdmin(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new AdminAuthError(401, "Authentication is required.");
  try {
    // Signature, issuer, audience, and expiration verification is sufficient
    // for these short-lived ID tokens. Passing `true` also performs a remote
    // user/revocation lookup, which is unreliable in the Cloudflare Workers
    // runtime and was rejecting freshly issued production tokens.
    const token = await getFirebaseAdminAuth().verifyIdToken(authorization.slice(7));
    if (token.admin !== true) throw new AdminAuthError(403, "Administrator access is required.");

    // Shared administrators are checked against the server-owned Firestore
    // entitlement on every admin API request. This makes a revocation take
    // effect immediately even if the browser still holds an older ID token.
    if (token.saintagramSharedAdmin === true) {
      const user = await getFirebaseAdminFirestore()
        .collection("users")
        .doc(token.uid)
        .get();
      if (!user.exists || user.data()?.adminAccessGranted !== true) {
        throw new AdminAuthError(403, "Shared administrator access is no longer active.");
      }
    }

    return token;
  } catch (error) {
    if (error instanceof AdminAuthError) throw error;
    throw new AdminAuthError(401, "Authentication is invalid or expired.");
  }
}
export const noStoreHeaders = { "Cache-Control": "no-store" } as const;
export function adminError(error: unknown) {
  const status = error instanceof AdminAuthError ? error.status : 500;
  const message = error instanceof AdminAuthError ? error.message : "The admin request could not be completed.";
  if (status === 500) {
    const details = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: String(error) };
    console.error("Admin API request failed", details);
  }
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders });
}
