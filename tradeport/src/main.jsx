import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { WalletProvider } from "./context/WalletContext.jsx";
import { ProfileProvider } from "./context/ProfileContext.jsx";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("TradePort root element not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <WalletProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </WalletProvider>
    </ErrorBoundary>
  </StrictMode>
);
