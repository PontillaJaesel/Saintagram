import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/constants";
import {
  cleanText,
  formatFriendlyDate,
  isValidEmail,
  normalizeCoverColor,
  normalizeHashtag,
  normalizeList,
  passwordError,
  validateImage
} from "@/lib/validation";

describe("cleanText", () => {
  it("removes null bytes, trims whitespace, and enforces the limit", () => {
    expect(cleanText("  known\u0000 and loved  ", 10)).toBe("known and ");
  });
});

describe("normalizeList", () => {
  it("trims, removes blank and case-insensitive duplicate values, and caps entries", () => {
    const values = [
      "  Jesus  ",
      "jesus",
      "",
      " \u0000 ",
      ...Array.from({ length: 35 }, (_, index) => `Guide ${index + 1}`)
    ];

    const normalized = normalizeList(values);

    expect(normalized[0]).toBe("Jesus");
    expect(normalized).toHaveLength(30);
    expect(normalized.filter((value) => value.toLowerCase() === "jesus")).toHaveLength(1);
  });

  it("enforces the per-entry character limit", () => {
    expect(normalizeList(["x".repeat(LIMITS.listEntry + 10)]))
      .toEqual(["x".repeat(LIMITS.listEntry)]);
  });
});

describe("normalizeHashtag", () => {
  it.each([
    ["Beloved", "#Beloved"],
    [" Seen by God! ", "#SeenbyGod"],
    ["#Humble_Heart", "#Humble_Heart"],
    ["", ""],
    ["!!!", ""]
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeHashtag(input)).toBe(expected);
  });
});

describe("normalizeCoverColor", () => {
  it.each([
    ["#a1b2c3", "#A1B2C3"],
    [undefined, "#DDD2F6"],
    [null, "#DDD2F6"],
    ["not-a-color", "#DDD2F6"]
  ])("normalizes %j safely", (input, expected) => {
    expect(normalizeCoverColor(input)).toBe(expected);
  });
});

describe("authentication validation", () => {
  it.each([
    ["faith@example.com", true],
    [" faith@example.com ", true],
    ["missing-at.example.com", false],
    ["faith@example", false],
    ["faith @example.com", false]
  ])("validates email %j", (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });

  it("requires at least eight password characters", () => {
    expect(passwordError("Faith1")).toBe("Use at least 8 characters.");
  });

  it("requires both a letter and a number", () => {
    expect(passwordError("onlyletters")).toBe(
      "Include at least one letter and one number."
    );
    expect(passwordError("12345678")).toBe(
      "Include at least one letter and one number."
    );
  });

  it("accepts a password that meets the MVP rules", () => {
    expect(passwordError("Beloved1")).toBeNull();
  });
});

describe("image validation", () => {
  it("accepts JPG, PNG, and WebP files within the size limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const file = new File(["image"], `profile.${type.split("/")[1]}`, {
        type
      });
      expect(validateImage(file)).toBeNull();
    }
  });

  it("rejects unsupported file types", () => {
    const file = new File(["<svg />"], "profile.svg", {
      type: "image/svg+xml"
    });

    expect(validateImage(file)).toBe("Choose a JPG, PNG, or WebP image.");
  });

  it("rejects an image larger than two megabytes", () => {
    const file = new File(
      [new ArrayBuffer(LIMITS.imageBytes + 1)],
      "profile.png",
      { type: "image/png" }
    );

    expect(validateImage(file)).toBe(
      "Choose an image smaller than 2 MB."
    );
  });
});

describe("formatFriendlyDate", () => {
  it("provides a friendly fallback for invalid dates", () => {
    expect(formatFriendlyDate("not-a-date")).toBe("Date unavailable");
  });

  it("formats valid values with and without a time", () => {
    const iso = "2026-07-28T08:30:00.000Z";

    expect(formatFriendlyDate(iso)).toContain("2026");
    expect(formatFriendlyDate(iso, true)).toContain("2026");
    expect(formatFriendlyDate(iso, true)).not.toBe(formatFriendlyDate(iso));
  });
});
