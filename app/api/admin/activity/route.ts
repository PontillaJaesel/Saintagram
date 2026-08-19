import { NextResponse } from "next/server";
import {
  adminError,
  noStoreHeaders,
  requireAdmin
} from "@/lib/admin-auth";
import { loadAdminLinkEvents } from "@/lib/admin-data";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    return NextResponse.json(
      { events: await loadAdminLinkEvents() },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return adminError(error);
  }
}
