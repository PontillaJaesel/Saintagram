import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ACCESS_SESSION_TTL_SECONDS,
  MINIMUM_ACCESS_CODE_LENGTH,
  MINIMUM_SESSION_SECRET_LENGTH,
  constantTimeTextEqual,
  createAccessSessionToken,
  hasValidAccessConfiguration,
  verifyAccessSessionToken
} from "@/lib/access-session";

const SESSION_SECRET = "s".repeat(MINIMUM_SESSION_SECRET_LENGTH);
const OTHER_SESSION_SECRET = "o".repeat(MINIMUM_SESSION_SECRET_LENGTH);
const NOW = 1_800_000_000_000;

describe("access configuration", () => {
  it("accepts values at the documented minimum lengths", () => {
    expect(
      hasValidAccessConfiguration(
        "c".repeat(MINIMUM_ACCESS_CODE_LENGTH),
        SESSION_SECRET
      )
    ).toBe(true);
  });

  it.each([
    [undefined, SESSION_SECRET],
    ["c".repeat(MINIMUM_ACCESS_CODE_LENGTH - 1), SESSION_SECRET],
    ["c".repeat(MINIMUM_ACCESS_CODE_LENGTH), undefined],
    [
      "c".repeat(MINIMUM_ACCESS_CODE_LENGTH),
      "s".repeat(MINIMUM_SESSION_SECRET_LENGTH - 1)
    ]
  ])("rejects missing or undersized configuration", (code, secret) => {
    expect(hasValidAccessConfiguration(code, secret)).toBe(false);
  });
});

describe("constantTimeTextEqual", () => {
  beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("matches only the exact submitted text", async () => {
    await expect(constantTimeTextEqual("Invitation-123", "Invitation-123"))
      .resolves.toBe(true);
    await expect(constantTimeTextEqual("invitation-123", "Invitation-123"))
      .resolves.toBe(false);
    await expect(constantTimeTextEqual("Invitation-1234", "Invitation-123"))
      .resolves.toBe(false);
  });
});

describe("access session tokens", () => {
  beforeAll(() => {
    vi.stubGlobal("crypto", webcrypto);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("creates a token that is valid until its exact expiration boundary", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET, NOW);
    const justBeforeExpiry =
      NOW + ACCESS_SESSION_TTL_SECONDS * 1000 - 1;
    const atExpiry = NOW + ACCESS_SESSION_TTL_SECONDS * 1000;

    await expect(
      verifyAccessSessionToken(token, SESSION_SECRET, NOW)
    ).resolves.toBe(true);
    await expect(
      verifyAccessSessionToken(token, SESSION_SECRET, justBeforeExpiry)
    ).resolves.toBe(true);
    await expect(
      verifyAccessSessionToken(token, SESSION_SECRET, atExpiry)
    ).resolves.toBe(false);
  });

  it("binds the token to the signing secret", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET, NOW);

    await expect(
      verifyAccessSessionToken(token, OTHER_SESSION_SECRET, NOW)
    ).resolves.toBe(false);
  });

  it("rejects a tampered signature or payload", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET, NOW);
    const [payload, signature] = token.split(".");
    const changedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const changedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;

    await expect(
      verifyAccessSessionToken(
        `${payload}.${changedSignature}`,
        SESSION_SECRET,
        NOW
      )
    ).resolves.toBe(false);
    await expect(
      verifyAccessSessionToken(
        `${changedPayload}.${signature}`,
        SESSION_SECRET,
        NOW
      )
    ).resolves.toBe(false);
  });

  it("rejects tokens issued too far in the future", async () => {
    const token = await createAccessSessionToken(SESSION_SECRET, NOW + 61_000);

    await expect(
      verifyAccessSessionToken(token, SESSION_SECRET, NOW)
    ).resolves.toBe(false);
  });

  it.each([
    undefined,
    "",
    "not-a-token",
    "payload.signature.extra",
    "%%%.$$$",
    "a".repeat(1025)
  ])("rejects a malformed token", async (token) => {
    await expect(
      verifyAccessSessionToken(token, SESSION_SECRET, NOW)
    ).resolves.toBe(false);
  });

  it("uses a fresh nonce for sessions created at the same instant", async () => {
    const first = await createAccessSessionToken(SESSION_SECRET, NOW);
    const second = await createAccessSessionToken(SESSION_SECRET, NOW);

    expect(first).not.toBe(second);
  });
});
