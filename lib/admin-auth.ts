import "server-only";
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export class AdminAuthError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } }
export async function requireAdmin(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new AdminAuthError(401, "Authentication is required.");
  try {
    const token = await getFirebaseAdminAuth().verifyIdToken(authorization.slice(7), true);
    if (token.admin !== true) throw new AdminAuthError(403, "Administrator access is required.");
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
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders });
}
