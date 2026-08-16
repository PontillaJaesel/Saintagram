import { NextResponse } from "next/server";
import { requireAdmin, adminError, noStoreHeaders } from "@/lib/admin-auth";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";

function iso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const snapshot = await getFirebaseAdminFirestore().collection("passwordResetRequests").get();
    const requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, userId: String(data.userId ?? ""), username: String(data.username ?? ""), status: String(data.status ?? "pending"), requestedAt: iso(data.requestedAt), reviewedAt: data.reviewedAt ? iso(data.reviewedAt) : null, reviewedByAdminId: data.reviewedByAdminId ? String(data.reviewedByAdminId) : null };
    }).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return NextResponse.json({ requests }, { headers: noStoreHeaders });
  } catch (error) { return adminError(error); }
}
