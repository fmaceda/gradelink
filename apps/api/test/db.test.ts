import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
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

  it("survives an idle connection error, writing only its code", () => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const error = Object.assign(new Error("fabricated-host-details"), { code: "ECONNRESET" });

    expect(() => pool.emit("error", error)).not.toThrow();

    const output = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    write.mockRestore();
    expect(output).toContain("ECONNRESET");
    expect(output).not.toContain("fabricated-host-details");
  });
});
