import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const ALICE_ID = "alice";
const BOB_ID = "bob";
const NOW = "2026-07-28T10:00:00.000Z";
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-no-project";
const ALICE_IMAGE_PATH =
  "users/alice/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png";
const BOB_IMAGE_PATH =
  "users/bob/profile/14fefae1-e03e-42ee-9cd4-dc86823426e8.png";
const LEGACY_IMAGE_FIELD = ["image", "Url"].join("");

function emulatorAddress(): { host: string; port: number } {
  const address = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const separator = address.lastIndexOf(":");
  return {
    host: address.slice(0, separator),
    port: Number(address.slice(separator + 1))
  };
}

const aliceUser = {
  id: ALICE_ID,
  email: "alice@example.test",
  createdAt: NOW,
  updatedAt: NOW,
  privacyConsentAt: NOW,
  spiritualIntroSeenAt: NOW,
  profileCompleted: false,
  privacyPreferences: {
    requirePrivateCheck: true,
    showReflectionDates: true
  }
};

const aliceProfile = {
  id: ALICE_ID,
  userId: ALICE_ID,
  profileName: "Still Growing",
  imagePath: "",
  selectedSymbol: "seed",
  spiritualBio: "Before God, I am learning to receive grace.",
  followers: ["Jesus", "My family"],
  following: ["God's will"],
  heartSeeks: ["Peace", "Truth"],
  godsComment: "You are known and loved.",
  heavenlyHashtag: "#StillGrowing",
  createdAt: NOW,
  updatedAt: NOW
};

const alicePrivateProfile = {
  userId: ALICE_ID,
  hiddenStory: "A private story entrusted to God.",
  updatedAt: NOW
};

const aliceDraft = {
  id: ALICE_ID,
  userId: ALICE_ID,
  currentStep: 5,
  draftData: {
    profileName: "Still Growing",
    imagePath: "",
    selectedSymbol: "seed",
    spiritualBio: "",
    followers: [],
    following: [],
    onboardingPosts: [""],
    heartSeeks: [],
    hiddenStory: "",
    godsComment: "",
    heavenlyHashtag: ""
  },
  updatedAt: NOW
};

const aliceReflection = {
  id: "alice-reflection",
  userId: ALICE_ID,
  content: "I noticed a quiet kindness today.",
  isPrivate: false,
  createdAt: NOW,
  updatedAt: NOW
};

describe("Saintagram Firestore ownership rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const { host, port } = emulatorAddress();
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules: readFileSync(
          new URL("../firestore.rules", import.meta.url),
          "utf8"
        )
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows owners and rejects cross-user access to user records", async () => {
    const aliceDb = testEnv
      .authenticatedContext(ALICE_ID, { email: aliceUser.email })
      .firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID).firestore();
    const aliceRef = doc(aliceDb, "users", ALICE_ID);

    await assertSucceeds(setDoc(aliceRef, aliceUser));
    await assertSucceeds(getDoc(aliceRef));
    await assertFails(getDoc(doc(bobDb, "users", ALICE_ID)));
    await assertFails(
      updateDoc(doc(bobDb, "users", ALICE_ID), {
        profileCompleted: true,
        updatedAt: NOW
      })
    );
    await assertSucceeds(
      updateDoc(aliceRef, {
        profileCompleted: true,
        updatedAt: NOW
      })
    );
    await assertFails(deleteDoc(doc(bobDb, "users", ALICE_ID)));
    await assertSucceeds(deleteDoc(aliceRef));
  });

  it("allows owners, rejects cross-user access, and forbids hiddenStory on profiles", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID).firestore();
    const aliceRef = doc(aliceDb, "profiles", ALICE_ID);

    await assertFails(
      setDoc(aliceRef, {
        ...aliceProfile,
        hiddenStory: "This must never enter the normal profile document."
      })
    );
    await assertSucceeds(setDoc(aliceRef, aliceProfile));
    await assertSucceeds(getDoc(aliceRef));
    await assertFails(getDoc(doc(bobDb, "profiles", ALICE_ID)));
    await assertFails(
      setDoc(doc(bobDb, "profiles", ALICE_ID), {
        ...aliceProfile,
        profileName: "Changed by Bob"
      })
    );
    await assertFails(deleteDoc(doc(bobDb, "profiles", ALICE_ID)));
    await assertSucceeds(deleteDoc(aliceRef));
  });

  it("accepts only the owner's exact Supabase image path on profiles", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).firestore();
    const aliceRef = doc(aliceDb, "profiles", ALICE_ID);

    await assertSucceeds(
      setDoc(aliceRef, {
        ...aliceProfile,
        imagePath: ALICE_IMAGE_PATH,
        selectedSymbol: ""
      })
    );
    await assertFails(updateDoc(aliceRef, { imagePath: BOB_IMAGE_PATH }));
    await assertFails(
      updateDoc(aliceRef, {
        imagePath: "https://example.test/public-avatar.png"
      })
    );
    await assertFails(
      updateDoc(aliceRef, {
        imagePath: "data:image/png;base64,aGVsbG8="
      })
    );
    await assertFails(
      updateDoc(aliceRef, {
        imagePath: "users/alice/profile/not-a-uuid.png"
      })
    );
    await assertFails(updateDoc(aliceRef, { selectedSymbol: "seed" }));
    await assertFails(
      updateDoc(aliceRef, {
        [LEGACY_IMAGE_FIELD]: "https://legacy.example.test/avatar.png"
      })
    );
  });

  it("allows only the owner to access the private profile", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID).firestore();
    const aliceRef = doc(aliceDb, "privateProfiles", ALICE_ID);

    await assertSucceeds(setDoc(aliceRef, alicePrivateProfile));
    await assertSucceeds(getDoc(aliceRef));
    await assertFails(getDoc(doc(bobDb, "privateProfiles", ALICE_ID)));
    await assertFails(
      updateDoc(doc(bobDb, "privateProfiles", ALICE_ID), {
        hiddenStory: "Cross-user overwrite",
        updatedAt: NOW
      })
    );
    await assertSucceeds(
      updateDoc(aliceRef, {
        hiddenStory: "An updated private story.",
        updatedAt: NOW
      })
    );
    await assertFails(
      deleteDoc(doc(bobDb, "privateProfiles", ALICE_ID))
    );
    await assertSucceeds(deleteDoc(aliceRef));
  });

  it("allows only the owner to access a profile draft", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID).firestore();
    const aliceRef = doc(aliceDb, "drafts", ALICE_ID);

    await assertSucceeds(setDoc(aliceRef, aliceDraft));
    await assertSucceeds(getDoc(aliceRef));
    await assertFails(getDoc(doc(bobDb, "drafts", ALICE_ID)));
    await assertFails(
      setDoc(doc(bobDb, "drafts", ALICE_ID), {
        ...aliceDraft,
        currentStep: 9
      })
    );
    await assertSucceeds(
      updateDoc(aliceRef, {
        currentStep: 6,
        updatedAt: NOW
      })
    );
    await assertFails(deleteDoc(doc(bobDb, "drafts", ALICE_ID)));
    await assertSucceeds(deleteDoc(aliceRef));
  });

  it("accepts only the owner's exact Supabase image path in drafts", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).firestore();
    const aliceRef = doc(aliceDb, "drafts", ALICE_ID);

    await assertSucceeds(
      setDoc(aliceRef, {
        ...aliceDraft,
        draftData: {
          ...aliceDraft.draftData,
          imagePath: ALICE_IMAGE_PATH,
          selectedSymbol: ""
        }
      })
    );
    await assertFails(
      updateDoc(aliceRef, { "draftData.imagePath": BOB_IMAGE_PATH })
    );
    await assertFails(
      updateDoc(aliceRef, {
        "draftData.imagePath": "users/alice/profile/not-a-uuid.webp"
      })
    );
    await assertFails(
      updateDoc(aliceRef, {
        [`draftData.${LEGACY_IMAGE_FIELD}`]:
          "https://legacy.example.test/avatar.png"
      })
    );
  });

  it("allows only the owner to access a reflection post", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID).firestore();
    const aliceRef = doc(
      aliceDb,
      "reflectionPosts",
      aliceReflection.id
    );

    await assertSucceeds(setDoc(aliceRef, aliceReflection));
    await assertSucceeds(getDoc(aliceRef));
    await assertSucceeds(
      getDocs(
        query(
          collection(aliceDb, "reflectionPosts"),
          where("userId", "==", ALICE_ID)
        )
      )
    );
    await assertFails(
      getDoc(doc(bobDb, "reflectionPosts", aliceReflection.id))
    );
    await assertFails(
      getDocs(
        query(
          collection(bobDb, "reflectionPosts"),
          where("userId", "==", ALICE_ID)
        )
      )
    );
    await assertFails(
      updateDoc(doc(bobDb, "reflectionPosts", aliceReflection.id), {
        content: "Cross-user overwrite",
        updatedAt: NOW
      })
    );
    await assertSucceeds(
      updateDoc(aliceRef, {
        content: "I noticed another quiet kindness today.",
        updatedAt: NOW
      })
    );
    await assertFails(
      deleteDoc(doc(bobDb, "reflectionPosts", aliceReflection.id))
    );
    await assertSucceeds(deleteDoc(aliceRef));
  });
});
