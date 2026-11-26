import helmet from "helmet";

// Listed in full (useDefaults: false) so nothing loosens silently with a helmet upgrade.
// helmet's own default style-src includes 'unsafe-inline' and https:; this one doesn't.
// SECURITY.md Input Validation: 'unsafe-inline' in style-src only if a check proves Radix needs it.
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
      // Over plain-HTTP localhost this would break every asset request.
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  };
}

// Mounted first, so API responses, Better Auth and the SPA all get the same headers. No CORS
// headers are ever set (ARCHITECTURE.md rule 6).
export function securityHeaders(isProduction: boolean) {
  return helmet({
    contentSecurityPolicy: contentSecurityPolicy(isProduction),
    // The share token is in the /t/<token> path, so no URL is ever sent to another site.
    referrerPolicy: { policy: "no-referrer" },
    // HSTS over local HTTP would pin localhost to HTTPS in the developer's browser.
    strictTransportSecurity: isProduction,
  });
}
