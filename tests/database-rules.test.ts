import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { get, ref, remove, set, update } from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const ALICE_ID = "alice";
const BOB_ID = "bob";
const NOW = "2026-07-29T10:00:00.000Z";
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-saintagram";

function emulatorAddress(): { host: string; port: number } {
  const address = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "127.0.0.1:9000";
  const separator = address.lastIndexOf(":");
  return {
    host: address.slice(0, separator),
    port: Number(address.slice(separator + 1))
  };
}

describe("Saintagram Realtime Database ownership rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const { host, port } = emulatorAddress();
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      database: {
        host,
        port,
        rules: readFileSync(resolve(process.cwd(), "database.rules.json"), "utf8")
      }
    });
  });

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await remove(ref(context.database()));
    });
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  it("allows owners and rejects anonymous or cross-user account access", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).database();
    const bobDb = testEnv.authenticatedContext(BOB_ID).database();
    const anonymousDb = testEnv.unauthenticatedContext().database();
    const account = {
      id: ALICE_ID,
      email: "alice@example.test",
      createdAt: NOW,
      updatedAt: NOW,
      privacyConsentAt: null,
      profileCompleted: false
    };

    await assertSucceeds(set(ref(aliceDb, `users/${ALICE_ID}`), account));
    await assertSucceeds(get(ref(aliceDb, `users/${ALICE_ID}`)));
    await assertFails(get(ref(bobDb, `users/${ALICE_ID}`)));
    await assertFails(get(ref(anonymousDb, `users/${ALICE_ID}`)));
    await assertFails(
      update(ref(bobDb, `users/${ALICE_ID}`), { profileCompleted: true })
    );
  });

  it("keeps profiles owner-only and rejects hidden stories in public data", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).database();
    const bobDb = testEnv.authenticatedContext(BOB_ID).database();
    const profile = {
      id: ALICE_ID,
      userId: ALICE_ID,
      profileName: "Still Growing",
      imageUrl: "",
      selectedSymbol: "seed",
      spiritualBio: "Learning to receive grace.",
      followers: ["Jesus"],
      following: ["God's will"],
      heartSeeks: ["Peace"],
      godsComment: "You are loved.",
      heavenlyHashtag: "#StillGrowing",
      createdAt: NOW,
      updatedAt: NOW
    };

    await assertSucceeds(set(ref(aliceDb, `profiles/${ALICE_ID}`), profile));
    await assertFails(
      set(ref(aliceDb, `profiles/${ALICE_ID}`), {
        ...profile,
        hiddenStory: "private"
      })
    );
    await assertFails(get(ref(bobDb, `profiles/${ALICE_ID}`)));
  });

  it("protects private profiles, drafts, and reflections by UID", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).database();
    const bobDb = testEnv.authenticatedContext(BOB_ID).database();
    const privateProfile = {
      userId: ALICE_ID,
      hiddenStory: "A private story.",
      updatedAt: NOW
    };
    const draft = {
      id: ALICE_ID,
      userId: ALICE_ID,
      currentStep: 3,
      draftData: { profileName: "Still Growing", imageUrl: "" },
      updatedAt: NOW
    };
    const post = {
      id: "post-1",
      userId: ALICE_ID,
      content: "A quiet kindness.",
      isPrivate: true,
      createdAt: NOW,
      updatedAt: NOW
    };

    await assertSucceeds(
      set(ref(aliceDb, `privateProfiles/${ALICE_ID}`), privateProfile)
    );
    await assertSucceeds(set(ref(aliceDb, `drafts/${ALICE_ID}`), draft));
    await assertSucceeds(
      set(ref(aliceDb, `reflectionPosts/${ALICE_ID}/post-1`), post)
    );
    await assertFails(get(ref(bobDb, `privateProfiles/${ALICE_ID}`)));
    await assertFails(get(ref(bobDb, `drafts/${ALICE_ID}`)));
    await assertFails(get(ref(bobDb, `reflectionPosts/${ALICE_ID}`)));
    await assertFails(
      set(ref(bobDb, `reflectionPosts/${ALICE_ID}/post-2`), {
        ...post,
        id: "post-2"
      })
    );
  });
});
