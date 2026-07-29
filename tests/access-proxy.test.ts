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
import {
  enforceAccessGate as proxy,
  proxy as bypassedAccessProxy
} from "@/proxy";
import {
  ACCESS_COOKIE_NAME,
  createAccessSessionToken
} from "@/lib/access-session";

const SESSION_SECRET = "s".repeat(32);

function nextRequest(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", `${ACCESS_COOKIE_NAME}=${cookie}`);
  }
  return new NextRequest(`https://saintagram.example${path}`, { headers });
}

describe("access proxy", () => {
  beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
  });

  beforeEach(() => {
    vi.stubEnv("SITE_ACCESS_SESSION_SECRET", SESSION_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("leaves site routes open while access-code security is disabled", async () => {
    const response = await bypassedAccessProxy(nextRequest("/profile"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    "/api/access",
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt"
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
});
