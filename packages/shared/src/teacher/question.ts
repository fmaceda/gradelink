import { z } from "zod";
import { optionIdSchema, questionIdSchema } from "../common/ids.ts";
import {
  choiceOptionsSchema,
  OPTIONS_MAX,
  OPTIONS_MIN,
  trueFalseOptionIdSchema,
  trueFalseOptionsSchema,
} from "../common/options.ts";
import { optionTextSchema, promptSchema } from "../common/text.ts";

// Points can be fractional (BP-033) but never zero or negative. The upper cap is a TASK-008
// choice to keep the value bounded; no doc sets one.
export const POINTS_MAX = 1000;
export const pointsSchema = z.number().positive().max(POINTS_MAX);
export const DEFAULT_POINTS = 1;

// The grader-only part of a choice question: the `answer_key` JSONB column.
export const choiceAnswerKeySchema = z.strictObject({
  correctOptionIds: z.array(optionIdSchema).min(1).max(OPTIONS_MAX),
});
export type ChoiceAnswerKey = z.infer<typeof choiceAnswerKeySchema>;

type IssueSink = {
  addIssue: (issue: { code: "custom"; message: string; path: PropertyKey[] }) => void;
};

// Option text that repeats within a question, after trimming and ignoring case, is rejected
// (TASK-008 decision). The text is already trimmed by optionTextSchema.
function rejectRepeatedText(options: readonly { text: string }[], ctx: IssueSink) {
  const seen = new Set<string>();
  options.forEach((option, index) => {
    const folded = option.text.toLowerCase();
    if (seen.has(folded)) {
      ctx.addIssue({
        code: "custom",
        message: "Repeats another option.",
        path: ["options", index, "text"],
      });
    }
    seen.add(folded);
  });
}

// Stored shapes must be internally consistent: unique option ids, and every correct id names
// one of the question's own options.
export function checkStoredChoice(
  question: {
    options: readonly { id: string; text: string }[];
    answerKey: { correctOptionIds: readonly string[] };
  },
  ctx: IssueSink,
) {
  const ids = new Set<string>();
  question.options.forEach((option, index) => {
    if (ids.has(option.id)) {
      ctx.addIssue({
        code: "custom",
        message: "Repeats another option id.",
        path: ["options", index, "id"],
      });
    }
    ids.add(option.id);
  });
  question.answerKey.correctOptionIds.forEach((id, index) => {
    if (!ids.has(id)) {
      ctx.addIssue({
        code: "custom",
        message: "Must name one of the question's options.",
        path: ["answerKey", "correctOptionIds", index],
      });
    }
  });
  rejectRepeatedText(question.options, ctx);
}

// The type-specific fields of a stored question, shared by the teacher response and the
// published snapshot. Plain shapes, because Zod 4 can't extend an object that has refinements.
export const multipleChoiceShape = {
  type: z.literal("multiple_choice"),
  prompt: promptSchema,
  options: choiceOptionsSchema,
  answerKey: z.strictObject({ correctOptionIds: z.array(optionIdSchema).length(1) }),
  points: pointsSchema,
};

export const trueFalseShape = {
  type: z.literal("true_false"),
  prompt: promptSchema,
  options: trueFalseOptionsSchema,
  answerKey: z.strictObject({ correctOptionIds: z.tuple([trueFalseOptionIdSchema]) }),
  points: pointsSchema,
};

const questionMetaShape = {
  id: questionIdSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

// A question as the teacher API returns it, answer key included. Only multiple choice and
// true/false exist until TASK-024 adds the other two (BP-007).
export const teacherQuestionSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...questionMetaShape, ...multipleChoiceShape }).superRefine(checkStoredChoice),
  z.strictObject({ ...questionMetaShape, ...trueFalseShape }).superRefine(checkStoredChoice),
]);
export type TeacherQuestion = z.infer<typeof teacherQuestionSchema>;

// Request bodies. The API generates option ids, so the teacher sends text and a correct flag.
const multipleChoiceBodySchema = z
  .strictObject({
    type: z.literal("multiple_choice"),
    prompt: promptSchema,
    points: pointsSchema.default(DEFAULT_POINTS),
    options: z
      .array(z.strictObject({ text: optionTextSchema, isCorrect: z.boolean() }))
      .min(OPTIONS_MIN)
      .max(OPTIONS_MAX),
  })
  .superRefine((body, ctx) => {
    if (body.options.filter((option) => option.isCorrect).length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Mark exactly one option as correct.",
        path: ["options"],
      });
    }
    rejectRepeatedText(body.options, ctx);
  });

const trueFalseBodySchema = z.strictObject({
  type: z.literal("true_false"),
  prompt: promptSchema,
  points: pointsSchema.default(DEFAULT_POINTS),
  correctOptionId: trueFalseOptionIdSchema,
});

export const createQuestionBodySchema = z.discriminatedUnion("type", [
  multipleChoiceBodySchema,
  trueFalseBodySchema,
]);
export type CreateQuestionInput = z.input<typeof createQuestionBodySchema>;
export type CreateQuestionBody = z.output<typeof createQuestionBodySchema>;

// An update sends the whole question again, type included, so the service can reject a type
// change (TASK-011).
export const updateQuestionBodySchema = createQuestionBodySchema;
export type UpdateQuestionInput = z.input<typeof updateQuestionBodySchema>;
export type UpdateQuestionBody = z.output<typeof updateQuestionBodySchema>;
