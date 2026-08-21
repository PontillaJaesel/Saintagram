import { NextRequest, NextResponse } from "next/server";
import { getSafeAccessDestination } from "@/lib/access-path";
import {
  ACCESS_COOKIE_NAME,
  MINIMUM_SESSION_SECRET_LENGTH,
  verifyAccessSessionToken
} from "@/lib/access-session";
import {
  getSaintagramAppMode,
  isAdminApiPath,
  isAdminPagePath,
  isLocalDevelopmentHostname
} from "@/lib/admin-routing";
import {
  COMMON_ENTRY_BYPASS_COOKIE,
  COMMON_VISIT_COOKIE,
  VISIT_ID_PATTERN
} from "@/lib/link-tracking";
import {
  OPEN_EVENT_ID_PARAM,
  OPEN_EVENT_TOKEN_PARAM,
  OPEN_EVENT_TOKEN_PATTERN
} from "@/lib/link-tracking-shared";

const ACCESS_PAGE = "/access";
const ACCESS_ENDPOINT = "/api/access";
const TRACKED_ENTRY_PATHS = new Set(["/open/qr", "/open/common"]);

function isFrameworkAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname === "/_next/image" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  );
}

function isPublicAssetPath(pathname: string): boolean {
  return /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|pdf|css|js|woff2?|ttf|eot|json|txt|xml|map|mp4|webm|mp3|wav|ogg)$/i.test(
    pathname
  );
}

function adminWorkerResponse(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  if (
    isFrameworkAsset(pathname) ||
    isPublicAssetPath(pathname) ||
    isAdminPagePath(pathname) ||
    isAdminApiPath(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "This endpoint is not available on the administrator Worker." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return new NextResponse("Not Found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" }
  });
}

export function proxy(request: NextRequest) {
  return enforceAccessGate(request);
}

export async function enforceAccessGate(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hostname = request.nextUrl.hostname || request.headers.get("host") || "";

  if (getSaintagramAppMode() === "admin") return adminWorkerResponse(request);

  // Local development uses /admin because a separate hostname is unnecessary.
  if (
    isLocalDevelopmentHostname(hostname) &&
    (isAdminPagePath(pathname) || isAdminApiPath(pathname))
  ) {
    return NextResponse.next();
  }

  if (pathname === "/qr") {
    return NextResponse.redirect(new URL(`/open/qr${search}`, request.url));
  }

  if (
    isFrameworkAsset(pathname) ||
    isPublicAssetPath(pathname) ||
    pathname === "/Saintagram_Logo.png" ||
    pathname === "/Saintagram_Logo.svg" ||
    pathname === ACCESS_ENDPOINT ||
    TRACKED_ENTRY_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  // A valid common-source cookie alone is not enough to decide that a root
  // request is "already tracked". It can still point to an older visit for up
  // to 30 minutes, which used to suppress a real later opening of
  // saintagram.com (especially when the user was already signed in).
  //
  // Modern browsers expose top-level navigation context through Fetch
  // Metadata. Treat an address-bar/bookmark/external navigation to `/` as a
  // fresh common-link entry even when an older common cookie exists. Same-
  // origin app navigation/reloads keep the existing visit window behavior.
  const explicitOpenEventId = request.nextUrl.searchParams.get(OPEN_EVENT_ID_PARAM);
  const explicitOpenEventToken = request.nextUrl.searchParams.get(OPEN_EVENT_TOKEN_PARAM);
  const hasExplicitTrackedReturn = Boolean(
    explicitOpenEventId &&
      VISIT_ID_PATTERN.test(explicitOpenEventId) &&
      explicitOpenEventToken &&
      OPEN_EVENT_TOKEN_PATTERN.test(explicitOpenEventToken)
  );

  const commonVisitId = request.cookies.get(COMMON_VISIT_COOKIE)?.value;
  const commonBypassId = request.cookies.get(COMMON_ENTRY_BYPASS_COOKIE)?.value;
  const hasValidCommonVisit = Boolean(
    commonVisitId && VISIT_ID_PATTERN.test(commonVisitId)
  );
  const isTrackedCommonReturn = Boolean(
    hasValidCommonVisit && commonBypassId === commonVisitId
  );
  const fetchSite = request.headers.get("sec-fetch-site");
  const fetchMode = request.headers.get("sec-fetch-mode");
  const fetchDest = request.headers.get("sec-fetch-dest");
  const isTopLevelNavigation =
    (!fetchMode || fetchMode === "navigate") &&
    (!fetchDest || fetchDest === "document");
  const isExternalOrDirectNavigation =
    isTopLevelNavigation &&
    (fetchSite === "none" ||
      fetchSite === "cross-site" ||
      fetchSite === "same-site" ||
      (!fetchSite && !request.headers.get("referer")));

  if (
    pathname === "/" &&
    !hasExplicitTrackedReturn &&
    !isTrackedCommonReturn &&
    (!hasValidCommonVisit || isExternalOrDirectNavigation)
  ) {
    return NextResponse.redirect(new URL("/open/common", request.url));
  }

  const clearCommonBypass = <T extends NextResponse>(response: T): T => {
    if (pathname === "/" && isTrackedCommonReturn) {
      response.cookies.delete(COMMON_ENTRY_BYPASS_COOKIE);
    }
    return response;
  };

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
    if (!hasAccess) return clearCommonBypass(NextResponse.next());

    const destination = getSafeAccessDestination(
      request.nextUrl.searchParams.get("next")
    );
    return clearCommonBypass(NextResponse.redirect(new URL(destination, request.url)));
  }

  if (hasAccess) return clearCommonBypass(NextResponse.next());

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
  return clearCommonBypass(response);
}
