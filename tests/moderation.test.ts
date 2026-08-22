import { afterEach, describe, expect, it, vi } from "vitest";
import {
  localModerationDecision,
  moderateTextContent,
  moderateTextForLiveCheck,
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

  it("blocks expanded Filipino profanity and spaced/leet variants locally", () => {
    expect(localModerationDecision("pakingshet naman")).toMatchObject({
      allowed: false,
      blocked: true
    });
    expect(localModerationDecision("g @ g o")).toMatchObject({
      allowed: false,
      blocked: true
    });
    expect(localModerationDecision("p u t a n g i n a")).toMatchObject({
      allowed: false,
      blocked: true
    });
  });

  it("reports only the locally matched profanity terms and not nearby safe words", () => {
    const decision = localModerationDecision("user fucking idiot");

    expect(decision).toMatchObject({
      allowed: false,
      blocked: true,
      matchedTerms: ["fucking", "idiot"],
      source: "local"
    });
    expect(decision.reason).toContain('"fucking"');
    expect(decision.reason).toContain('"idiot"');
    expect(decision.reason.toLowerCase()).not.toContain('"user"');
  });

  it("uses a singular precise warning when one local profanity term is matched", () => {
    const decision = localModerationDecision("she is a cunt");

    expect(decision.matchedTerms).toEqual(["cunt"]);
    expect(decision.reason).toBe(
      'Inappropriate language detected: "cunt". Please revise this term before submitting.'
    );
  });

  it("does not block context-sensitive Filipino words used normally", () => {
    expect(localModerationDecision("Si Hudas ay binanggit sa pagbasa.")).toMatchObject({
      allowed: true,
      blocked: false
    });
    expect(localModerationDecision("Ang boto ko ay mahalaga.")).toMatchObject({
      allowed: true,
      blocked: false
    });
    expect(localModerationDecision("Sumakay kami ng habal-habal.")).toMatchObject({
      allowed: true,
      blocked: false
    });
  });

  it("uses the moderation API for a live check after local text passes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          allowed: false,
          blocked: true,
          message: "Please remove inappropriate or vulgar language before submitting.",
          source: "profanity-api"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(moderateTextForLiveCheck("remote-only blocked phrase")).resolves.toMatchObject({
      allowed: false,
      blocked: true,
      source: "profanity-api"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/moderation",
      expect.objectContaining({ method: "POST" })
    );
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
