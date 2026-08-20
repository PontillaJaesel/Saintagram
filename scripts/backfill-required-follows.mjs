import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function env(name) {
  return process.env[name]?.trim() ?? "";
}

const projectId =
  env("FIREBASE_ADMIN_PROJECT_ID") ||
  env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const clientEmail = env("FIREBASE_ADMIN_CLIENT_EMAIL");
const privateKey = env("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "Missing Firebase Admin environment variables. Check FIREBASE_ADMIN_PROJECT_ID, " +
      "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
  );
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId
    });
const db = getFirestore(app);
const auth = getAuth(app);
const BATCH_SIZE = 400;
const VERSION = "2026-08-21-v2";
const ADMIN_PROFILE_NAME = "Saintagram Admin";
const ADMIN_PROFILE_BIO = "Official reflections from Saintagram.";
const ADMIN_HASHTAG = "#Saintagram";

function addRequired(required, followerId, followingId) {
  if (!followerId || !followingId || followerId === followingId) return;
  const id = `${followerId}_${followingId}`;
  required.set(id, { id, followerId, followingId });
}

async function commitDeletes(documents) {
  for (let offset = 0; offset < documents.length; offset += BATCH_SIZE) {
    const batch = db.batch();
    for (const document of documents.slice(offset, offset + BATCH_SIZE)) {
      batch.delete(document.ref);
    }
    await batch.commit();
  }
}


async function loadOfficialAdminIds() {
  const profiles = await db
    .collection("socialProfiles")
    .where("profileName", "==", ADMIN_PROFILE_NAME)
    .get();

  const adminIds = [];
  for (const profile of profiles.docs) {
    const data = profile.data() ?? {};
    if (
      data.spiritualBio !== ADMIN_PROFILE_BIO ||
      data.heavenlyHashtag !== ADMIN_HASHTAG
    ) {
      continue;
    }

    try {
      const authUser = await auth.getUser(profile.id);
      if (authUser.customClaims?.admin === true) {
        adminIds.push(profile.id);
      }
    } catch {
      // Ignore stale profile documents whose Firebase Auth account no longer exists.
    }
  }

  return Array.from(new Set(adminIds));
}

async function main() {
  console.log("Loading Saintagram users and existing follows...");
  const [usersSnapshot, followsSnapshot, requestsSnapshot, coreAdminIds] =
    await Promise.all([
      db.collection("users").get(),
      db.collection("follows").get(),
      db.collection("followRequests").get(),
      loadOfficialAdminIds()
    ]);

  const userIds = [];
  const sharedAdminIds = [];
  for (const document of usersSnapshot.docs) {
    const data = document.data() ?? {};
    userIds.push(document.id);
    if (data.adminAccessGranted === true) sharedAdminIds.push(document.id);
  }

  if (!coreAdminIds.length) {
    throw new Error(
      "The official Saintagram Admin account could not be found. Make sure its social profile exists and its Firebase Auth account has admin=true."
    );
  }

  const required = new Map();
  for (const userId of userIds) {
    for (const adminId of coreAdminIds) addRequired(required, userId, adminId);
    for (const sharedAdminId of sharedAdminIds) {
      addRequired(required, userId, sharedAdminId);
      addRequired(required, sharedAdminId, userId);
    }
  }

  const existing = new Set(followsSnapshot.docs.map((document) => document.id));
  const missing = Array.from(required.values()).filter(({ id }) => !existing.has(id));

  let created = 0;
  for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = missing.slice(offset, offset + BATCH_SIZE);
    for (const follow of chunk) {
      batch.set(db.collection("follows").doc(follow.id), {
        ...follow,
        createdAt: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
    created += chunk.length;
    console.log(`Created ${created}/${missing.length} required follow relationship(s).`);
  }

  const obsoleteRequests = requestsSnapshot.docs.filter((document) => required.has(document.id));
  await commitDeletes(obsoleteRequests);

  await db.collection("systemState").doc("requiredFollowGraph").set({
    version: VERSION,
    completedAt: FieldValue.serverTimestamp()
  });

  console.log("Required follow backfill complete.");
  console.log(`Users: ${userIds.length}`);
  console.log(`Core admins: ${coreAdminIds.length}`);
  console.log(`Shared admins: ${sharedAdminIds.length}`);
  console.log(`New follow relationships: ${missing.length}`);
  console.log(`Obsolete follow requests removed: ${obsoleteRequests.length}`);
}

main().catch((error) => {
  console.error("Required follow backfill failed:");
  console.error(error);
  process.exit(1);
});
