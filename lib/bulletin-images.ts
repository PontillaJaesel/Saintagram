import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseServices } from "@/lib/firebase";
import { MODERATION_IMAGE_ERROR, moderateWithServerRoute, validateModerationImageFile } from "@/lib/moderation";
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
  const validationError = validateImage(file) || validateModerationImageFile(file);
  if (validationError) throw new Error(validationError);
  const extension = EXTENSIONS[file.type as keyof typeof EXTENSIONS];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP image.");
  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("This image could not be checked."));
    reader.readAsDataURL(file);
  });
  await moderateWithServerRoute("", "image", {
    imageDataUrl, fileName: file.name, mimeType: file.type, size: file.size
  }).catch(() => { throw new Error(MODERATION_IMAGE_ERROR); });
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
