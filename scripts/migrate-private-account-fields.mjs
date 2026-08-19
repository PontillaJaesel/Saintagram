import {
  readFileSync
} from "node:fs";

import {
  cert,
  initializeApp
} from "firebase-admin/app";

import {
  getFirestore
} from "firebase-admin/firestore";

const serviceAccount =
  JSON.parse(
    readFileSync(
      "./serviceAccountKey.json",
      "utf8"
    )
  );

const app =
  initializeApp({
    credential:
      cert(
        serviceAccount
      )
  });

const db =
  getFirestore(
    app
  );

const MAX_BATCH =
  400;

async function commitOperations(
  operations
) {
  for (
    let index = 0;
    index <
    operations.length;
    index +=
      MAX_BATCH
  ) {
    const batch =
      db.batch();

    operations
      .slice(
        index,
        index +
          MAX_BATCH
      )
      .forEach(
        (
          operation
        ) =>
          operation(
            batch
          )
      );

    await batch.commit();
  }
}

async function main() {
  console.log(
    "Loading existing Saintagram data..."
  );

  const [
    users,
    profiles,
    reflections
  ] =
    await Promise.all([
      db
        .collection(
          "users"
        )
        .get(),

      db
        .collection(
          "socialProfiles"
        )
        .get(),

      db
        .collection(
          "reflectionPosts"
        )
        .get()
    ]);

  const privacyByUser =
    new Map();

  const operations =
    [];

  /*
   * Add accountPrivate to every
   * existing user's preferences.
   */
  for (
    const user
    of users.docs
  ) {
    const current =
      user.get(
        "privacyPreferences"
      ) ??
      {};

    const accountPrivate =
      current
        .accountPrivate ===
      true;

    privacyByUser.set(
      user.id,
      accountPrivate
    );

    operations.push(
      (
        batch
      ) => {
        batch.update(
          user.ref,
          {
            privacyPreferences: {
              accountPrivate,

              requirePrivateCheck:
                current
                  .requirePrivateCheck
                  !== false,

              showReflectionDates:
                current
                  .showReflectionDates
                  !== false
            }
          }
        );
      }
    );
  }

  /*
   * Add isPrivateAccount to
   * every searchable profile.
   */
  for (
    const profile
    of profiles.docs
  ) {
    operations.push(
      (
        batch
      ) => {
        batch.update(
          profile.ref,
          {
            isPrivateAccount:
              privacyByUser.get(
                profile.id
              ) === true
          }
        );
      }
    );
  }

  /*
   * Add accountPrivate to
   * every existing reflection.
   */
  for (
    const reflection
    of reflections.docs
  ) {
    const userId =
      reflection.get(
        "userId"
      );

    operations.push(
      (
        batch
      ) => {
        batch.update(
          reflection.ref,
          {
            accountPrivate:
              privacyByUser.get(
                userId
              ) === true
          }
        );
      }
    );
  }

  console.log(
    `Updating ${operations.length} documents...`
  );

  await commitOperations(
    operations
  );

  console.log(
    "Migration complete."
  );

  console.log(
    `Users: ${users.size}`
  );

  console.log(
    `Social profiles: ${profiles.size}`
  );

  console.log(
    `Reflections: ${reflections.size}`
  );

  console.log(
    "Private-account fields are ready."
  );
}

main()
  .then(() => {
    process.exit(
      0
    );
  })
  .catch(
    (
      error
    ) => {
      console.error(
        "Migration failed:"
      );

      console.error(
        error
      );

      process.exit(
        1
      );
    }
  );