import express from "express";

// Builds the Express app. Order matters (ARCHITECTURE.md rules 7 and 8): Better Auth mount
// before express.json(), then routers under /api, a JSON 404 for unknown /api/*, then the SPA.
export function createApp() {
  const app = express();
  return app;
}
