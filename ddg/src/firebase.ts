import { type FirebaseApp, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

let appSingleton: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (appSingleton) return appSingleton;

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY ?? "";
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "";
  if (!apiKey || !projectId) {
    throw new Error(
      "Firebase: missing VITE_FIREBASE_API_KEY and/or VITE_FIREBASE_PROJECT_ID. Set all VITE_FIREBASE_* variables in .env (local) or GitHub Actions secrets (CI)."
    );
  }

  appSingleton = initializeApp({
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  });
  return appSingleton;
}

export function getFirebaseFirestore() {
  return getFirestore(getFirebaseApp());
}

/** Best-effort Analytics; fails quietly if blocked, unsupported, or Firebase env is missing. */
export async function initFirebaseAnalytics(): Promise<void> {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY ?? "";
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "";
  if (!apiKey || !projectId) return;
  try {
    const app = getFirebaseApp();
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (typeof window === "undefined") return;
    if (!(await isSupported())) return;
    getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics not initialized:", e);
  }
}
