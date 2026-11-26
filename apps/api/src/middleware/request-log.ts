import { randomUUID } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { writeLogLine } from "../log.ts";

declare global {
  namespace Express {
    interface Locals {
      // Server-generated; never taken from an incoming header (TASK-005 decision).
      requestId: string;
    }
  }
}

// Requests that matched no route (static files, 404s) all log this, never their raw path.
export const UNMATCHED_PATTERN = "(no route)";

function routePath(route: unknown): string | undefined {
  if (typeof route === "object" && route !== null && "path" in route) {
    return typeof route.path === "string" ? route.path : undefined;
  }
  return undefined;
}

// Express sets req.route when a route matches, but resets req.baseUrl when an error leaves a
// mounted router, so a pattern read at the end would lose its mount path. Recording
// baseUrl + route.path at match time keeps it. Both are patterns, never the raw URL, and mount
// paths are static (BP-046), so a share token can't reach the log this way.
function recordRoutePattern(req: Request) {
  let pattern: string | undefined;
  let route: unknown = req.route;
  Object.defineProperty(req, "route", {
    configurable: true,
    enumerable: true,
    get: () => route,
    set: (value: unknown) => {
      route = value;
      const path = routePath(value);
      if (path !== undefined) {
        pattern = `${req.baseUrl}${path}`;
      }
    },
  });
  return () => pattern ?? UNMATCHED_PATTERN;
}

// One line per request: request id, method, route pattern, status. Nothing else, so no URL,
// query, body, cookie, header or IP (SECURITY.md Secrets Management, BP-043).
export const requestLog: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const pattern = recordRoutePattern(req);

  // "close" also fires when the client disconnects early, so every request gets its line.
  res.once("close", () => {
    writeLogLine(`[request] ${requestId} ${req.method} ${pattern()} ${res.statusCode}`);
  });
  next();
};
