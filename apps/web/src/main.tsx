import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// Placeholder. The router and routes are set up in TASK-004.
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <h1>GradeLink</h1>
    </StrictMode>,
  );
}
