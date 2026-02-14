// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

console.log("🔥 Firebase module loading...");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDar7dEWWf_BVqXwh_TPCeScZ3ZQM157qw",
  authDomain: "littleollie-onebuttonhero.firebaseapp.com",
  projectId: "littleollie-onebuttonhero",
  storageBucket: "littleollie-onebuttonhero.firebasestorage.app",
  messagingSenderId: "569971658655",
  appId: "1:569971658655:web:759194e2501c34d71777aa"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
console.log("✅ Firebase initialized");
