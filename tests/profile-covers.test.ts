import { describe, expect, it } from "vitest";
import {
  getProfileCover,
  getProfileCoverCategory,
  getProfileCoversByCategory,
  isProfileCoverId,
  PROFILE_COVER_CATEGORIES,
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

  it("keeps category IDs unique and includes an All filter", () => {
    expect(PROFILE_COVER_CATEGORIES[0]?.id).toBe("all");
    expect(
      new Set(PROFILE_COVER_CATEGORIES.map((category) => category.id)).size
    ).toBe(PROFILE_COVER_CATEGORIES.length);
  });

  it("assigns every cover to exactly one visible vibe", () => {
    const vibeIds = new Set(
      PROFILE_COVER_CATEGORIES
        .filter((category) => category.id !== "all")
        .map((category) => category.id)
    );

    for (const cover of PROFILE_COVERS) {
      expect(vibeIds.has(getProfileCoverCategory(cover))).toBe(true);
    }
  });

  it("never hides covers when the All filter is selected", () => {
    expect(getProfileCoversByCategory("all")).toEqual(PROFILE_COVERS);
  });

  it("keeps the reviewed starter covers in their intended vibes", () => {
    expect(getProfileCoverCategory(PROFILE_COVERS[0])).toBe("peaceful");
    expect(getProfileCoverCategory(PROFILE_COVERS[3])).toBe("sacred");
    expect(getProfileCoverCategory(PROFILE_COVERS[10])).toBe("moody");
  });
});
