import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, type Firestore } from "firebase/firestore";

function readFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
}

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

/** Single Firebase app for the LO × DDG build (Firestore + Analytics). */
export function getFirebaseApp(): FirebaseApp {
  if (appInstance) return appInstance;
  const cfg = readFirebaseConfig();
  if (!cfg.apiKey || !cfg.projectId) {
    throw new Error(
      "Firebase is not configured. Add VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID (and other keys) to your .env file."
    );
  }
  appInstance = getApps().length === 0 ? initializeApp(cfg) : getApps()[0]!;
  return appInstance;
}

export function getFirestoreDb(): Firestore {
  if (dbInstance) return dbInstance;
  dbInstance = getFirestore(getFirebaseApp());
  return dbInstance;
}

/** Enables Google Analytics when supported (browser only). Safe to fire-and-forget from main. */
export async function initFirebaseAnalytics(): Promise<void> {
  try {
    if (!(await isSupported())) return;
    const app = getFirebaseApp();
    getAnalytics(app);
  } catch {
    /* missing env, blocked, or unsupported */
  }
}
