import { beforeEach, describe, expect, it } from "vitest";
import { appService } from "@/lib/app-service";
import type { ProfileDraftData } from "@/types";

const draft: ProfileDraftData = {
  profileName: "Beloved Test User",
  imagePath: "",
  selectedSymbol: "cross",
  spiritualBio: "is learning to trust.",
  spiritualGuides: ["Mary"],
  lifeDirections: ["Jesus"],
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

  it("keeps authentication in durable local storage across browser restarts", async () => {
    const user = await appService.register(
      "session-only@example.test",
      "Faithful123"
    );

    expect(localStorage.getItem("saintagram:v1:session")).toBe(user.id);

    await appService.logout();
    expect(localStorage.getItem("saintagram:v1:session")).toBeNull();
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
      /username and password do not match/i
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

  it("saves and updates a reflection's chosen date", async () => {
    const user = await appService.register(
      "reflection-date@example.test",
      "Faithful123"
    );
    const originalDate = "2026-05-10T12:00:00.000Z";
    const changedDate = "2026-04-02T12:00:00.000Z";
    const created = await appService.saveReflection(user.id, {
      content: "A remembered moment.",
      isPrivate: false,
      createdAt: originalDate
    });

    expect(created.createdAt).toBe(originalDate);
    expect(created.editedAt).toBeUndefined();

    const updated = await appService.saveReflection(user.id, {
      id: created.id,
      content: created.content,
      isPrivate: created.isPrivate,
      createdAt: changedDate
    });

    expect(updated.createdAt).toBe(changedDate);
    expect(updated.editedAt).toBeDefined();
    await expect(appService.getReflections(user.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, createdAt: changedDate })
      ])
    );
  });

  it("saves, changes, and removes an optional FiAt category", async () => {
    const user = await appService.register("fiat@example.test", "Faithful123");
    const normal = await appService.saveReflection(user.id, { content: "A normal reflection.", isPrivate: false });
    expect(normal.fiatCategory).toBeUndefined();
    const fiat = await appService.saveReflection(user.id, { id: normal.id, content: normal.content, isPrivate: false, createdAt: "2026-08-11T12:00:00.000Z", fiatCategory: "prayer" });
    expect(fiat).toMatchObject({ fiatCategory: "prayer", fiatDateKey: "2026-08-11" });
    const changed = await appService.saveReflection(user.id, { id: fiat.id, content: fiat.content, isPrivate: false, createdAt: fiat.createdAt, fiatCategory: "service" });
    expect(changed.fiatCategory).toBe("service");
    const other = await appService.saveReflection(user.id, { id: changed.id, content: changed.content, isPrivate: false, createdAt: changed.createdAt, fiatCategory: "other", fiatOther: "Listening patiently" });
    expect(other).toMatchObject({ fiatCategory: "other", fiatOther: "Listening patiently" });
    await expect(appService.saveReflection(user.id, { id: other.id, content: other.content, isPrivate: false, fiatCategory: "other", fiatOther: "  " })).rejects.toThrow(/describe your other FiAt/i);
    const removed = await appService.saveReflection(user.id, { id: other.id, content: other.content, isPrivate: false, createdAt: other.createdAt });
    expect(removed.fiatCategory).toBeUndefined();
    await expect(appService.saveReflection(user.id, { content: "Invalid", isPrivate: false, fiatCategory: "points" })).rejects.toThrow(/valid FiAt category/i);
  });
});
