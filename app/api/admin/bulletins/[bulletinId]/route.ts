import { NextResponse } from "next/server";

import {
  adminError,
  noStoreHeaders,
  requireAdmin
} from "@/lib/admin-auth";

import {
  deleteAdminBulletin,
  updateAdminBulletin
} from "@/lib/admin-bulletins";

interface RouteContext {
  params: Promise<{
    bulletinId: string;
  }>;
}

async function authorizedId(
  request: Request,
  context: RouteContext
) {
  await requireAdmin(request);

  const { bulletinId } = await context.params;

  if (!/^[A-Za-z0-9_-]{1,128}$/.test(bulletinId)) {
    throw new Error("BULLETIN_NOT_FOUND");
  }

  return bulletinId;
}

function knownError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === "BULLETIN_NOT_FOUND") {
    return NextResponse.json(
      {
        error: "That bulletin item could not be found."
      },
      {
        status: 404,
        headers: noStoreHeaders
      }
    );
  }

  const messages: Record<string, string> = {
    BULLETIN_INVALID_TYPE:
      "Choose Announcement or Event as the bulletin type.",
    BULLETIN_TITLE_REQUIRED:
      "Enter a bulletin title before saving.",
    BULLETIN_EVENT_DATE_REQUIRED:
      "Choose a date and time for an event.",
    BULLETIN_ANNOUNCEMENT_HAS_EVENT_DATE:
      "Announcements cannot include an event date.",
    BULLETIN_INVALID_DATE:
      "One of the bulletin dates is invalid.",
    BULLETIN_INVALID_URL:
      "Use a valid http:// or https:// link.",
    BULLETIN_EXPIRY_BEFORE_EVENT:
      "The expiry time cannot be earlier than the event time."
  };

  const message = messages[error.message];

  if (!message) {
    return null;
  }

  return NextResponse.json(
    { error: message },
    {
      status: 400,
      headers: noStoreHeaders
    }
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const bulletinId = await authorizedId(request, context);

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          error: "Bulletin information is required."
        },
        {
          status: 400,
          headers: noStoreHeaders
        }
      );
    }

    const bulletin = await updateAdminBulletin(
      bulletinId,
      body
    );

    return NextResponse.json(
      { bulletin },
      {
        headers: noStoreHeaders
      }
    );
  } catch (error) {
    return knownError(error) ?? adminError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const bulletinId = await authorizedId(request, context);

    await deleteAdminBulletin(bulletinId);

    return NextResponse.json(
      { deleted: true },
      {
        headers: noStoreHeaders
      }
    );
  } catch (error) {
    return knownError(error) ?? adminError(error);
  }
}