import { getFirebaseServices } from "@/lib/firebase";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  PROFILE_IMAGES_BUCKET
} from "@/lib/supabase";
import { validateImage } from "@/lib/validation";

const PROFILE_IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

const LOCAL_IMAGE_SOURCE =
  /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;
const FIREBASE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const PROFILE_IMAGE_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

interface AuthorizedStorage {
  userId: string;
  client: NonNullable<ReturnType<typeof getSupabaseClient>>;
  firebaseUser: {
    uid: string;
    getIdToken(forceRefresh?: boolean): Promise<string>;
  };
}

function imageStorageStatus(error: unknown): {
  status: number;
  detail: string;
} {
  const record =
    typeof error === "object" && error
      ? (error as Record<string, unknown>)
      : {};
  return {
    status: Number(record.statusCode ?? record.status ?? 0),
    detail: `${String(record.message ?? "")} ${String(
      record.error ?? ""
    )}`.toLocaleLowerCase()
  };
}

function isImageAuthorizationError(error: unknown): boolean {
  const { status, detail } = imageStorageStatus(error);
  return (
    status === 401 ||
    status === 403 ||
    detail.includes("invalid jwt") ||
    detail.includes("row-level security") ||
    detail.includes("unauthorized")
  );
}

function profileImageError(action: string, error: unknown): Error {
  const { status, detail } = imageStorageStatus(error);

  console.error(`Supabase profile image ${action} failed.`, error);

  if (status === 413 || detail.includes("maximum allowed size")) {
    return new Error("Choose an image no larger than 2 MB.");
  }
  if (status === 401 || detail.includes("invalid jwt")) {
    return new Error(
      "Image storage could not verify your sign-in. Sign out, sign in again, and retry."
    );
  }
  if (
    status === 403 ||
    detail.includes("row-level security") ||
    detail.includes("unauthorized")
  ) {
    return new Error(
      "Image storage access is not configured for this account. The site owner must apply the Supabase image-access migration."
    );
  }
  if (status === 404 || detail.includes("bucket not found")) {
    return new Error(
      "The private image bucket is missing. The site owner must apply the Supabase image-storage migration."
    );
  }
  if (detail.includes("failed to fetch") || detail.includes("network")) {
    return new Error(
      "Image storage could not be reached. Check your connection and try again."
    );
  }
  return new Error(`The profile image could not be ${action}. Please try again.`);
}

async function refreshImageAccess(
  firebaseUser: AuthorizedStorage["firebaseUser"]
): Promise<boolean> {
  try {
    await firebaseUser.getIdToken(true);
    return true;
  } catch {
    return false;
  }
}

async function storageRequest<T extends { error: unknown }>(
  storage: AuthorizedStorage,
  request: () => PromiseLike<T>
): Promise<T> {
  let result = await request();
  if (
    result.error &&
    isImageAuthorizationError(result.error) &&
    (await refreshImageAccess(storage.firebaseUser))
  ) {
    result = await request();
  }
  return result;
}

function assertSafeFirebaseUid(userId: string): void {
  if (!FIREBASE_UID.test(userId)) {
    throw new Error("The signed-in account has an unsupported user ID.");
  }
}

async function authorizedStorage(
  expectedUserId?: string
): Promise<AuthorizedStorage> {
  const services = getFirebaseServices();
  const firebaseUser = services?.auth.currentUser;
  if (!firebaseUser) {
    throw new Error("Please log in before accessing profile images.");
  }
  if (expectedUserId && firebaseUser.uid !== expectedUserId) {
    throw new Error("You can only access your own Saintagram images.");
  }
  assertSafeFirebaseUid(firebaseUser.uid);

  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase image storage is not configured. Add the project URL and publishable key."
    );
  }
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase image storage is not available in this browser.");
  }

  // Supabase accepts Firebase JWTs directly. Firebase tokens do not normally
  // contain Supabase's `role` claim, so storage RLS authorizes the verified
  // token by issuer and subject instead of mutating Firebase custom claims.
  await firebaseUser.getIdToken();
  return { userId: firebaseUser.uid, client, firebaseUser };
}

export function profileImageFolder(userId: string): string {
  assertSafeFirebaseUid(userId);
  return `users/${userId}/profile`;
}

export function isOwnedProfileImagePath(
  imagePath: string,
  userId: string
): boolean {
  if (!FIREBASE_UID.test(userId)) return false;
  const prefix = `${profileImageFolder(userId)}/`;
  return (
    imagePath.startsWith(prefix) &&
    PROFILE_IMAGE_FILE.test(imagePath.slice(prefix.length))
  );
}

export function isLocalProfileImageSource(value: string): boolean {
  return LOCAL_IMAGE_SOURCE.test(value);
}

export async function uploadSupabaseProfileImage(
  userId: string,
  file: File
): Promise<string> {
  const validationError = validateImage(file);
  if (validationError) throw new Error(validationError);

  const extension =
    PROFILE_IMAGE_MIME_EXTENSIONS[
      file.type as keyof typeof PROFILE_IMAGE_MIME_EXTENSIONS
    ];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP image.");

  const storage = await authorizedStorage(userId);
  const { client } = storage;
  const imagePath =
    `${profileImageFolder(userId)}/${crypto.randomUUID()}.${extension}`;
  const { error } = await storageRequest(storage, () =>
    client.storage.from(PROFILE_IMAGES_BUCKET).upload(imagePath, file, {
      cacheControl: "300",
      contentType: file.type,
      upsert: false
    })
  );
  if (error) throw profileImageError("uploaded", error);
  return imagePath;
}

export async function downloadSupabaseProfileImage(
  imagePath: string
): Promise<Blob> {
  const storage = await authorizedStorage();
  const { userId, client } = storage;
  if (!isOwnedProfileImagePath(imagePath, userId)) {
    throw new Error("That profile image does not belong to this account.");
  }
  const { data, error } = await storageRequest(storage, () =>
    client.storage.from(PROFILE_IMAGES_BUCKET).download(imagePath)
  );
  if (error || !data) throw profileImageError("downloaded", error);
  return data;
}

export async function deleteSupabaseProfileImage(
  userId: string,
  imagePath: string
): Promise<void> {
  if (!imagePath || isLocalProfileImageSource(imagePath)) return;
  if (!isOwnedProfileImagePath(imagePath, userId)) {
    throw new Error("That profile image does not belong to this account.");
  }
  const storage = await authorizedStorage(userId);
  const { client } = storage;
  const { error } = await storageRequest(storage, () =>
    client.storage.from(PROFILE_IMAGES_BUCKET).remove([imagePath])
  );
  if (error) throw profileImageError("removed", error);
}

export async function deleteAllSupabaseProfileImages(
  userId: string
): Promise<void> {
  const { client } = await authorizedStorage(userId);
  const folder = profileImageFolder(userId);

  for (let page = 0; page < 1_000; page += 1) {
    const { data, error } = await client.storage
      .from(PROFILE_IMAGES_BUCKET)
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" }
      });
    if (error) throw profileImageError("listed for removal", error);

    const entries = data ?? [];
    if (!entries.length) return;
    const nestedFolders = entries.filter((item) => !item.id);
    if (nestedFolders.length) {
      throw new Error(
        "Unexpected nested profile-image folders require administrator cleanup."
      );
    }
    const imagePaths = entries.map((item) => `${folder}/${item.name}`);
    if (!imagePaths.length) {
      throw new Error("Profile-image cleanup could not make progress.");
    }

    const { data: removed, error: removeError } = await client.storage
      .from(PROFILE_IMAGES_BUCKET)
      .remove(imagePaths);
    if (removeError) {
      throw profileImageError("removed during account deletion", removeError);
    }
    if (!removed?.length) {
      throw new Error("Profile-image cleanup could not make progress.");
    }
  }

  throw new Error(
    "Profile-image cleanup exceeded its safety limit. Contact the site owner."
  );
}
