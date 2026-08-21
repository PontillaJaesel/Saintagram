import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { syncRequiredFollowsForUser } from "@/lib/required-follows";

const headers = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = /^Bearer ([^\s]+)$/.exec(authorization)?.[1] ?? "";
    if (!token) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401, headers });
    }
    // Do not request the extra remote revocation lookup in Cloudflare Workers.
    // Signature/issuer/audience/expiration verification is sufficient for this
    // short-lived Firebase ID token and matches the rest of the app's server auth.
    const verified = await getFirebaseAdminAuth().verifyIdToken(token);
    await syncRequiredFollowsForUser(verified.uid);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    console.error("[REQUIRED FOLLOW SYNC]", error);
    return NextResponse.json({ error: "Required follows could not be synchronized." }, { status: 500, headers });
  }
}
