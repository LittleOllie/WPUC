/**
 * Firebase init for Slider Puzzle leaderboard (same config as project root).
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAj7yKa2cxcDGi5Kcky6wgPkbQKzdy9seI",
  authDomain: "sliderpuzzle-ac7df.firebaseapp.com",
  projectId: "sliderpuzzle-ac7df",
  storageBucket: "sliderpuzzle-ac7df.firebasestorage.app",
  messagingSenderId: "602825992804",
  appId: "1:602825992804:web:18f67f22b68a7692ea8d71"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
