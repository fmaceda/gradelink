import { z } from "zod";

// Values that are committed to the repo, so they must never sign production sessions.
const PLACEHOLDER_SECRETS = new Set(["replace-me-with-a-long-random-value"]);

const envSchema = z
  .object({
    // Required: a default would let a deploy that forgets it run with development security.
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && PLACEHOLDER_SECRETS.has(value.BETTER_AUTH_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "must not be a placeholder in production",
      });
    }
  });

function parseEnv(source: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  // Names only: a value here could be a secret, and this message reaches the logs.
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(`Invalid environment variables: ${names.join(", ")}`);
}

// The only place in the app that reads process.env (BP-044). Importing this module fails fast.
export const env = parseEnv(process.env);
