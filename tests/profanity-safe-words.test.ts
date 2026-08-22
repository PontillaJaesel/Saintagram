import { describe, expect, it } from "vitest";
import { COMMON_PROFANITY } from "@/lib/profanity";
import {
  APP_PROFANITY_API_SAFE_TERMS,
  PROFANITY_API_SAFE_TERMS,
  prepareTextForProfanityApi
} from "@/lib/profanity-safe-words";

describe("profanity API safe-word preparation", () => {
  it("masks known benign Saintagram terms before remote moderation", () => {
    const prepared = prepareTextForProfanityApi(
      "The USER updated their username and Saintagram profile after Bible prayer."
    );

    expect(prepared.toLowerCase()).not.toMatch(/\buser\b/);
    expect(prepared.toLowerCase()).not.toMatch(/\busername\b/);
    expect(prepared.toLowerCase()).not.toMatch(/\bsaintagram\b/);
    expect(prepared.toLowerCase()).not.toMatch(/\bprofile\b/);
    expect(prepared.toLowerCase()).not.toMatch(/\bbible\b/);
    expect(prepared.toLowerCase()).not.toMatch(/\bprayer\b/);
  });

  it("keeps profanity outside safe terms visible to the remote API", () => {
    const prepared = prepareTextForProfanityApi(
      "The user posted fucking shit in a comment."
    ).toLowerCase();

    expect(prepared).not.toMatch(/\buser\b/);
    expect(prepared).toContain("fucking");
    expect(prepared).toContain("shit");
  });

  it("uses exact term boundaries rather than unsafe substring replacement", () => {
    const prepared = prepareTextForProfanityApi("enduser USER user's username");

    expect(prepared).toContain("enduser");
    expect(prepared).not.toMatch(/(^|[^a-z0-9])user(?=$|[^a-z0-9])/i);
    expect(prepared).not.toMatch(/\busername\b/i);
  });

  it("never marks a locally blocked profanity term as remotely safe", () => {
    const blockedTerms = new Set(COMMON_PROFANITY.map((term) => term.toLowerCase()));
    const overlaps = PROFANITY_API_SAFE_TERMS.filter((term) =>
      blockedTerms.has(term.toLowerCase())
    );

    expect(overlaps).toEqual([]);
  });

  it("keeps the reported false positive 'user' in the app safe dictionary", () => {
    expect(APP_PROFANITY_API_SAFE_TERMS).toContain("user");
  });
});
