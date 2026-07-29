import { NextRequest, NextResponse } from "next/server";
import { getSafeAccessDestination } from "@/lib/access-path";
import {
  ACCESS_COOKIE_NAME,
  MINIMUM_SESSION_SECRET_LENGTH,
  verifyAccessSessionToken
} from "@/lib/access-session";

const ACCESS_PAGE = "/access";
const ACCESS_ENDPOINT = "/api/access";

function isFrameworkAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname === "/_next/image" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isFrameworkAsset(pathname) || pathname === ACCESS_ENDPOINT) {
    return NextResponse.next();
  }

  const sessionSecret = process.env.SITE_ACCESS_SESSION_SECRET;
  const cookie = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const hasAccess =
    Boolean(
      sessionSecret &&
        sessionSecret.length >= MINIMUM_SESSION_SECRET_LENGTH &&
        cookie
    ) &&
    (await verifyAccessSessionToken(cookie, sessionSecret as string));

  if (pathname === ACCESS_PAGE) {
    if (!hasAccess) return NextResponse.next();

    const destination = getSafeAccessDestination(
      request.nextUrl.searchParams.get("next")
    );
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (hasAccess) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json(
      { error: "A valid site access session is required." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
    if (cookie) response.cookies.delete(ACCESS_COOKIE_NAME);
    return response;
  }

  const accessUrl = new URL(ACCESS_PAGE, request.url);
  accessUrl.searchParams.set("next", `${pathname}${search}`);
  const response = NextResponse.redirect(accessUrl);
  if (cookie) response.cookies.delete(ACCESS_COOKIE_NAME);
  return response;
}
