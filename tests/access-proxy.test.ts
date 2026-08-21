import { webcrypto } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import {
  ACCESS_COOKIE_NAME,
  createAccessSessionToken
} from "@/lib/access-session";
import {
  COMMON_ENTRY_BYPASS_COOKIE,
  COMMON_VISIT_COOKIE,
  QR_VISIT_COOKIE,
  VISIT_SESSION_COOKIE
} from "@/lib/link-tracking";
import {
  OPEN_EVENT_ID_PARAM,
  OPEN_EVENT_TOKEN_PARAM
} from "@/lib/link-tracking-shared";

const SESSION_SECRET = "s".repeat(32);

function nextRequest(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", `${ACCESS_COOKIE_NAME}=${cookie}`);
  }
  return new NextRequest(`https://saintagram.example${path}`, { headers });
}

function hostRequest(hostname: string, path: string): NextRequest {
  return new NextRequest(`https://${hostname}${path}`);
}

describe("access proxy", () => {
  beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
  });

  beforeEach(() => {
    vi.stubEnv("SITE_ACCESS_SESSION_SECRET", SESSION_SECRET);
    vi.stubEnv("SAINTAGRAM_APP_MODE", "normal");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    "/api/access",
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
    "/Saintagram_Logo.png"
  ])("allows the public framework endpoint %s", async (path) => {
    const response = await proxy(nextRequest(path));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("shows the access page to a visitor without a session", async () => {
    const response = await proxy(
      nextRequest("/access?next=%2Fprofile")
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a protected deep link to access and preserves its path and query", async () => {
    const response = await proxy(
      nextRequest("/profile?tab=private&entry=one")
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") as string);
    expect(location.origin).toBe("https://saintagram.example");
    expect(location.pathname).toBe("/access");
    expect(location.searchParams.get("next")).toBe(
      "/profile?tab=private&entry=one"
    );
  });

  it("allows a valid session through to a protected page", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const response = await proxy(nextRequest("/profile", token));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("returns JSON instead of redirecting an unauthorized protected API request", async () => {
    const response = await proxy(nextRequest("/api/private-data?item=one"));

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "A valid site access session is required."
    });
  });

  it("keeps Next data requests behind the access gate", async () => {
    const response = await proxy(nextRequest("/_next/data/build/profile.json"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/access?next=");
  });

  it("redirects an admitted visitor away from access to a safe destination", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const response = await proxy(
      nextRequest("/access?next=%2Fjourney%3Fday%3D1", token)
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/journey?day=1"
    );
  });

  it("falls back to home for an admitted visitor with an external next value", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const response = await proxy(
      nextRequest(
        "/access?next=https%3A%2F%2Fexample.com%2Fsteal-session",
        token
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/"
    );
  });

  it("does not redirect an admitted visitor to a normalized protocol-relative path", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const response = await proxy(
      nextRequest(
        "/access?next=%2F%252e%252e%2F%2Fevil.example%2Fsteal-session",
        token
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/"
    );
  });

  it("rejects and clears a forged session cookie", async () => {
    const response = await proxy(
      nextRequest("/profile", "forged.session")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/access?next=");
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${ACCESS_COOKIE_NAME}=;`);
    expect(setCookie).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    );
  });

  it("fails closed when the session secret is missing", async () => {
    vi.stubEnv("SITE_ACCESS_SESSION_SECRET", "");
    const token = await createAccessSessionToken(SESSION_SECRET);
    const response = await proxy(nextRequest("/profile", token));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/access?next=");
  });

  it("routes the public QR URL through the tracked QR entry handler", async () => {
    const response = await proxy(nextRequest("/qr?campaign=parish-2026"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/open/qr?campaign=parish-2026"
    );
  });

  it("routes a direct root visit through common-link tracking", async () => {
    const response = await proxy(nextRequest("/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/open/common"
    );
  });

  it("tracks a common-link visit even when a QR/general visit cookie already exists", async () => {
    const headers = new Headers();
    headers.set(
      "cookie",
      `${VISIT_SESSION_COOKIE}=qr_general_visit; ${QR_VISIT_COOKIE}=qr_source_visit`
    );
    const request = new NextRequest("https://saintagram.example/", { headers });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/open/common"
    );
  });

  it("keeps same-origin root navigation inside the current common visit", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const headers = new Headers();
    headers.set(
      "cookie",
      `${ACCESS_COOKIE_NAME}=${token}; ${COMMON_VISIT_COOKIE}=common_visit_123`
    );
    headers.set("sec-fetch-site", "same-origin");
    headers.set("sec-fetch-mode", "navigate");
    headers.set("sec-fetch-dest", "document");
    const request = new NextRequest("https://saintagram.example/", { headers });
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("records a fresh common entry when the user directly opens the root again", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const headers = new Headers();
    headers.set(
      "cookie",
      `${ACCESS_COOKIE_NAME}=${token}; ${COMMON_VISIT_COOKIE}=older_common_visit`
    );
    headers.set("sec-fetch-site", "none");
    headers.set("sec-fetch-mode", "navigate");
    headers.set("sec-fetch-dest", "document");
    const request = new NextRequest("https://saintagram.example/", { headers });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/open/common"
    );
  });

  it("records a fresh common entry when saintagram.com is opened from another site", async () => {
    const headers = new Headers();
    headers.set("cookie", `${COMMON_VISIT_COOKIE}=older_common_visit`);
    headers.set("sec-fetch-site", "cross-site");
    headers.set("sec-fetch-mode", "navigate");
    headers.set("sec-fetch-dest", "document");
    const request = new NextRequest("https://saintagram.example/", { headers });
    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://saintagram.example/open/common"
    );
  });


  it("allows the explicit tracked-entry return even if redirect cookies are missing", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const eventId = "event_123";
    const trackingToken = "a".repeat(64);
    const headers = new Headers();
    headers.set("cookie", `${ACCESS_COOKIE_NAME}=${token}`);
    headers.set("sec-fetch-site", "none");
    headers.set("sec-fetch-mode", "navigate");
    headers.set("sec-fetch-dest", "document");
    const request = new NextRequest(
      `https://saintagram.example/?${OPEN_EVENT_ID_PARAM}=${eventId}&${OPEN_EVENT_TOKEN_PARAM}=${trackingToken}`,
      { headers }
    );
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows the one-time return from /open/common and consumes its bypass cookie", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET);
    const headers = new Headers();
    headers.set(
      "cookie",
      `${ACCESS_COOKIE_NAME}=${token}; ${COMMON_VISIT_COOKIE}=new_common_visit; ${COMMON_ENTRY_BYPASS_COOKIE}=new_common_visit`
    );
    // Redirect chains can preserve the original user-navigation metadata, so
    // the bypass cookie is what prevents /open/common -> / -> /open/common.
    headers.set("sec-fetch-site", "none");
    headers.set("sec-fetch-mode", "navigate");
    headers.set("sec-fetch-dest", "document");
    const request = new NextRequest("https://saintagram.example/", { headers });
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain(
      `${COMMON_ENTRY_BYPASS_COOKIE}=;`
    );
  });

  it("rewrites the admin Worker root to the existing dashboard", async () => {
    vi.stubEnv("SAINTAGRAM_APP_MODE", "admin");
    const response = await proxy(hostRequest("saintagram-admin.axjp.workers.dev", "/"));

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://saintagram-admin.axjp.workers.dev/admin"
    );
  });

  it("allows only admin pages and APIs in admin deployment mode", async () => {
    vi.stubEnv("SAINTAGRAM_APP_MODE", "admin");
    const page = await proxy(hostRequest("preview.example", "/admin/users"));
    const api = await proxy(hostRequest("preview.example", "/api/admin/users"));
    const normalPage = await proxy(hostRequest("preview.example", "/feed"));
    const normalApi = await proxy(hostRequest("preview.example", "/api/fiat/leaderboard"));

    expect(page.headers.get("x-middleware-next")).toBe("1");
    expect(api.headers.get("x-middleware-next")).toBe("1");
    expect(normalPage.status).toBe(404);
    expect(normalApi.status).toBe(404);
  });

  it("allows the simple localhost admin route without the public access code", async () => {
    const page = await proxy(hostRequest("localhost", "/admin"));
    const api = await proxy(hostRequest("localhost", "/api/admin/session"));

    expect(page.headers.get("x-middleware-next")).toBe("1");
    expect(api.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the existing admin route behind the normal Worker's access gate", async () => {
    const response = await proxy(hostRequest("saintagram.axjp.workers.dev", "/admin/users?sort=new"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/access?next=");
  });
});
