import { NextResponse } from "next/server";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { createAdminHandoff } from "@/lib/admin-handoff";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const code = await createAdminHandoff(admin.uid);
    return NextResponse.json({ code }, { headers: noStoreHeaders });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SHARED_ADMIN_ACCESS_REQUIRED"
    ) {
      return NextResponse.json(
        { error: "Shared administrator access is not active for this account." },
        { status: 403, headers: noStoreHeaders }
      );
    }
    return adminError(error);
  }
}
