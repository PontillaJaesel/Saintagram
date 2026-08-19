import { AdminBulletins } from "@/components/admin/admin-bulletins";

export default function Page() {
  return <AdminBulletins />;
}

import { NextResponse } from "next/server";

import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import {
  createAdminBulletin,
  listAdminBulletins
} from "@/lib/admin-bulletins";

function knownError(error: unknown) {
  if (!(error instanceof Error)) return null;

  const messages: Record<string, string> = {
    BULLETIN_INVALID_TYPE: "Choose Announcement or Event as the bulletin type.",
    BULLETIN_TITLE_REQUIRED: "Enter a bulletin title before publishing.",
    BULLETIN_EVENT_DATE_REQUIRED: "Choose a date and time for an event.",
    BULLETIN_ANNOUNCEMENT_HAS_EVENT_DATE: "Announcements cannot include an event date.",
    BULLETIN_INVALID_DATE: "One of the bulletin dates is invalid.",
    BULLETIN_INVALID_URL: "Use a valid http:// or https:// link.",
    BULLETIN_EXPIRY_BEFORE_EVENT: "The expiry time cannot be earlier than the event time."
  };

  const message = messages[error.message];
  return message
    ? NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders })
    : null;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(
      { bulletins: await listAdminBulletins() },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Bulletin information is required." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { bulletin: await createAdminBulletin(body) },
      { status: 201, headers: noStoreHeaders }
    );
  } catch (error) {
    return knownError(error) ?? adminError(error);
  }
}