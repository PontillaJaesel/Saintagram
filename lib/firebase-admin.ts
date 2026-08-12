import {
  cert,
  getApps,
  initializeApp,
  type App,
  type AppOptions
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

const FIREBASE_ADMIN_APP_NAME = "saintagram-firebase-admin";

function trimmedEnvironmentValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function firebaseAdminOptions(): AppOptions {
  const browserProjectId = trimmedEnvironmentValue(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  );
  const adminProjectId =
    trimmedEnvironmentValue("FIREBASE_ADMIN_PROJECT_ID") || browserProjectId;
  const clientEmail = trimmedEnvironmentValue(
    "FIREBASE_ADMIN_CLIENT_EMAIL"
  );
  const escapedPrivateKey = trimmedEnvironmentValue(
    "FIREBASE_ADMIN_PRIVATE_KEY"
  );

  if (!adminProjectId) {
    throw new Error("The Firebase Admin project ID is not configured.");
  }
  if (browserProjectId && adminProjectId !== browserProjectId) {
    throw new Error(
      "The Firebase browser and Admin project IDs must refer to the same project."
    );
  }
  if (!clientEmail || !escapedPrivateKey) {
    throw new Error(
      "The Firebase Admin client email and private key are not configured."
    );
  }

  return {
    credential: cert({
      projectId: adminProjectId,
      clientEmail,
      privateKey: escapedPrivateKey.replace(/\\n/g, "\n")
    }),
    projectId: adminProjectId
  };
}

function firebaseAdminApp(): App {
  const existing = getApps().find(
    (app) => app.name === FIREBASE_ADMIN_APP_NAME
  );
  return (
    existing ??
    initializeApp(firebaseAdminOptions(), FIREBASE_ADMIN_APP_NAME)
  );
}

/**
 * Server-only Firebase Admin Auth instance.
 *
 * Keep every import of this module inside server routes or server utilities.
 * None of the FIREBASE_ADMIN_* values may be exposed with NEXT_PUBLIC_ names.
 */
export function getFirebaseAdminAuth(): Auth {
  return getAuth(firebaseAdminApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(firebaseAdminApp());
}

export function getFirebaseAdminStorage(): Storage {
  return getStorage(firebaseAdminApp());
}
