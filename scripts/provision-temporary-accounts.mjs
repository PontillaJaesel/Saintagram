import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { TEMPORARY_ACCOUNTS } from "../lib/temporary-accounts.data.mjs";

const accounts = TEMPORARY_ACCOUNTS.map((account) => ({
  ...account,
  password: account.temporaryPassword
}));
const projectId = (process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
const clientEmail = (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "").trim();
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").trim().replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin environment variables are required.");
const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
const auth = getAuth(app), db = getFirestore(app), reset = process.argv.includes("--reset-incomplete");
const resetTestUser = process.argv.includes("--reset-test-user");
let created = 0, repaired = 0, skipped = 0;
for (const account of accounts) {
  const email = `${account.username.toLowerCase()}@accounts.saintagram.local`;
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({ email, password: account.password, emailVerified: true, displayName: account.username });
    created += 1;
  }
  const ref = db.collection("users").doc(user.uid), snapshot = await ref.get();
  const shouldResetTestUser = resetTestUser && account.username.startsWith("USRTEST");
  if (snapshot.exists && snapshot.get("mustChangePassword") !== true && !shouldResetTestUser) { skipped += 1; continue; }
  if (reset || shouldResetTestUser) await auth.updateUser(user.uid, { password: account.password, emailVerified: true, displayName: account.username });
  const now = new Date().toISOString();
  await ref.set({
    id: user.uid, email, username: account.username, fullName: account.fullName,
    role: account.role, authProvider: "password",
    createdAt: snapshot.exists ? snapshot.get("createdAt") || now : now, updatedAt: now,
    privacyConsentAt: snapshot.exists ? snapshot.get("privacyConsentAt") ?? null : null,
    spiritualIntroSeenAt: snapshot.exists ? snapshot.get("spiritualIntroSeenAt") ?? null : null,
    profileCompleted: snapshot.exists ? snapshot.get("profileCompleted") === true : false,
    mustChangePassword: true,
    privacyPreferences: snapshot.exists ? snapshot.get("privacyPreferences") || { requirePrivateCheck: true, showReflectionDates: true } : { requirePrivateCheck: true, showReflectionDates: true }
  }, { merge: true });
  if (snapshot.exists) repaired += 1;
}
console.log(`Provisioning complete: ${created} Auth users created, ${repaired} records reconciled, ${skipped} permanent-password accounts preserved.`);
