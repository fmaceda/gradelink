// Cross-teacher isolation (SECURITY.md Teacher data isolation, BP-031). Every /api/teacher/*
// route adds its cases to the "routes" block below in the task that builds it; see the note at
// the top of support/teachers.ts. Until TASK-011 there are no real routes, so the harness and
// expectNotFoundForOtherTeacher are proven against probe routes.
import { uuidSchema } from "@gradelink/shared";
import { and, eq, inArray, like } from "drizzle-orm";
import { Router } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../src/app.ts";
import { db, pool } from "../src/db/client.ts";
import { questions, tests, user } from "../src/db/schema.ts";
import { AppError, notFoundError } from "../src/errors.ts";
import { currentTeacherId } from "../src/middleware/require-teacher.ts";
import { validated } from "../src/middleware/validate.ts";
import { createApiRouter } from "../src/routes/index.ts";
import { findOwned } from "../src/services/owned.ts";
import { listen } from "./support/server.ts";
import {
  createTwoTeachers,
  expectNotFoundForOtherTeacher,
  TEACHER_EMAIL_DOMAIN,
  type TeacherPair,
  withTwoTeachers,
} from "./support/teachers.ts";

const byId = {
  body: z.undefined(),
  params: z.strictObject({ id: uuidSchema }),
  query: z.object({}),
};

const renameBody = z.strictObject({ title: z.string() });

async function findById(id: string) {
  const [row] = await db.select().from(tests).where(eq(tests.id, id));
  return row;
}

// Probe routes standing in for real teacher routes: one correct, and one for each way a route
// can leak another teacher's resource.
function probeRouter() {
  const router = Router();
  router.get(
    "/scoped/:id",
    validated(byId, async ({ params }, _req, res) => {
      const row = await findOwned(tests, { teacherId: currentTeacherId(res), id: params.id });
      res.json({ id: row.id, title: row.title });
    }),
  );
  router.delete(
    "/scoped/:id",
    validated(byId, async ({ params }, _req, res) => {
      const teacherId = currentTeacherId(res);
      await findOwned(tests, { teacherId, id: params.id });
      await db.delete(tests).where(and(eq(tests.id, params.id), eq(tests.teacherId, teacherId)));
      res.status(204).end();
    }),
  );
  router.patch(
    "/scoped/:id",
    validated({ ...byId, body: renameBody }, async ({ params, body }, _req, res) => {
      const teacherId = currentTeacherId(res);
      await findOwned(tests, { teacherId, id: params.id });
      await db
        .update(tests)
        .set({ title: body.title })
        .where(and(eq(tests.id, params.id), eq(tests.teacherId, teacherId)));
      res.status(204).end();
    }),
  );
  // Writes by id alone, then checks the owner: B's request answers 404 but has already renamed
  // A's test.
  router.patch(
    "/blind/:id",
    validated({ ...byId, body: renameBody }, async ({ params, body }, _req, res) => {
      await db.update(tests).set({ title: body.title }).where(eq(tests.id, params.id));
      await findOwned(tests, { teacherId: currentTeacherId(res), id: params.id });
      res.status(204).end();
    }),
  );
  // Filters by id alone.
  router.get(
    "/unscoped/:id",
    validated(byId, async ({ params }, _req, res) => {
      const row = await findById(params.id);
      if (row === undefined) throw notFoundError();
      res.json({ id: row.id, title: row.title });
    }),
  );
  // Admits the resource exists with a 403.
  router.get(
    "/forbidden/:id",
    validated(byId, async ({ params }, _req, res) => {
      const row = await findById(params.id);
      if (row === undefined) throw notFoundError();
      if (row.teacherId !== currentTeacherId(res)) {
        res.status(403).json({ error: { code: "NOT_FOUND", message: "Not found." } });
        return;
      }
      res.json({ id: row.id });
    }),
  );
  // A 404 that reads differently from the missing-id one.
  router.get(
    "/leaky/:id",
    validated(byId, async ({ params }, _req, res) => {
      const row = await findById(params.id);
      if (row === undefined) throw notFoundError();
      if (row.teacherId !== currentTeacherId(res)) {
        throw new AppError(404, "NOT_FOUND", "That test belongs to another teacher.");
      }
      res.json({ id: row.id });
    }),
  );
  // Broken for its owner too.
  router.get(
    "/always-missing/:id",
    validated(byId, () => {
      throw notFoundError();
    }),
  );
  return router;
}

async function insertTest(teacherId: string, title = "Probe test") {
  const [row] = await db.insert(tests).values({ teacherId, title }).returning();
  if (row === undefined) throw new Error("insert returned no row");
  return row.id;
}

describe("cross-teacher isolation", () => {
  let server: Awaited<ReturnType<typeof listen>>;
  let teachers: TeacherPair;

  beforeAll(async () => {
    const teacherRouter = Router();
    teacherRouter.use("/probe", probeRouter());
    server = await listen(createApp({ apiRouter: createApiRouter({ teacherRouter }) }));
    teachers = await createTwoTeachers(server.url);
  });

  afterAll(async () => {
    try {
      await teachers?.cleanup();
      await server?.close();
    } finally {
      await pool.end();
    }
  });

  describe("harness", () => {
    it("signs in two distinct teachers through Better Auth", async () => {
      const { a, b } = teachers;

      expect(a.id).not.toBe(b.id);
      expect(a.cookie).not.toBe(b.cookie);
      const rows = await db
        .select()
        .from(user)
        .where(like(user.email, `%@${TEACHER_EMAIL_DOMAIN}`));
      expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    });

    it("cleans up in finally when the test body fails, including owned rows", async () => {
      let emails: string[] = [];
      let testId = "";
      let questionId = "";

      await expect(
        withTwoTeachers(server.url, async ({ a, b }) => {
          emails = [a.email, b.email];
          testId = await insertTest(a.id);
          const [question] = await db
            .insert(questions)
            .values({
              teacherId: b.id,
              type: "true_false",
              prompt: "Fabricated prompt",
              options: [
                { id: "true", text: "True" },
                { id: "false", text: "False" },
              ],
              answerKey: { correctOptionIds: ["true"] },
            })
            .returning();
          questionId = question?.id ?? "";
          throw new Error("simulated test failure");
        }),
      ).rejects.toThrow("simulated test failure");

      expect(emails).toHaveLength(2);
      for (const email of emails) {
        expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
      }
      expect(await findById(testId)).toBeUndefined();
      expect(await db.select().from(questions).where(eq(questions.id, questionId))).toHaveLength(0);
    });

    it("removes teacher A when teacher B's sign-up fails", async () => {
      const realFetch = globalThis.fetch;
      const emails: string[] = [];
      let teacherACreated = false;
      const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        if (!String(input).endsWith("/api/auth/sign-up/email")) {
          return realFetch(input, init);
        }
        const { email } = JSON.parse(String(init?.body)) as { email: string };
        emails.push(email);
        if (emails.length === 2) {
          return new Response("", { status: 500 });
        }
        const response = await realFetch(input, init);
        teacherACreated = (await db.select().from(user).where(eq(user.email, email))).length === 1;
        return response;
      });

      try {
        await expect(createTwoTeachers(server.url)).rejects.toThrow("sign-up failed with 500");
      } finally {
        spy.mockRestore();
      }

      expect(teacherACreated).toBe(true);
      expect(emails).toHaveLength(2);
      expect(await db.select().from(user).where(inArray(user.email, emails))).toHaveLength(0);
    });
  });

  describe("expectNotFoundForOtherTeacher", () => {
    it("passes for a route scoped by findOwned", async () => {
      const id = await insertTest(teachers.a.id);

      await expectNotFoundForOtherTeacher(teachers, id, (target) => ({
        path: `/api/teacher/probe/scoped/${target}`,
      }));
    });

    it("passes for a scoped delete, which teacher B can't perform", async () => {
      const id = await insertTest(teachers.a.id);

      await expectNotFoundForOtherTeacher(teachers, id, (target) => ({
        method: "DELETE",
        path: `/api/teacher/probe/scoped/${target}`,
      }));

      expect(await findById(id)).toBeUndefined();
    });

    it("passes for a scoped update, which leaves teacher A's row as it was", async () => {
      const id = await insertTest(teachers.a.id, "Original title");

      await expectNotFoundForOtherTeacher(
        teachers,
        id,
        (target) => ({
          method: "PATCH",
          path: `/api/teacher/probe/scoped/${target}`,
          body: { title: "Renamed" },
        }),
        { readOwned: () => findById(id) },
      );

      // Only teacher A's own request, which runs last, renamed it.
      expect((await findById(id))?.title).toBe("Renamed");
    });

    it("fails for an update that changes teacher A's row while answering 404", async () => {
      const id = await insertTest(teachers.a.id, "Original title");

      await expect(
        expectNotFoundForOtherTeacher(
          teachers,
          id,
          (target) => ({
            method: "PATCH",
            path: `/api/teacher/probe/blind/${target}`,
            body: { title: "Renamed by B" },
          }),
          { readOwned: () => findById(id) },
        ),
      ).rejects.toThrow("must not change teacher A's resource");
    });

    it("refuses an update case without readOwned", async () => {
      const id = await insertTest(teachers.a.id);

      for (const method of ["POST", "PUT", "patch"]) {
        await expect(
          expectNotFoundForOtherTeacher(teachers, id, (target) => ({
            method,
            path: `/api/teacher/probe/scoped/${target}`,
            body: { title: "Renamed" },
          })),
        ).rejects.toThrow("must pass readOwned");
      }
      expect((await findById(id))?.title).toBe("Probe test");
    });

    it("fails for a route that filters by id alone", async () => {
      const id = await insertTest(teachers.a.id);

      await expect(
        expectNotFoundForOtherTeacher(teachers, id, (target) => ({
          path: `/api/teacher/probe/unscoped/${target}`,
        })),
      ).rejects.toThrow("never 403");
    });

    it("fails for a route that answers another teacher's resource with 403", async () => {
      const id = await insertTest(teachers.a.id);

      await expect(
        expectNotFoundForOtherTeacher(teachers, id, (target) => ({
          path: `/api/teacher/probe/forbidden/${target}`,
        })),
      ).rejects.toThrow("never 403");
    });

    it("fails when the cross-teacher 404 body differs from the missing-id one", async () => {
      const id = await insertTest(teachers.a.id);

      await expect(
        expectNotFoundForOtherTeacher(teachers, id, (target) => ({
          path: `/api/teacher/probe/leaky/${target}`,
        })),
      ).rejects.toThrow("look exactly like a missing one");
    });

    it("fails when teacher A can't reach their own resource either", async () => {
      const id = await insertTest(teachers.a.id);

      await expect(
        expectNotFoundForOtherTeacher(teachers, id, (target) => ({
          path: `/api/teacher/probe/always-missing/${target}`,
        })),
      ).rejects.toThrow("teacher A must reach their own resource");
    });
  });

  // Real routes add their cases here from TASK-011 on.
  describe.todo("routes");
});
