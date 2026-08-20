import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { TEMPORARY_ACCOUNTS } from "../lib/temporary-accounts.data.mjs";

const accounts = TEMPORARY_ACCOUNTS.map((account) => ({
  ...account,
  password: account.temporaryPassword
}));

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
  throw new Error(
    "Firebase Admin environment variables are required. Check FIREBASE_ADMIN_PROJECT_ID, " +
      "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
  );
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId
  });

const auth = getAuth(app);
const db = getFirestore(app);

const resetIncomplete = process.argv.includes("--reset-incomplete");
const resetTestUser = process.argv.includes("--reset-test-user");
const dryRun = process.argv.includes("--dry-run");

const counters = {
  authCreated: 0,
  firestoreCreated: 0,
  metadataUpdated: 0,
  authProfileUpdated: 0,
  passwordsReset: 0,
  unchanged: 0
};

function accountEmail(username) {
  return `${username.toLowerCase()}@accounts.saintagram.local`;
}

function managedMetadata(account, uid, email) {
  return {
    id: uid,
    email,
    username: account.username,
    fullName: account.fullName,
    role: account.role,
    authProvider: "password"
  };
}

function metadataDiff(snapshot, expected) {
  if (!snapshot.exists) {
    return Object.entries(expected).map(([field, after]) => ({
      field,
      before: undefined,
      after
    }));
  }

  return Object.entries(expected)
    .filter(([field, value]) => snapshot.get(field) !== value)
    .map(([field, after]) => ({
      field,
      before: snapshot.get(field),
      after
    }));
}

function printable(value) {
  if (value === undefined) return "<missing>";
  return JSON.stringify(value);
}

function printChanges(username, changes, prefix = "") {
  for (const change of changes) {
    console.log(
      `${prefix}${username}: ${change.field} ${printable(change.before)} -> ${printable(change.after)}`
    );
  }
}

async function assertNoDuplicateUserDocument(username, expectedUid) {
  const matches = await db
    .collection("users")
    .where("username", "==", username)
    .get();

  const conflictingIds = matches.docs
    .map((document) => document.id)
    .filter((id) => id !== expectedUid);

  if (conflictingIds.length) {
    throw new Error(
      `Duplicate Firestore identity detected for ${username}. Firebase Auth UID is ${expectedUid}, ` +
        `but these users documents use the same username: ${conflictingIds.join(", ")}. ` +
        "Provisioning stopped instead of modifying an ambiguous account."
    );
  }
}

async function verifyManagedMetadata(ref, expected, username) {
  const verified = await ref.get();

  if (!verified.exists) {
    throw new Error(
      `Verification failed for ${username}: users/${ref.id} does not exist after provisioning.`
    );
  }

  const mismatches = Object.entries(expected).filter(
    ([field, value]) => verified.get(field) !== value
  );

  if (mismatches.length) {
    const details = mismatches
      .map(
        ([field, value]) =>
          `${field}: expected ${printable(value)}, got ${printable(verified.get(field))}`
      )
      .join("; ");

    throw new Error(
      `Verification failed for ${username} at users/${ref.id}: ${details}`
    );
  }
}

const usernames = new Set();
for (const account of accounts) {
  if (!account.username || !account.fullName || !account.password) {
    throw new Error(
      "Every temporary account must have username, fullName, and temporaryPassword."
    );
  }

  if (usernames.has(account.username)) {
    throw new Error(
      `Duplicate username in temporary-accounts.data.mjs: ${account.username}`
    );
  }

  usernames.add(account.username);
}

console.log("");
console.log("Saintagram temporary-account provisioning");
console.log(`Firebase project: ${projectId}`);
console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
console.log("");

for (const account of accounts) {
  const email = accountEmail(account.username);
  let user;
  let authWasCreated = false;

  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;

    if (dryRun) {
      console.log(
        `[dry-run] ${account.username}: would create Firebase Auth account for "${account.fullName}" (${email}).`
      );
      counters.authCreated += 1;
      continue;
    }

    user = await auth.createUser({
      email,
      password: account.password,
      emailVerified: true,
      displayName: account.fullName
    });
    authWasCreated = true;
    counters.authCreated += 1;

    console.log(
      `[created] ${account.username}: Firebase Auth UID ${user.uid} for "${account.fullName}".`
    );
  }

  await assertNoDuplicateUserDocument(account.username, user.uid);

  const ref = db.collection("users").doc(user.uid);
  const snapshot = await ref.get();
  const expected = managedMetadata(account, user.uid, email);
  const changes = metadataDiff(snapshot, expected);

  const shouldResetTestUser =
    resetTestUser && account.username.startsWith("USRTEST");
  const shouldResetIncomplete =
    resetIncomplete &&
    snapshot.exists &&
    snapshot.get("mustChangePassword") === true;
  const shouldResetPassword =
    shouldResetTestUser || shouldResetIncomplete;

  const authProfileNeedsUpdate =
    user.displayName !== account.fullName || user.emailVerified !== true;

  if (!snapshot.exists) {
    if (dryRun) {
      console.log(
        `[dry-run] ${account.username}: would create users/${user.uid} with fullName="${account.fullName}".`
      );
      counters.firestoreCreated += 1;
      continue;
    }

    const now = new Date().toISOString();
    await ref.set({
      ...expected,
      createdAt: now,
      updatedAt: now,
      privacyConsentAt: null,
      spiritualIntroSeenAt: null,
      fiatIntroSeenAt: null,
      profileCompleted: false,
      mustChangePassword: true,
      privacyPreferences: {
        requirePrivateCheck: true,
        showReflectionDates: true
      }
    });

    counters.firestoreCreated += 1;
    await verifyManagedMetadata(ref, expected, account.username);

    console.log(
      `[created] ${account.username}: users/${user.uid} created and verified with fullName="${account.fullName}".`
    );
    continue;
  }

  if (dryRun) {
    if (changes.length) {
      printChanges(account.username, changes, "[dry-run] ");
      console.log(
        `[dry-run] ${account.username}: would update users/${user.uid}; password would be preserved${shouldResetPassword ? " except for the explicitly requested reset flag" : ""}.`
      );
      counters.metadataUpdated += 1;
    }

    if (authProfileNeedsUpdate) {
      console.log(
        `[dry-run] ${account.username}: Firebase Auth displayName ${printable(user.displayName)} -> ${printable(account.fullName)}.`
      );
      counters.authProfileUpdated += 1;
    }

    if (shouldResetPassword) {
      console.log(
        `[dry-run] ${account.username}: temporary password would be reset because an explicit reset flag was supplied.`
      );
      counters.passwordsReset += 1;
    }

    if (!changes.length && !authProfileNeedsUpdate && !shouldResetPassword) {
      console.log(
        `[dry-run] ${account.username}: unchanged (users/${user.uid}).`
      );
      counters.unchanged += 1;
    }

    continue;
  }

  if (authProfileNeedsUpdate || shouldResetPassword) {
    const authPatch = {
      displayName: account.fullName,
      emailVerified: true
    };

    if (shouldResetPassword) {
      authPatch.password = account.password;
    }

    user = await auth.updateUser(user.uid, authPatch);

    if (authProfileNeedsUpdate) counters.authProfileUpdated += 1;
    if (shouldResetPassword) counters.passwordsReset += 1;
  }

  if (changes.length) {
    printChanges(account.username, changes, "[update] ");

    await ref.set(
      {
        ...expected,
        updatedAt: new Date().toISOString(),
        ...(shouldResetPassword ? { mustChangePassword: true } : {})
      },
      { merge: true }
    );

    counters.metadataUpdated += 1;
  } else if (shouldResetPassword) {
    await ref.set(
      {
        mustChangePassword: true,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  }

  /*
   * Verify the exact Firestore document after every live run, even when no
   * metadata write was needed. This catches wrong-project, stale-document,
   * duplicate-identity, and unexpected write problems immediately.
   */
  await verifyManagedMetadata(ref, expected, account.username);

  if (changes.length || authProfileNeedsUpdate || shouldResetPassword || authWasCreated) {
    console.log(
      `[verified] ${account.username}: users/${user.uid} fullName="${account.fullName}", password ${
        shouldResetPassword ? "reset by explicit flag" : "preserved"
      }.`
    );
  } else {
    counters.unchanged += 1;
    console.log(
      `[ok] ${account.username}: users/${user.uid} already matches "${account.fullName}".`
    );
  }
}

console.log("");
console.log(`${dryRun ? "Dry run" : "Provisioning"} complete.`);
console.log(`Firebase project: ${projectId}`);
console.log(`Auth users ${dryRun ? "that would be created" : "created"}: ${counters.authCreated}`);
console.log(`Firestore users ${dryRun ? "that would be created" : "created"}: ${counters.firestoreCreated}`);
console.log(`Metadata records ${dryRun ? "that would be updated" : "updated"}: ${counters.metadataUpdated}`);
console.log(`Auth profiles ${dryRun ? "that would be updated" : "updated"}: ${counters.authProfileUpdated}`);
console.log(`Passwords ${dryRun ? "that would be reset" : "reset"}: ${counters.passwordsReset}`);
console.log(`Unchanged accounts: ${counters.unchanged}`);
