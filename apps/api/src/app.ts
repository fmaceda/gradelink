import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import express, { type RequestHandler, type Router } from "express";
import { auth, writeAuthLog } from "./auth.ts";
import { env } from "./env.ts";
import { requireJsonBody } from "./middleware/content-type.ts";
import { errorHandler, notFound } from "./middleware/error-handler.ts";
import { requestLog } from "./middleware/request-log.ts";
import { cspNonce, securityHeaders } from "./middleware/security-headers.ts";
import { createApiRouter } from "./routes/index.ts";

const JSON_BODY_LIMIT = "100kb";

// The same relative path works from src/ under tsx and from dist/ after the build.
const DEFAULT_WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));

const betterAuthHandler = toNodeHandler(auth);

// Thrown failures go on to errorHandler. Better Auth answers its own API errors itself, including
// 500s such as the breached-password service being down, and with onAPIError.throw it logs none
// of them, so a 5xx it answered gets a status-only line here.
const handleAuth: RequestHandler = async (req, res) => {
  await betterAuthHandler(req, res);
  if (res.statusCode >= 500) {
    writeAuthLog("error", `Better Auth answered ${res.statusCode}`);
  }
};

// apps/web/index.html carries this in a meta tag; each response swaps in its own CSP nonce, which
// the SPA hands to Radix's scroll lock (apps/web/src/csp-nonce.ts).
const CSP_NONCE_PLACEHOLDER = "__CSP_NONCE__";

// A missing hashed bundle must fail loudly, not load index.html as JavaScript.
const assetNotFound: RequestHandler = (_req, res) => {
  res.status(404).type("text/plain").send("Not found");
};

type AppOptions = {
  // The built SPA. Tests pass a fixture directory because CI runs them before the build.
  webDist?: string;
  // Routes under /api. Tests pass a router of probe routes; the app passes its real one.
  apiRouter?: Router;
  // Proxy hops trusted for req.ip (env TRUST_PROXY).
  trustProxy?: number;
};

// Builds the Express app. Order matters (ARCHITECTURE.md rules 7 and 8): the request log and
// security headers first so every response gets them, the Better Auth mount before
// express.json(), routers under /api, a JSON 404 for unknown /api/*, the SPA, then one last
// JSON 404 and the error handler.
export function createApp({
  webDist = DEFAULT_WEB_DIST,
  apiRouter = createApiRouter(),
  trustProxy = env.TRUST_PROXY,
}: AppOptions = {}) {
  const app = express();
  app.set("trust proxy", trustProxy);

  app.use(requestLog);
  app.use(securityHeaders(env.NODE_ENV === "production"));

  app.all("/api/auth/*splat", handleAuth);

  app.use("/api", requireJsonBody);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use("/api", apiRouter);
  app.use("/api", notFound);

  // Served whenever a build exists, so the API alone still starts in development and in tests.
  const indexHtml = path.join(webDist, "index.html");
  if (existsSync(indexHtml)) {
    // Read once: the build doesn't change while the server runs.
    const indexTemplate = readFileSync(indexHtml, "utf8");
    app.use(express.static(webDist, { index: false }));
    app.use("/assets", assetNotFound);
    app.get("/{*splat}", (_req, res) => {
      // The nonce is base64, so it can't break out of the attribute. no-cache: every load
      // revalidates, so a page never pairs one response's nonce with another's header.
      res
        .type("html")
        .set("Cache-Control", "no-cache")
        .send(indexTemplate.replaceAll(CSP_NONCE_PLACEHOLDER, cspNonce(res)));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
