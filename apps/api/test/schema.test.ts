import { randomUUID } from "node:crypto";
import type { SnapshotContent } from "@gradelink/shared";
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "../src/db/client.ts";
import {
  attemptAnswers,
  attempts,
  questions,
  testQuestions,
  testSnapshots,
  tests,
  user,
} from "../src/db/schema.ts";

// The TASK-007 schema against the real database. Each test makes its own rows under one
// fabricated teacher, and afterAll removes them.
const teacherId = `schema-test-${randomUUID()}`;

// The Postgres error code behind a failed query. Drizzle wraps driver errors in `cause`.
async function pgErrorCode(query: PromiseLike<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? (error as { code?: string }).code;
  }
  return undefined;
}

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

async function insertQuestion(points = 1) {
  const [row] = await db
    .insert(questions)
    .values({
      teacherId,
      type: "multiple_choice",
      prompt: "Fabricated prompt",
      options: [
        { id: "a", text: "First" },
        { id: "b", text: "Second" },
      ],
      answerKey: { correctOptionIds: ["a"] },
      points,
    })
    .returning();
  if (!row) throw new Error("insert returned no row");
  return row;
}

async function insertTest(title = "Fabricated test") {
  const [row] = await db.insert(tests).values({ teacherId, title }).returning();
  if (!row) throw new Error("insert returned no row");
  return row;
}

function snapshotOf(questionId: string): SnapshotContent {
  return {
    questions: [
      {
        key: "q1",
        sourceQuestionId: questionId,
        type: "multiple_choice",
        prompt: "Fabricated prompt",
        options: [
          { id: "a", text: "First" },
          { id: "b", text: "Second" },
        ],
        answerKey: { correctOptionIds: ["a"] },
        points: 1,
      },
    ],
  };
}

// A published test with its composition, snapshot, one attempt and one answer.
async function insertPublishedTest() {
  const question = await insertQuestion();
  const test = await insertTest();
  await db.insert(testQuestions).values({ testId: test.id, questionId: question.id, position: 0 });
  const [snapshot] = await db
    .insert(testSnapshots)
    .values({ testId: test.id, content: snapshotOf(question.id) })
    .returning();
  if (!snapshot) throw new Error("insert returned no row");
  const [attempt] = await db
    .insert(attempts)
    .values({
      testId: test.id,
      snapshotId: snapshot.id,
      studentName: "Fabricated Student",
      score: 1,
      maxScore: 1,
    })
    .returning();
  if (!attempt) throw new Error("insert returned no row");
  const [answer] = await db
    .insert(attemptAnswers)
    .values({
      attemptId: attempt.id,
      snapshotQuestionKey: "q1",
      sourceQuestionId: question.id,
      response: ["a"],
      awardedPoints: 1,
      maxPoints: 1,
    })
    .returning();
  if (!answer) throw new Error("insert returned no row");
  return { question, test, snapshot, attempt, answer };
}

describe("core schema", () => {
  beforeAll(async () => {
    await db.insert(user).values({
      id: teacherId,
      name: "Fabricated Teacher",
      email: `${teacherId}@schema-test.gradelink.example`,
    });
  });

  afterAll(async () => {
    try {
      // Tests cascade to their children; questions and the user go after them.
      await db.delete(tests).where(eq(tests.teacherId, teacherId));
      await db.delete(questions).where(eq(questions.teacherId, teacherId));
      await db.delete(user).where(eq(user.id, teacherId));
    } finally {
      await pool.end();
    }
  });

  it("stores fractional points and scores exactly (BP-033)", async () => {
    const question = await insertQuestion(0.5);
    const { attempt, answer } = await insertPublishedTest();
    await db.update(attempts).set({ score: 0.5, maxScore: 2.5 }).where(eq(attempts.id, attempt.id));
    await db
      .update(attemptAnswers)
      .set({ awardedPoints: 0.5, maxPoints: 1.5 })
      .where(eq(attemptAnswers.id, answer.id));

    const [storedQuestion] = await db
      .select({ points: questions.points })
      .from(questions)
      .where(eq(questions.id, question.id));
    const [storedAttempt] = await db
      .select({ score: attempts.score, maxScore: attempts.maxScore })
      .from(attempts)
      .where(eq(attempts.id, attempt.id));
    const [storedAnswer] = await db
      .select({ awarded: attemptAnswers.awardedPoints, max: attemptAnswers.maxPoints })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.id, answer.id));

    expect(storedQuestion).toEqual({ points: 0.5 });
    expect(storedAttempt).toEqual({ score: 0.5, maxScore: 2.5 });
    expect(storedAnswer).toEqual({ awarded: 0.5, max: 1.5 });
  });

  it("uses numeric, timestamptz, jsonb and uuid column types", async () => {
    const result = await db.execute<{ table_name: string; column_name: string; data_type: string }>(
      sql`select table_name, column_name, data_type from information_schema.columns
          where table_schema = 'public'
            and table_name in ('questions', 'tests', 'test_questions', 'test_snapshots',
                               'attempts', 'attempt_answers')`,
    );
    const types = new Map(
      result.rows.map((row) => [`${row.table_name}.${row.column_name}`, row.data_type]),
    );

    for (const column of [
      "questions.points",
      "attempts.score",
      "attempts.max_score",
      "attempt_answers.awarded_points",
      "attempt_answers.max_points",
    ]) {
      expect(types.get(column), column).toBe("numeric");
    }
    for (const column of [
      "questions.options",
      "questions.answer_key",
      "test_snapshots.content",
      "attempt_answers.response",
    ]) {
      expect(types.get(column), column).toBe("jsonb");
    }
    for (const column of [
      "questions.id",
      "tests.id",
      "test_snapshots.id",
      "attempts.id",
      "attempt_answers.id",
    ]) {
      expect(types.get(column), column).toBe("uuid");
    }
    expect(types.get("questions.teacher_id")).toBe("text");
    expect(types.get("tests.teacher_id")).toBe("text");
    expect(types.get("attempt_answers.snapshot_question_key")).toBe("text");
    expect(types.get("test_questions.position")).toBe("integer");

    const timestamps = [...types].filter(([column]) => /_at$/.test(column));
    expect(timestamps.map(([column]) => column).sort()).toEqual([
      "attempts.submitted_at",
      "questions.archived_at",
      "questions.created_at",
      "questions.updated_at",
      "test_snapshots.created_at",
      "tests.created_at",
      "tests.published_at",
      "tests.updated_at",
    ]);
    for (const [column, type] of timestamps) {
      expect(type, column).toBe("timestamp with time zone");
    }
  });

  it("generates uuid ids and defaults a new test to draft", async () => {
    const test = await insertTest();

    expect(test.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(test.status).toBe("draft");
    expect(test.shareToken).toBeNull();
    expect(test.publishedAt).toBeNull();
  });

  it("accepts the four question types and rejects any other", async () => {
    for (const type of ["multiple_choice", "multiple_answer", "true_false", "short_answer"]) {
      const code = await pgErrorCode(
        db.execute(sql`insert into questions (teacher_id, type, prompt, options, answer_key)
                       values (${teacherId}, ${type}, 'p', '[]', '{}')`),
      );
      expect(code, type).toBeUndefined();
    }

    for (const type of ["essay", "MULTIPLE_CHOICE", ""]) {
      const code = await pgErrorCode(
        db.execute(sql`insert into questions (teacher_id, type, prompt, options, answer_key)
                       values (${teacherId}, ${type}, 'p', '[]', '{}')`),
      );
      expect(code, type).toBe(CHECK_VIOLATION);
    }
  });

  it("accepts the three test statuses and rejects any other", async () => {
    const test = await insertTest();

    for (const status of ["draft", "published", "closed"]) {
      const code = await pgErrorCode(
        db.execute(sql`update tests set status = ${status} where id = ${test.id}`),
      );
      expect(code, status).toBeUndefined();
    }

    for (const status of ["archived", "Draft", ""]) {
      const code = await pgErrorCode(
        db.execute(sql`update tests set status = ${status} where id = ${test.id}`),
      );
      expect(code, status).toBe(CHECK_VIOLATION);
    }
  });

  it("allows a question once per test and reads positions in ascending order", async () => {
    const test = await insertTest();
    const first = await insertQuestion();
    const second = await insertQuestion();
    await db.insert(testQuestions).values([
      { testId: test.id, questionId: second.id, position: 1 },
      { testId: test.id, questionId: first.id, position: 0 },
    ]);

    const code = await pgErrorCode(
      db.insert(testQuestions).values({ testId: test.id, questionId: first.id, position: 2 }),
    );
    expect(code).toBe(UNIQUE_VIOLATION);

    const rows = await db
      .select({ questionId: testQuestions.questionId })
      .from(testQuestions)
      .where(eq(testQuestions.testId, test.id))
      .orderBy(asc(testQuestions.position));
    expect(rows.map((row) => row.questionId)).toEqual([first.id, second.id]);
  });

  it("has no unique index on a test's positions yet", async () => {
    const test = await insertTest();
    const first = await insertQuestion();
    const second = await insertQuestion();

    const code = await pgErrorCode(
      db.insert(testQuestions).values([
        { testId: test.id, questionId: first.id, position: 0 },
        { testId: test.id, questionId: second.id, position: 0 },
      ]),
    );
    expect(code).toBeUndefined();
  });

  it("keeps every attempt, even with the same student name (BP-030)", async () => {
    const { test, snapshot } = await insertPublishedTest();

    await db.insert(attempts).values({
      testId: test.id,
      snapshotId: snapshot.id,
      studentName: "Fabricated Student",
      score: 0,
      maxScore: 1,
    });

    const rows = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(eq(attempts.testId, test.id));
    expect(rows).toHaveLength(2);
  });

  it("keeps share tokens and snapshot test ids unique", async () => {
    const first = await insertTest();
    const second = await insertTest();
    const token = `fabricated-${randomUUID()}`;
    await db.update(tests).set({ shareToken: token }).where(eq(tests.id, first.id));

    expect(
      await pgErrorCode(db.update(tests).set({ shareToken: token }).where(eq(tests.id, second.id))),
    ).toBe(UNIQUE_VIOLATION);

    const { test, question } = await insertPublishedTest();
    expect(
      await pgErrorCode(
        db.insert(testSnapshots).values({ testId: test.id, content: snapshotOf(question.id) }),
      ),
    ).toBe(UNIQUE_VIOLATION);
  });

  it("lets many draft tests have no share token", async () => {
    const first = await insertTest();
    const second = await insertTest();

    expect(first.shareToken).toBeNull();
    expect(second.shareToken).toBeNull();
  });

  it("stores the snapshot question key on the answer and in the snapshot", async () => {
    const { snapshot, answer } = await insertPublishedTest();

    expect(answer.snapshotQuestionKey).toBe("q1");
    expect(snapshot.content.questions.map((question) => question.key)).toContain("q1");
  });

  it("deletes a test's composition, snapshot, attempts and answers with it", async () => {
    const { test, snapshot, attempt, answer, question } = await insertPublishedTest();

    await db.delete(tests).where(eq(tests.id, test.id));

    expect(await db.select().from(testQuestions).where(eq(testQuestions.testId, test.id))).toEqual(
      [],
    );
    expect(await db.select().from(testSnapshots).where(eq(testSnapshots.id, snapshot.id))).toEqual(
      [],
    );
    expect(await db.select().from(attempts).where(eq(attempts.id, attempt.id))).toEqual([]);
    expect(await db.select().from(attemptAnswers).where(eq(attemptAnswers.id, answer.id))).toEqual(
      [],
    );
    // The bank question stays.
    expect(await db.select().from(questions).where(eq(questions.id, question.id))).toHaveLength(1);
  });

  it("deletes an attempt's answers with it, and nothing else", async () => {
    const { test, attempt, answer } = await insertPublishedTest();

    await db.delete(attempts).where(eq(attempts.id, attempt.id));

    expect(await db.select().from(attemptAnswers).where(eq(attemptAnswers.id, answer.id))).toEqual(
      [],
    );
    expect(await db.select().from(tests).where(eq(tests.id, test.id))).toHaveLength(1);
  });

  it("clears source_question_id when its bank question is deleted", async () => {
    const { test, question, answer } = await insertPublishedTest();
    // The draft composition still points at the question, so remove it first.
    await db.delete(testQuestions).where(eq(testQuestions.testId, test.id));

    await db.delete(questions).where(eq(questions.id, question.id));

    const [stored] = await db
      .select({ sourceQuestionId: attemptAnswers.sourceQuestionId })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.id, answer.id));
    expect(stored).toEqual({ sourceQuestionId: null });
  });

  it("has the BP-017 indexes", async () => {
    const result = await db.execute<{ tablename: string; indexdef: string }>(
      sql`select tablename, indexdef from pg_indexes
          where schemaname = 'public'
            and tablename in ('questions', 'tests', 'test_snapshots', 'attempts', 'attempt_answers')`,
    );
    // "table(column)" for single-column indexes, with UNIQUE noted.
    const indexes = result.rows.map((row) => {
      const column = /USING btree \((\w+)\)$/.exec(row.indexdef)?.[1];
      return `${row.indexdef.startsWith("CREATE UNIQUE") ? "unique " : ""}${row.tablename}(${column})`;
    });

    expect(indexes).toEqual(
      expect.arrayContaining([
        "questions(teacher_id)",
        "tests(teacher_id)",
        "attempts(test_id)",
        "attempts(snapshot_id)",
        "attempt_answers(attempt_id)",
        "attempt_answers(source_question_id)",
        "unique tests(share_token)",
        "unique test_snapshots(test_id)",
      ]),
    );
    // No unique (test_id, student_name), or any other index over student_name.
    expect(result.rows.filter((row) => row.indexdef.includes("student_name"))).toEqual([]);
  });
});
