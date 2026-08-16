import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PENDING_OPEN_COOKIE, VISIT_ID_PATTERN, VISIT_SESSION_COOKIE, recordLinkOpen } from "@/lib/link-tracking";

export async function handleTrackedEntry(request: Request, source: "common" | "qr") {
  const jar = await cookies();
  const existingVisitId = jar.get(VISIT_SESSION_COOKIE)?.value;
  if (existingVisitId && VISIT_ID_PATTERN.test(existingVisitId)) return NextResponse.redirect(new URL("/", request.url));
  try {
    const event = await recordLinkOpen(request, source);
    const response = NextResponse.redirect(new URL(event.destination, request.url));
    const options = { httpOnly: true, sameSite: "lax" as const, secure: new URL(request.url).protocol === "https:", path: "/" };
    response.cookies.set(VISIT_SESSION_COOKIE, event.id, options);
    response.cookies.set(PENDING_OPEN_COOKIE, event.id, { ...options, maxAge: 60 * 30 });
    return response;
  } catch (error) {
    // Analytics must never prevent an admitted visitor from entering the app.
    // Mark this browser session as attempted so `/` does not redirect back here
    // forever when Firebase Admin is unavailable during local development.
    console.error("Visit tracking failed; continuing without a stored visit.", error);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(
      VISIT_SESSION_COOKIE,
      `untracked_${crypto.randomUUID().replaceAll("-", "")}`,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
        path: "/"
      }
    );
    return response;
  }
}
