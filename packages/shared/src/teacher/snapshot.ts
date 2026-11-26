import { z } from "zod";
import { questionIdSchema, snapshotQuestionKeySchema } from "../common/ids.ts";
import { TEST_QUESTIONS_MAX } from "../common/options.ts";
import { checkStoredChoice, multipleChoiceShape, trueFalseShape } from "./question.ts";

// The frozen copy written at publish: the `test_snapshots.content` JSONB column. It holds
// answer keys, so it lives with the teacher schemas and only the grader and the student DTO
// mappers read it (ARCHITECTURE.md rules 2 and 14).
const snapshotMetaShape = {
  key: snapshotQuestionKeySchema,
  sourceQuestionId: questionIdSchema,
};

export const snapshotQuestionSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...snapshotMetaShape, ...multipleChoiceShape }).superRefine(checkStoredChoice),
  z.strictObject({ ...snapshotMetaShape, ...trueFalseShape }).superRefine(checkStoredChoice),
]);
export type SnapshotQuestion = z.infer<typeof snapshotQuestionSchema>;

export const snapshotContentSchema = z
  .strictObject({
    questions: z.array(snapshotQuestionSchema).min(1).max(TEST_QUESTIONS_MAX),
  })
  .superRefine((content, ctx) => {
    const keys = new Set<string>();
    content.questions.forEach((question, index) => {
      if (keys.has(question.key)) {
        ctx.addIssue({
          code: "custom",
          message: "Repeats another question key.",
          path: ["questions", index, "key"],
        });
      }
      keys.add(question.key);
    });
  });
export type SnapshotContent = z.infer<typeof snapshotContentSchema>;
