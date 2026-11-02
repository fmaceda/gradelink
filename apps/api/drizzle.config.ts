import { defineConfig } from "drizzle-kit";

// DATABASE_URL comes from the environment (see .env.example); no default on purpose.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
