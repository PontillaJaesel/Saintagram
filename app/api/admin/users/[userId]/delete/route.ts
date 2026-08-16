import { NextResponse } from "next/server";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { deleteOneNonAdminUser } from "@/lib/admin-delete-records";

export const runtime = "nodejs";
const CONFIRMATION = "DELETE ACCOUNT";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { userId } = await params;
    const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
    if (body.confirmation !== CONFIRMATION) return NextResponse.json({ error: `Type ${CONFIRMATION} to confirm.` }, { status: 400, headers: noStoreHeaders });
    return NextResponse.json(await deleteOneNonAdminUser(userId, admin.uid), { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_ACCOUNT_PROTECTED") return NextResponse.json({ error: "Administrator accounts cannot be deleted here." }, { status: 403, headers: noStoreHeaders });
    return adminError(error);
  }
}
