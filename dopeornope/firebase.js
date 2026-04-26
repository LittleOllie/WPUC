import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD8wLF9AP_1ymZ9VBsPlzABDvmeuSEpUx8",
  authDomain: "lo-dope-or-nope.firebaseapp.com",
  projectId: "lo-dope-or-nope",
  storageBucket: "lo-dope-or-nope.firebasestorage.app",
  messagingSenderId: "19718843403",
  appId: "1:19718843403:web:f0c2a6eaa693654fdbab0e",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
