import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/ratzilla2.css";
import "./styles/infection.css";
import "./styles/containment.css";
import "./styles/whitelist.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
