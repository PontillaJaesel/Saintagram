import { NextResponse } from "next/server";
import { requireAdmin, adminError, noStoreHeaders } from "@/lib/admin-auth";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import {
  revokeFirebaseAuthRefreshTokens,
  setFirebaseAuthPassword
} from "@/lib/firebase-auth-rest";
import { findTemporaryAccount } from "@/lib/temporary-accounts.server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { requestId } = await params;
    const body = (await request.json()) as { decision?: unknown };

    if (body.decision !== "approve" && body.decision !== "reject") {
      return NextResponse.json(
        { error: "Choose approve or reject." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const db = getFirebaseAdminFirestore();
    const ref = db.collection("passwordResetRequests").doc(requestId);
    const snapshot = await ref.get();

    if (!snapshot.exists || snapshot.get("status") !== "pending") {
      return NextResponse.json(
        { error: "That request is no longer pending." },
        { status: 409, headers: noStoreHeaders }
      );
    }

    const username = String(snapshot.get("username") ?? "");
    const userId = String(snapshot.get("userId") ?? "");

    if (body.decision === "approve") {
      const issued = findTemporaryAccount(username);

      if (!issued || !userId) {
        return NextResponse.json(
          { error: "The issued account could not be verified." },
          { status: 400, headers: noStoreHeaders }
        );
      }

      // Use the Cloudflare-compatible Identity Toolkit REST path instead of
      // firebase-admin Auth. The Admin SDK credential refresh is the same
      // failure mode that prevented reset requests from being processed.
      await setFirebaseAuthPassword(userId, issued.temporaryPassword);
      await revokeFirebaseAuthRefreshTokens(userId);

      await db.collection("users").doc(userId).update({
        mustChangePassword: true,
        updatedAt: new Date().toISOString()
      });
    }

    await ref.update({
      status: body.decision === "approve" ? "approved" : "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedByAdminId: admin.uid
    });

    return NextResponse.json({ success: true }, { headers: noStoreHeaders });
  } catch (error) {
    return adminError(error);
  }
}
