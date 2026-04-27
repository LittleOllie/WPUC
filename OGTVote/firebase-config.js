/**
 * Web app config (Firebase Console → Project settings → Your apps).
 * Client API keys are expected in the browser; lock down access with Firestore rules + App Check if needed.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDgieR_37LyYtB_Zw892GozTNMV-9DWO6I",
  authDomain: "ogtvote.firebaseapp.com",
  projectId: "ogtvote",
  storageBucket: "ogtvote.firebasestorage.app",
  messagingSenderId: "1056540901452",
  appId: "1:1056540901452:web:ac5a000cd17449630334e9",
  measurementId: "G-Y1EBQ0ZTCM",
};

export function isFirebaseConfigured() {
  const id = String(firebaseConfig.projectId || "");
  return Boolean(id && id !== "YOUR_PROJECT_ID" && !id.startsWith("YOUR_"));
}
