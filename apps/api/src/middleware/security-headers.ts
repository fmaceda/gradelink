import { randomBytes } from "node:crypto";
import type { RequestHandler, Response } from "express";
import helmet from "helmet";

declare global {
  namespace Express {
    interface Locals {
      // A fresh value for every response (TASK-010 CSP check). See cspNonce below.
      cspNonce?: string;
    }
  }
}

// 128 bits from the CSPRNG, as CSP Level 3 recommends.
const assignCspNonce: RequestHandler = (_req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString("base64");
  next();
};

export function cspNonce(res: Response): string {
  const nonce = res.locals.cspNonce;
  if (nonce === undefined) {
    throw new Error("cspNonce read before securityHeaders ran");
  }
  return nonce;
}

// Listed in full (useDefaults: false) so nothing loosens silently with a helmet upgrade.
// helmet's own default style-src includes 'unsafe-inline' and https:; this one doesn't.
// SECURITY.md Input Validation: never 'unsafe-inline'. The TASK-010 browser check proved that
// Radix's scroll lock (Sheet, Dialog, modal menus) injects a <style> element, so
// style-src-elem allows <style> elements carrying this response's nonce, and nothing else
// inline. style-src stays 'self', so inline style="" attributes in markup are still blocked, and
// a browser without style-src-elem falls back to it (the scroll lock then doesn't apply).
function contentSecurityPolicy(isProduction: boolean) {
  return {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'"],
      styleSrcElem: [
        "'self'",
        (_req: unknown, res: unknown) => `'nonce-${cspNonce(res as Response)}'`,
      ],
      // Over plain-HTTP localhost this would break every asset request.
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  };
}

// Mounted first, so API responses, Better Auth and the SPA all get the same headers. No CORS
// headers are ever set (ARCHITECTURE.md rule 6).
export function securityHeaders(isProduction: boolean): RequestHandler[] {
  const headers = helmet({
    contentSecurityPolicy: contentSecurityPolicy(isProduction),
    // The share token is in the /t/<token> path, so no URL is ever sent to another site.
    referrerPolicy: { policy: "no-referrer" },
    // HSTS over local HTTP would pin localhost to HTTPS in the developer's browser.
    strictTransportSecurity: isProduction,
  });
  return [assignCspNonce, headers];
}
