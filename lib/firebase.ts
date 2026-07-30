import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth
} from "firebase/auth";
<<<<<<< HEAD
import { getDatabase, type Database } from "firebase/database";
=======
import { getFirestore, type Firestore } from "firebase/firestore";
>>>>>>> origin/feature/Access-Code

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
<<<<<<< HEAD
  db: Database;
=======
  db: Firestore;
>>>>>>> origin/feature/Access-Code
}

let services: FirebaseServices | null = null;

export function getFirebaseServices(): FirebaseServices | null {
  if (!isFirebaseConfigured || typeof window === "undefined") return null;
  if (services) return services;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence);
  services = {
    app,
    auth,
<<<<<<< HEAD
    db: getDatabase(app)
=======
    db: getFirestore(app)
>>>>>>> origin/feature/Access-Code
  };
  return services;
}
