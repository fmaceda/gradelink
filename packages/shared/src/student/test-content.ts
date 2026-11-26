// Student schemas never import from teacher/ (ARCHITECTURE.md rule 5, enforced by
// test/student-imports.test.ts). They declare their own shapes from common/ primitives.
import { z } from "zod";
import { snapshotQuestionKeySchema } from "../common/ids.ts";
import {
  choiceOptionsSchema,
  TEST_QUESTIONS_MAX,
  trueFalseOptionsSchema,
} from "../common/options.ts";
import { promptSchema, titleSchema } from "../common/text.ts";

// Question text and options only: no points, answer key or source id (ARCHITECTURE.md rule 2).
export const studentQuestionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    key: snapshotQuestionKeySchema,
    type: z.literal("multiple_choice"),
    prompt: promptSchema,
    options: choiceOptionsSchema,
  }),
  z.strictObject({
    key: snapshotQuestionKeySchema,
    type: z.literal("true_false"),
    prompt: promptSchema,
    options: trueFalseOptionsSchema,
  }),
]);
export type StudentQuestion = z.infer<typeof studentQuestionSchema>;

// GET /api/public/tests/:token for a published test.
export const openTestContentSchema = z.strictObject({
  status: z.literal("published"),
  title: titleSchema,
  questions: z.array(studentQuestionSchema).min(1).max(TEST_QUESTIONS_MAX),
});
export type OpenTestContent = z.infer<typeof openTestContentSchema>;

// The same call for a closed test: title and status only, no questions.
export const closedTestSchema = z.strictObject({
  status: z.literal("closed"),
  title: titleSchema,
});
export type ClosedTest = z.infer<typeof closedTestSchema>;

export const publicTestSchema = z.discriminatedUnion("status", [
  openTestContentSchema,
  closedTestSchema,
]);
export type PublicTest = z.infer<typeof publicTestSchema>;
