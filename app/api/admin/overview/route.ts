import { NextResponse } from "next/server";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { loadOverview } from "@/lib/admin-data";
import { ensureRequiredFollowGraphBackfilled } from "@/lib/required-follows";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    await ensureRequiredFollowGraphBackfilled();
    return NextResponse.json(await loadOverview(), { headers: noStoreHeaders });
  } catch (error) {
    return adminError(error);
  }
}
