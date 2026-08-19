import {
  cert,
  initializeApp,
  getApps
} from "firebase-admin/app";

import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirestore
} from "firebase-admin/firestore";

function env(name) {
  return process.env[name]?.trim() ?? "";
}

const projectId =
  env("FIREBASE_ADMIN_PROJECT_ID") ||
  env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

const clientEmail =
  env("FIREBASE_ADMIN_CLIENT_EMAIL");

const privateKey =
  env("FIREBASE_ADMIN_PRIVATE_KEY")
    .replace(/\\n/g, "\n");

if (
  !projectId ||
  !clientEmail ||
  !privateKey
) {
  throw new Error(
    "Missing Firebase Admin environment variables. " +
    "Check FIREBASE_ADMIN_PROJECT_ID, " +
    "FIREBASE_ADMIN_CLIENT_EMAIL, and " +
    "FIREBASE_ADMIN_PRIVATE_KEY."
  );
}

const app =
  getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        }),
        projectId
      });

const auth =
  getAuth(app);

const db =
  getFirestore(app);

const MAX_BATCH_SIZE = 400;

async function findAdminUser() {
  console.log(
    "Looking for the Saintagram Admin account..."
  );

  let pageToken;

  do {
    const result =
      await auth.listUsers(
        1000,
        pageToken
      );

    for (
      const user
      of result.users
    ) {
      if (
        user.customClaims?.admin ===
        true
      ) {
        return user;
      }
    }

    pageToken =
      result.pageToken;
  } while (pageToken);

  throw new Error(
    "No Firebase user with admin=true custom claim was found."
  );
}

async function repairAdminProfile(
  adminId
) {
  const profileRef =
    db
      .collection(
        "socialProfiles"
      )
      .doc(adminId);

  const profile =
    await profileRef.get();

  if (!profile.exists) {
    console.log(
      "Admin social profile does not exist. " +
      "It will be created automatically when a new Admin reflection is published."
    );

    return;
  }

  const current =
    profile.data();

  if (
    current?.isPrivateAccount ===
    false
  ) {
    console.log(
      "Admin social profile is already public."
    );

    return;
  }

  await profileRef.update({
    isPrivateAccount: false
  });

  console.log(
    "Repaired Admin social profile: isPrivateAccount = false"
  );
}

async function repairAdminReflections(
  adminId
) {
  console.log(
    "Loading existing Admin reflections..."
  );

  const snapshot =
    await db
      .collection(
        "reflectionPosts"
      )
      .where(
        "userId",
        "==",
        adminId
      )
      .get();

  if (snapshot.empty) {
    console.log(
      "No Admin reflections were found."
    );

    return;
  }

  const documentsToRepair =
    snapshot.docs.filter(
      (document) => {
        const data =
          document.data();

        return (
          data.isPrivate !== false ||
          data.accountPrivate !== false
        );
      }
    );

  console.log(
    `Admin reflections found: ${snapshot.size}`
  );

  console.log(
    `Admin reflections requiring repair: ${documentsToRepair.length}`
  );

  if (
    documentsToRepair.length ===
    0
  ) {
    console.log(
      "All Admin reflections already have the correct privacy fields."
    );

    return;
  }

  let repaired = 0;

  for (
    let offset = 0;
    offset <
    documentsToRepair.length;
    offset += MAX_BATCH_SIZE
  ) {
    const batch =
      db.batch();

    const currentBatch =
      documentsToRepair.slice(
        offset,
        offset +
          MAX_BATCH_SIZE
      );

    for (
      const document
      of currentBatch
    ) {
      batch.update(
        document.ref,
        {
          /*
           * The official Saintagram Admin's
           * reflections are always public.
           */
          isPrivate: false,
          accountPrivate: false
        }
      );
    }

    await batch.commit();

    repaired +=
      currentBatch.length;

    console.log(
      `Repaired ${repaired}/${documentsToRepair.length}`
    );
  }

  console.log(
    "All legacy Admin reflections have been repaired."
  );
}

async function main() {
  console.log(
    "=========================================="
  );

  console.log(
    "Saintagram Admin Reflection Repair"
  );

  console.log(
    "=========================================="
  );

  const admin =
    await findAdminUser();

  console.log(
    `Admin account found: ${admin.email ?? admin.uid}`
  );

  console.log(
    `Admin UID: ${admin.uid}`
  );

  await repairAdminProfile(
    admin.uid
  );

  await repairAdminReflections(
    admin.uid
  );

  console.log("");
  console.log(
    "Repair complete."
  );

  console.log(
    "Old Saintagram Admin posts should now appear in Discover."
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("");
    console.error(
      "Repair failed:"
    );

    console.error(error);

    process.exit(1);
  });