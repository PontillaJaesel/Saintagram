import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COMMON_ENTRY_BYPASS_COOKIE,
  COMMON_VISIT_COOKIE,
  LOCATION_OPEN_COOKIE,
  PENDING_OPEN_COOKIE,
  QR_VISIT_COOKIE,
  VISIT_ID_PATTERN,
  VISIT_SESSION_COOKIE,
  VISIT_SESSION_TTL_SECONDS,
  recordLinkOpen,
  reuseUnclaimedLinkOpen
} from "@/lib/link-tracking";
import {
  OPEN_EVENT_ID_PARAM,
  OPEN_EVENT_TOKEN_PARAM
} from "@/lib/link-tracking-shared";

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
  event: {
    id: string;
    destination: string;
    trackingToken: string;
  },
  sourceCookie: string
) {
  const destination = new URL(event.destination, request.url);
  destination.searchParams.set(OPEN_EVENT_ID_PARAM, event.id);
  destination.searchParams.set(OPEN_EVENT_TOKEN_PARAM, event.trackingToken);

  const response = NextResponse.redirect(destination);
  const options = cookieOptions(request);

  // Cookies remain as backwards-compatible/fallback targeting, but the client
  // also receives an explicit short-lived event id + opaque token in the
  // redirect URL. The provider removes those internal parameters immediately
  // after reading them. This prevents a lost/overwritten redirect cookie from
  // leaving a real visit anonymous or approximate-only.
  response.cookies.set(VISIT_SESSION_COOKIE, event.id, options);
  response.cookies.set(sourceCookie, event.id, options);
  if (sourceCookie === COMMON_VISIT_COOKIE) {
    // The tracked common route redirects back to `/`. Mark only that redirect
    // so proxy.ts can let it through once instead of sending it straight back
    // into /open/common. The explicit event parameters are a second loop guard
    // in case a browser does not preserve this cookie across the redirect.
    response.cookies.set(COMMON_ENTRY_BYPASS_COOKIE, event.id, options);
  }
  response.cookies.set(PENDING_OPEN_COOKIE, event.id, options);
  response.cookies.set(LOCATION_OPEN_COOKIE, event.id, options);
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
    // to 30 minutes. A fresh browser token is issued for the reused visit so
    // the newest entry page is always authorized to finish identity/GPS work.
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
