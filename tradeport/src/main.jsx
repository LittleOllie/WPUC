import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { WalletProvider } from "./context/WalletContext.jsx";
import { ProfileProvider } from "./context/ProfileContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <WalletProvider>
      <ProfileProvider>
        <App />
      </ProfileProvider>
    </WalletProvider>
  </StrictMode>
);
