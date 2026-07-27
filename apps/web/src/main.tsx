import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import { App } from "./App";
import { UiProvider } from "./ui";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <UiProvider>
      <App />
    </UiProvider>
  </StrictMode>,
);
