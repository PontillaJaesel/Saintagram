import { NextResponse } from "next/server";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { deleteAdminReflection, updateAdminReflection } from "@/lib/admin-reflections";

interface RouteContext {
  params: Promise<{ reflectionId: string }>;
}

async function authorizedId(request: Request, context: RouteContext) {
  const admin = await requireAdmin(request);
  const { reflectionId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reflectionId)) throw new Error("ADMIN_REFLECTION_NOT_FOUND");
  return { adminId: admin.uid, reflectionId };
}

function knownError(error: unknown) {
  if (error instanceof Error && error.message === "INVALID_REFLECTION_MEDIA") {
    return NextResponse.json({ error: "Choose up to five photos or one short video." }, { status: 400, headers: noStoreHeaders });
  }
  if (error instanceof Error && error.message === "REFLECTION_CONTENT_REQUIRED") {
    return NextResponse.json({ error: "Write a reflection before saving." }, { status: 400, headers: noStoreHeaders });
  }
  if (error instanceof Error && error.message === "ADMIN_REFLECTION_NOT_FOUND") {
    return NextResponse.json({ error: "That admin reflection could not be found." }, { status: 404, headers: noStoreHeaders });
  }
  return adminError(error);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { adminId, reflectionId } = await authorizedId(request, context);
    const body = await request.json().catch(() => null) as { title?: unknown; content?: unknown; media?: unknown } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "A reflection is required." }, { status: 400, headers: noStoreHeaders });
    }
    return NextResponse.json(
      { reflection: await updateAdminReflection(adminId, reflectionId, body) },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return knownError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { adminId, reflectionId } = await authorizedId(request, context);
    await deleteAdminReflection(adminId, reflectionId);
    return NextResponse.json({ deleted: true }, { headers: noStoreHeaders });
  } catch (error) {
    return knownError(error);
  }
}
