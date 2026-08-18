import { describe, expect, it } from "vitest";
import {
  moderateTextContent,
  normalizeModerationText,
  validateModerationImageFile
} from "@/lib/moderation";

describe("moderation policy", () => {
  it("allows benign text", async () => {
    await expect(moderateTextContent("I am grateful for this quiet moment.")).resolves.toMatchObject({
      allowed: true,
      blocked: false
    });
  });

  it("blocks common profanity and Filipino vulgarity", async () => {
    await expect(moderateTextContent("This is a damn stupid post")).resolves.toMatchObject({
      allowed: false,
      blocked: true
    });
    await expect(moderateTextContent("puta ka talaga")).resolves.toMatchObject({
      allowed: false,
      blocked: true
    });
  });

  it("normalizes capitalization, punctuation, spacing, and leetspeak", async () => {
    const normalized = normalizeModerationText("F-u-c-k!!! y0u");
    expect(normalized).toContain("fuck");
    expect(normalized).toContain("you");

    await expect(moderateTextContent("F-u-c-k!!! y0u")).resolves.toMatchObject({
      allowed: false,
      blocked: true
    });
  });

  it("rejects disallowed image types and oversize uploads", () => {
    expect(validateModerationImageFile(new File(["x"], "test.gif", { type: "image/gif" }))).toBe(
      "This image cannot be uploaded because it violates our community guidelines."
    );
    expect(validateModerationImageFile(new File([new Uint8Array(11 * 1024 * 1024)], "large.png", { type: "image/png" }))).toBe(
      "This image cannot be uploaded because it violates our community guidelines."
    );
    expect(validateModerationImageFile(new File(["x"], "ok.webp", { type: "image/webp" }))).toBeNull();
  });
});
