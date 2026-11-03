import { defineConfig } from "drizzle-kit";

// BP-044 exception: drizzle-kit loads this file itself, and importing src/env.ts would make
// migrations require the auth secrets too. It still fails fast and has no default.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("Invalid environment variables: DATABASE_URL");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
