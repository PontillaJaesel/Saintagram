import { describe, expect, it } from "vitest";
import { getSafeAccessDestination } from "@/lib/access-path";

describe("getSafeAccessDestination", () => {
  it.each([
    ["/", "/"],
    ["/profile", "/profile"],
    ["/journey?day=1#reflection", "/journey?day=1#reflection"],
    ["/profile name?tab=private", "/profile%20name?tab=private"]
  ])("keeps the internal destination %s", (candidate, expected) => {
    expect(getSafeAccessDestination(candidate)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    42,
    {},
    "",
    "profile",
    "https://example.com/profile",
    "//example.com/profile",
    "///example.com/profile",
    "/%2e%2e//example.com/profile",
    "/%2E//example.com/profile",
    "/.//example.com/profile",
    "/profile\\example",
    "/profile\nnext",
    `/profile${"\u0000"}next`,
    `/${"a".repeat(2048)}`
  ])("falls back for an unsafe destination %#", (candidate) => {
    expect(getSafeAccessDestination(candidate)).toBe("/");
  });

  it.each([
    "/access",
    "/access?next=/profile",
    "/api/access",
    "/api/access/verify?next=/profile"
  ])("does not redirect back into the access flow: %s", (candidate) => {
    expect(getSafeAccessDestination(candidate)).toBe("/");
  });

  it("uses the caller's fallback when the candidate is invalid", () => {
    expect(getSafeAccessDestination("//example.com", "/profile")).toBe(
      "/profile"
    );
  });
});
