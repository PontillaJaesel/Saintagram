import { describe, expect, it } from "vitest";
import {
  getProfileCover,
  isProfileCoverId,
  PROFILE_COVERS
} from "@/lib/profile-covers";

describe("profile cover designs", () => {
  it("contains unique local cover definitions", () => {
    expect(PROFILE_COVERS.length).toBeGreaterThan(0);
    expect(new Set(PROFILE_COVERS.map((cover) => cover.id)).size).toBe(
      PROFILE_COVERS.length
    );
    expect(PROFILE_COVERS.every((cover) => cover.src.startsWith("/covers/"))).toBe(
      true
    );
  });

  it("rejects unknown design IDs so callers can fall back to color", () => {
    expect(isProfileCoverId("cover-01")).toBe(true);
    expect(getProfileCover("missing-cover")).toBeUndefined();
    expect(isProfileCoverId("missing-cover")).toBe(false);
  });
});
