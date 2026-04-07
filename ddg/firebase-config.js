/**
 * Firebase initialization for Frappy Brew leaderboard.
 *
 * SETUP (Firebase Console → Project settings → Your apps → Web app):
 * 1. Paste your web app's config object below.
 * 2. Enable Cloud Firestore in Firebase Console.
 * 3. Deploy the Security Rules (leaderboard.rules).
 *
 * Uses the Firebase v10 modular SDK from Google's CDN (same as leaderboard-init.js).
 * Do not mix in npm-style imports like "firebase/app" — those need a bundler.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJhskef25gVWuaNBfyxEf1RUkq7c8MWl4",
  authDomain: "ddgfb-33f83.firebaseapp.com",
  projectId: "ddgfb-33f83",
  storageBucket: "ddgfb-33f83.firebasestorage.app",
  messagingSenderId: "661949656271",
  appId: "1:661949656271:web:9694ca4bdfac318fa91bba",
  measurementId: "G-KJ99VJY3LP",
};

/** True when apiKey has been replaced with a real key (minimal sanity check). */
export const isFirebaseConfigured =
  typeof firebaseConfig.apiKey === "string" &&
  firebaseConfig.apiKey.length > 12 &&
  firebaseConfig.apiKey !== "REPLACE_ME" &&
  typeof firebaseConfig.projectId === "string" &&
  firebaseConfig.projectId !== "REPLACE_ME";

let app = null;
/** @type {import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js').Firestore | null} */
export let db = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.warn("[firebase-config] Firebase init failed:", e);
    db = null;
  }
} else {
  console.info(
    "[firebase-config] Firebase not configured — paste your config in firebase-config.js to enable the leaderboard."
  );
}
