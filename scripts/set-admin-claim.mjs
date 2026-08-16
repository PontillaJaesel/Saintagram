import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const get = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const uid = get("--uid");
const email = get("--email");
const grant = args.includes("--grant");
const revoke = args.includes("--revoke");

if ((!uid && !email) || (uid && email) || grant === revoke) {
  console.error("Usage: node --env-file=.env.production scripts/set-admin-claim.mjs (--uid UID | --email EMAIL) (--grant | --revoke)");
  process.exitCode = 1;
} else {
  try {
    const projectId = (process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
    const clientEmail = (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "").trim();
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").trim().replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) throw new Error("CONFIG_MISSING");
    const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    const auth = getAuth(app);
    const user = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);
    const claims = { ...user.customClaims };
    if (grant) claims.admin = true;
    else delete claims.admin;
    await auth.setCustomUserClaims(user.uid, claims);
    console.log(`Administrator access ${grant ? "granted" : "revoked"} for account ${user.uid}. Refresh the ID token or sign out and back in.`);
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "unknown";
    const reason = error?.message === "CONFIG_MISSING"
      ? "required Firebase Admin variables are missing"
      : code === "auth/user-not-found"
        ? "no Firebase Authentication account matches that identifier"
        : code === "app/invalid-credential" || code === "auth/invalid-credential"
          ? "Firebase rejected the Admin credential"
          : `Firebase returned ${code}`;
    console.error(`The administrator claim could not be updated: ${reason}.`);
    process.exitCode = 1;
  }
}
