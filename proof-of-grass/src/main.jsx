import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "../../styles/lo-playground.css";
import "../../home.css";
import "../../styles/labs-nav.css";
import "../../styles/labs-game-header.css";
import "../../styles/labs-game-stage.css";
import "../../styles/labs-game-switcher.css";
import "./index.css";
import "./pog-labs.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
