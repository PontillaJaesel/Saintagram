import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  getFirebaseAdminAuth: vi.fn(),
  verifyIdToken: vi.fn(),
  getUser: vi.fn(),
  setCustomUserClaims: vi.fn()
}));

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseAdminAuth: mocks.getFirebaseAdminAuth
}));

import { POST } from "@/app/api/image-access/route";

const TOKEN = "header.payload.signature";

function request(
  authorization?: string,
  body?: Record<string, unknown>
): Request {
  const headers = new Headers();
  if (authorization) headers.set("Authorization", authorization);
  if (body) headers.set("Content-Type", "application/json");
  return new Request("https://saintagram.example/api/image-access", {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("POST /api/image-access", () => {
  beforeEach(() => {
    mocks.getFirebaseAdminAuth.mockReturnValue({
      verifyIdToken: mocks.verifyIdToken,
      getUser: mocks.getUser,
      setCustomUserClaims: mocks.setCustomUserClaims
    });
    mocks.verifyIdToken.mockResolvedValue({
      uid: "alice",
      email_verified: true
    });
    mocks.getUser.mockResolvedValue({
      uid: "alice",
      disabled: false,
      emailVerified: true,
      customClaims: { invitation: "accepted" }
    });
    mocks.setCustomUserClaims.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["a missing header", undefined],
    ["a non-Bearer header", TOKEN],
    ["a malformed token", "Bearer not-a-jwt"],
    ["an oversized header", `Bearer ${"a".repeat(16_385)}`]
  ])("rejects %s", async (_label, authorization) => {
    const response = await POST(request(authorization));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("rejects an invalid or revoked Firebase token", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error("revoked"), {
        code: "auth/id-token-revoked"
      })
    );

    const response = await POST(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(401);
    expect(mocks.verifyIdToken).toHaveBeenCalledWith(TOKEN, true);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("reports a server credential failure separately from a bad session", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error("credential unavailable"), {
        code: "app/invalid-credential"
      })
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        "Automatic image access setup is unavailable. Please contact the site owner."
    });
    expect(consoleError).toHaveBeenCalledOnce();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("preserves existing claims and grants access only to the verified UID", async () => {
    const response = await POST(
      request(`Bearer ${TOKEN}`, {
        uid: "bob",
        role: "service_role"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.getUser).toHaveBeenCalledWith("alice");
    expect(mocks.setCustomUserClaims).toHaveBeenCalledWith("alice", {
      invitation: "accepted",
      role: "authenticated"
    });
  });

  it("does not rewrite a claim that is already configured", async () => {
    mocks.getUser.mockResolvedValueOnce({
      uid: "alice",
      disabled: false,
      emailVerified: true,
      customClaims: {
        invitation: "accepted",
        role: "authenticated"
      }
    });

    const response = await POST(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(200);
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("rejects disabled users and reserved conflicting roles", async () => {
    mocks.getUser.mockResolvedValueOnce({
      uid: "alice",
      disabled: true,
      emailVerified: true,
      customClaims: {}
    });
    const disabled = await POST(request(`Bearer ${TOKEN}`));
    expect(disabled.status).toBe(401);
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();

    mocks.getUser.mockResolvedValueOnce({
      uid: "alice",
      disabled: false,
      emailVerified: true,
      customClaims: { role: "admin" }
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const conflicting = await POST(request(`Bearer ${TOKEN}`));
    expect(conflicting.status).toBe(503);
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("rejects users whose email address is not verified", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({
      uid: "alice",
      email_verified: false
    });
    mocks.getUser.mockResolvedValueOnce({
      uid: "alice",
      disabled: false,
      emailVerified: false,
      customClaims: {}
    });

    const response = await POST(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(401);
    expect(mocks.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("allows a Firebase anonymous guest identity", async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({
      uid: "guest",
      firebase: { sign_in_provider: "anonymous" }
    });
    mocks.getUser.mockResolvedValueOnce({
      uid: "guest",
      disabled: false,
      emailVerified: false,
      customClaims: {}
    });

    const response = await POST(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(200);
    expect(mocks.setCustomUserClaims).toHaveBeenCalledWith("guest", {
      role: "authenticated"
    });
  });

  it("fails safely when Firebase Admin is unavailable", async () => {
    mocks.getFirebaseAdminAuth.mockImplementationOnce(() => {
      throw new Error("missing credentials");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request(`Bearer ${TOKEN}`));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error:
        "Automatic image access setup is unavailable. Please contact the site owner."
    });
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("does not expose an Admin claim-write failure", async () => {
    mocks.setCustomUserClaims.mockRejectedValueOnce(
      new Error("private internal detail")
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request(`Bearer ${TOKEN}`));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("private internal detail");
    expect(body).not.toContain(TOKEN);
  });
});
