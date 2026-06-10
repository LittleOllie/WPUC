import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC-F366Zxj9WB4WizVsv6iUbHQn6hzU9W4",
  authDomain: "vault-raid.firebaseapp.com",
  projectId: "vault-raid",
  storageBucket: "vault-raid.firebasestorage.app",
  messagingSenderId: "236814327201",
  appId: "1:236814327201:web:5ae67bff89a1ed8663bfe0",
  measurementId: "G-5027P01LC6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function userRef(uid) {
  return doc(db, "users", uid);
}

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signUp(email, password, username) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (username) await updateProfile(cred.user, { displayName: username });
  return cred.user;
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() {
  await signOut(auth);
}

export async function loadUser(uid) {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createUser(uid, data) {
  await setDoc(userRef(uid), {
    ...data,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveUser(uid, partial) {
  await updateDoc(userRef(uid), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function touchLogin(uid) {
  await updateDoc(userRef(uid), { lastLogin: serverTimestamp() });
}

/** Username-based save (no auth) for lightweight game builds. */
export function playerDocRef(slug) {
  return doc(db, "players", slug);
}

export async function loadPlayerBySlug(slug) {
  const snap = await getDoc(playerDocRef(slug));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function savePlayerBySlug(slug, data) {
  await setDoc(
    playerDocRef(slug),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
