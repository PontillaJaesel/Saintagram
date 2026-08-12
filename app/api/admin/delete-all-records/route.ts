import { NextResponse } from "next/server";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { deleteAllNonAdminRecords } from "@/lib/admin-delete-records";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
    if (body.confirmation !== "DELETE ALL RECORDS") {
      return NextResponse.json({ error: "Type DELETE ALL RECORDS to confirm." }, { status: 400, headers: noStoreHeaders });
    }
    return NextResponse.json(await deleteAllNonAdminRecords(admin.uid), { headers: noStoreHeaders });
  } catch (error) {
    return adminError(error);
  }
}
