import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Unsubscribe
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { DEMO_EMAIL, DEMO_PASSWORD, LIMITS } from "@/lib/constants";
import { isFiatCategory, localDateKey } from "@/lib/fiat";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  deleteAllFirebaseProfileImages,
  deleteFirebaseProfileImage,
  isOwnedProfileImagePath,
  uploadFirebaseProfileImage
} from "@/lib/profile-images";
import {
  normalizeDraft,
  normalizeProfileImageReference,
  toPublicProfile
} from "@/lib/profile";
import {
  cleanText,
  normalizeCoverColor,
  normalizeHashtag,
  normalizeList,
  registrationEmailError
} from "@/lib/validation";
import {
  DEFAULT_PRIVACY_PREFERENCES,
  EMPTY_DRAFT,
  type AppUser,
  type PersonalDataExport,
  type ProfileImageHistoryEntry,
  type ProfileDraft,
  type ProfileDraftData,
  type PublicSpiritualProfile,
  type ReflectionPost,
  type FollowRelationship,
  type SocialNotification,
  type SocialFeedPost,
  type SocialProfile,
  type ReflectionLike,
  type ReflectionComment,
  type SpiritualProfile,
  type SpiritualSymbol
} from "@/types";

const STORAGE_PREFIX = "saintagram:v1";
const LOCAL_KEYS = {
  accounts: `${STORAGE_PREFIX}:accounts`,
  session: `${STORAGE_PREFIX}:session`,
  profiles: `${STORAGE_PREFIX}:profiles`,
  coverColors: `${STORAGE_PREFIX}:coverColors`,
  privateProfiles: `${STORAGE_PREFIX}:privateProfiles`,
  drafts: `${STORAGE_PREFIX}:drafts`,
  reflections: `${STORAGE_PREFIX}:reflectionPosts`,
  profileImageHistory: `${STORAGE_PREFIX}:profileImageHistory`
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

interface LocalProfileImageHistoryEntry {
  id: string;
  userId: string;
  imagePath: string;
  createdAt: string;
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

function readSessionUid(): string | null {
  if (!storageAvailable()) return null;
  try {
    return window.localStorage.getItem(LOCAL_KEYS.session);
  } catch {
    return null;
  }
}

function writeSessionUid(userId: string | null): void {
  if (!storageAvailable()) return;
  if (userId) {
    window.localStorage.setItem(LOCAL_KEYS.session, userId);
  } else {
    window.localStorage.removeItem(LOCAL_KEYS.session);
  }
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
  return readSessionUid();
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

function emailActionSettings(path: string) {
  return {
    url: `${window.location.origin}${path}`,
    handleCodeInApp: false
  };
}

function createUserRecord(
  id: string,
  email: string,
  authProvider: "password" | "google" | "guest" = "password"
): AppUser {
  const now = nowIso();
  return {
    id,
    email: email.trim().toLocaleLowerCase(),
    ...(authProvider === "guest" ? { isGuest: true } : {}),
    authProvider,
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

function dateValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return "";
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
    coverColor: expectedUserId
      ? normalizeCoverColor(
          readJson<JsonMap<string>>(LOCAL_KEYS.coverColors, {})[expectedUserId]
        )
      : "#DDD2F6",
    imagePath:
      expectedUserId &&
      storedImagePath &&
      !isOwnedProfileImagePath(storedImagePath, expectedUserId)
        ? ""
        : storedImagePath,
    selectedSymbol: stringValue(data.selectedSymbol) as SpiritualSymbol,
    spiritualBio: stringValue(data.spiritualBio),
    spiritualGuides: stringList(
    data.spiritualGuides ?? data.followers
    ),
    lifeDirections: stringList(
    data.lifeDirections ?? data.following
    ),
    heartSeeks: stringList(data.heartSeeks),
    godsComment: stringValue(data.godsComment),
    heavenlyHashtag: stringValue(data.heavenlyHashtag),
    createdAt: dateValue(data.createdAt),
    updatedAt: dateValue(data.updatedAt)
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
    spiritualGuides: stringList(
    rawDraft.spiritualGuides ?? rawDraft.followers
    ),
    lifeDirections: stringList(
    rawDraft.lifeDirections ?? rawDraft.following
    ),
    onboardingPostTitles: stringList(rawDraft.onboardingPostTitles),
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
    updatedAt: dateValue(data.updatedAt)
  };
}

function storedReflection(
  id: string,
  value: unknown,
  expectedUserId: string
): ReflectionPost | null {
  if (typeof value !== "object" || !value) return null;
  const data = value as Record<string, unknown>;
  const userId = stringValue(data.userId);
  const content = stringValue(data.content).trim();
  const createdAt = dateValue(data.createdAt);
  const updatedAt = dateValue(data.updatedAt);
  const editedAt = dateValue(data.editedAt);
  if (
    userId !== expectedUserId ||
    !content ||
    typeof data.isPrivate !== "boolean" ||
    Number.isNaN(Date.parse(createdAt)) ||
    Number.isNaN(Date.parse(updatedAt)) ||
    (editedAt && Number.isNaN(Date.parse(editedAt)))
  ) {
    return null;
  }
  return {
    id,
    userId,
    title: cleanText(stringValue(data.title), LIMITS.momentTitle),
    content,
    isPrivate: data.isPrivate,
    createdAt,
    updatedAt,
    ...(editedAt ? { editedAt } : {}),
    ...(isFiatCategory(data.fiatCategory) ? { fiatCategory: data.fiatCategory } : {}),
    ...(isFiatCategory(data.fiatCategory) && /^\d{4}-\d{2}-\d{2}$/.test(stringValue(data.fiatDateKey)) ? { fiatDateKey: stringValue(data.fiatDateKey) } : {})
  };
}

function storedSocialProfile(
  id: string,
  value: unknown
): SocialProfile | null {
  if (typeof value !== "object" || !value) return null;

  const data = value as Record<string, unknown>;
  const userId = stringValue(data.userId);
  const profileName = stringValue(data.profileName).trim();
  const createdAt = dateValue(data.createdAt);
  const updatedAt = dateValue(data.updatedAt);

  if (
    id !== userId ||
    !profileName ||
    Number.isNaN(Date.parse(createdAt)) ||
    Number.isNaN(Date.parse(updatedAt))
  ) {
    return null;
  }

  return {
    id,
    userId,
    profileName,
    imagePath: stringValue(data.imagePath),
    spiritualBio: stringValue(data.spiritualBio),
    heavenlyHashtag: stringValue(data.heavenlyHashtag),
    createdAt,
    updatedAt
  };
}

function storedFollowRelationship(
  id: string,
  value: unknown
): FollowRelationship | null {
  if (typeof value !== "object" || !value) return null;

  const data = value as Record<string, unknown>;
  const followerId = stringValue(data.followerId);
  const followingId = stringValue(data.followingId);
  const createdAt = dateValue(data.createdAt);

  if (
    !followerId ||
    !followingId ||
    followerId === followingId ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    id,
    followerId,
    followingId,
    createdAt
  };
}

function storedReflectionLike(
  id: string,
  value: unknown
): ReflectionLike | null {
  if (typeof value !== "object" || !value) {
    return null;
  }

  const data = value as Record<string, unknown>;

  const storedId = stringValue(data.id);
  const reflectionId = stringValue(data.reflectionId);
  const postOwnerId = stringValue(data.postOwnerId);
  const userId = stringValue(data.userId);
  const createdAt = dateValue(data.createdAt);

  if (
    storedId !== id ||
    !reflectionId ||
    !postOwnerId ||
    !userId ||
    postOwnerId === userId ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    id,
    reflectionId,
    postOwnerId,
    userId,
    createdAt
  };
}

function storedReflectionComment(
  id: string,
  value: unknown
): ReflectionComment | null {
  if (
    typeof value !== "object" ||
    !value
  ) {
    return null;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const storedId =
    stringValue(data.id);

  const reflectionId =
    stringValue(
      data.reflectionId
    );

  const postOwnerId =
    stringValue(
      data.postOwnerId
    );

  const userId =
    stringValue(data.userId);

  const parentCommentId =
    stringValue(
      data.parentCommentId
    );

  const replyToUserId =
    stringValue(
      data.replyToUserId
    );

  const content =
    stringValue(data.content);

  const createdAt =
    dateValue(data.createdAt);

  const updatedAt =
    dateValue(data.updatedAt);

  const hasReplyData =
    Boolean(
      parentCommentId ||
      replyToUserId
    );

  if (
    storedId !== id ||
    !reflectionId ||
    !postOwnerId ||
    !userId ||
    !content ||
    Number.isNaN(
      Date.parse(createdAt)
    ) ||
    Number.isNaN(
      Date.parse(updatedAt)
    ) ||
    (
      hasReplyData &&
      (
        !parentCommentId ||
        !replyToUserId
      )
    )
  ) {
    return null;
  }

  return {
    id,
    reflectionId,
    postOwnerId,
    userId,

    ...(parentCommentId
      ? { parentCommentId }
      : {}),

    ...(replyToUserId
      ? { replyToUserId }
      : {}),

    content,
    createdAt,
    updatedAt
  };
}

function storedSocialNotification(
  id: string,
  value: unknown
): SocialNotification | null {
  if (typeof value !== "object" || !value) {
    return null;
  }

  const data =
    value as Record<string, unknown>;

  const storedId =
    stringValue(data.id);

  const userId =
    stringValue(data.userId);

  const actorUserId =
    stringValue(data.actorUserId);

  const type =
    stringValue(data.type);

  const createdAt =
    dateValue(data.createdAt);

  const readAt =
    data.readAt === null
      ? null
      : dateValue(data.readAt);

  const reflectionId =
    stringValue(data.reflectionId);

  const commentId =
    stringValue(data.commentId);

  if (
    storedId !== id ||
    !userId ||
    !actorUserId ||
    userId === actorUserId ||
    ![
      "follow",
      "like",
      "comment",
      "reply"
    ].includes(type) ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    id,
    userId,
    actorUserId,
    type: type as SocialNotification["type"],
    ...(reflectionId
      ? { reflectionId }
      : {}),
    ...(commentId
      ? { commentId }
      : {}),
    createdAt,
    readAt
  };
}

function newestFirst(posts: ReflectionPost[]): ReflectionPost[] {
  return posts.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function newestImageHistoryFirst(
  entries: ProfileImageHistoryEntry[]
): ProfileImageHistoryEntry[] {
  return entries.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
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
  // Keep older profile images so the journey timeline can show every change.
  // Account deletion removes the full owner image set in one pass.
  return;
}

function localProfileImageHistoryKey(userId: string): string {
  return `${STORAGE_PREFIX}:profileImageHistory:${userId}`;
}

function readLocalProfileImageHistory(
  userId: string
): LocalProfileImageHistoryEntry[] {
  return Object.values(
    readJson<Record<string, LocalProfileImageHistoryEntry>>(
      localProfileImageHistoryKey(userId),
      {}
    )
  );
}

function writeLocalProfileImageHistoryEntry(
  entry: LocalProfileImageHistoryEntry
): void {
  const entries = readJson<Record<string, LocalProfileImageHistoryEntry>>(
    localProfileImageHistoryKey(entry.userId),
    {}
  );
  entries[entry.id] = entry;
  writeJson(localProfileImageHistoryKey(entry.userId), entries);
}

function storedProfileImageHistoryEntry(
  id: string,
  value: unknown,
  expectedUserId: string
): ProfileImageHistoryEntry | null {
  if (typeof value !== "object" || !value) return null;
  const data = value as Record<string, unknown>;
  const userId = stringValue(data.userId);
  const imagePath = stringValue(data.imagePath);
  const createdAt = dateValue(data.createdAt);
  const updatedAt = dateValue(data.updatedAt);
  if (
    userId !== expectedUserId ||
    !isOwnedProfileImagePath(imagePath, userId) ||
    Number.isNaN(Date.parse(createdAt)) ||
    Number.isNaN(Date.parse(updatedAt))
  ) {
    return null;
  }
  return { id, userId, imagePath, createdAt, updatedAt };
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
    coverColor: "#DDD2F6",
    imagePath: "",
    selectedSymbol: "seed",
    spiritualBio:
      "Before God, I am someone who is learning to receive grace, begin again, and notice quiet gifts.",
    spiritualGuides: [
      "My parents",
      "St. Thérèse",
      "A trusted friend",
      "Jesus"
    ],
    lifeDirections: [
      "Jesus",
      "God’s will",
      "Friends"
    ],
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
  writeJson<Record<string, LocalProfileImageHistoryEntry>>(
    localProfileImageHistoryKey(userId),
    {}
  );
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
    "auth/email-not-verified":
      "Verify your email before logging in. We sent you a new verification link.",
    "auth/unauthorized-domain":
      "This website domain is not authorized for sign-in.",
    "auth/account-exists-with-different-credential":
      "An account already exists with different sign-in information.",
    "auth/credential-already-in-use":
      "That account is already connected to another Saintagram profile.",
    "auth/provider-already-linked":
      "This guest account is already connected to that sign-in method.",
    "auth/user-mismatch":
      "Choose the same Google account that you used to begin this profile.",
    "auth/web-storage-unsupported":
      "Authentication needs browser storage. Enable it and try again.",
    "auth/popup-blocked":
      "Your browser blocked the Google sign-in window. Allow pop-ups and try again.",
    "auth/popup-closed-by-user":
      "Google sign-in was cancelled before it finished.",
    "auth/cancelled-popup-request":
      "Another Google sign-in window is already open.",
    "auth/operation-not-allowed":
      "This sign-in method is not enabled. Please contact the site owner.",
    "auth/requires-recent-login":
      "For your safety, please log out and log in again before making this change.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters."
  };
  if (messages[code]) return new Error(messages[code]);
  if (code.startsWith("auth/")) {
    return new Error(
      `Authentication could not be completed (${code}). Please try again or contact the site owner.`
    );
  }
  return new Error("Something went wrong. Please try again.");
}

async function hasStoredProfileImageReference(userId: string): Promise<boolean> {
  const services = getFirebaseServices();
  if (!services) return false;
  const [profileSnapshot, draftSnapshot, historySnapshot] = await Promise.all([
    getDoc(doc(services.db, "profiles", userId)),
    getDoc(doc(services.db, "drafts", userId)),
    getDocs(
      query(
        collection(services.db, "profileImageHistory"),
        where("userId", "==", userId)
      )
    )
  ]);
  const profilePath = profileSnapshot.exists()
    ? stringValue(profileSnapshot.data().imagePath)
    : "";
  const draftData = draftSnapshot.exists()
    ? draftSnapshot.data().draftData
    : null;
  const draftPath =
    typeof draftData === "object" && draftData
      ? stringValue((draftData as Record<string, unknown>).imagePath)
      : "";
  return (
    isOwnedProfileImagePath(profilePath, userId) ||
    isOwnedProfileImagePath(draftPath, userId) ||
    historySnapshot.docs.length > 0
  );
}

async function hasFirebaseProfileImageReference(
  userId: string,
  imagePath: string
): Promise<boolean> {
  const services = getFirebaseServices();
  if (!services) return false;
  if (!imagePath || !isOwnedProfileImagePath(imagePath, userId)) return false;

  const [profileSnapshot, draftSnapshot, historySnapshot] = await Promise.all([
    getDoc(doc(services.db, "profiles", userId)),
    getDoc(doc(services.db, "drafts", userId)),
    getDocs(
      query(
        collection(services.db, "profileImageHistory"),
        where("userId", "==", userId)
      )
    )
  ]);

  const profilePath = profileSnapshot.exists()
    ? stringValue(profileSnapshot.data().imagePath)
    : "";
  const draftData = draftSnapshot.exists()
    ? draftSnapshot.data().draftData
    : null;
  const draftPath =
    typeof draftData === "object" && draftData
      ? stringValue((draftData as Record<string, unknown>).imagePath)
      : "";

  if (profilePath === imagePath || draftPath === imagePath) {
    return true;
  }

  return historySnapshot.docs.some(
    (item) => stringValue(item.data().imagePath) === imagePath
  );
}

async function deleteFirebaseOwnedDocuments(
  userId: string
): Promise<void> {
  const services =
    getFirebaseServices();

  if (!services) {
    throw new Error(
      "The account service is unavailable."
    );
  }

  // 1. Delete reflection posts.
  while (true) {
    const page = await getDocs(
      query(
        collection(
          services.db,
          "reflectionPosts"
        ),
        where(
          "userId",
          "==",
          userId
        ),
        firestoreLimit(400)
      )
    );

    if (page.empty) {
      break;
    }

    const batch =
      writeBatch(services.db);

    page.docs.forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
  }

  // 2. Delete profile-image history.
  while (true) {
    const page = await getDocs(
      query(
        collection(
          services.db,
          "profileImageHistory"
        ),
        where(
          "userId",
          "==",
          userId
        ),
        firestoreLimit(400)
      )
    );

    if (page.empty) {
      break;
    }

    const batch =
      writeBatch(services.db);

    page.docs.forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
  }

  // 3. Delete outgoing follow relationships.
  while (true) {
    const page = await getDocs(
      query(
        collection(
          services.db,
          "follows"
        ),
        where(
          "followerId",
          "==",
          userId
        ),
        firestoreLimit(400)
      )
    );

    if (page.empty) {
      break;
    }

    const batch =
      writeBatch(services.db);

    page.docs.forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
  }

  // 4. Delete incoming follow relationships.
  while (true) {
    const page = await getDocs(
      query(
        collection(
          services.db,
          "follows"
        ),
        where(
          "followingId",
          "==",
          userId
        ),
        firestoreLimit(400)
      )
    );

    if (page.empty) {
      break;
    }

    const batch =
      writeBatch(services.db);

    page.docs.forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
  }

  // 5. Delete notifications received by this user.
  while (true) {
    const page = await getDocs(
      query(
        collection(
          services.db,
          "notifications"
        ),
        where(
          "userId",
          "==",
          userId
        ),
        firestoreLimit(400)
      )
    );

    if (page.empty) {
      break;
    }

    const batch =
      writeBatch(services.db);

    page.docs.forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
  }

  // 6. Delete notifications created because
  // this user followed somebody.
  while (true) {
    const page = await getDocs(
      query(
        collection(
          services.db,
          "notifications"
        ),
        where(
          "actorUserId",
          "==",
          userId
        ),
        firestoreLimit(400)
      )
    );

    if (page.empty) {
      break;
    }

    const batch =
      writeBatch(services.db);

    page.docs.forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
  }

  // 7. Delete UID-keyed account documents.
  const accountBatch =
    writeBatch(services.db);

  accountBatch.delete(
    doc(
      services.db,
      "profiles",
      userId
    )
  );

  accountBatch.delete(
    doc(
      services.db,
      "privateProfiles",
      userId
    )
  );

  accountBatch.delete(
    doc(
      services.db,
      "drafts",
      userId
    )
  );

  accountBatch.delete(
    doc(
      services.db,
      "socialProfiles",
      userId
    )
  );

  accountBatch.delete(
    doc(
      services.db,
      "users",
      userId
    )
  );

  await accountBatch.commit();
}

async function getFirebaseUserRecord(
  userId: string,
  email = "",
  authProvider?: "password" | "google" | "guest"
): Promise<AppUser> {
  const services = getFirebaseServices();

  if (!services) {
    throw new Error("Firebase is not available.");
  }

  const userRef = doc(
    services.db,
    "users",
    userId
  );

  return runTransaction(
    services.db,
    async (transaction) => {
      const snapshot = await transaction.get(userRef);

      if (snapshot.exists()) {
        const stored = snapshot.data() as AppUser;

        if (
          authProvider &&
          (
            stored.email !== email ||
            stored.authProvider !== authProvider ||
            Boolean(stored.isGuest) !==
              (authProvider === "guest")
          )
        ) {
          const identityPatch = {
            email: email.trim().toLocaleLowerCase(),
            isGuest: authProvider === "guest",
            authProvider,
            updatedAt: nowIso()
          };

          transaction.update(
            userRef,
            identityPatch
          );

          return {
            ...stored,
            ...identityPatch
          };
        }

        return stored;
      }

      const user = createUserRecord(
        userId,
        email,
        authProvider ?? "password"
      );

      transaction.set(
        userRef,
        user
      );

      return user;
    }
  );
}

function sameStringList(
  first: string[] | undefined,
  second: string[] | undefined
): boolean {
  return JSON.stringify(
    first ?? []
  ) ===
    JSON.stringify(
      second ?? []
    );
}

function listDescription(
  values: string[] | undefined
): string {
  const list =
    values ?? [];

  return list.length
    ? list.join(", ")
    : "None";
}

function profileJourneyChanges(
  before: SpiritualProfile,
  after: SpiritualProfile
): string[] {
  const changes: string[] =
    [];

  if (
    before.profileName !==
    after.profileName
  ) {
    changes.push(
      `Profile name changed from "${before.profileName}" to "${after.profileName}".`
    );
  }

  if (
    before.imagePath !==
    after.imagePath
  ) {
    changes.push(
      after.imagePath
        ? "Profile picture was changed."
        : "Profile picture was removed."
    );
  }

  if (
    before.selectedSymbol !==
    after.selectedSymbol
  ) {
    changes.push(
      after.selectedSymbol
        ? `Profile symbol changed to "${after.selectedSymbol}".`
        : "Profile symbol was removed."
    );
  }

  if (
    before.spiritualBio !==
    after.spiritualBio
  ) {
    changes.push(
      after.spiritualBio
        ? `“Before God, I am” was changed to: "${after.spiritualBio}"`
        : "“Before God, I am” was cleared."
    );
  }

  if (
    !sameStringList(
      before.spiritualGuides,
      after.spiritualGuides
    )
  ) {
    changes.push(
      `Spiritual guides changed to: ${listDescription(
        after.spiritualGuides
      )}.`
    );
  }

  if (
    !sameStringList(
      before.lifeDirections,
      after.lifeDirections
    )
  ) {
    changes.push(
      `Life directions changed to: ${listDescription(
        after.lifeDirections
      )}.`
    );
  }

  if (
    !sameStringList(
      before.heartSeeks,
      after.heartSeeks
    )
  ) {
    changes.push(
      `“My heart seeks” changed to: ${listDescription(
        after.heartSeeks
      )}.`
    );
  }

  if (
    before.godsComment !==
    after.godsComment
  ) {
    changes.push(
      after.godsComment
        ? `Word of grace changed to: "${after.godsComment}"`
        : "Word of grace was cleared."
    );
  }

  if (
    before.heavenlyHashtag !==
    after.heavenlyHashtag
  ) {
    changes.push(
      after.heavenlyHashtag
        ? `Heavenly hashtag changed to ${after.heavenlyHashtag}.`
        : "Heavenly hashtag was removed."
    );
  }

  if (
    before.hiddenStory !==
    after.hiddenStory
  ) {
    /*
     * Do not copy the private
     * story into the journey.
     */
    changes.push(
      "Hidden story was updated."
    );
  }

  if (
    before.coverColor !==
    after.coverColor
  ) {
    changes.push(
      "Profile cover color was changed."
    );
  }

  return changes;
}

export const appService = {
  mode: isFirebaseConfigured ? ("firebase" as const) : ("local" as const),

  async saveSocialProfile(
    userId: string,
    profile: PublicSpiritualProfile
  ): Promise<SocialProfile> {
    assertFirebaseOwner(
      userId
    );

    const services =
      getFirebaseServices();

    if (!services) {
      throw new Error(
        "Firebase is not available."
      );
    }

    const socialProfileRef =
      doc(
        services.db,
        "socialProfiles",
        userId
      );

    const existing =
      await getDoc(
        socialProfileRef
      );

    const socialProfile:
      SocialProfile = {
      id: userId,
      userId,

      profileName:
        profile.profileName,

      imagePath:
        profile.imagePath,

      spiritualBio:
        profile.spiritualBio,

      heavenlyHashtag:
        profile.heavenlyHashtag,

      createdAt:
        profile.createdAt,

      updatedAt:
        profile.updatedAt
    };

    if (
      existing.exists()
    ) {
      /*
      * Update only mutable fields.
      *
      * Do NOT touch createdAt.
      */
      await updateDoc(
        socialProfileRef,
        {
          profileName:
            socialProfile.profileName,

          imagePath:
            socialProfile.imagePath,

          spiritualBio:
            socialProfile.spiritualBio,

          heavenlyHashtag:
            socialProfile.heavenlyHashtag,

          updatedAt:
            socialProfile.updatedAt
        }
      );
    } else {
      /*
      * Only a brand-new social
      * profile receives createdAt.
      */
      await setDoc(
        socialProfileRef,
        socialProfile
      );
    }

    return socialProfile;
  },

  async getSocialProfiles(
    currentUserId: string
  ): Promise<SocialProfile[]> {
    assertFirebaseOwner(currentUserId);

    const services = getFirebaseServices();
    if (!services) return [];

    const snapshot = await getDocs(
      collection(services.db, "socialProfiles")
    );

    return snapshot.docs
    .map((item) =>
      storedSocialProfile(item.id, item.data())
    )
    .filter(
      (profile): profile is SocialProfile =>
        profile !== null &&
        profile.userId !== currentUserId
    )
    .sort((a, b) =>
      a.profileName.localeCompare(b.profileName)
    );
  },

  async getSocialProfile(
    userId: string
  ): Promise<SocialProfile | null> {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) return null;

    const snapshot = await getDoc(
      doc(services.db, "socialProfiles", userId)
    );

    return snapshot.exists()
      ? storedSocialProfile(snapshot.id, snapshot.data())
      : null;
  },

  subscribeReflectionLikes(
    reflectionId: string,
    callback: (likes: ReflectionLike[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    const services = getFirebaseServices();

    if (!services?.auth.currentUser) {
      callback([]);
      return () => undefined;
    }

    return onSnapshot(
      query(
        collection(services.db, "reflectionLikes"),
        where("reflectionId", "==", reflectionId)
      ),
      (snapshot) => {
        callback(
          snapshot.docs
            .map((item) =>
              storedReflectionLike(
                item.id,
                item.data()
              )
            )
            .filter(
              (like): like is ReflectionLike =>
                like !== null
            )
        );
      },
      () => {
        onError("Likes could not be updated.");
      }
    );
  },

  subscribeReflectionComments(
    reflectionId: string,
    callback: (comments: ReflectionComment[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    const services = getFirebaseServices();

    if (!services?.auth.currentUser) {
      callback([]);
      return () => undefined;
    }

    return onSnapshot(
      query(
        collection(
          services.db,
          "reflectionComments"
        ),
        where(
          "reflectionId",
          "==",
          reflectionId
        )
      ),
      (snapshot) => {
        const comments =
          snapshot.docs
            .map((item) =>
              storedReflectionComment(
                item.id,
                item.data()
              )
            )
            .filter(
              (
                comment
              ): comment is ReflectionComment =>
                comment !== null
            )
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );

        callback(comments);
      },
      () => {
        onError(
          "Comments could not be updated."
        );
      }
    );
  },

  async toggleReflectionLike(
    userId: string,
    reflectionId: string
  ): Promise<boolean> {
    assertFirebaseOwner(userId);

    const services =
      getFirebaseServices();

    if (!services) {
      throw new Error(
        "Firebase is not available."
      );
    }

    const reflectionRef = doc(
      services.db,
      "reflectionPosts",
      reflectionId
    );

    const reflectionSnapshot =
      await getDoc(reflectionRef);

    if (!reflectionSnapshot.exists()) {
      throw new Error(
        "That reflection could not be found."
      );
    }

    const reflectionData =
      reflectionSnapshot.data();

    const postOwnerId =
      stringValue(
        reflectionData.userId
      );

    if (
      !postOwnerId ||
      reflectionData.isPrivate !== false
    ) {
      throw new Error(
        "That reflection is not available for social interaction."
      );
    }

    if (postOwnerId === userId) {
      throw new Error(
        "You cannot like your own reflection."
      );
    }

    /*
    * IMPORTANT:
    *
    * userId = person liking the post
    * postOwnerId = owner of the post
    *
    * A likes B:
    * follows/A_B must exist.
    *
    * B does NOT need to follow A.
    */
    const followId =
      `${userId}_${postOwnerId}`;

    const followSnapshot =
      await getDoc(
        doc(
          services.db,
          "follows",
          followId
        )
      );

    if (!followSnapshot.exists()) {
      throw new Error(
        "Follow this person before liking their reflection."
      );
    }

    const followData =
      followSnapshot.data();

    if (
      followData.followerId !== userId ||
      followData.followingId !== postOwnerId
    ) {
      throw new Error(
        "Follow this person before liking their reflection."
      );
    }

    const likeId =
      `${reflectionId}_${userId}`;

    const likeRef = doc(
      services.db,
      "reflectionLikes",
      likeId
    );

    return runTransaction(
      services.db,
      async (transaction) => {
        /*
        * Only read the Like document.
        *
        * Do NOT try to read a notification
        * that does not exist yet.
        */
        const likeSnapshot =
          await transaction.get(
            likeRef
          );

        /*
        * UNLIKE
        */
        if (likeSnapshot.exists()) {
          transaction.delete(
            likeRef
          );

          return false;
        }

        /*
        * LIKE
        */
        const createdAt =
          nowIso();

        const like: ReflectionLike = {
          id: likeId,
          reflectionId,
          postOwnerId,
          userId,
          createdAt
        };

        /*
        * Each Like event gets its own
        * notification ID.
        *
        * This means:
        * Like → Unlike → Like again
        * can generate another notification.
        */
        const notificationId =
          `like_${likeId}_${createdAt}`;

        const notification:
          SocialNotification = {
            id: notificationId,
            userId: postOwnerId,
            actorUserId: userId,
            type: "like",
            reflectionId,
            createdAt,
            readAt: null
          };

        const notificationRef =
          doc(
            services.db,
            "notifications",
            notificationId
          );

        transaction.set(
          likeRef,
          like
        );

        transaction.set(
          notificationRef,
          notification
        );

        return true;
      }
    );
  },

  async addReflectionComment(
    userId: string,
    reflectionId: string,
    rawContent: string
  ): Promise<ReflectionComment> {
    assertFirebaseOwner(userId);

    const content =
      cleanText(rawContent, 500);

    if (!content) {
      throw new Error(
        "Write a comment first."
      );
    }

    const services =
      getFirebaseServices();

    if (!services) {
      throw new Error(
        "Firebase is not available."
      );
    }

    const reflectionSnapshot =
      await getDoc(
        doc(
          services.db,
          "reflectionPosts",
          reflectionId
        )
      );

    if (!reflectionSnapshot.exists()) {
      throw new Error(
        "That reflection could not be found."
      );
    }

    const reflectionData =
      reflectionSnapshot.data();

    const postOwnerId =
      stringValue(
        reflectionData.userId
      );

    if (
      !postOwnerId ||
      reflectionData.isPrivate !== false
    ) {
      throw new Error(
        "That reflection is not available."
      );
    }

    if (postOwnerId === userId) {
      throw new Error(
        "You cannot comment on your own reflection."
      );
    }

    const followSnapshot =
      await getDoc(
        doc(
          services.db,
          "follows",
          `${userId}_${postOwnerId}`
        )
      );

    if (!followSnapshot.exists()) {
      throw new Error(
        "Follow this person before commenting."
      );
    }

    const commentRef = doc(
      collection(
        services.db,
        "reflectionComments"
      )
    );

    const createdAt = nowIso();

    const comment: ReflectionComment = {
      id: commentRef.id,
      reflectionId,
      postOwnerId,
      userId,
      content,
      createdAt,
      updatedAt: createdAt
    };

    const notification: SocialNotification = {
      id: `comment_${commentRef.id}`,
      userId: postOwnerId,
      actorUserId: userId,
      type: "comment",
      reflectionId,
      commentId: commentRef.id,
      createdAt,
      readAt: null
    };

    const batch =
      writeBatch(services.db);

    batch.set(
      commentRef,
      comment
    );

    batch.set(
      doc(
        services.db,
        "notifications",
        notification.id
      ),
      notification
    );

    await batch.commit();

    return comment;
  },

  async addReflectionReply(
    userId: string,
    reflectionId: string,
    parentCommentId: string,
    rawContent: string
  ): Promise<ReflectionComment> {
    assertFirebaseOwner(userId);

    const content =
      cleanText(rawContent, 500);

    if (!content) {
      throw new Error(
        "Write a reply first."
      );
    }

    const services =
      getFirebaseServices();

    if (!services) {
      throw new Error(
        "Firebase is not available."
      );
    }

    /*
    * First verify that the reflection
    * exists and is PUBLIC.
    */
    const reflectionSnapshot =
      await getDoc(
        doc(
          services.db,
          "reflectionPosts",
          reflectionId
        )
      );

    if (
      !reflectionSnapshot.exists()
    ) {
      throw new Error(
        "That reflection could not be found."
      );
    }

    const reflectionData =
      reflectionSnapshot.data();

    const postOwnerId =
      stringValue(
        reflectionData.userId
      );

    if (
      !postOwnerId ||
      reflectionData.isPrivate !== false
    ) {
      throw new Error(
        "That reflection is not available for replies."
      );
    }

    /*
    * Get the comment being replied to.
    */
    const parentSnapshot =
      await getDoc(
        doc(
          services.db,
          "reflectionComments",
          parentCommentId
        )
      );

    if (
      !parentSnapshot.exists()
    ) {
      throw new Error(
        "That comment could not be found."
      );
    }

    const parentComment =
      storedReflectionComment(
        parentSnapshot.id,
        parentSnapshot.data()
      );

    if (
      !parentComment ||
      parentComment.reflectionId
        !== reflectionId ||
      parentComment.postOwnerId
        !== postOwnerId
    ) {
      throw new Error(
        "That comment does not belong to this reflection."
      );
    }

    /*
    * Keep threads one level deep.
    *
    * Users can reply to normal comments,
    * but not create replies to replies.
    */

    const replyToUserId =
      parentComment.userId;

    const replyRef = doc(
      collection(
        services.db,
        "reflectionComments"
      )
    );

    const createdAt =
      nowIso();

    const reply:
      ReflectionComment = {
        id: replyRef.id,
        reflectionId,
        postOwnerId,
        userId,

        parentCommentId:
          parentComment.id,

        replyToUserId,

        content,
        createdAt,
        updatedAt: createdAt
      };

    const batch =
      writeBatch(
        services.db
      );

    batch.set(
      replyRef,
      reply
    );

    /*
    * Don't send someone a notification
    * for replying to their own comment.
    */
    if (
      replyToUserId !== userId
    ) {
      const notification:
        SocialNotification = {
          id:
            `reply_${replyRef.id}`,

          /*
          * Recipient = person whose
          * comment was replied to.
          */
          userId:
            replyToUserId,

          actorUserId:
            userId,

          type: "reply",

          reflectionId,

          commentId:
            replyRef.id,

          createdAt,
          readAt: null
        };

      batch.set(
        doc(
          services.db,
          "notifications",
          notification.id
        ),
        notification
      );
    }

    await batch.commit();

    return reply;
  },

  async followUser(
    followerId: string,
    followingId: string
  ): Promise<void> {
    assertFirebaseOwner(followerId);

    if (followerId === followingId) {
      throw new Error(
        "You cannot follow your own account."
      );
    }

    const services =
      getFirebaseServices();

    if (!services) {
      throw new Error(
        "Firebase is not available."
      );
    }

    const target = await getDoc(
      doc(
        services.db,
        "socialProfiles",
        followingId
      )
    );

    if (!target.exists()) {
      throw new Error(
        "That Saintagram user could not be found."
      );
    }

    const followId =
      `${followerId}_${followingId}`;

    const followRef = doc(
      services.db,
      "follows",
      followId
    );

    await runTransaction(
      services.db,
      async (transaction) => {
        const existingFollow =
          await transaction.get(followRef);

        // Already following:
        // do nothing and do NOT create another notification.
        if (existingFollow.exists()) {
          return;
        }

        const createdAt = nowIso();

        const relationship: FollowRelationship = {
          id: followId,
          followerId,
          followingId,
          createdAt
        };

        const notificationId =
          `${followId}_${createdAt}`;

        const notification: SocialNotification = {
          id: notificationId,
          userId: followingId,
          actorUserId: followerId,
          type: "follow",
          createdAt,
          readAt: null
        };

        const notificationRef = doc(
          services.db,
          "notifications",
          notificationId
        );

        transaction.set(
          followRef,
          relationship
        );

        transaction.set(
          notificationRef,
          notification
        );
      }
    );
  },

  async unfollowUser(
    followerId: string,
    followingId: string
  ): Promise<void> {
    assertFirebaseOwner(followerId);

    const services = getFirebaseServices();
    if (!services) {
      throw new Error("Firebase is not available.");
    }

    await deleteDoc(
      doc(
        services.db,
        "follows",
        `${followerId}_${followingId}`
      )
    );
  },

  async isFollowing(
    followerId: string,
    followingId: string
  ): Promise<boolean> {
    assertFirebaseOwner(followerId);

    const services = getFirebaseServices();
    if (!services) return false;

    const snapshot = await getDoc(
      doc(
        services.db,
        "follows",
        `${followerId}_${followingId}`
      )
    );

    return snapshot.exists();
  },

  async getFollowingIds(userId: string): Promise<string[]> {
    assertFirebaseOwner(userId);

    const services = getFirebaseServices();
    if (!services) return [];

    const snapshot = await getDocs(
      query(
        collection(services.db, "follows"),
        where("followerId", "==", userId)
      )
    );

    return snapshot.docs
      .map((item) =>
        storedFollowRelationship(item.id, item.data())
      )
      .filter(
        (relationship): relationship is FollowRelationship =>
          Boolean(relationship)
      )
      .map((relationship) => relationship.followingId);
  },

  async getFollowerIds(userId: string): Promise<string[]> {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) return [];

    const snapshot = await getDocs(
      query(
        collection(services.db, "follows"),
        where("followingId", "==", userId)
      )
    );

    return snapshot.docs
      .map((item) =>
        storedFollowRelationship(item.id, item.data())
      )
      .filter(
        (relationship): relationship is FollowRelationship =>
          Boolean(relationship)
      )
      .map((relationship) => relationship.followerId);
  },

  subscribeNotifications(
    userId: string,
    callback: (
      notifications: SocialNotification[]
    ) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured) {
      callback([]);
      return () => undefined;
    }

    assertFirebaseOwner(userId);

    const services =
      getFirebaseServices();

    if (!services) {
      onError(
        "Firebase is not available."
      );

      return () => undefined;
    }

    const notificationsQuery = query(
      collection(
        services.db,
        "notifications"
      ),
      where(
        "userId",
        "==",
        userId
      )
    );

    return onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notifications =
          snapshot.docs
            .map((item) =>
              storedSocialNotification(
                item.id,
                item.data()
              )
            )
            .filter(
              (
                notification
              ): notification is SocialNotification =>
                notification !== null
            )
            .sort(
              (a, b) =>
                new Date(
                  b.createdAt
                ).getTime() -
                new Date(
                  a.createdAt
                ).getTime()
            );

        callback(notifications);
      },
      (error) => {
        onError(
          error.code === "permission-denied"
            ? "You do not have permission to read these notifications."
            : "Notifications could not be updated. Check your connection."
        );
      }
    );
  },

  async markNotificationRead(
    userId: string,
    notificationId: string
  ): Promise<void> {
    if (!isFirebaseConfigured) {
      return;
    }

    assertFirebaseOwner(userId);

    const services =
      getFirebaseServices();

    if (!services) {
      throw new Error(
        "Firebase is not available."
      );
    }

    const notificationRef = doc(
      services.db,
      "notifications",
      notificationId
    );

    const snapshot =
      await getDoc(notificationRef);

    if (!snapshot.exists()) {
      return;
    }

    const notification =
      storedSocialNotification(
        snapshot.id,
        snapshot.data()
      );

    if (
      !notification ||
      notification.userId !== userId
    ) {
      throw new Error(
        "That notification could not be found."
      );
    }

    if (notification.readAt) {
      return;
    }

    await updateDoc(
      notificationRef,
      {
        readAt: nowIso()
      }
    );
  },

  async getPublicReflectionsByUser(
    profileUserId: string
  ): Promise<ReflectionPost[]> {
    const services = getFirebaseServices();

    if (!services?.auth.currentUser) {
      throw new Error("Please log in to view reflections.");
    }

    const snapshot = await getDocs(
      query(
        collection(services.db, "reflectionPosts"),
        where("userId", "==", profileUserId),
        where("isPrivate", "==", false)
      )
    );

    return snapshot.docs
      .map((item) =>
        storedReflection(item.id, item.data(), profileUserId)
      )
      .filter((post): post is ReflectionPost => Boolean(post))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
  },

  async getPublicReflectionById(
    reflectionId: string
  ): Promise<SocialFeedPost | null> {
    const services =
      getFirebaseServices();

    if (
      !services?.auth.currentUser
    ) {
      throw new Error(
        "Please log in to view this reflection."
      );
    }

    const reflectionSnapshot =
      await getDoc(
        doc(
          services.db,
          "reflectionPosts",
          reflectionId
        )
      );

    if (
      !reflectionSnapshot.exists()
    ) {
      return null;
    }

    const reflectionData =
      reflectionSnapshot.data();

    const postOwnerId =
      stringValue(
        reflectionData.userId
      );

    /*
    * Dedicated social reflection pages
    * are PUBLIC reflections only.
    */
    if (
      !postOwnerId ||
      reflectionData.isPrivate !== false
    ) {
      return null;
    }

    const post =
      storedReflection(
        reflectionSnapshot.id,
        reflectionData,
        postOwnerId
      );

    if (
      !post ||
      post.isPrivate
    ) {
      return null;
    }

    const profileSnapshot =
      await getDoc(
        doc(
          services.db,
          "socialProfiles",
          postOwnerId
        )
      );

    if (
      !profileSnapshot.exists()
    ) {
      return null;
    }

    const author =
      storedSocialProfile(
        profileSnapshot.id,
        profileSnapshot.data()
      );

    if (!author) {
      return null;
    }

    return {
      ...post,
      author
    };
  },

  async getFollowingFeed(
    userId: string
  ): Promise<SocialFeedPost[]> {
    assertFirebaseOwner(userId);

    const services = getFirebaseServices();
    if (!services) return [];

    const followingIds = await this.getFollowingIds(userId);

    if (!followingIds.length) return [];

    const profileSnapshots = await Promise.all(
      followingIds.map((id) =>
        getDoc(doc(services.db, "socialProfiles", id))
      )
    );

    const profiles = new Map<string, SocialProfile>();

    profileSnapshots.forEach((snapshot) => {
      if (!snapshot.exists()) return;

      const profile = storedSocialProfile(
        snapshot.id,
        snapshot.data()
      );

      if (profile) profiles.set(profile.userId, profile);
    });

    const postGroups = await Promise.all(
      followingIds.map(async (followingId) => {
        const snapshot = await getDocs(
          query(
            collection(services.db, "reflectionPosts"),
            where("userId", "==", followingId),
            where("isPrivate", "==", false)
          )
        );

        return snapshot.docs
          .map((item) =>
            storedReflection(item.id, item.data(), followingId)
          )
          .filter(
            (post): post is ReflectionPost => Boolean(post)
          );
      })
    );

    return postGroups
      .flat()
      .map((post) => {
        const author = profiles.get(post.userId);
        return author ? { ...post, author } : null;
      })
      .filter(
        (post): post is SocialFeedPost => Boolean(post)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
  },

  async getDiscoverFeed(
    userId: string
  ): Promise<SocialFeedPost[]> {
    assertFirebaseOwner(userId);

    const services =
      getFirebaseServices();

    if (!services) {
      return [];
    }

    const followingIds =
      await this.getFollowingIds(userId);

    const excludedUserIds =
      new Set<string>([
        userId,
        ...followingIds
      ]);

    const publicPostsSnapshot =
      await getDocs(
        query(
          collection(
            services.db,
            "reflectionPosts"
          ),
          where(
            "isPrivate",
            "==",
            false
          )
        )
      );

    const posts =
      publicPostsSnapshot.docs
        .map((item) => {
          const data = item.data();

          const postUserId =
            stringValue(data.userId);

          if (
            !postUserId ||
            excludedUserIds.has(
              postUserId
            )
          ) {
            return null;
          }

          return storedReflection(
            item.id,
            data,
            postUserId
          );
        })
        .filter(
          (
            post
          ): post is ReflectionPost =>
            post !== null
        );

    const authorIds =
      Array.from(
        new Set(
          posts.map(
            (post) => post.userId
          )
        )
      );

    const profileSnapshots =
      await Promise.all(
        authorIds.map((authorId) =>
          getDoc(
            doc(
              services.db,
              "socialProfiles",
              authorId
            )
          )
        )
      );

    const profiles =
      new Map<
        string,
        SocialProfile
      >();

    profileSnapshots.forEach(
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const profile =
          storedSocialProfile(
            snapshot.id,
            snapshot.data()
          );

        if (profile) {
          profiles.set(
            profile.userId,
            profile
          );
        }
      }
    );

    return posts
      .map((post) => {
        const author =
          profiles.get(post.userId);

        return author
          ? {
              ...post,
              author
            }
          : null;
      })
      .filter(
        (
          post
        ): post is SocialFeedPost =>
          post !== null
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      );
  },

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
      let active = true;
      let unsubscribe: Unsubscribe | null = null;
      void services.persistenceReady.then(() => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(services.auth, async (firebaseUser) => {
          if (!firebaseUser) {
            callback(null);
            return;
          }
          const usesPassword = firebaseUser.providerData.some(
            (provider) => provider.providerId === "password"
          );
          if (usesPassword && !firebaseUser.emailVerified) {
            callback(null);
            return;
          }
          try {
            callback(
              await getFirebaseUserRecord(
                firebaseUser.uid,
                firebaseUser.email ?? "",
                firebaseUser.isAnonymous
                  ? "guest"
                  : firebaseUser.providerData.some(
                        (provider) => provider.providerId === "google.com"
                      )
                    ? "google"
                    : "password"
              )
            );
          } catch {
            callback(null);
          }
        });
      });
      return () => {
        active = false;
        unsubscribe?.();
      };
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
    if (isFirebaseConfigured) {
      const invalidEmail = registrationEmailError(email);
      if (invalidEmail) throw new Error(invalidEmail);
    }

    try {
      if (isFirebaseConfigured) {
        const services = getFirebaseServices();

        if (!services) {
          throw new Error("Firebase is not available.");
        }

        await services.persistenceReady;

        const credential = await createUserWithEmailAndPassword(
          services.auth,
          email.trim(),
          password
        );

        const user = createUserRecord(
          credential.user.uid,
          credential.user.email ?? email,
          "password"
        );

        try {
          await sendEmailVerification(
            credential.user,
            emailActionSettings("/auth?mode=login&verified=1")
          );

          return user;
        } catch (verificationError) {
          // Registration is not considered complete if Saintagram
          // cannot send the verification email.
          try {
            await deleteUser(credential.user);
          } catch (cleanupError) {
            console.error(
              "Could not clean up failed registration.",
              cleanupError
            );
          }

          throw verificationError;
        } finally {
          if (services.auth.currentUser) {
            await signOut(services.auth);
          }
        }
      }

      await ensureLocalSeed();

      const normalizedEmail = email.trim().toLocaleLowerCase();
      const accounts = localAccounts();

      if (
        accounts.some(
          (account) => account.user.email === normalizedEmail
        )
      ) {
        throw Object.assign(new Error(), {
          code: "auth/email-already-in-use"
        });
      }

      const user = createUserRecord(
        newId("local-"),
        normalizedEmail
      );

      accounts.push({
        user,
        passwordHash: await hashPassword(password)
      });

      saveLocalAccounts(accounts);
      writeSessionUid(user.id);

      return user;
    } catch (error) {
      console.error("GUEST ACCOUNT FAILED:", error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Guest account creation failed.");
    }
  },

  async login(email: string, password: string): Promise<AppUser> {
    try {
      if (isFirebaseConfigured) {
        const services = getFirebaseServices();
        if (!services) throw new Error("Firebase is not available.");
        await services.persistenceReady;
        const credential = await signInWithEmailAndPassword(
          services.auth,
          email.trim(),
          password
        );
        await credential.user.reload();
        if (!credential.user.emailVerified) {
          try {
            await sendEmailVerification(
              credential.user,
              emailActionSettings("/auth?mode=login&verified=1")
            );
          } finally {
            await signOut(services.auth);
          }
          throw Object.assign(new Error(), { code: "auth/email-not-verified" });
        }
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
      writeSessionUid(account.user.id);
      return account.user;
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async signInWithGoogle(): Promise<AppUser> {
    try {
      const services = getFirebaseServices();
      if (!services) throw new Error("Google sign-in is currently unavailable.");
      await services.persistenceReady;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(services.auth, provider);
      return await getFirebaseUserRecord(
        credential.user.uid,
        credential.user.email ?? "",
        "google"
      );
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async continueAsGuest(): Promise<AppUser> {
    try {
      const services = getFirebaseServices();

      if (!services) {
        throw new Error("Guest access is currently unavailable.");
      }

      await services.persistenceReady;

      if (services.auth.currentUser?.isAnonymous) {
        return await getFirebaseUserRecord(
          services.auth.currentUser.uid,
          "",
          "guest"
        );
      }

      const credential = await signInAnonymously(services.auth);

      return await getFirebaseUserRecord(
        credential.user.uid,
        "",
        "guest"
      );
    } catch (error) {
      console.error("GUEST ACCOUNT FAILED:", error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Guest account creation failed.");
    }
  },

  async upgradeGuestWithGoogle(): Promise<AppUser> {
    try {
      const services = getFirebaseServices();
      const guest = services?.auth.currentUser;
      if (!services || !guest?.isAnonymous) {
        throw new Error("Only a guest account can be upgraded.");
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await linkWithPopup(guest, provider);
      await credential.user.getIdToken(true);
      return await getFirebaseUserRecord(
        credential.user.uid,
        credential.user.email ?? "",
        "google"
      );
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async upgradeGuestWithEmail(email: string, password: string): Promise<void> {
    const invalidEmail = registrationEmailError(email);
    if (invalidEmail) throw new Error(invalidEmail);
    try {
      const services = getFirebaseServices();
      const guest = services?.auth.currentUser;
      if (!services || !guest?.isAnonymous) {
        throw new Error("Only a guest account can be upgraded.");
      }
      const credential = await linkWithCredential(
        guest,
        EmailAuthProvider.credential(email.trim(), password)
      );
      try {
        await sendEmailVerification(
          credential.user,
          emailActionSettings("/auth?mode=login&verified=1")
        );
      } finally {
        await signOut(services.auth);
      }
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  async logout(): Promise<void> {
    if (isFirebaseConfigured) {
      const services = getFirebaseServices();
      if (services) {
        const currentUser = services.auth.currentUser;
        const userId = currentUser?.uid;
        if (currentUser?.isAnonymous && userId) {
          await this.deleteAllUserData(userId, "");
          if (storageAvailable()) {
            window.localStorage.removeItem(firebaseDraftCacheKey(userId));
          }
          return;
        }
        await signOut(services.auth);
        if (userId && storageAvailable()) {
          window.localStorage.removeItem(firebaseDraftCacheKey(userId));
        }
      }
      return;
    }
    writeSessionUid(null);
  },

  async requestPasswordReset(email: string): Promise<void> {
    try {
      if (isFirebaseConfigured) {
        const services = getFirebaseServices();
        if (!services) throw new Error("Firebase is not available.");
        await sendPasswordResetEmail(
          services.auth,
          email.trim(),
          emailActionSettings("/auth?mode=login&reset=sent")
        );
        return;
      }
      await ensureLocalSeed();
      const exists = localAccounts().some(
        (account) => account.user.email === email.trim().toLocaleLowerCase()
      );
      // Return the same result whether or not the demo account exists.
      void exists;
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      if (code === "auth/user-not-found") return;
      throw friendlyAuthError(error);
    }
  },

  subscribeReflections(
    userId: string,
    visibility: "public" | "private" | "all",
    callback: (posts: ReflectionPost[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) {
        onError("Firebase is not available.");
        return () => undefined;
      }
      const constraints =
        visibility === "all"
          ? [where("userId", "==", userId)]
          : [
              where("userId", "==", userId),
              where("isPrivate", "==", visibility === "private")
            ];
      return onSnapshot(
        query(collection(services.db, "reflectionPosts"), ...constraints),
        (snapshot) => {
          const posts = snapshot.docs
            .map((item) => storedReflection(item.id, item.data(), userId))
            .filter((post): post is ReflectionPost => Boolean(post));
          callback(newestFirst(posts));
        },
        (error) => {
          onError(
            error.code === "permission-denied"
              ? "You do not have permission to read these reflections."
              : "Live reflection updates were interrupted. Check your connection."
          );
        }
      );
    }

    assertLocalOwner(userId);
    const read = () => {
      const posts = Object.values(
        readJson<JsonMap<ReflectionPost>>(LOCAL_KEYS.reflections, {})
      ).filter(
        (post) =>
          post.userId === userId &&
          (visibility === "all" ||
            post.isPrivate === (visibility === "private"))
      );
      callback(newestFirst(posts));
    };
    read();
    const listener = (event: StorageEvent) => {
      if (event.key === LOCAL_KEYS.reflections) read();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
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

  subscribeProfile(
    userId: string,
    callback: (profile: PublicSpiritualProfile | null) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) {
        onError("Firebase is not available.");
        return () => undefined;
      }
      return onSnapshot(
        doc(services.db, "profiles", userId),
        (snapshot) => {
          callback(
            snapshot.exists()
              ? storedPublicProfile(snapshot.data(), userId)
              : null
          );
        },
        (error) => {
          onError(
            error.code === "permission-denied"
              ? "You do not have permission to read this profile."
              : "Live profile updates were interrupted. Check your connection."
          );
        }
      );
    }

    assertLocalOwner(userId);
    const read = () => {
      const profile = readJson<JsonMap<PublicSpiritualProfile>>(
        LOCAL_KEYS.profiles,
        {}
      )[userId];
      callback(profile ? storedPublicProfile(profile, userId) : null);
    };
    read();
    const listener = (event: StorageEvent) => {
      if (event.key === LOCAL_KEYS.profiles) read();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
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
        coverColor: "#DDD2F6",
        imagePath: data.imagePath,
        selectedSymbol: data.selectedSymbol,
        spiritualBio: data.spiritualBio,
        spiritualGuides: data.spiritualGuides,
        lifeDirections: data.lifeDirections,
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
      data.onboardingPosts.forEach((content, index) => {
        const postRef = doc(collection(services.db, "reflectionPosts"));
        const post: ReflectionPost = {
          id: postRef.id,
          userId,
          title: data.onboardingPostTitles?.[index] || `Moment ${index + 1}`,
          content,
          isPrivate: false,
          createdAt: now,
          updatedAt: now
        };
        batch.set(postRef, {
          ...post,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      await this.saveSocialProfile(userId, fullProfile);
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
      coverColor: "#DDD2F6",
      imagePath: data.imagePath,
      selectedSymbol: data.selectedSymbol,
      spiritualBio: data.spiritualBio,
      spiritualGuides: data.spiritualGuides,
      lifeDirections: data.lifeDirections,
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
    data.onboardingPosts.forEach((content, index) => {
      const id = newId("reflection-");
      reflections[id] = {
        id,
        userId,
        title: data.onboardingPostTitles?.[index] || `Moment ${index + 1}`,
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

    const updated:
      SpiritualProfile = {
      ...profile,

      id: userId,
      userId,

      profileName:
        cleanText(
          profile.profileName,
          LIMITS.profileName
        ),

      coverColor:
        normalizeCoverColor(
          profile.coverColor ??
            ""
        ),

      imagePath:
        normalizeProfileImageReference(
          profile.imagePath
        ),

      spiritualBio:
        cleanText(
          profile.spiritualBio,
          LIMITS.bio
        ),

      spiritualGuides:
        normalizeList(
          profile.spiritualGuides
        ),

      lifeDirections:
        normalizeList(
          profile.lifeDirections
        ),

      heartSeeks:
        normalizeList(
          profile.heartSeeks
        ),

      godsComment:
        cleanText(
          profile.godsComment,
          LIMITS.godsComment
        ),

      heavenlyHashtag:
        normalizeHashtag(
          profile.heavenlyHashtag
        ),

      hiddenStory:
        cleanText(
          profile.hiddenStory,
          LIMITS.hiddenStory
        ),

      updatedAt: now
    };

    if (!updated.profileName) {
      throw new Error(
        "Profile name is required."
      );
    }

    /*
    * Cover color is currently
    * stored locally rather than
    * inside the Firestore profile.
    */
    const coverColors =
      readJson<
        JsonMap<string>
      >(
        LOCAL_KEYS.coverColors,
        {}
      );

    coverColors[userId] =
      updated.coverColor ??
      "#DDD2F6";

    writeJson(
      LOCAL_KEYS.coverColors,
      coverColors
    );

    /*
    * FIREBASE
    */
    if (isFirebaseConfigured) {
      assertFirebaseOwner(
        userId
      );

      assertStoredProfileImagePath(
        userId,
        updated.imagePath
      );

      const services =
        getFirebaseServices();

      if (!services) {
        throw new Error(
          "Firebase is not available."
        );
      }

      /*
      * Get the complete OLD profile
      * before changing anything.
      *
      * getFullProfile includes the
      * private Hidden Story.
      */
      const existing =
        await this.getFullProfile(
          userId
        );

      if (!existing) {
        throw new Error(
          "Your existing profile could not be found."
        );
      }

      /*
      * Determine exactly what the
      * user changed for Journey.
      */
      const changes =
        profileJourneyChanges(
          existing,
          updated
        );

      const profileImageChanged =
        existing.imagePath !==
        updated.imagePath;

      const profileRef =
        doc(
          services.db,
          "profiles",
          userId
        );

      const privateProfileRef =
        doc(
          services.db,
          "privateProfiles",
          userId
        );

      const userRef =
        doc(
          services.db,
          "users",
          userId
        );

      const socialProfileRef =
        doc(
          services.db,
          "socialProfiles",
          userId
        );

      /*
      * Check whether the public
      * social profile already exists.
      *
      * Existing profile:
      *   UPDATE only mutable fields.
      *
      * Missing profile:
      *   CREATE the full document.
      */
      const socialProfileSnapshot =
        await getDoc(
          socialProfileRef
        );

      const batch =
        writeBatch(
          services.db
        );

      /*
      * MAIN PROFILE
      *
      * IMPORTANT:
      * Do NOT write createdAt here.
      *
      * Firestore keeps the original
      * createdAt automatically.
      */
      batch.update(
        profileRef,
        {
          profileName:
            updated.profileName,

          imagePath:
            updated.imagePath,

          selectedSymbol:
            updated.selectedSymbol,

          spiritualBio:
            updated.spiritualBio,

          spiritualGuides:
            updated.spiritualGuides,

          lifeDirections:
            updated.lifeDirections,

          heartSeeks:
            updated.heartSeeks,

          godsComment:
            updated.godsComment,

          heavenlyHashtag:
            updated.heavenlyHashtag,

          /*
          * Remove OLD profile field names.
          *
          * Older Saintagram profiles used:
          * followers -> spiritualGuides
          * following -> lifeDirections
          *
          * The current Firestore rules no
          * longer permit the old keys.
          */
          followers:
            deleteField(),

          following:
            deleteField(),

          updatedAt: now
        }
      );

      /*
      * PRIVATE PROFILE
      */
      batch.set(
        privateProfileRef,
        {
          userId,

          hiddenStory:
            updated.hiddenStory,

          updatedAt: now
        }
      );

      /*
      * USER ACCOUNT METADATA
      */
      batch.update(
        userRef,
        {
          updatedAt: now
        }
      );

      /*
      * SOCIAL PROFILE
      */
      if (
        socialProfileSnapshot.exists()
      ) {
        /*
        * Existing social profile.
        *
        * Do NOT rewrite createdAt.
        */
        batch.update(
          socialProfileRef,
          {
            profileName:
              updated.profileName,

            imagePath:
              updated.imagePath,

            spiritualBio:
              updated.spiritualBio,

            heavenlyHashtag:
              updated.heavenlyHashtag,

            updatedAt: now
          }
        );
      } else {
        /*
        * Social profile does not
        * exist yet, so create it.
        */
        const socialProfile:
          SocialProfile = {
          id: userId,
          userId,

          profileName:
            updated.profileName,

          imagePath:
            updated.imagePath,

          spiritualBio:
            updated.spiritualBio,

          heavenlyHashtag:
            updated.heavenlyHashtag,

          createdAt:
            updated.createdAt,

          updatedAt: now
        };

        batch.set(
          socialProfileRef,
          socialProfile
        );
      }

      /*
      * JOURNEY HISTORY
      *
      * Record the actual saved image path
      * when the profile picture changes.
      */
      if (changes.length > 0) {
        const eventRef =
          doc(
            collection(
              services.db,
              "profileJourneyEvents"
            )
          );

        batch.set(
          eventRef,
          {
            id: eventRef.id,

            userId,

            changes,

            ...(profileImageChanged &&
            updated.imagePath
              ? {
                  imagePath:
                    updated.imagePath
                }
              : {}),

            createdAt: now
          }
        );
      }

      /*
      * All Firestore changes happen
      * together.
      */
      await batch.commit();

      await cleanupReplacedProfileImage(
        userId,
        existing.imagePath ??
          "",
        updated.imagePath
      );

      return updated;
    }

    /*
    * LOCAL / DEMO MODE
    */
    assertLocalOwner(
      userId
    );

    const profiles =
      readJson<
        JsonMap<
          PublicSpiritualProfile
        >
      >(
        LOCAL_KEYS.profiles,
        {}
      );

    profiles[userId] =
      toPublicProfile(
        updated
      );

    writeJson(
      LOCAL_KEYS.profiles,
      profiles
    );

    const privateProfiles =
      readJson<
        JsonMap<
          PrivateProfileRecord
        >
      >(
        LOCAL_KEYS.privateProfiles,
        {}
      );

    privateProfiles[
      userId
    ] = {
      userId,

      hiddenStory:
        updated.hiddenStory,

      updatedAt: now
    };

    writeJson(
      LOCAL_KEYS.privateProfiles,
      privateProfiles
    );

    await this.updateUser(
      userId,
      {}
    );

    return updated;
  },

  async uploadProfileImage(userId: string, file: File): Promise<string> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const imagePath = await uploadFirebaseProfileImage(userId, file);
      await this.recordProfileImageHistory(userId, imagePath);
      return imagePath;
    }

    assertLocalOwner(userId);
    const now = nowIso();
    const imagePath = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("The image could not be read."));
      reader.readAsDataURL(file);
    });
    writeLocalProfileImageHistoryEntry({
      id: newId("profile-image-"),
      userId,
      imagePath,
      createdAt: now,
      updatedAt: now
    });
    return imagePath;
  },

  async deleteProfileImage(userId: string, imagePath: string): Promise<void> {
    if (!imagePath) return;
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      if (await hasFirebaseProfileImageReference(userId, imagePath)) return;
      await deleteFirebaseProfileImage(userId, imagePath);
    }
  },

  async recordProfileImageHistory(
    userId: string,
    imagePath: string
  ): Promise<void> {
    const now = nowIso();

    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);

      const services = getFirebaseServices();
      if (!services) {
        throw new Error("Firebase is not available.");
      }

      const historyRef = doc(
        collection(services.db, "profileImageHistory")
      );

      await setDoc(historyRef, {
        id: historyRef.id,
        userId,
        imagePath,
        createdAt: now,
        updatedAt: now
      });

      return;
    }

    assertLocalOwner(userId);

    const historyId = newId("profile-image-");

    writeLocalProfileImageHistoryEntry({
      id: historyId,
      userId,
      imagePath,
      createdAt: now,
      updatedAt: now
    });
  },

  async getProfileImageHistory(
    userId: string
  ): Promise<ProfileImageHistoryEntry[]> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) return [];
      const snapshot = await getDocs(
        query(
          collection(services.db, "profileImageHistory"),
          where("userId", "==", userId)
        )
      );
      return newestImageHistoryFirst(
        snapshot.docs
          .map((item) =>
            storedProfileImageHistoryEntry(item.id, item.data(), userId)
          )
          .filter((entry): entry is ProfileImageHistoryEntry => Boolean(entry))
      );
    }

    assertLocalOwner(userId);
    return newestImageHistoryFirst(
      readLocalProfileImageHistory(userId)
        .filter((entry) => entry.userId === userId)
        .map((entry) => ({ ...entry }))
    );
  },

  subscribeProfileImageHistory(
    userId: string,
    callback: (entries: ProfileImageHistoryEntry[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) {
        onError("Firebase is not available.");
        return () => undefined;
      }
      return onSnapshot(
        query(
          collection(services.db, "profileImageHistory"),
          where("userId", "==", userId)
        ),
        (snapshot) => {
          callback(
            newestImageHistoryFirst(
              snapshot.docs
                .map((item) =>
                  storedProfileImageHistoryEntry(item.id, item.data(), userId)
                )
                .filter((entry): entry is ProfileImageHistoryEntry => Boolean(entry))
            )
          );
        },
        (error) => {
          onError(
            error.code === "permission-denied"
              ? "You do not have permission to read this history."
              : "Live profile picture updates were interrupted. Check your connection."
          );
        }
      );
    }

    assertLocalOwner(userId);
    const read = () => {
      callback(
        newestImageHistoryFirst(
          readLocalProfileImageHistory(userId).filter((entry) => entry.userId === userId)
        )
      );
    };
    read();
    const listener = (event: StorageEvent) => {
      if (event.key === localProfileImageHistoryKey(userId)) read();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
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
      posts = snapshot.docs
        .map((item) => storedReflection(item.id, item.data(), userId))
        .filter((post): post is ReflectionPost => Boolean(post));
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
        .map((item) => storedReflection(item.id, item.data(), userId))
        .filter((post): post is ReflectionPost => Boolean(post))
        .sort((a, b) =>
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
        .map((item) => storedReflection(item.id, item.data(), userId))
        .filter((post): post is ReflectionPost => Boolean(post))
        .sort((a, b) =>
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
      title?: string;
      createdAt?: string;
      fiatCategory?: unknown;
    }
  ): Promise<ReflectionPost> {
    const content = cleanText(input.content, LIMITS.post);
    const title = cleanText(input.title ?? "", LIMITS.momentTitle);
    if (!content) throw new Error("Write a short moment before saving.");
    const now = nowIso();
    const requestedCreatedAt = input.createdAt ?? now;
    if (Number.isNaN(Date.parse(requestedCreatedAt))) {
      throw new Error("Choose a valid creation date.");
    }
    const normalizedCreatedAt = new Date(requestedCreatedAt).toISOString();
    if (input.fiatCategory !== undefined && input.fiatCategory !== "" && !isFiatCategory(input.fiatCategory)) {
      throw new Error("Choose a valid FiAt category.");
    }
    const fiatCategory = isFiatCategory(input.fiatCategory) ? input.fiatCategory : undefined;
    const fiatDateKey = fiatCategory ? localDateKey(normalizedCreatedAt) : undefined;

    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      const postRef = input.id
        ? doc(services.db, "reflectionPosts", input.id)
        : doc(collection(services.db, "reflectionPosts"));
      const createdAt = normalizedCreatedAt;
      if (input.id) {
        const existing = await getDoc(postRef);
        if (!existing.exists() || existing.data().userId !== userId) {
          throw new Error("That reflection could not be found.");
        }
      }
      const post: ReflectionPost = {
        id: postRef.id,
        userId,
        title,
        content,
        isPrivate: input.isPrivate,
        createdAt,
        updatedAt: now,
        ...(input.id ? { editedAt: now } : {})
        ,...(fiatCategory ? { fiatCategory, fiatDateKey } : {})
      };
      await setDoc(postRef, {
        ...post,
        createdAt: new Date(createdAt),
        updatedAt: serverTimestamp(),
        ...(input.id ? { editedAt: serverTimestamp() } : {})
      });
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
    const existingCreatedAt = input.id
      ? reflections[input.id]?.createdAt
      : undefined;
    const post: ReflectionPost = {
      id,
      userId,
      title,
      content,
      isPrivate: input.isPrivate,
      createdAt: input.createdAt
        ? normalizedCreatedAt
        : existingCreatedAt ?? now,
      updatedAt: now,
      ...(input.id ? { editedAt: now } : {})
      ,...(fiatCategory ? { fiatCategory, fiatDateKey } : {})
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

  async cancelAccountCreation(userId: string): Promise<void> {
    if (isFirebaseConfigured) {
      assertFirebaseOwner(userId);
      const services = getFirebaseServices();
      if (!services) throw new Error("Firebase is not available.");
      const firebaseUser = services.auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== userId) {
        throw new Error("Please log in again.");
      }

      const userRecord = await this.refreshUser(userId);
      if (userRecord.profileCompleted) {
        throw new Error(
          "A completed account must be deleted from Settings."
        );
      }

      const usesGoogle = firebaseUser.providerData.some(
        (provider) => provider.providerId === "google.com"
      );
      if (usesGoogle) {
        try {
          const provider = new GoogleAuthProvider();
          if (firebaseUser.email) {
            provider.setCustomParameters({ login_hint: firebaseUser.email });
          }
          await reauthenticateWithPopup(firebaseUser, provider);
        } catch (reauthenticationError) {
          throw friendlyAuthError(reauthenticationError);
        }
      }

      try {
        await deleteAllFirebaseProfileImages(userId);
      } catch (imageCleanupError) {
        if (await hasStoredProfileImageReference(userId)) {
          console.error("Private image cleanup failed during cancellation.", imageCleanupError);
          throw new Error(
            "Your uploaded images could not be removed, so cancellation stopped. Please try again."
          );
        }
      }

      try {
        await deleteFirebaseOwnedDocuments(userId);
        await deleteUser(firebaseUser);
      } catch (cancellationError) {
        console.error("Account creation cancellation failed.", cancellationError);
        const code =
          typeof cancellationError === "object" &&
          cancellationError &&
          "code" in cancellationError
            ? String(cancellationError.code)
            : "";
        if (code.startsWith("auth/")) {
          throw friendlyAuthError(cancellationError);
        }
        throw new Error("The account could not be removed. Please try again.");
      }
      if (storageAvailable()) {
        window.localStorage.removeItem(firebaseDraftCacheKey(userId));
      }
      return;
    }

    assertLocalOwner(userId);
    const account = localAccounts().find((item) => item.user.id === userId);
    if (!account) throw new Error("That account could not be found.");
    if (account.user.profileCompleted) {
      throw new Error("A completed account must be deleted from Settings.");
    }

    saveLocalAccounts(
      localAccounts().filter((item) => item.user.id !== userId)
    );
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
    writeSessionUid(null);
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
      if (!firebaseUser) throw new Error("Please log in again.");
      const usesPassword = firebaseUser.providerData.some(
        (provider) => provider.providerId === "password"
      );
      if (usesPassword && firebaseUser.email) {
        try {
          await reauthenticateWithCredential(
            firebaseUser,
            EmailAuthProvider.credential(firebaseUser.email, currentPassword)
          );
        } catch (error) {
          throw friendlyAuthError(error);
        }
      }
      // Remove Firebase Storage first. If this fails, retain the account and
      // Firestore records so the owner can retry without orphaning image data.
      try {
        await deleteAllFirebaseProfileImages(userId);
      } catch (imageCleanupError) {
        if (await hasStoredProfileImageReference(userId)) {
          console.error("Private image cleanup failed during account deletion.", imageCleanupError);
          throw new Error(
            "Your profile image could not be removed, so account deletion stopped. Please try again."
          );
        }
      }

      await deleteFirebaseOwnedDocuments(userId);
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
    removeUserEntry<LocalProfileImageHistoryEntry>(
      LOCAL_KEYS.profileImageHistory
    );
    writeSessionUid(null);
  }
};
