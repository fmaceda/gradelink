import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { db, pool } from "../src/db/client.ts";
import { tests, user } from "../src/db/schema.ts";
import { AppError } from "../src/errors.ts";
import { findOwned } from "../src/services/owned.ts";

// findOwned against the real database, with two fabricated teachers inserted directly.
const teacherA = `owned-test-${randomUUID()}`;
const teacherB = `owned-test-${randomUUID()}`;

async function thrownBy(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected a rejection");
}

describe("findOwned", () => {
  let ownedId: string;

  beforeAll(async () => {
    await db.insert(user).values(
      [teacherA, teacherB].map((id) => ({
        id,
        name: "Fabricated Teacher",
        email: `${id}@owned-test.gradelink.example`,
      })),
    );
    const [row] = await db
      .insert(tests)
      .values({ teacherId: teacherA, title: "Owned by A" })
      .returning();
    ownedId = row?.id ?? "";
  });

  afterAll(async () => {
    try {
      await db.delete(tests).where(inArray(tests.teacherId, [teacherA, teacherB]));
      await db.delete(user).where(inArray(user.id, [teacherA, teacherB]));
    } finally {
      await pool.end();
    }
  });

  it("returns the owner's row", async () => {
    const row = await findOwned(tests, { teacherId: teacherA, id: ownedId });

    expect(row).toMatchObject({ id: ownedId, teacherId: teacherA, title: "Owned by A" });
  });

  it("throws the same 404 for another teacher's row as for a missing id (BP-031)", async () => {
    const otherTeacher = await thrownBy(findOwned(tests, { teacherId: teacherB, id: ownedId }));
    const missing = await thrownBy(findOwned(tests, { teacherId: teacherA, id: randomUUID() }));

    expect(otherTeacher).toBeInstanceOf(AppError);
    expect(otherTeacher).toMatchObject({ status: 404, code: "NOT_FOUND", message: "Not found." });
    expect(missing).toEqual(otherTeacher);
    expect({ ...(missing as AppError) }).toEqual({ ...(otherTeacher as AppError) });
  });

  it("answers a non-uuid id with the same 404 instead of a database error", async () => {
    const missing = await thrownBy(findOwned(tests, { teacherId: teacherA, id: randomUUID() }));

    for (const id of ["123", "not-a-uuid", `${ownedId}x`, ""]) {
      const error = await thrownBy(findOwned(tests, { teacherId: teacherA, id }));
      expect(error).toEqual(missing);
      expect({ ...(error as AppError) }).toEqual({ ...(missing as AppError) });
    }
  });

  it("requires a teacherId in its type", () => {
    expectTypeOf(findOwned<typeof tests>)
      .parameter(1)
      .toEqualTypeOf<{ teacherId: string; id: string }>();
  });

  it("refuses an empty teacherId instead of matching nothing", async () => {
    const error = await thrownBy(findOwned(tests, { teacherId: "", id: ownedId }));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AppError);
  });
});
