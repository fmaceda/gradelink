import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, pool } from "../src/db/client.ts";

describe("database client", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("runs a query through Drizzle", async () => {
    const result = await db.execute(sql`select ${41}::int + 1 as answer`);

    expect(result.rows).toEqual([{ answer: 42 }]);
  });

  it("limits the pool size", () => {
    expect(pool.options.max).toBe(5);
  });
});
