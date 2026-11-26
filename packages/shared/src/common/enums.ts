import { z } from "zod";

// All four types the database accepts. The request and response unions only include the
// types that are built so far (multiple_choice and true_false until TASK-024).
export const questionTypeSchema = z.enum([
  "multiple_choice",
  "multiple_answer",
  "true_false",
  "short_answer",
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const testStatusSchema = z.enum(["draft", "published", "closed"]);
export type TestStatus = z.infer<typeof testStatusSchema>;
