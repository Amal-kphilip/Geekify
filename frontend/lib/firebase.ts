import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them at build time.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when the Firebase env vars are present. Without them the app runs in guest-only mode. */
export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

export type Firebase = { app: FirebaseApp; auth: Auth; db: Firestore };

let cached: Firebase | null = null;

/** Browser-only, lazy. Returns null on the server or when Firebase isn't configured. */
export function getFirebase(): Firebase | null {
  if (typeof window === "undefined" || !firebaseConfigured) return null;
  if (!cached) {
    const app = getApps().length ? getApp() : initializeApp(config);
    cached = { app, auth: getAuth(app), db: getFirestore(app) };
  }
  return cached;
}
