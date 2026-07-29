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
import { POST } from "@/app/api/access/route";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_TTL_SECONDS,
  verifyAccessSessionToken
} from "@/lib/access-session";

const ACCESS_CODE = "Invitation-123";
const SESSION_SECRET = "s".repeat(32);

function request(
  body: string,
  headers: Record<string, string> = {
    "Content-Type": "application/json"
  }
): Request {
  return new Request("https://saintagram.example/api/access", {
    method: "POST",
    headers,
    body
  });
}

describe("POST /api/access", () => {
  beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
  });

  beforeEach(() => {
    vi.stubEnv("SITE_ACCESS_CODE", ACCESS_CODE);
    vi.stubEnv("SITE_ACCESS_SESSION_SECRET", SESSION_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when the server-side configuration is missing", async () => {
    vi.stubEnv("SITE_ACCESS_CODE", "");
    vi.stubEnv("SITE_ACCESS_SESSION_SECRET", "");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      request(JSON.stringify({ code: ACCESS_CODE, next: "/profile" }))
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error:
        "Private access is temporarily unavailable. Please contact the site owner."
    });
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it.each([
    ["invalid JSON", "{", {}],
    ["a null body", "null", {}],
    ["an array body", "[]", {}],
    ["a primitive body", "42", {}],
    ["a missing code", JSON.stringify({ next: "/profile" }), {}],
    [
      "an oversized code",
      JSON.stringify({ code: "x".repeat(257), next: "/profile" }),
      {}
    ],
    [
      "an oversized declared request",
      JSON.stringify({ code: ACCESS_CODE, next: "/profile" }),
      { "Content-Type": "application/json", "Content-Length": "1025" }
    ],
    [
      "an oversized body without a declared length",
      JSON.stringify({ code: ACCESS_CODE, padding: "x".repeat(1025) }),
      { "Content-Type": "application/json" }
    ]
  ])("rejects %s without creating a session", async (_label, body, headers) => {
    const response = await POST(request(body, headers));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "That access code was not recognized. Please try again."
    });
  });

  it("uses the same generic denial for an incorrect code", async () => {
    const response = await POST(
      request(JSON.stringify({ code: "Incorrect-123", next: "/profile" }))
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "That access code was not recognized. Please try again."
    });
  });

  it("sets a signed HttpOnly session and returns only a safe destination", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(
      request(
        JSON.stringify({
          code: `  ${ACCESS_CODE}  `,
          next: "/journey?day=1"
        })
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.clone().json()).resolves.toEqual({
      ok: true,
      next: "/journey?day=1"
    });

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${ACCESS_COOKIE_NAME}=`);
    expect(setCookie).toContain(`Max-Age=${ACCESS_SESSION_TTL_SECONDS}`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toMatch(/Priority=High/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toContain(ACCESS_CODE);

    const encodedToken = setCookie
      ?.split(";")[0]
      .slice(`${ACCESS_COOKIE_NAME}=`.length);
    const token = encodedToken ? decodeURIComponent(encodedToken) : undefined;
    await expect(
      verifyAccessSessionToken(token, SESSION_SECRET)
    ).resolves.toBe(true);
  });

  it("does not reflect an external destination after successful verification", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          code: ACCESS_CODE,
          next: "https://example.com/steal-session"
        })
      )
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      next: "/"
    });
  });
});
