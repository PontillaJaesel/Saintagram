import { describe, expect, it } from "vitest";
import {
  normalizeDraft,
  publicReflections,
  toPublicProfile
} from "@/lib/profile";
import { LIMITS } from "@/lib/constants";
import type {
  ProfileDraftData,
  ReflectionPost,
  SpiritualProfile
} from "@/types";

const SECRET = "PRIVATE-SENTINEL: never render or share";

function makeProfile(): SpiritualProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    profileName: "Beloved Child of God",
    coverColor: "#DDD2F6",
    imagePath: "",
    selectedSymbol: "candle",
    spiritualBio: "Still growing in faith.",
    spiritualGuides: ["Mary", "A trusted friend"],
    lifeDirections: ["Jesus"],
    heartSeeks: ["Peace", "Truth"],
    godsComment: "You are loved.",
    heavenlyHashtag: "#SeenByGod",
    hiddenStory: SECRET,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z"
  };
}

function makePost(
  id: string,
  content: string,
  isPrivate: boolean
): ReflectionPost {
  return {
    id,
    userId: "user-1",
    content,
    isPrivate,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("private profile projections", () => {
  it("removes the Hidden Story property from a public profile", () => {
    const source = makeProfile();

    const publicProfile = toPublicProfile(source);

    expect(publicProfile).not.toHaveProperty("hiddenStory");
    expect(JSON.stringify(publicProfile)).not.toContain(SECRET);
    expect(publicProfile).toMatchObject({
      id: source.id,
      userId: source.userId,
      profileName: source.profileName,
      godsComment: source.godsComment
    });
    expect(source.hiddenStory).toBe(SECRET);
  });

  it("filters private reflections without changing public ordering or input", () => {
    const firstPublic = makePost("public-1", "Grace in a quiet moment", false);
    const privatePost = makePost("private-1", SECRET, true);
    const secondPublic = makePost("public-2", "Help from a friend", false);
    const posts = [firstPublic, privatePost, secondPublic];

    const result = publicReflections(posts);

    expect(result).toEqual([firstPublic, secondPublic]);
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(posts).toHaveLength(3);
  });
});

describe("normalizeDraft", () => {
  it("normalizes every user-authored profile field while preserving private data", () => {
    const draft: ProfileDraftData = {
      profileName: `  Beloved\u0000 Child  ${"x".repeat(LIMITS.profileName)}  `,
      imagePath:
        "  users/user-1/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png  ",
      selectedSymbol: "heart",
      spiritualBio: `  Learning\u0000 to trust  `,
      spiritualGuides: [" Mary ", "mary", "", "  Jesus  "],
      lifeDirections: [" God's will ", "GOD'S WILL", "Jesus"],
      onboardingPosts: [
        "  A quiet prayer  ",
        "",
        " \u0000 ",
        ...Array.from({ length: 25 }, (_, index) => `Moment ${index + 1}`)
      ],
      heartSeeks: [" Peace ", "peace", "Healing"],
      hiddenStory: `  ${SECRET}\u0000  `,
      godsComment: "  You are known and loved.  ",
      heavenlyHashtag: " Seen by God! "
    };

    const normalized = normalizeDraft(draft);

    expect(normalized.profileName).not.toContain("\u0000");
    expect(normalized.profileName.length).toBeLessThanOrEqual(
      LIMITS.profileName
    );
    expect(normalized.imagePath).toBe(
      "users/user-1/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png"
    );
    expect(normalized.spiritualBio).toBe("Learning to trust");
    expect(normalized.spiritualGuides).toEqual(["Mary", "Jesus"]);
    expect(normalized.lifeDirections).toEqual(["God's will", "Jesus"]);
    expect(normalized.heartSeeks).toEqual(["Peace", "Healing"]);
    expect(normalized.onboardingPosts).toHaveLength(20);
    expect(normalized.onboardingPosts[0]).toBe("A quiet prayer");
    expect(normalized.hiddenStory).toBe(SECRET);
    expect(normalized.godsComment).toBe("You are known and loved.");
    expect(normalized.heavenlyHashtag).toBe("#SeenbyGod");
  });

  it("does not mutate the draft supplied by the form", () => {
    const draft: ProfileDraftData = {
      profileName: "  Still Growing  ",
      imagePath: "",
      selectedSymbol: "",
      spiritualBio: "",
      spiritualGuides: [" Mary "],
      lifeDirections: [],
      onboardingPosts: [" A reflection "],
      heartSeeks: [],
      hiddenStory: "",
      godsComment: "",
      heavenlyHashtag: "Beloved"
    };
    const snapshot = structuredClone(draft);

    normalizeDraft(draft);

    expect(draft).toEqual(snapshot);
  });
});
