import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COMMON_VISIT_COOKIE,
  PENDING_OPEN_COOKIE,
  QR_VISIT_COOKIE,
  VISIT_ID_PATTERN,
  VISIT_SESSION_COOKIE,
  VISIT_SESSION_TTL_SECONDS,
  recordLinkOpen,
  reuseUnclaimedLinkOpen
} from "@/lib/link-tracking";

function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: VISIT_SESSION_TTL_SECONDS
  };
}

function trackedRedirect(
  request: Request,
  event: { id: string; destination: string },
  sourceCookie: string
) {
  const response = NextResponse.redirect(
    new URL(event.destination, request.url)
  );
  const options = cookieOptions(request);

  // Refresh all visit cookies whenever the same anonymous browser opens the
  // link again. The location endpoint and later login claim keep targeting the
  // same Firestore document.
  response.cookies.set(VISIT_SESSION_COOKIE, event.id, options);
  response.cookies.set(sourceCookie, event.id, options);
  response.cookies.set(PENDING_OPEN_COOKIE, event.id, options);
  return response;
}

export async function handleTrackedEntry(
  request: Request,
  source: "common" | "qr"
) {
  const jar = await cookies();
  const sourceCookie =
    source === "qr" ? QR_VISIT_COOKIE : COMMON_VISIT_COOKIE;
  const existingSourceVisitId = jar.get(sourceCookie)?.value;

  try {
    // If this browser already has an unclaimed visit for the exact same link,
    // do not create another row. Increment openCount and keep using it for up
    // to 30 minutes. If that visit was already claimed after login, this
    // returns null and a brand-new visit is created below.
    if (
      existingSourceVisitId &&
      VISIT_ID_PATTERN.test(existingSourceVisitId)
    ) {
      const reused = await reuseUnclaimedLinkOpen(
        existingSourceVisitId,
        request,
        source
      );

      if (reused) {
        return trackedRedirect(request, reused, sourceCookie);
      }
    }

    const event = await recordLinkOpen(request, source);
    return trackedRedirect(request, event, sourceCookie);
  } catch (error) {
    // Analytics must never prevent an admitted visitor from entering the app.
    console.error(
      "Visit tracking failed; continuing without a stored visit.",
      error
    );

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(
      VISIT_SESSION_COOKIE,
      `untracked_${crypto.randomUUID().replaceAll("-", "")}`,
      cookieOptions(request)
    );
    return response;
  }
}
