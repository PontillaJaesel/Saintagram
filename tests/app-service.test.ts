import { beforeEach, describe, expect, it } from "vitest";
import { appService } from "@/lib/app-service";
import type { ProfileDraftData } from "@/types";

const draft: ProfileDraftData = {
  profileName: "Beloved Test User",
  imagePath: "",
  selectedSymbol: "cross",
  spiritualBio: "is learning to trust.",
  followers: ["Mary"],
  following: ["Jesus"],
  onboardingPosts: ["I tried again quietly."],
  heartSeeks: ["Peace"],
  hiddenStory: "PRIVATE-SENTINEL-STORY",
  godsComment: "You are loved.",
  heavenlyHashtag: "#Beloved"
};

describe("local profile persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves a completed profile, clears its draft, and keeps Hidden Story out of the standard projection", async () => {
    const user = await appService.register(
      "profile-save@example.test",
      "Faithful123"
    );
    await appService.saveDraft(user.id, 10, draft);

    await appService.completeProfile(user.id, draft);

    const [savedUser, publicProfile, hiddenStory, unfinishedDraft, posts] =
      await Promise.all([
        appService.refreshUser(user.id),
        appService.getProfileView(user.id),
        appService.getPrivateStory(user.id),
        appService.getDraft(user.id),
        appService.getPublicReflections(user.id)
      ]);

    expect(savedUser.profileCompleted).toBe(true);
    expect(publicProfile?.profileName).toBe("Beloved Test User");
    expect(publicProfile).not.toHaveProperty("hiddenStory");
    expect(JSON.stringify(publicProfile)).not.toContain(
      "PRIVATE-SENTINEL-STORY"
    );
    expect(hiddenStory).toBe("PRIVATE-SENTINEL-STORY");
    expect(unfinishedDraft).toBeNull();
    expect(posts[0]?.content).toBe("I tried again quietly.");
  });

  it("prevents one local session from reading another user's data", async () => {
    const owner = await appService.register(
      "owner@example.test",
      "Faithful123"
    );
    await appService.completeProfile(owner.id, draft);
    await appService.logout();
    await appService.register("other@example.test", "Faithful123");

    await expect(appService.getProfileView(owner.id)).rejects.toThrow(
      /only access your own/i
    );
  });

  it("removes an unfinished account, its email, and its saved draft", async () => {
    const email = "cancel-signup@example.test";
    const user = await appService.register(email, "Faithful123");
    await appService.saveDraft(user.id, 4, draft);

    await appService.cancelAccountCreation(user.id);

    await expect(appService.login(email, "Faithful123")).rejects.toThrow(
      /email and password do not match/i
    );
  });

  it("returns a neutral password-reset result for an unknown email", async () => {
    await expect(
      appService.requestPasswordReset("unknown@example.test")
    ).resolves.toBeUndefined();
  });

  it("publishes an initial owner-only reflection snapshot", async () => {
    const user = await appService.register(
      "listener@example.test",
      "Faithful123"
    );
    await appService.saveReflection(user.id, {
      content: "A synchronized reflection.",
      isPrivate: false
    });

    const posts = await new Promise<Awaited<
      ReturnType<typeof appService.getReflections>
    >>((resolve, reject) => {
      let unsubscribe: () => void = () => undefined;
      unsubscribe = appService.subscribeReflections(
        user.id,
        "public",
        (nextPosts) => {
          unsubscribe();
          resolve(nextPosts);
        },
        reject
      );
    });

    expect(posts).toHaveLength(1);
    expect(posts[0].content).toBe("A synchronized reflection.");
  });
});
