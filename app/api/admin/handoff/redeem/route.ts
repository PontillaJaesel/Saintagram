import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/admin-auth";
import { redeemAdminHandoff } from "@/lib/admin-handoff";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    const code = typeof body?.code === "string" ? body.code : "";
    const customToken = await redeemAdminHandoff(code);

    return NextResponse.json({ customToken }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "INVALID_HANDOFF") {
      return NextResponse.json(
        { error: "This admin handoff is invalid, expired, or already used." },
        { status: 401, headers: noStoreHeaders }
      );
    }
    if (message === "SHARED_ADMIN_ACCESS_REQUIRED") {
      return NextResponse.json(
        { error: "Shared administrator access is no longer active." },
        { status: 403, headers: noStoreHeaders }
      );
    }

    console.error("Admin handoff redemption failed", error);
    return NextResponse.json(
      { error: "The admin handoff could not be completed." },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
