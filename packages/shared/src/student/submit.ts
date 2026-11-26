import { z } from "zod";
import { optionIdSchema, snapshotQuestionKeySchema } from "../common/ids.ts";
import { OPTIONS_MAX, TEST_QUESTIONS_MAX } from "../common/options.ts";
import { personNameSchema } from "../common/text.ts";

// One answer's raw response: the option ids the student picked (TASK-008 decision). Stored
// as submitted in the `attempt_answers.response` JSONB column.
export const choiceResponseSchema = z.array(optionIdSchema).max(OPTIONS_MAX);
export type ChoiceResponse = z.infer<typeof choiceResponseSchema>;

// POST /api/public/tests/:token/attempts. Strict, and every student-supplied value is capped
// (BP-007, BP-008). Duplicate keys and unknown option ids are checked against the snapshot
// by the submit route (TASK-019).
export const submitAttemptBodySchema = z.strictObject({
  studentName: personNameSchema,
  answers: z
    .array(
      z.strictObject({
        questionKey: snapshotQuestionKeySchema,
        response: choiceResponseSchema,
      }),
    )
    .max(TEST_QUESTIONS_MAX),
});
export type SubmitAttemptInput = z.input<typeof submitAttemptBodySchema>;
export type SubmitAttemptBody = z.output<typeof submitAttemptBodySchema>;

// The only thing a student learns after submitting (PRD Product Decision 1).
export const submitAttemptResultSchema = z.strictObject({
  score: z.number().nonnegative(),
  maxScore: z.number().nonnegative(),
});
export type SubmitAttemptResult = z.infer<typeof submitAttemptResultSchema>;
