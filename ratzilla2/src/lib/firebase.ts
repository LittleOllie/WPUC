/**
 * Ratzilla Firebase bootstrap (Firestore v9+ modular SDK).
 *
 * Firestore layout:
 *   collection: ratzilla
 *   document:   infectionStats
 *   fields:     count (number), target (number), lastUpdated (timestamp)
 */
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCGue0lg9CJaTFwXzSu6GiHZFSNfwgbRmQ",
  authDomain: "ratzilla-fd11a.firebaseapp.com",
  projectId: "ratzilla-fd11a",
  storageBucket: "ratzilla-fd11a.firebasestorage.app",
  messagingSenderId: "510834097084",
  appId: "1:510834097084:web:d4798c9f4756792ff5c9b9",
};

const app = initializeApp(firebaseConfig);

/** Shared Firestore instance for infection counter reads/writes. */
export const db = getFirestore(app);
