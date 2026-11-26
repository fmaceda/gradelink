import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { auth, writeAuthLog } from "./auth.ts";

const JSON_BODY_LIMIT = "100kb";

// The same relative path works from src/ under tsx and from dist/ after the build.
const DEFAULT_WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));

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

// ARCHITECTURE.md rule 7: an unknown /api path is a JSON 404, never the SPA's HTML.
const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
};

// A missing hashed bundle must fail loudly, not load index.html as JavaScript.
const assetNotFound: RequestHandler = (_req, res) => {
  res.status(404).type("text/plain").send("Not found");
};

type AppOptions = {
  // The built SPA. Tests pass a fixture directory because CI runs them before the build.
  webDist?: string;
};

// Builds the Express app. Order matters (ARCHITECTURE.md rules 7 and 8): Better Auth mount
// before express.json(), then routers under /api, a JSON 404 for unknown /api/*, then the SPA.
export function createApp({ webDist = DEFAULT_WEB_DIST }: AppOptions = {}) {
  const app = express();

  app.all("/api/auth/*splat", toNodeHandler(auth), handleAuthError);

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use("/api", apiNotFound);

  // Served whenever a build exists, so the API alone still starts in development and in tests.
  const indexHtml = path.join(webDist, "index.html");
  if (existsSync(indexHtml)) {
    app.use(express.static(webDist, { index: false }));
    app.use("/assets", assetNotFound);
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  return app;
}
