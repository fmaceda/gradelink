import { z } from "zod";

export const questionTypeSchema = z.enum([
  "multiple_choice",
  "multiple_answer",
  "true_false",
  "short_answer",
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;
