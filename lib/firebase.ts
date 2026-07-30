import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Firebase web configuration identifies the public client app; it is not a
// secret. Keep production defaults here because Sites runtime variables are
// not available when the browser bundle evaluates NEXT_PUBLIC_* references.
// Environment variables still take precedence for previews and other projects.
const productionFirebaseConfig =
  process.env.NODE_ENV === "production"
    ? {
        apiKey: "AIzaSyBPI__TDo06VKvWOmGxQjDagOcsdoLmTko",
        authDomain: "saintagram-51ccc.firebaseapp.com",
        projectId: "saintagram-51ccc",
        messagingSenderId: "1045750502235",
        appId: "1:1045750502235:web:04902ace84ed9ee912807e"
      }
    : {};

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    productionFirebaseConfig.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    productionFirebaseConfig.authDomain,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    productionFirebaseConfig.projectId,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    productionFirebaseConfig.messagingSenderId,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    productionFirebaseConfig.appId
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
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
    db: getFirestore(app)
  };
  return services;
}
