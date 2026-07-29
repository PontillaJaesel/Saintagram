import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Unsubscribe
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { DEMO_EMAIL, DEMO_PASSWORD, LIMITS } from "@/lib/constants";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  deleteAllSupabaseProfileImages,
  deleteSupabaseProfileImage,
  isOwnedProfileImagePath,
  uploadSupabaseProfileImage
} from "@/lib/profile-images";
import {
  normalizeDraft,
  normalizeProfileImageReference,
  toPublicProfile
} from "@/lib/profile";
import {
  cleanText,
  normalizeHashtag,
  normalizeList
} from "@/lib/validation";
import {
  DEFAULT_PRIVACY_PREFERENCES,
  EMPTY_DRAFT,
  type AppUser,
  type PersonalDataExport,
  type ProfileDraft,
  type ProfileDraftData,
  type PublicSpiritualProfile,
  type ReflectionPost,
  type SpiritualProfile,
  type SpiritualSymbol
} from "@/types";

const STORAGE_PREFIX = "saintagram:v1";
const LOCAL_KEYS = {
  accounts: `${STORAGE_PREFIX}:accounts`,
  session: `${STORAGE_PREFIX}:session`,
  profiles: `${STORAGE_PREFIX}:profiles`,
  privateProfiles: `${STORAGE_PREFIX}:privateProfiles`,
  drafts: `${STORAGE_PREFIX}:drafts`,
  reflections: `${STORAGE_PREFIX}:reflectionPosts`
} as const;

interface LocalAccount {
  user: AppUser;
  passwordHash: string;
}

interface PrivateProfileRecord {
  userId: string;
  hiddenStory: string;
  updatedAt: string;
}

type JsonMap<T> = Record<string, T>;

function storageAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(prefix = ""): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}${id}`;
}

async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(`saintagram-demo:${password}`);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return `demo-${password.length}-${password
    .split("")
    .reduce((sum, character) => sum + character.charCodeAt(0), 0)}`;
}

function localAccounts(): LocalAccount[] {
  return readJson<LocalAccount[]>(LOCAL_KEYS.accounts, []);
}

function saveLocalAccounts(accounts: LocalAccount[]): void {
  writeJson(LOCAL_KEYS.accounts, accounts);
}

function currentLocalUid(): string | null {
  return readJson<string | null>(LOCAL_KEYS.session, null);
}

function assertLocalOwner(userId: string): void {
  if (currentLocalUid() !== userId) {
    throw new Error("You can only access your own Saintagram data.");
  }
}

function assertFirebaseOwner(userId: string): void {
  const services = getFirebaseServices();
  if (!services?.auth.currentUser || services.auth.currentUser.uid !== userId) {
    throw new Error("You can only access your own Saintagram data.");
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function firebaseDraftCacheKey(userId: string): string {
  return `${STORAGE_PREFIX}:firebaseDraftCache:${userId}`;
}

function createUserRecord(id: string, email: string): AppUser {
  const now = nowIso();
  return {
    id,
    email: email.trim().toLocaleLowerCase(),
    createdAt: now,
    updatedAt: now,
    privacyConsentAt: null,
    spiritualIntroSeenAt: null,
    profileCompleted: false,
    privacyPreferences: DEFAULT_PRIVACY_PREFERENCES
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function storedPublicProfile(
  value: unknown,
  expectedUserId?: string
): PublicSpiritualProfile {
  const data =
    typeof value === "object" && value
      ? (value as Record<string, unknown>)
      : {};
  const storedImagePath = stringValue(data.imagePath);
  return {
    id: stringValue(data.id),
    userId: stringValue(data.userId),
    profileName: stringValue(data.profileName),
    imagePath:
      expectedUserId &&
      storedImagePath &&
      !isOwnedProfileImagePath(storedImagePath, expectedUserId)
        ? ""
        : storedImagePath,
    selectedSymbol: stringValue(data.selectedSymbol) as SpiritualSymbol,
    spiritualBio: stringValue(data.spiritualBio),
    followers: stringList(data.followers),
    following: stringList(data.following),
    heartSeeks: stringList(data.heartSeeks),
    godsComment: stringValue(data.godsComment),
    heavenlyHashtag: stringValue(data.heavenlyHashtag),
    createdAt: stringValue(data.createdAt),
    updatedAt: stringValue(data.updatedAt)
  };
}

function storedProfileDraft(
  value: unknown,
  expectedUserId?: string
): ProfileDraft | null {
  if (typeof value !== "object" || !value) return null;
  const data = value as Record<string, unknown>;
  const rawDraft =
    typeof data.draftData === "object" && data.draftData
      ? (data.draftData as Record<string, unknown>)
      : {};
  const storedImagePath = stringValue(rawDraft.imagePath);
  const draftData: ProfileDraftData = {
    ...EMPTY_DRAFT,
    profileName: stringValue(rawDraft.profileName),
    imagePath:
      expectedUserId &&
      storedImagePath &&
      !isOwnedProfileImagePath(storedImagePath, expectedUserId)
        ? ""
        : storedImagePath,
    selectedSymbol: stringValue(rawDraft.selectedSymbol) as SpiritualSymbol,
    spiritualBio: stringValue(rawDraft.spiritualBio),
    followers: stringList(rawDraft.followers),
    following: stringList(rawDraft.following),
    onboardingPosts: stringList(rawDraft.onboardingPosts),
    heartSeeks: stringList(rawDraft.heartSeeks),
    hiddenStory: stringValue(rawDraft.hiddenStory),
    godsComment: stringValue(rawDraft.godsComment),
    heavenlyHashtag: stringValue(rawDraft.heavenlyHashtag)
  };
  return {
    id: stringValue(data.id),
    userId: stringValue(data.userId),
    currentStep:
      typeof data.currentStep === "number" ? data.currentStep : 0,
    draftData,
    updatedAt: stringValue(data.updatedAt)
  };
}

function assertStoredProfileImagePath(userId: string, imagePath: string): void {
  if (imagePath && !isOwnedProfileImagePath(imagePath, userId)) {
    throw new Error("The selected image path is not valid for this account.");
  }
}

async function cleanupReplacedProfileImage(
  userId: string,
  previousPath: string,
  nextPath: string
): Promise<void> {
  if (!previousPath || previousPath === nextPath) return;
  try {
    await deleteSupabaseProfileImage(userId, previousPath);
  } catch {
    // The profile write is already durable. Account deletion scans the entire
    // owner folder, so a failed best-effort replacement cleanup remains
    // recoverable without rolling the profile back to a stale image.
  }
}

async function ensureLocalSeed(): Promise<void> {
  if (!storageAvailable() || localAccounts().length > 0) return;

  const userId = "demo-grace";
  const createdAt = "2026-01-06T08:00:00.000Z";
  const updatedAt = "2026-07-24T18:30:00.000Z";
  const user: AppUser = {
    id: userId,
    email: DEMO_EMAIL,
    createdAt,
    updatedAt,
    privacyConsentAt: createdAt,
    spiritualIntroSeenAt: createdAt,
    profileCompleted: true,
    privacyPreferences: DEFAULT_PRIVACY_PREFERENCES
  };
  saveLocalAccounts([
    {
      user,
      passwordHash: await hashPassword(DEMO_PASSWORD)
    }
  ]);

  const profile: PublicSpiritualProfile = {
    id: userId,
    userId,
    profileName: "Still Growing",
    imagePath: "",
    selectedSymbol: "seed",
    spiritualBio:
      "Before God, I am someone who is learning to receive grace, begin again, and notice quiet gifts.",
    followers: ["My parents", "St. Thérèse", "A trusted friend", "Jesus"],
    following: ["Jesus", "God’s will", "Friends"],
    heartSeeks: ["Peace", "Belonging", "God’s love", "Truth"],
    godsComment:
      "You do not need to become perfect before you let Me love you.",
    heavenlyHashtag: "#StillGrowing",
    createdAt,
    updatedAt
  };
  writeJson<JsonMap<PublicSpiritualProfile>>(LOCAL_KEYS.profiles, {
    [userId]: profile
  });
  writeJson<JsonMap<PrivateProfileRecord>>(LOCAL_KEYS.privateProfiles, {
    [userId]: {
      userId,
      hiddenStory:
        "I sometimes hide how uncertain I feel. I am practicing bringing that uncertainty to prayer.",
      updatedAt
    }
  });
  const posts: ReflectionPost[] = [
    {
      id: "demo-post-1",
      userId,
      content:
        "I checked in on a friend even though I did not know the perfect thing to say.",
      isPrivate: false,
      createdAt: "2026-07-24T18:30:00.000Z",
      updatedAt: "2026-07-24T18:30:00.000Z"
    },
    {
      id: "demo-post-2",
      userId,
      content:
        "I stayed quiet for a few minutes after prayer and let myself be known without explaining everything.",
      isPrivate: false,
      createdAt: "2026-07-21T07:15:00.000Z",
      updatedAt: "2026-07-21T07:15:00.000Z"
    },
    {
      id: "demo-private-post",
      userId,
      content:
        "A private journal note held only in the confirmed private space.",
      isPrivate: true,
      createdAt: "2026-07-20T20:00:00.000Z",
      updatedAt: "2026-07-20T20:00:00.000Z"
    }
  ];
  writeJson<JsonMap<ReflectionPost>>(LOCAL_KEYS.reflections, Object.fromEntries(
    posts.map((post) => [post.id, post])
  ));
}

function friendlyAuthError(error: unknown): Error {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use":
      "An account already uses that email. Try logging in instead.",
    "auth/invalid-credential":
      "That email and password do not match. Please try again.",
    "auth/user-not-found":
      "We could not find an account with that email.",
    "auth/wrong-password":
      "That email and password do not match. Please try again.",
    "auth/too-many-requests":
      "There have been several attempts. Take a short pause, then try again.",
    "auth/network-request-failed":
      "We could not connect. Check your internet connection and try again.",
    "auth/requires-recent-login":
      "For your safety, please log out and log in again before making this change.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters."
  };
  if (messages[code]) return new Error(messages[code]);
  if (error instanceof Error) return error;
  return new Error("Something went wrong. Please try again.");
}

async function getFirebaseUserRecord(userId: string, email = ""): Promise<AppUser> {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase is not available.");
  const userRef = doc(services.db, "users", userId);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) return snapshot.data() as AppUser;
  const user = createUserRecord(userId, email);
  await setDoc(userRef, user);
  return user;
}

export const appService = {
  mode: isFirebaseConfigured ? ("firebase" as const) : ("local" as const),

  async initializeLocalDemo(): Promise<void> {
    if (!isFirebaseConfigured) await ensureLocalSeed();
  },

  subscribeAuth(
    callback: (user: AppUser | null) => void
  ): Unsubscribe {
    if (isFirebaseConfigured) {
      const services = getFirebaseServices();
      if (!services) {
        callback(null);
        return () => undefined;
      }
      return onAuthStateChanged(services.auth, async (firebaseUser) => {
        if (!firebaseUser) {
          callback(null);
          return;
        }
        try {
          callback(
            await getFirebaseUserRecord(
              firebaseUser.uid,
              firebaseUser.email ?? ""
            )
          );
        } catch {
          callback(null);
        }
      });
    }

    let active = true;
    void ensureLocalSeed().then(() => {
      if (!active) return;
      const uid = currentLocalUid();
      const account = localAccounts().find((item) => item.user.id === uid);
      callback(account?.user ?? null);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCAL_KEYS.session && event.key !== LOCAL_KEYS.accounts) {
        return;
      }
      const uid = currentLocalUid();
      const account = localAccounts().find((item) => item.user.id === uid);
      callback(account?.user ?? null);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  },

  async register(email: string, password: string): Promise<AppUser> {
    try {
      if (isFirebaseConfigured) {
        const services = getFirebaseServices();
        if (!services) throw new Error("Firebase is not available.");
        const credential = await createUserWithEmailAndPassword(
          services.auth,
          email.trim(),
          password
        );
        const user = createUserRecord(credential.user.uid, email);
        await setDoc(doc(services.db, "users", user.id), user);
        return user;
      }

      await ensureLocalSeed();
      const normalizedEmail = email.trim().toLocaleLowerCase();
      const accounts = localAccounts();
      if (accounts.some((account) => account.user.email === normalizedEmail)) {
        throw Object.assign(new Error(), { code: "auth/email-already-in-use" });
      }
      const user = createUserRecord(newId("local-"), normalizedEmail);
      accounts.push({ user, passwordHash: await hashPassword(password) });
      saveLocalAccounts(accounts);
      writeJson(LOCAL_KEYS.session, user.id);
      return user;
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async login(email: string, password: string): Promise<AppUser> {
    try {
      if (isFirebaseConfigured) {
        const services = getFirebaseServices();
        if (!services) throw new Error("Firebase is not available.");
        const credential = await signInWithEmailAndPassword(
          services.auth,
          email.trim(),
          password
        );
        return getFirebaseUserRecord(
          credential.user.uid,
          credential.user.email ?? email
        );
      }

      await ensureLocalSeed();
      const normalizedEmail = email.trim().toLocaleLowerCase();
      const hash = await hashPassword(password);
      const account = localAccounts().find(
        (candidate) =>
          candidate.user.email === normalizedEmail &&
          candidate.passwordHash === hash
      );
      if (!account) {
        throw Object.assign(new Error(), { code: "auth/invalid-credential" });
      }
      writeJson(LOCAL_KEYS.session, account.user.id);
      return account.user;
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async logout(): Promise<void> {
    if (isFirebaseConfigured) {
      const services = getFirebaseServices();
      if (services) {
        const userId = services.auth.currentUser?.uid;
        await signOut(services.auth);
        if (userId && storageAvailable()) {
          window.localStorage.removeItem(firebaseDraftCacheKey(userId));
        }
      }
      return;
    }
    writeJson(LOCAL_KEYS.session, null);
  },

  async requestPasswordReset(email: string): Promise<void> {
    try {
      if (isFirebaseConfigured) {
        const services = getFirebaseServices();
        if (!services) throw new Error("Firebase is not available.");
        await sendPasswordResetEmail(services.auth, email.trim());
        return;
      }
      await ensureLocalSeed();
      const exists = localAccounts().some(
        (account) => account.user.email === email.trim().toLocaleLowerCase()
      );
      if (!exists) {
        throw Object.assign(new Error(), { code: "auth/user-not-found" });
      }
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      if (isFirebaseConfigured) {
        assertFirebaseOwner(userId);
        const services = getFirebaseServices();
        const firebaseUser = services?.auth.currentUser;
        if (!firebaseUser?.email) throw new Error("Please log in again.");
        await reauthenticateWithCredential(
          firebaseUser,
          EmailAuthProvider.credential(firebaseUser.email, currentPassword)
        );
        await updatePassword(firebaseUser, newPassword);
        return;
      }

      assertLocalOwner(userId);
      const accounts = localAccounts();
      const index = accounts.findIndex((account) => account.user.id === userId);
      if (
        index < 0 ||
        accounts[index].passwordHash !== await hashPassword(currentPassword)
      ) {
        throw Object.assign(new Error(), { code: "auth/wrong-password" });
      }
      accounts[index].passwordHash = await hashPassword(newPassword);
      saveLocalAccounts(accounts);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async refreshUser(userId: string): Promise<AppUser> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      return getFirebaseUserRecord(userId);
    }
    assertLocalOwner(userId);
    const account = localAccounts().find((item) => item.user.id === userId);
    if (!account) throw new Error("Your account could not be found.");
    return account.user;
  },

  async updateUser(
    userId: string,
    patch: Partial<Omit<AppUser, "id" | "email" | "createdAt">>
  ): Promise<AppUser> {
    const updatedAt = nowIso();
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      await updateDoc(doc(services.db, "users", userId), {
        ...patch,
        updatedAt
      });
      return getFirebaseUserRecord(userId);
    }

    assertLocalOwner(userId);
    const accounts = localAccounts();
    const index = accounts.findIndex((item) => item.user.id === userId);
    if (index < 0) throw new Error("Your account could not be found.");
    accounts[index].user = {
      ...accounts[index].user,
      ...patch,
      id: accounts[index].user.id,
      email: accounts[index].user.email,
      createdAt: accounts[index].user.createdAt,
      updatedAt
    };
    saveLocalAccounts(accounts);
    return accounts[index].user;
  },

  async getProfileView(userId: string): Promise<PublicSpiritualProfile | null> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) return null;
      const snapshot = await getDoc(doc(services.db, "profiles", userId));
      return snapshot.exists()
        ? storedPublicProfile(snapshot.data(), userId)
        : null;
    }
    assertLocalOwner(userId);
    const profile = readJson<JsonMap<PublicSpiritualProfile>>(
      LOCAL_KEYS.profiles,
      {}
    )[userId];
    return profile ? storedPublicProfile(profile) : null;
  },

  async getPrivateStory(userId: string): Promise<string> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) return "";
      const snapshot = await getDoc(doc(services.db, "privateProfiles", userId));
      return snapshot.exists()
        ? String(snapshot.data().hiddenStory ?? "")
        : "";
    }
    assertLocalOwner(userId);
    return readJson<JsonMap<PrivateProfileRecord>>(
      LOCAL_KEYS.privateProfiles,
      {}
    )[userId]?.hiddenStory ?? "";
  },

  async getFullProfile(userId: string): Promise<SpiritualProfile | null> {
    const [profile, hiddenStory] = await Promise.all([
      this.getProfileView(userId),
      this.getPrivateStory(userId)
    ]);
    return profile ? { ...profile, hiddenStory } : null;
  },

  async getDraft(userId: string): Promise<ProfileDraft | null> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) return null;
      try {
        const snapshot = await getDoc(doc(services.db, "drafts", userId));
        if (snapshot.exists()) {
          return storedProfileDraft(snapshot.data(), userId);
        }
      } catch {
        // A sanitized browser copy keeps non-sensitive progress recoverable
        // during a temporary network interruption.
      }
      return storedProfileDraft(
        readJson<ProfileDraft | null>(firebaseDraftCacheKey(userId), null),
        userId
      );
    }
    assertLocalOwner(userId);
    return storedProfileDraft(
      readJson<JsonMap<ProfileDraft>>(LOCAL_KEYS.drafts, {})[userId] ?? null
    );
  },

  async saveDraft(
    userId: string,
    currentStep: number,
    draftData: ProfileDraftData
  ): Promise<ProfileDraft> {
    const draft: ProfileDraft = {
      id: userId,
      userId,
      currentStep: Math.max(0, Math.min(10, currentStep)),
      draftData,
      updatedAt: nowIso()
    };
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      assertStoredProfileImagePath(userId, draftData.imagePath);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      // Keep only a non-sensitive local fallback. The Hidden Story remains in
      // the owner-protected Firestore draft and never persists in this cache.
      writeJson(firebaseDraftCacheKey(userId), {
        ...draft,
        draftData: { ...draft.draftData, hiddenStory: "" }
      });
      await setDoc(doc(services.db, "drafts", userId), draft);
      return draft;
    }
    assertLocalOwner(userId);
    const drafts = readJson<JsonMap<ProfileDraft>>(LOCAL_KEYS.drafts, {});
    drafts[userId] = draft;
    writeJson(LOCAL_KEYS.drafts, drafts);
    return draft;
  },

  async deleteDraft(userId: string): Promise<void> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (services) await deleteDoc(doc(services.db, "drafts", userId));
      if (storageAvailable()) {
        window.localStorage.removeItem(firebaseDraftCacheKey(userId));
      }
      return;
    }
    assertLocalOwner(userId);
    const drafts = readJson<JsonMap<ProfileDraft>>(LOCAL_KEYS.drafts, {});
    delete drafts[userId];
    writeJson(LOCAL_KEYS.drafts, drafts);
  },

  async completeProfile(
    userId: string,
    rawData: ProfileDraftData
  ): Promise<SpiritualProfile> {
    const data = normalizeDraft(rawData);
    if (!data.profileName) throw new Error("Please add a profile name.");
    const now = nowIso();

    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      assertStoredProfileImagePath(userId, data.imagePath);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      const existing = await this.getProfileView(userId);
      const fullProfile: SpiritualProfile = {
        id: userId,
        userId,
        profileName: data.profileName,
        imagePath: data.imagePath,
        selectedSymbol: data.selectedSymbol,
        spiritualBio: data.spiritualBio,
        followers: data.followers,
        following: data.following,
        heartSeeks: data.heartSeeks,
        godsComment: data.godsComment,
        heavenlyHashtag: data.heavenlyHashtag,
        hiddenStory: data.hiddenStory,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      const batch = writeBatch(services.db);
      batch.set(doc(services.db, "profiles", userId), toPublicProfile(fullProfile));
      batch.set(doc(services.db, "privateProfiles", userId), {
        userId,
        hiddenStory: fullProfile.hiddenStory,
        updatedAt: now
      });
      batch.update(doc(services.db, "users", userId), {
        profileCompleted: true,
        updatedAt: now
      });
      batch.delete(doc(services.db, "drafts", userId));
      data.onboardingPosts.forEach((content) => {
        const postRef = doc(collection(services.db, "reflectionPosts"));
        const post: ReflectionPost = {
          id: postRef.id,
          userId,
          content,
          isPrivate: false,
          createdAt: now,
          updatedAt: now
        };
        batch.set(postRef, post);
      });
      await batch.commit();
      await cleanupReplacedProfileImage(
        userId,
        existing?.imagePath ?? "",
        fullProfile.imagePath
      );
      return fullProfile;
    }

    assertLocalOwner(userId);
    const profiles = readJson<JsonMap<PublicSpiritualProfile>>(
      LOCAL_KEYS.profiles,
      {}
    );
    const existing = profiles[userId];
    const fullProfile: SpiritualProfile = {
      id: userId,
      userId,
      profileName: data.profileName,
      imagePath: data.imagePath,
      selectedSymbol: data.selectedSymbol,
      spiritualBio: data.spiritualBio,
      followers: data.followers,
      following: data.following,
      heartSeeks: data.heartSeeks,
      godsComment: data.godsComment,
      heavenlyHashtag: data.heavenlyHashtag,
      hiddenStory: data.hiddenStory,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    profiles[userId] = toPublicProfile(fullProfile);
    writeJson(LOCAL_KEYS.profiles, profiles);
    const privateProfiles = readJson<JsonMap<PrivateProfileRecord>>(
      LOCAL_KEYS.privateProfiles,
      {}
    );
    privateProfiles[userId] = {
      userId,
      hiddenStory: data.hiddenStory,
      updatedAt: now
    };
    writeJson(LOCAL_KEYS.privateProfiles, privateProfiles);

    const reflections = readJson<JsonMap<ReflectionPost>>(
      LOCAL_KEYS.reflections,
      {}
    );
    data.onboardingPosts.forEach((content) => {
      const id = newId("reflection-");
      reflections[id] = {
        id,
        userId,
        content,
        isPrivate: false,
        createdAt: now,
        updatedAt: now
      };
    });
    writeJson(LOCAL_KEYS.reflections, reflections);
    await this.updateUser(userId, { profileCompleted: true });
    await this.deleteDraft(userId);
    return fullProfile;
  },

  async updateProfile(
    userId: string,
    profile: SpiritualProfile
  ): Promise<SpiritualProfile> {
    const now = nowIso();
    const updated: SpiritualProfile = {
      ...profile,
      id: userId,
      userId,
      profileName: cleanText(profile.profileName, LIMITS.profileName),
      imagePath: normalizeProfileImageReference(profile.imagePath),
      spiritualBio: cleanText(profile.spiritualBio, LIMITS.bio),
      followers: normalizeList(profile.followers),
      following: normalizeList(profile.following),
      heartSeeks: normalizeList(profile.heartSeeks),
      godsComment: cleanText(profile.godsComment, LIMITS.godsComment),
      heavenlyHashtag: normalizeHashtag(profile.heavenlyHashtag),
      hiddenStory: cleanText(profile.hiddenStory, LIMITS.hiddenStory),
      updatedAt: now
    };
    if (!updated.profileName) throw new Error("Profile name is required.");

    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      assertStoredProfileImagePath(userId, updated.imagePath);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      const existing = await this.getProfileView(userId);
      const batch = writeBatch(services.db);
      batch.set(doc(services.db, "profiles", userId), toPublicProfile(updated));
      batch.set(doc(services.db, "privateProfiles", userId), {
        userId,
        hiddenStory: updated.hiddenStory,
        updatedAt: now
      });
      batch.update(doc(services.db, "users", userId), { updatedAt: now });
      await batch.commit();
      await cleanupReplacedProfileImage(
        userId,
        existing?.imagePath ?? "",
        updated.imagePath
      );
      return updated;
    }

    assertLocalOwner(userId);
    const profiles = readJson<JsonMap<PublicSpiritualProfile>>(
      LOCAL_KEYS.profiles,
      {}
    );
    profiles[userId] = toPublicProfile(updated);
    writeJson(LOCAL_KEYS.profiles, profiles);
    const privateProfiles = readJson<JsonMap<PrivateProfileRecord>>(
      LOCAL_KEYS.privateProfiles,
      {}
    );
    privateProfiles[userId] = {
      userId,
      hiddenStory: updated.hiddenStory,
      updatedAt: now
    };
    writeJson(LOCAL_KEYS.privateProfiles, privateProfiles);
    await this.updateUser(userId, {});
    return updated;
  },

  async uploadProfileImage(userId: string, file: File): Promise<string> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      return uploadSupabaseProfileImage(userId, file);
    }

    assertLocalOwner(userId);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("The image could not be read."));
      reader.readAsDataURL(file);
    });
  },

  async deleteProfileImage(userId: string, imagePath: string): Promise<void> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      await deleteSupabaseProfileImage(userId, imagePath);
    }
  },

  async getReflections(userId: string): Promise<ReflectionPost[]> {
    let posts: ReflectionPost[];
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) return [];
      const snapshot = await getDocs(
        query(
          collection(services.db, "reflectionPosts"),
          where("userId", "==", userId)
        )
      );
      posts = snapshot.docs.map((item) => item.data() as ReflectionPost);
    } else {
      assertLocalOwner(userId);
      posts = Object.values(
        readJson<JsonMap<ReflectionPost>>(LOCAL_KEYS.reflections, {})
      ).filter((post) => post.userId === userId);
    }
    return posts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getPublicReflections(userId: string): Promise<ReflectionPost[]> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) return [];
      const snapshot = await getDocs(
        query(
          collection(services.db, "reflectionPosts"),
          where("userId", "==", userId),
          where("isPrivate", "==", false)
        )
      );
      return snapshot.docs
        .map((item) => item.data() as ReflectionPost)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    assertLocalOwner(userId);
    return Object.values(
      readJson<JsonMap<ReflectionPost>>(LOCAL_KEYS.reflections, {})
    )
      .filter((post) => post.userId === userId && !post.isPrivate)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  async getPrivateReflections(userId: string): Promise<ReflectionPost[]> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) return [];
      const snapshot = await getDocs(
        query(
          collection(services.db, "reflectionPosts"),
          where("userId", "==", userId),
          where("isPrivate", "==", true)
        )
      );
      return snapshot.docs
        .map((item) => item.data() as ReflectionPost)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    assertLocalOwner(userId);
    return Object.values(
      readJson<JsonMap<ReflectionPost>>(LOCAL_KEYS.reflections, {})
    )
      .filter((post) => post.userId === userId && post.isPrivate)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  async saveReflection(
    userId: string,
    input: Pick<ReflectionPost, "content" | "isPrivate"> & {
      id?: string;
      createdAt?: string;
    }
  ): Promise<ReflectionPost> {
    const content = cleanText(input.content, LIMITS.post);
    if (!content) throw new Error("Write a short moment before saving.");
    const now = nowIso();

    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      const postRef = input.id
        ? doc(services.db, "reflectionPosts", input.id)
        : doc(collection(services.db, "reflectionPosts"));
      let createdAt = input.createdAt ?? now;
      if (input.id) {
        const existing = await getDoc(postRef);
        if (!existing.exists() || existing.data().userId !== userId) {
          throw new Error("That reflection could not be found.");
        }
        createdAt = String(existing.data().createdAt ?? createdAt);
      }
      const post: ReflectionPost = {
        id: postRef.id,
        userId,
        content,
        isPrivate: input.isPrivate,
        createdAt,
        updatedAt: now
      };
      await setDoc(postRef, post);
      return post;
    }

    assertLocalOwner(userId);
    const reflections = readJson<JsonMap<ReflectionPost>>(
      LOCAL_KEYS.reflections,
      {}
    );
    if (input.id && reflections[input.id]?.userId !== userId) {
      throw new Error("That reflection could not be found.");
    }
    const id = input.id ?? newId("reflection-");
    const post: ReflectionPost = {
      id,
      userId,
      content,
      isPrivate: input.isPrivate,
      createdAt: input.id
        ? reflections[input.id].createdAt
        : input.createdAt ?? now,
      updatedAt: now
    };
    reflections[id] = post;
    writeJson(LOCAL_KEYS.reflections, reflections);
    return post;
  },

  async deleteReflection(userId: string, reflectionId: string): Promise<void> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      const postRef = doc(services.db, "reflectionPosts", reflectionId);
      const existing = await getDoc(postRef);
      if (!existing.exists() || existing.data().userId !== userId) {
        throw new Error("That reflection could not be found.");
      }
      await deleteDoc(postRef);
      return;
    }

    assertLocalOwner(userId);
    const reflections = readJson<JsonMap<ReflectionPost>>(
      LOCAL_KEYS.reflections,
      {}
    );
    if (reflections[reflectionId]?.userId !== userId) {
      throw new Error("That reflection could not be found.");
    }
    delete reflections[reflectionId];
    writeJson(LOCAL_KEYS.reflections, reflections);
  },

  async exportPersonalData(userId: string): Promise<PersonalDataExport> {
    const [user, profile, reflections, unfinishedDraft] = await Promise.all([
      this.refreshUser(userId),
      this.getFullProfile(userId),
      this.getReflections(userId),
      this.getDraft(userId)
    ]);
    return {
      exportedAt: nowIso(),
      notice:
        "Private personal archive requested by the account owner. Keep this file secure; it can contain a Hidden Story and private reflections.",
      user,
      profile,
      reflections,
      unfinishedDraft
    };
  },

  async deleteAllUserData(
    userId: string,
    currentPassword: string
  ): Promise<void> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      const firebaseUser = services.auth.currentUser;
      if (!firebaseUser?.email) throw new Error("Please log in again.");
      try {
        await reauthenticateWithCredential(
          firebaseUser,
          EmailAuthProvider.credential(firebaseUser.email, currentPassword)
        );
      } catch (error) {
        throw friendlyAuthError(error);
      }
      // Remove Supabase Storage first. If this fails, retain the account and
      // Firestore records so the owner can retry without orphaning image data.
      try {
        await deleteAllSupabaseProfileImages(userId);
      } catch (imageError) {
        const detail =
          imageError instanceof Error
            ? ` ${imageError.message}`
            : "";
        throw new Error(
          `Your profile images could not be removed, so account deletion stopped.${detail}`
        );
      }

      // A Firestore WriteBatch accepts at most 500 writes. Delete reflections
      // in bounded pages, then remove the four UID-keyed account documents.
      const reflectionBatchSize = 400;
      while (true) {
        const reflectionsPage = await getDocs(
          query(
            collection(services.db, "reflectionPosts"),
            where("userId", "==", userId),
            firestoreLimit(reflectionBatchSize)
          )
        );
        if (reflectionsPage.empty) break;

        const reflectionBatch = writeBatch(services.db);
        reflectionsPage.docs.forEach((item) =>
          reflectionBatch.delete(item.ref)
        );
        await reflectionBatch.commit();
      }

      const accountBatch = writeBatch(services.db);
      accountBatch.delete(doc(services.db, "profiles", userId));
      accountBatch.delete(doc(services.db, "privateProfiles", userId));
      accountBatch.delete(doc(services.db, "drafts", userId));
      accountBatch.delete(doc(services.db, "users", userId));
      await accountBatch.commit();
      await deleteUser(firebaseUser);
      return;
    }

    assertLocalOwner(userId);
    const account = localAccounts().find((item) => item.user.id === userId);
    if (
      !account ||
      account.passwordHash !== await hashPassword(currentPassword)
    ) {
      throw friendlyAuthError(
        Object.assign(new Error(), { code: "auth/wrong-password" })
      );
    }
    const accounts = localAccounts().filter(
      (account) => account.user.id !== userId
    );
    saveLocalAccounts(accounts);
    const removeUserEntry = <T extends { userId: string }>(
      key: string
    ): void => {
      const values = readJson<JsonMap<T>>(key, {});
      Object.entries(values).forEach(([id, value]) => {
        if (value.userId === userId) delete values[id];
      });
      writeJson(key, values);
    };
    removeUserEntry<PublicSpiritualProfile>(LOCAL_KEYS.profiles);
    removeUserEntry<PrivateProfileRecord>(LOCAL_KEYS.privateProfiles);
    removeUserEntry<ProfileDraft>(LOCAL_KEYS.drafts);
    removeUserEntry<ReflectionPost>(LOCAL_KEYS.reflections);
    writeJson(LOCAL_KEYS.session, null);
  }
};
