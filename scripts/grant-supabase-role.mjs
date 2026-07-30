import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp({
  credential: applicationDefault()
});

const target = process.argv[2];
if (!target) {
  throw new Error(
    "Usage: node scripts/grant-supabase-role.mjs <firebase-user-uid|--all>"
  );
}

const auth = getAuth();

async function grantRole(user) {
  if (user.customClaims?.role === "authenticated") return false;
  await auth.setCustomUserClaims(user.uid, {
    ...user.customClaims,
    role: "authenticated"
  });
  return true;
}

if (target === "--all") {
  let nextPageToken;
  let scanned = 0;
  let updated = 0;
  do {
    const page = await auth.listUsers(1_000, nextPageToken);
    for (const user of page.users) {
      scanned += 1;
      if (await grantRole(user)) updated += 1;
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  console.log(
    `Checked ${scanned} Firebase users and granted Supabase access to ${updated}.`
  );
} else {
  const user = await auth.getUser(target);
  const updated = await grantRole(user);
  console.log(
    updated
      ? `Granted Supabase authenticated access to ${target}.`
      : `${target} already has Supabase authenticated access.`
  );
}

console.log(
  "The app refreshes the Firebase token on the next image request; " +
    "sign out and back in if access is still denied."
);
