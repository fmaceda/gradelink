import { uuidSchema } from "@gradelink/shared";
import { and, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../db/client.ts";
import { notFoundError } from "../errors.ts";

// A teacher-owned table: one with its own id and a teacher_id (questions, tests).
type OwnedTable = PgTable & { id: PgColumn; teacherId: PgColumn };

type OwnedLookup = {
  // From currentTeacherId, never from the request (BP-012).
  teacherId: string;
  // Routes parse it with the shared uuid schema (a 400); checked again below.
  id: string;
};

// Loads one row by id for its owner (BP-031: `where id = ? and teacher_id = ?`). Another
// teacher's row and an id that doesn't exist throw the same 404, so ids can't be probed.
export async function findOwned<T extends OwnedTable>(
  table: T,
  { teacherId, id }: OwnedLookup,
): Promise<T["$inferSelect"]> {
  // The type requires the field; this stops an empty string from a bug matching nothing quietly.
  if (teacherId === "") {
    throw new Error("findOwned needs a teacherId");
  }
  // A non-uuid id would make Postgres throw 22P02, a 500. No uuid can match, so it's the same 404
  // as any other missing id, even from a route that forgot to parse it (BP-045).
  if (!uuidSchema.safeParse(id).success) {
    throw notFoundError();
  }
  const [row] = await db
    .select()
    .from(table as PgTable)
    .where(and(eq(table.id, id), eq(table.teacherId, teacherId)))
    .limit(1);
  if (row === undefined) {
    throw notFoundError();
  }
  return row as T["$inferSelect"];
}
