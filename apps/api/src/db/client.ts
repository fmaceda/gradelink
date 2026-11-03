import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

// Provisional: Railway's connection limit is unconfirmed. TASK-039 checks this value.
const POOL_MAX = 5;

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: POOL_MAX });

export const db = drizzle({ client: pool, schema });
