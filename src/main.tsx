import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Web3ContextProvider } from "./contexts/Web3Context.tsx";
import { AIContextProvider } from "./contexts/AIContext.tsx";
import { StorageContextProvider } from "./contexts/StorageContext.tsx";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Web3ContextProvider>
      <AIContextProvider>
        <StorageContextProvider>
          <App />
        </StorageContextProvider>
      </AIContextProvider>
    </Web3ContextProvider>
  </StrictMode>
);
