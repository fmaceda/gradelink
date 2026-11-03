import { toNodeHandler } from "better-auth/node";
import express, { type ErrorRequestHandler } from "express";
import { auth, writeAuthLog } from "./auth.ts";

const JSON_BODY_LIMIT = "100kb";

// Unexpected auth failures only; Better Auth answers its own API errors (401, 429) itself.
const handleAuthError: ErrorRequestHandler = (error, _req, res, next) => {
  writeAuthLog("error", "Auth request failed", error);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
};

// Builds the Express app. Order matters (ARCHITECTURE.md rules 7 and 8): Better Auth mount
// before express.json(), then routers under /api, a JSON 404 for unknown /api/*, then the SPA.
export function createApp() {
  const app = express();

  app.all("/api/auth/*splat", toNodeHandler(auth), handleAuthError);

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Stack proof for TASK-001: shows Express 5 answering under tsx and in the Vitest smoke test.
  app.get("/api/hello", (_req, res) => {
    res.json({ message: "hello" });
  });

  return app;
}
