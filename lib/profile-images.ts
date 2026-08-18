import { getFirebaseServices, type FirebaseServices } from "@/lib/firebase";
import { MODERATION_IMAGE_ERROR, moderateWithServerRoute, validateModerationImageFile } from "@/lib/moderation";
import { validateImage } from "@/lib/validation";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes
} from "firebase/storage";

const PROFILE_IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

const profileImageUrlCache =
  new Map<string, string>();

const profileImageUrlPromiseCache =
  new Map<
    string,
    Promise<string>
  >();

const LOCAL_IMAGE_SOURCE =
  /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;
const FIREBASE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const PROFILE_IMAGE_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

interface AuthorizedStorage {
  userId: string;
  storage: FirebaseServices["storage"];
  firebaseUser: {
    uid: string;
    getIdToken(forceRefresh?: boolean): Promise<string>;
  };
}

function storageErrorStatus(error: unknown): {
  code: string;
  detail: string;
} {
  const record =
    typeof error === "object" && error
      ? (error as Record<string, unknown>)
      : {};
  return {
    code: String(record.code ?? record.serverErrorCode ?? ""),
    detail: `${String(record.message ?? "")} ${String(
      record.serverResponse ?? record.error ?? ""
    )}`.toLocaleLowerCase()
  };
}

function profileImageError(action: string, error: unknown): Error {
  const { code, detail } = storageErrorStatus(error);

  console.error(`Firebase profile image ${action} failed.`, error);

  if (code === "storage/unauthorized" || detail.includes("unauthorized")) {
    return new Error(
      "Image storage access is not configured for this account. Check Firebase Storage rules and sign in again."
    );
  }
  if (
    code === "storage/object-not-found" ||
    detail.includes("object not found") ||
    detail.includes("not found")
  ) {
    return new Error("The stored profile image could not be found.");
  }
  if (code === "storage/quota-exceeded" || detail.includes("quota")) {
    return new Error(
      "Choose a smaller image or free up Firebase Storage space."
    );
  }
  if (detail.includes("failed to fetch") || detail.includes("network")) {
    return new Error(
      "Image storage could not be reached. Check your connection and try again."
    );
  }
  if (code === "storage/canceled") {
    return new Error("The image upload was canceled.");
  }
  return new Error(`The profile image could not be ${action}. Please try again.`);
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
  if (!services) {
    throw new Error("Firebase is not available.");
  }
  const firebaseUser = services?.auth.currentUser;
  if (!firebaseUser) {
    throw new Error("Please log in before accessing profile images.");
  }
  if (expectedUserId && firebaseUser.uid !== expectedUserId) {
    throw new Error("You can only access your own Saintagram images.");
  }
  assertSafeFirebaseUid(firebaseUser.uid);
  await firebaseUser.getIdToken();
  return { userId: firebaseUser.uid, storage: services.storage, firebaseUser };
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

export function isFirebaseProfileImagePath(
  imagePath: string
): boolean {
  const parts = imagePath.split("/");

  if (parts.length !== 4) {
    return false;
  }

  const [usersFolder, userId, profileFolder, imageName] = parts;

  return (
    usersFolder === "users" &&
    profileFolder === "profile" &&
    FIREBASE_UID.test(userId) &&
    PROFILE_IMAGE_FILE.test(imageName)
  );
}

export function isLocalProfileImageSource(value: string): boolean {
  return LOCAL_IMAGE_SOURCE.test(value);
}

export async function uploadFirebaseProfileImage(
  userId: string,
  file: File
): Promise<string> {
  const validationError = validateImage(file);
  if (validationError) throw new Error(validationError);
  const moderationError = validateModerationImageFile(file);
  if (moderationError) throw new Error(moderationError);

  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("This image could not be checked."));
    reader.readAsDataURL(file);
  });
  await moderateWithServerRoute("", "image", {
    imageDataUrl,
    fileName: file.name,
    mimeType: file.type,
    size: file.size
  }).catch(() => {
    throw new Error(MODERATION_IMAGE_ERROR);
  });

  const extension =
    PROFILE_IMAGE_MIME_EXTENSIONS[
      file.type as keyof typeof PROFILE_IMAGE_MIME_EXTENSIONS
    ];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP image.");

  const storage = await authorizedStorage(userId);
  const imagePath =
    `${profileImageFolder(userId)}/${crypto.randomUUID()}.${extension}`;
  try {
    await uploadBytes(ref(storage.storage, imagePath), file, {
      cacheControl: "300",
      contentType: file.type
    });
  } catch (error) {
    throw profileImageError("uploaded", error);
  }
  return imagePath;
}

export async function downloadFirebaseProfileImage(
  imagePath: string
): Promise<string> {
  if (!isFirebaseProfileImagePath(imagePath)) {
    throw new Error(
      "That profile image path is not valid."
    );
  }

  const cached =
    profileImageUrlCache.get(
      imagePath
    );

  if (cached) {
    return cached;
  }

  const existingPromise =
    profileImageUrlPromiseCache.get(
      imagePath
    );

  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    const storage =
      await authorizedStorage();

    try {
      const downloadUrl =
        await getDownloadURL(
          ref(
            storage.storage,
            imagePath
          )
        );

      profileImageUrlCache.set(
        imagePath,
        downloadUrl
      );

      return downloadUrl;
    } catch (error) {
      throw profileImageError(
        "downloaded",
        error
      );
    } finally {
      profileImageUrlPromiseCache.delete(
        imagePath
      );
    }
  })();

  profileImageUrlPromiseCache.set(
    imagePath,
    promise
  );

  return promise;
}

export async function deleteFirebaseProfileImage(
  userId: string,
  imagePath: string
): Promise<void> {
  if (!imagePath || isLocalProfileImageSource(imagePath)) return;
  if (!isOwnedProfileImagePath(imagePath, userId)) {
    throw new Error("That profile image does not belong to this account.");
  }
  const storage = await authorizedStorage(userId);
  try {
    await deleteObject(ref(storage.storage, imagePath));
  } catch (error) {
    throw profileImageError("removed", error);
  }
}

export async function deleteAllFirebaseProfileImages(
  userId: string
): Promise<void> {
  const storage = await authorizedStorage(userId);
  const folder = profileImageFolder(userId);

  let listing: Awaited<ReturnType<typeof listAll>>;
  try {
    listing = await listAll(ref(storage.storage, folder));
  } catch (error) {
    throw profileImageError("listed for removal", error);
  }

  if (listing.prefixes.length) {
    throw new Error(
      "Unexpected nested profile-image folders require administrator cleanup."
    );
  }

  for (const item of listing.items) {
    try {
      await deleteObject(item);
    } catch (error) {
      throw profileImageError("removed during account deletion", error);
    }
  }
}
