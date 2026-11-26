// Drizzle tables. See ARCHITECTURE.md "Data model" and TASKS.md.
import {
  type ChoiceAnswerKey,
  type ChoiceOptions,
  type ChoiceResponse,
  type QuestionType,
  questionTypeSchema,
  type SnapshotContent,
  type TestStatus,
  testStatusSchema,
} from "@gradelink/shared";
import { type SQL, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Better Auth's tables. The property names are the ones its Drizzle adapter looks up, so they
// must match what `getAuthTables` from "better-auth/db" reports for the options in auth.ts.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// The app's tables (TASK-007). Points and scores are `numeric` because partial credit makes
// fractions (BP-033); `mode: "number"` reads them back as numbers to match the shared schemas.
// Every JSONB column takes its type from a shared schema (BP-016). `$type` is compile-time
// only, so services still parse with that schema on read and write.

// `text` plus a CHECK rather than a pgEnum, because it's easier to change later (TASK-007
// decision). The allowed values come from the shared enums, which are plain string literals.
function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(", "))})`;
}

function createdAt() {
  return timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
}

function updatedAt() {
  return timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
}

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id),
    type: text("type").$type<QuestionType>().notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<ChoiceOptions>().notNull(),
    answerKey: jsonb("answer_key").$type<ChoiceAnswerKey>().notNull(),
    points: numeric("points", { mode: "number" }).notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("questions_type_check", oneOf(table.type, questionTypeSchema.options)),
    index("questions_teacher_id_idx").on(table.teacherId),
  ],
);

export const tests = pgTable(
  "tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id),
    title: text("title").notNull(),
    status: text("status").$type<TestStatus>().notNull().default("draft"),
    // Null until publish. TASK-016 generates it with node:crypto (ARCHITECTURE.md rule 4).
    shareToken: text("share_token"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("tests_status_check", oneOf(table.status, testStatusSchema.options)),
    index("tests_teacher_id_idx").on(table.teacherId),
    uniqueIndex("tests_share_token_idx").on(table.shareToken),
  ],
);

// Draft composition. The composite key means a question appears in a test at most once.
// `position` orders the questions (ascending); it has no unique index yet.
export const testQuestions = pgTable(
  "test_questions",
  {
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.testId, table.questionId] })],
);

// The frozen copy written at publish, one per test. Holds answer keys (ARCHITECTURE.md rule 14).
export const testSnapshots = pgTable(
  "test_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<SnapshotContent>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("test_snapshots_test_id_idx").on(table.testId)],
);

// One row per submission. There is deliberately no unique (test_id, student_name) (BP-030).
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => testSnapshots.id, { onDelete: "cascade" }),
    studentName: text("student_name").notNull(),
    // Set by the server at submit (BP-018).
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    score: numeric("score", { mode: "number" }).notNull(),
    maxScore: numeric("max_score", { mode: "number" }).notNull(),
  },
  (table) => [
    index("attempts_test_id_idx").on(table.testId),
    index("attempts_snapshot_id_idx").on(table.snapshotId),
  ],
);

// One row per question per attempt, written at grading. Per-question analytics aggregate here.
export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    // The same key as the question's entry in test_snapshots.content.
    snapshotQuestionKey: text("snapshot_question_key").notNull(),
    sourceQuestionId: uuid("source_question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    // Raw, as submitted, so grading can be re-run if a rule changes.
    response: jsonb("response").$type<ChoiceResponse>().notNull(),
    awardedPoints: numeric("awarded_points", { mode: "number" }).notNull(),
    maxPoints: numeric("max_points", { mode: "number" }).notNull(),
  },
  (table) => [
    index("attempt_answers_attempt_id_idx").on(table.attemptId),
    index("attempt_answers_source_question_id_idx").on(table.sourceQuestionId),
  ],
);
