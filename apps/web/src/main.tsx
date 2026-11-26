// Must stay the first import: see zod-config.ts.
import "./zod-config";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The DOM build of RouterProvider (React Router 8, library/data mode).
import { RouterProvider } from "react-router/dom";
import { applyCspNonce } from "./csp-nonce";
import { router } from "./router";
import "./styles.css";

// Before anything renders, so the first scroll lock already has the nonce.
applyCspNonce();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
