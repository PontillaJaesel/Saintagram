import { NextResponse } from "next/server";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { deleteSelectedNonAdminUsers } from "@/lib/admin-delete-records";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({})) as { confirmation?: unknown; userIds?: unknown };
    if (body.confirmation !== "DELETE USERS") return NextResponse.json({ error: "Type DELETE USERS to confirm." }, { status: 400, headers: noStoreHeaders });
    if (!Array.isArray(body.userIds) || !body.userIds.every((value) => typeof value === "string")) return NextResponse.json({ error: "Select at least one valid user." }, { status: 400, headers: noStoreHeaders });
    return NextResponse.json(await deleteSelectedNonAdminUsers(body.userIds, admin.uid), { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_ACCOUNT_PROTECTED") return NextResponse.json({ error: "Your selection includes an administrator account. Remove it before deleting." }, { status: 403, headers: noStoreHeaders });
    if (error instanceof Error && error.message === "NO_USERS_SELECTED") return NextResponse.json({ error: "Select at least one user." }, { status: 400, headers: noStoreHeaders });
    return adminError(error);
  }
}
