import { NextResponse } from "next/server";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { listAdminReflections, publishAdminReflection } from "@/lib/admin-reflections";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    return NextResponse.json(
      { reflections: await listAdminReflections(admin.uid) },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_REFLECTION_MEDIA") {
      return NextResponse.json(
        { error: "Choose up to five photos or one short video." },
        { status: 400, headers: noStoreHeaders }
      );
    }
    return adminError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => null) as
      | { title?: unknown; content?: unknown; reflectionId?: unknown; media?: unknown }
      | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "A reflection title and message are required." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const result = await publishAdminReflection(admin.uid, body);
    return NextResponse.json(result, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "REFLECTION_CONTENT_REQUIRED") {
      return NextResponse.json(
        { error: "Write a reflection before publishing." },
        { status: 400, headers: noStoreHeaders }
      );
    }
    return adminError(error);
  }
}
