"use client";

import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from "firebase/storage";
import { getFirebaseServices } from "@/lib/firebase";
import { LIMITS } from "@/lib/constants";
import { MODERATION_IMAGE_ERROR, moderateWithServerRoute, validateModerationImageFile } from "@/lib/moderation";
import type { ReflectionMedia } from "@/types";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function extension(file: File): string {
  const values: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
  return values[file.type] ?? "";
}

async function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => { const duration = video.duration; URL.revokeObjectURL(url); resolve(duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That video could not be read.")); };
    video.src = url;
  });
}

export async function validateReflectionMedia(files: File[]): Promise<void> {
  if (!files.length) return;
  const images = files.filter((file) => IMAGE_TYPES.has(file.type));
  const videos = files.filter((file) => VIDEO_TYPES.has(file.type));
  if (images.length + videos.length !== files.length) throw new Error("Choose JPG, PNG, WebP, MP4, WebM, or MOV media.");
  if (videos.length && (videos.length !== 1 || images.length)) throw new Error("Choose either up to five photos or one video.");
  if (images.length > LIMITS.reflectionImages) throw new Error("Choose no more than five photos.");
  if (images.some((file) => file.size > LIMITS.reflectionImageBytes)) throw new Error("Each photo must be 10 MB or smaller.");
  for (const image of images) {
    const imageError = validateModerationImageFile(image);
    if (imageError) throw new Error(MODERATION_IMAGE_ERROR);
    await moderateWithServerRoute("", "image", {
      imageDataUrl: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("This image could not be checked."));
        reader.readAsDataURL(image);
      }),
      fileName: image.name,
      mimeType: image.type,
      size: image.size
    }).catch(() => {
      throw new Error(MODERATION_IMAGE_ERROR);
    });
  }
  if (videos.length) {
    if (videos[0].size > LIMITS.reflectionVideoBytes) throw new Error("The video must be 50 MB or smaller.");
    if ((await videoDuration(videos[0])) > LIMITS.reflectionVideoSeconds + 0.1) throw new Error("The video must be 15 seconds or shorter.");
  }
}

export function reflectionMediaId(): string { return crypto.randomUUID(); }

export async function uploadReflectionMedia(userId: string, reflectionId: string, files: File[], isPrivate = false): Promise<ReflectionMedia[]> {
  await validateReflectionMedia(files);
  const services = getFirebaseServices();
  if (!services?.auth.currentUser || services.auth.currentUser.uid !== userId) throw new Error("Please sign in again before uploading media.");
  const uploaded: ReflectionMedia[] = [];
  try {
    for (const file of files) {
      const type = IMAGE_TYPES.has(file.type) ? "image" : "video";
      const path = `users/${userId}/reflections/${reflectionId}/${crypto.randomUUID()}.${extension(file)}`;
      await uploadBytes(ref(services.storage, path), file, {
        contentType: file.type,
        cacheControl: "3600",
        customMetadata: { visibility: isPrivate ? "private" : "public" }
      });
      uploaded.push({ path, type });
    }
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map((item) => deleteObject(ref(services.storage, item.path)).catch(() => undefined)));
    throw error instanceof Error ? error : new Error("Reflection media could not be uploaded.");
  }
}

export async function deleteReflectionMedia(media: ReflectionMedia[]): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  await Promise.all(media.map((item) => deleteObject(ref(services.storage, item.path)).catch(() => undefined)));
}

export async function reflectionMediaUrl(path: string): Promise<string> {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase Storage is unavailable.");
  return getDownloadURL(ref(services.storage, path));
}

export async function deleteAllReflectionMedia(userId: string): Promise<void> {
  const services = getFirebaseServices();
  if (!services?.auth.currentUser || services.auth.currentUser.uid !== userId) return;
  const root = await listAll(ref(services.storage, `users/${userId}/reflections`));
  for (const folder of root.prefixes) {
    const listing = await listAll(folder);
    await Promise.all(listing.items.map((item) => deleteObject(item)));
  }
}
