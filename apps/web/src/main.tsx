import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The DOM build of RouterProvider (React Router 8, library/data mode).
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
