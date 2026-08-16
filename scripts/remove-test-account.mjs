import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const username = (process.argv[2] || "").trim().toUpperCase();
const confirmed = process.argv.includes("--confirm");

if (!/^USRTEST[A-Z0-9]*$/.test(username)) {
  throw new Error("Only a dedicated USRTEST account can be removed with this script.");
}
if (!confirmed) {
  throw new Error("Pass --confirm to permanently remove the test account.");
}

const projectId = (
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  ""
).trim();
const clientEmail = (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "").trim();
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "")
  .trim()
  .replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Firebase Admin environment variables are required.");
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId
  });
const auth = getAuth(app);
const db = getFirestore(app);
const email = `${username.toLowerCase()}@accounts.saintagram.local`;

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (error) {
  if (error?.code !== "auth/user-not-found") throw error;
  console.log(`${username} is already absent from Firebase Authentication.`);
  process.exit(0);
}

const reflections = await db
  .collection("reflectionPosts")
  .where("userId", "==", user.uid)
  .get();
const batch = db.batch();

for (const collection of [
  "users",
  "profiles",
  "privateProfiles",
  "drafts",
  "socialProfiles"
]) {
  batch.delete(db.collection(collection).doc(user.uid));
}
reflections.docs.forEach((document) => batch.delete(document.ref));

await batch.commit();
await auth.deleteUser(user.uid);
console.log(`Removed ${username} and ${reflections.size} reflection record(s).`);
