import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseServices } from "@/lib/firebase";
import { validateImage } from "@/lib/validation";

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const SAFE_PATH = /^bulletins\/[A-Za-z0-9_-]{1,128}\/[0-9a-f-]+\.(?:jpg|png|webp)$/i;

async function authorizedStorage() {
  const services = getFirebaseServices();
  const user = services?.auth.currentUser;
  if (!services || !user) throw new Error("Please sign in before accessing bulletin images.");
  await user.getIdToken();
  return { services, user };
}

export async function uploadBulletinImage(file: File): Promise<string> {
  // Bulletins are admin-only content. Do not send posters, schedules, or QR
  // codes through user-photo AI moderation, which can falsely flag dense QR
  // patterns. File type and size are still checked here and enforced again by
  // Firebase Storage rules.
  const validationError = validateImage(file);
  if (validationError) throw new Error(validationError);
  const extension = EXTENSIONS[file.type as keyof typeof EXTENSIONS];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP image.");
  const { services, user } = await authorizedStorage();
  const path = `bulletins/${user.uid}/${crypto.randomUUID()}.${extension}`;
  await uploadBytes(ref(services.storage, path), file, { cacheControl: "public,max-age=3600", contentType: file.type });
  return path;
}

export async function bulletinImageUrl(path: string): Promise<string> {
  if (!SAFE_PATH.test(path)) throw new Error("That bulletin image path is invalid.");
  const { services } = await authorizedStorage();
  return getDownloadURL(ref(services.storage, path));
}

export async function deleteBulletinImage(path: string): Promise<void> {
  if (!SAFE_PATH.test(path)) return;
  const { services } = await authorizedStorage();
  await deleteObject(ref(services.storage, path));
}
