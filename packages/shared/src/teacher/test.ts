import { z } from "zod";
import { testStatusSchema } from "../common/enums.ts";
import { questionIdSchema, testIdSchema } from "../common/ids.ts";
import { TEST_QUESTIONS_MAX } from "../common/options.ts";
import { titleSchema } from "../common/text.ts";

// A test as the teacher API returns it. The share token is null until publish (TASK-016).
export const teacherTestSchema = z.strictObject({
  id: testIdSchema,
  title: titleSchema,
  status: testStatusSchema,
  shareToken: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TeacherTest = z.infer<typeof teacherTestSchema>;

export const createTestBodySchema = z.strictObject({ title: titleSchema });
export type CreateTestBody = z.infer<typeof createTestBodySchema>;

export const renameTestBodySchema = z.strictObject({ title: titleSchema });
export type RenameTestBody = z.infer<typeof renameTestBodySchema>;

// The draft's questions in order. Points stay on the bank question, so a per-test points
// field is an unknown key (PRD: no per-test override). TASK-013 rejects repeated ids.
export const setTestQuestionsBodySchema = z.strictObject({
  questionIds: z.array(questionIdSchema).max(TEST_QUESTIONS_MAX),
});
export type SetTestQuestionsBody = z.infer<typeof setTestQuestionsBodySchema>;
