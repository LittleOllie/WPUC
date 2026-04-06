import { createRoot } from "react-dom/client";
import App from "./App";
import { initFirebaseAnalytics } from "./firebase";

void initFirebaseAnalytics();

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(<App />);
}
