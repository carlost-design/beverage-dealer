import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import App from "./App";
import { PrintProvider } from "./components/print";
import { LanguageProvider } from "./i18n";
import "./index.css";
import { applyTextSize, readTextSize } from "./lib/textSize";

// Apply the saved text size before the first paint.
applyTextSize(readTextSize());

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <PrintProvider>
            <App />
          </PrintProvider>
        </BrowserRouter>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ duration: 5000, style: { fontSize: "1rem", padding: "1rem 1.25rem" } }}
        />
      </ConvexAuthProvider>
    </LanguageProvider>
  </StrictMode>,
);
