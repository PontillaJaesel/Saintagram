import "server-only";

import { FieldValue, Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { writeAudit } from "@/lib/admin-data";
import type { ReflectionMedia, ReflectionPost } from "@/types";

const TITLE_LIMIT = 60;
const CONTENT_LIMIT = 500;
const BATCH_WRITE_LIMIT = 450;

function normalizedText(value: unknown, maximumLength: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximumLength)
    : "";
}

export interface AdminReflectionInput {
  title?: unknown;
  content?: unknown;
  reflectionId?: unknown;
  media?: unknown;
}

function normalizedMedia(value: unknown, adminId: string, reflectionId: string): ReflectionMedia[] {
  if (!Array.isArray(value)) return [];
  const media = value.filter((item): item is ReflectionMedia => Boolean(item && typeof item === "object" && ((item as ReflectionMedia).type === "image" || (item as ReflectionMedia).type === "video") && typeof (item as ReflectionMedia).path === "string" && (item as ReflectionMedia).path.startsWith(`users/${adminId}/reflections/${reflectionId}/`)));
  const videos = media.filter((item) => item.type === "video");
  if (media.length > 5 || videos.length > 1 || (videos.length && media.length > 1)) throw new Error("INVALID_REFLECTION_MEDIA");
  return media;
}

function timestampIso(value: unknown): string {
  return value instanceof Timestamp
    ? value.toDate().toISOString()
    : typeof value === "string"
      ? value
      : "";
}

function storedAdminReflection(id: string, data: FirebaseFirestore.DocumentData): ReflectionPost {
  return {
    id,
    userId: String(data.userId ?? ""),
    title: String(data.title ?? ""),
    content: String(data.content ?? ""),
    isPrivate: false,
    accountPrivate: false,
    createdAt: timestampIso(data.createdAt),
    updatedAt: timestampIso(data.updatedAt),
    ...(data.editedAt ? { editedAt: timestampIso(data.editedAt) } : {}),
    ...(Array.isArray(data.media) ? { media: data.media as ReflectionMedia[] } : {})
  };
}

async function commitReferences(
  db: Firestore,
  references: DocumentReference[],
  operation: (batch: FirebaseFirestore.WriteBatch, reference: DocumentReference) => void
): Promise<void> {
  for (let offset = 0; offset < references.length; offset += BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    for (const reference of references.slice(offset, offset + BATCH_WRITE_LIMIT)) {
      operation(batch, reference);
    }
    await batch.commit();
  }
}

export async function listAdminReflections(
  adminId: string,
  db: Firestore = getFirebaseAdminFirestore()
): Promise<ReflectionPost[]> {
  const snapshot = await db.collection("reflectionPosts").where("userId", "==", adminId).get();
  return snapshot.docs
    .filter((document) => document.get("isPrivate") === false)
    .map((document) => storedAdminReflection(document.id, document.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function publishAdminReflection(
  adminId: string,
  input: AdminReflectionInput,
  db: Firestore = getFirebaseAdminFirestore()
): Promise<{ reflectionId: string; notifiedUsers: number }> {
  const title = normalizedText(input.title, TITLE_LIMIT);
  const content = normalizedText(input.content, CONTENT_LIMIT);
  if (!content) throw new Error("REFLECTION_CONTENT_REQUIRED");

  const requestedId = typeof input.reflectionId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.reflectionId) ? input.reflectionId : null;
  const postRef = requestedId ? db.collection("reflectionPosts").doc(requestedId) : db.collection("reflectionPosts").doc();
  const media = normalizedMedia(input.media, adminId, postRef.id);
  const profileRef = db.collection("socialProfiles").doc(adminId);
  const [profile, users] = await Promise.all([
    profileRef.get(),
    db.collection("users").get()
  ]);

  const setupBatch = db.batch();

  if (!profile.exists) {
    setupBatch.set(profileRef, {
      id: adminId,
      userId: adminId,
      profileName: "Saintagram Admin",
      imagePath: "",
      spiritualBio: "Official reflections from Saintagram.",
      heavenlyHashtag: "#Saintagram",

      // Saintagram Admin is always public.
      isPrivateAccount: false,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } else {
    /*
    * Repair legacy Admin profiles.
    *
    * Older Admin profiles may have been created before
    * isPrivateAccount existed. Always force the official
    * Saintagram Admin account to remain public.
    */
    setupBatch.update(profileRef, {
      isPrivateAccount: false,
      updatedAt: FieldValue.serverTimestamp()
    });
  }
  setupBatch.set(postRef, {
    id: postRef.id,
    userId: adminId,
    title,
    content,

    // The reflection itself is public.
    isPrivate: false,

    // The Saintagram Admin account is also public.
    accountPrivate: false,

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),

    ...(media.length ? { media } : {})
  });
  await setupBatch.commit();

  const recipients = users.docs.filter((user) => user.id !== adminId);
  for (let offset = 0; offset < recipients.length; offset += BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    for (const user of recipients.slice(offset, offset + BATCH_WRITE_LIMIT)) {
      const notificationRef = db.collection("systemNotifications").doc();
      batch.set(notificationRef, {
        id: notificationRef.id,
        userId: user.id,
        type: "admin_reflection",
        title: title || "New reflection from Saintagram",
        message: content,
        missingFields: [],
        reflectionId: postRef.id,
        createdByAdminId: adminId,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null
      });
    }
    await batch.commit();
  }

  await writeAudit(adminId, "admin_reflection_published", null, {
    reflectionId: postRef.id,
    notifiedUsers: recipients.length
  });

  return { reflectionId: postRef.id, notifiedUsers: recipients.length };
}

export async function updateAdminReflection(
  adminId: string,
  reflectionId: string,
  input: AdminReflectionInput,
  db: Firestore = getFirebaseAdminFirestore()
): Promise<ReflectionPost> {
  const title = normalizedText(input.title, TITLE_LIMIT);
  const content = normalizedText(input.content, CONTENT_LIMIT);
  if (!content) throw new Error("REFLECTION_CONTENT_REQUIRED");

  const postRef = db.collection("reflectionPosts").doc(reflectionId);
  const media = input.media === undefined ? undefined : normalizedMedia(input.media, adminId, reflectionId);
  const post = await postRef.get();
  if (!post.exists || post.get("userId") !== adminId || post.get("isPrivate") !== false) {
    throw new Error("ADMIN_REFLECTION_NOT_FOUND");
  }

  await postRef.update({
    title,
    content,

    // Admin reflections are always public.
    // These fields also repair legacy Admin posts
    // that were created before accountPrivate existed.
    isPrivate: false,
    accountPrivate: false,

    updatedAt: FieldValue.serverTimestamp(),
    editedAt: FieldValue.serverTimestamp(),

    ...(media ? { media } : {})
  });

  const notificationSnapshot = await db
    .collection("systemNotifications")
    .where("reflectionId", "==", reflectionId)
    .get();
  await commitReferences(db, notificationSnapshot.docs.map((document) => document.ref), (batch, reference) => {
    batch.update(reference, { title: title || "New reflection from Saintagram", message: content });
  });

  await writeAudit(adminId, "admin_reflection_updated", null, { reflectionId });
  return {
    ...storedAdminReflection(post.id, post.data() ?? {}),
    title,
    content,
    updatedAt: new Date().toISOString(),
    editedAt: new Date().toISOString()
    ,...(media ? { media } : {})
  };
}

export async function deleteAdminReflection(
  adminId: string,
  reflectionId: string,
  db: Firestore = getFirebaseAdminFirestore()
): Promise<void> {
  const postRef = db.collection("reflectionPosts").doc(reflectionId);
  const post = await postRef.get();
  if (!post.exists || post.get("userId") !== adminId || post.get("isPrivate") !== false) {
    throw new Error("ADMIN_REFLECTION_NOT_FOUND");
  }

  const relatedSnapshots = await Promise.all([
    db.collection("reflectionLikes").where("reflectionId", "==", reflectionId).get(),
    db.collection("reflectionComments").where("reflectionId", "==", reflectionId).get(),
    db.collection("notifications").where("reflectionId", "==", reflectionId).get(),
    db.collection("systemNotifications").where("reflectionId", "==", reflectionId).get()
  ]);
  const references = [postRef, ...relatedSnapshots.flatMap((snapshot) => snapshot.docs.map((document) => document.ref))];
  await commitReferences(db, references, (batch, reference) => batch.delete(reference));
  await writeAudit(adminId, "admin_reflection_deleted", null, { reflectionId });
}
