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
import { Timestamp } from "firebase/firestore";
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
const VERIFIED_EMAIL = {
  email_verified: true,
  firebase: { sign_in_provider: "password" }
} as const;

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
  authProvider: "password",
  mustChangePassword: false,
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
  spiritualGuides: ["Jesus", "My family"],
  lifeDirections: ["God's will"],
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
    spiritualGuides: [],
    lifeDirections: [],
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
  title: "A quiet kindness",
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

  it("rejects an authenticated account whose email is not verified", async () => {
    const unverifiedDb = testEnv
      .authenticatedContext(ALICE_ID, { email_verified: false })
      .firestore();

    await assertFails(getDoc(doc(unverifiedDb, "users", ALICE_ID)));
    await assertFails(setDoc(doc(unverifiedDb, "users", ALICE_ID), aliceUser));
  });

  it("rejects an anonymous guest account", async () => {
    const guestDb = testEnv
      .authenticatedContext("guest-user", {
        firebase: { sign_in_provider: "anonymous" }
      })
      .firestore();

    await assertFails(
      setDoc(doc(guestDb, "users", "guest-user"), {
        ...aliceUser,
        id: "guest-user",
        email: "",
        isGuest: true
      })
    );
  });

  it("rejects legacy guest and Google-provider account writes", async () => {
    const guestId = "upgrading-guest";
    const guestDb = testEnv
      .authenticatedContext(guestId, {
        firebase: { sign_in_provider: "anonymous" }
      })
      .firestore();
    await assertFails(
      setDoc(doc(guestDb, "users", guestId), {
        ...aliceUser,
        id: guestId,
        email: "",
        isGuest: true,
        authProvider: "guest"
      })
    );

    const googleEmail = "new-google@example.com";
    const googleDb = testEnv
      .authenticatedContext(guestId, {
        email: googleEmail,
        email_verified: true,
        firebase: { sign_in_provider: "google.com" }
      })
      .firestore();
    await assertFails(
      updateDoc(doc(googleDb, "users", guestId), {
        email: googleEmail,
        isGuest: false,
        authProvider: "google",
        updatedAt: NOW
      })
    );
  });

  it("allows owners and rejects cross-user access to user records", async () => {
    const aliceDb = testEnv
      .authenticatedContext(ALICE_ID, {
        email: aliceUser.email,
        email_verified: true,
        firebase: { sign_in_provider: "password" }
      })
      .firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID, VERIFIED_EMAIL).firestore();
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
    await assertFails(deleteDoc(doc(aliceDb, "users", ALICE_ID)));
    await assertSucceeds(deleteDoc(aliceRef));
  });

  it("allows server-provisioned username and password-change metadata", async () => {
    const aliceDb = testEnv
      .authenticatedContext(ALICE_ID, {
        email: aliceUser.email,
        email_verified: true,
        firebase: { sign_in_provider: "password" }
      })
      .firestore();
    const aliceRef = doc(aliceDb, "users", ALICE_ID);

    await assertSucceeds(
      setDoc(aliceRef, {
        ...aliceUser,
        username: "USR001",
        fullName: "Alice Example",
        role: "user",
        mustChangePassword: true
      })
    );

    await assertSucceeds(
      updateDoc(aliceRef, {
        mustChangePassword: true,
        updatedAt: NOW
      })
    );
  });

  it("allows owners, rejects cross-user access, and forbids hiddenStory on profiles", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID, VERIFIED_EMAIL).firestore();
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

  it("accepts only the owner's exact Firebase Storage image path on profiles", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
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
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID, VERIFIED_EMAIL).firestore();
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

  it("allows only the owner to access profile image history", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID, VERIFIED_EMAIL).firestore();
    const historyRef = doc(aliceDb, "profileImageHistory", "history-1");

    await assertSucceeds(
      setDoc(historyRef, {
        id: "history-1",
        userId: ALICE_ID,
        imagePath: ALICE_IMAGE_PATH,
        createdAt: NOW,
        updatedAt: NOW
      })
    );
    await assertSucceeds(getDoc(historyRef));
    await assertFails(getDoc(doc(bobDb, "profileImageHistory", "history-1")));
    await assertFails(
      setDoc(doc(bobDb, "profileImageHistory", "history-1"), {
        id: "history-1",
        userId: ALICE_ID,
        imagePath: ALICE_IMAGE_PATH,
        createdAt: NOW,
        updatedAt: NOW
      })
    );
    await assertFails(
      updateDoc(historyRef, {
        imagePath: BOB_IMAGE_PATH,
        updatedAt: NOW
      })
    );
    await assertSucceeds(deleteDoc(historyRef));
  });

  it("allows only the owner to access a profile draft", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID, VERIFIED_EMAIL).firestore();
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

  it("accepts only the owner's exact Firebase Storage image path in drafts", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
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

  it("protects server-created system notifications", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "systemNotifications", "reminder-1"), {
        id: "reminder-1", userId: ALICE_ID, type: "profile_reminder",
        title: "Complete your Saintagram profile", message: "A reminder.",
        missingFields: ["Bio"], createdByAdminId: "admin",
        createdAt: Timestamp.fromDate(new Date(NOW)), readAt: null
      });
    });
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID, VERIFIED_EMAIL).firestore();
    const ref = doc(aliceDb, "systemNotifications", "reminder-1");
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(bobDb, "systemNotifications", "reminder-1")));
    await assertFails(setDoc(doc(aliceDb, "systemNotifications", "fake"), { userId: ALICE_ID }));
    await assertSucceeds(updateDoc(ref, { readAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { title: "Changed", readAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
  });

  it("allows only the owner to access a reflection post", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_ID, VERIFIED_EMAIL).firestore();
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
    await assertSucceeds(
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
    await assertSucceeds(
      updateDoc(aliceRef, {
        createdAt: "2026-06-15T12:00:00.000Z",
        updatedAt: NOW
      })
    );
    await assertFails(
      deleteDoc(doc(bobDb, "reflectionPosts", aliceReflection.id))
    );
    await assertSucceeds(deleteDoc(aliceRef));
  });

  it("accepts only canonical optional FiAt fields on reflections", async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_ID, VERIFIED_EMAIL).firestore();
    const validRef = doc(aliceDb, "reflectionPosts", "fiat-valid");
    await assertSucceeds(setDoc(validRef, { ...aliceReflection, id: "fiat-valid", fiatCategory: "prayer", fiatDateKey: "2026-07-28" }));
    await assertFails(setDoc(doc(aliceDb, "reflectionPosts", "fiat-invalid"), { ...aliceReflection, id: "fiat-invalid", fiatCategory: "points", fiatDateKey: "2026-07-28" }));
    await assertFails(setDoc(doc(aliceDb, "reflectionPosts", "fiat-missing-date"), { ...aliceReflection, id: "fiat-missing-date", fiatCategory: "service" }));
    await assertSucceeds(setDoc(doc(aliceDb, "reflectionPosts", "fiat-other"), { ...aliceReflection, id: "fiat-other", fiatCategory: "other", fiatDateKey: "2026-07-28", fiatOther: "Listened patiently" }));
    for (const category of ["forgiveness", "act-of-love", "responsible-choice"]) {
      await assertSucceeds(setDoc(doc(aliceDb, "reflectionPosts", `fiat-${category}`), { ...aliceReflection, id: `fiat-${category}`, fiatCategory: category, fiatDateKey: "2026-07-28" }));
    }
    await assertFails(setDoc(doc(aliceDb, "reflectionPosts", "fiat-obsolete-kindness"), { ...aliceReflection, id: "fiat-obsolete-kindness", fiatCategory: "kindness", fiatDateKey: "2026-07-28" }));
    await assertFails(setDoc(doc(aliceDb, "reflectionPosts", "fiat-other-empty"), { ...aliceReflection, id: "fiat-other-empty", fiatCategory: "other", fiatDateKey: "2026-07-28", fiatOther: "" }));
    await assertFails(setDoc(doc(aliceDb, "reflectionPosts", "fiat-other-long"), { ...aliceReflection, id: "fiat-other-long", fiatCategory: "other", fiatDateKey: "2026-07-28", fiatOther: "x".repeat(26) }));
    await assertFails(setDoc(doc(aliceDb, "reflectionPosts", "fiat-extra-other"), { ...aliceReflection, id: "fiat-extra-other", fiatCategory: "service", fiatDateKey: "2026-07-28", fiatOther: "Not allowed" }));
  });
});
