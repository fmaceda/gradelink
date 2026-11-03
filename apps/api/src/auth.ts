import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { db } from "./db/client.ts";
import * as schema from "./db/schema.ts";
import { env } from "./env.ts";

const ONE_HOUR_IN_SECONDS = 60 * 60;
const SIGN_IN_LIMIT = { window: 60, max: 10 };
// In development the browser only sees the Vite origin; /api is proxied to Express.
const VITE_DEV_ORIGIN = "http://localhost:5173";

const MAX_LOG_MESSAGE_LENGTH = 200;

const isProduction = env.NODE_ENV === "production";

function errorCode(args: unknown[]) {
  for (const arg of args) {
    if (arg instanceof Error) {
      const { code, cause } = arg as Error & { code?: unknown; cause?: { code?: unknown } };
      return String(cause?.code ?? code ?? arg.name);
    }
  }
  return undefined;
}

// Better Auth logs failed queries with Drizzle's error, whose message holds the query params:
// session tokens and password hashes (BP-043). So the extra arguments are never written, only
// one short line of Better Auth's own message and an error code.
export function writeAuthLog(level: string, message: string, ...args: unknown[]) {
  const line = (message.split(/\r?\n/, 1)[0] ?? "").slice(0, MAX_LOG_MESSAGE_LENGTH);
  const code = errorCode(args);
  process.stderr.write(`[auth] ${level}: ${line}${code ? ` (${code})` : ""}\n`);
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 15 },
  session: { expiresIn: 24 * ONE_HOUR_IN_SECONDS, updateAge: ONE_HOUR_IN_SECONDS },
  trustedOrigins:
    env.NODE_ENV === "development" ? [env.BETTER_AUTH_URL, VITE_DEV_ORIGIN] : [env.BETTER_AUTH_URL],
  rateLimit: {
    enabled: true,
    storage: "memory",
    window: 60,
    max: 100,
    customRules: { "/sign-in/email": SIGN_IN_LIMIT, "/sign-up/email": SIGN_IN_LIMIT },
  },
  advanced: {
    // Better Auth turns these checks off by default under NODE_ENV=test. Tests must exercise them.
    disableOriginCheck: false,
    disableCSRFCheck: false,
    useSecureCookies: isProduction,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProduction },
  },
  logger: { level: "warn", log: writeAuthLog },
  // Otherwise Better Auth's router prints unexpected errors whole with console.error, whatever
  // the logger above does. Thrown, they reach the error handler in app.ts instead.
  onAPIError: { throw: true },
  telemetry: { enabled: false },
  plugins: [haveIBeenPwned()],
});
