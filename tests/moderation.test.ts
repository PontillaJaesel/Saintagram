import { afterEach, describe, expect, it, vi } from "vitest";
import {
  moderateTextContent,
  moderateTextForSubmission,
  normalizeModerationText,
  validateModerationImageFile
} from "@/lib/moderation";

describe("moderation policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("uses the server moderation route for final submissions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          allowed: false,
          blocked: true,
          message: "Please remove inappropriate or vulgar language before submitting."
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(moderateTextForSubmission("remote-only blocked phrase")).resolves.toMatchObject({
      allowed: false,
      blocked: true
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/moderation",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back to the local decision when the moderation route is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network unavailable")));

    await expect(moderateTextForSubmission("A peaceful reflection.")).resolves.toMatchObject({
      allowed: true,
      blocked: false,
      source: "local"
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
