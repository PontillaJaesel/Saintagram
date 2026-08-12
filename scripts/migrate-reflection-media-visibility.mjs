import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!projectId || !clientEmail || !privateKey || !storageBucket) {
  throw new Error("Firebase Admin and Storage environment variables are required.");
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
  storageBucket
});
const snapshot = await getFirestore(app).collection("reflectionPosts").get();
const bucket = getStorage(app).bucket(storageBucket);
let updated = 0;

for (const document of snapshot.docs) {
  const data = document.data();
  if (!Array.isArray(data.media)) continue;
  const visibility = data.isPrivate === true ? "private" : "public";
  for (const media of data.media) {
    if (!media || typeof media.path !== "string") continue;
    const file = bucket.file(media.path);
    const [exists] = await file.exists();
    if (!exists) continue;
    const [metadata] = await file.getMetadata();
    await file.setMetadata({
      metadata: { ...(metadata.metadata ?? {}), visibility }
    });
    updated += 1;
  }
}

console.log(`Updated visibility metadata on ${updated} reflection media object(s).`);
