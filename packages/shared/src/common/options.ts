import { z } from "zod";
import { optionIdSchema } from "./ids.ts";
import { optionTextSchema } from "./text.ts";

export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 10;
export const TEST_QUESTIONS_MAX = 100;

// The student-visible part of a choice question: the `options` JSONB column holds an array of
// these, and nothing else. Answer keys live in their own column (ARCHITECTURE.md Data model).
export const choiceOptionSchema = z.strictObject({ id: optionIdSchema, text: optionTextSchema });
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;

export const choiceOptionsSchema = z.array(choiceOptionSchema).min(OPTIONS_MIN).max(OPTIONS_MAX);
export type ChoiceOptions = z.infer<typeof choiceOptionsSchema>;

// True/false uses fixed options with the multiple-choice shape, so grading and the
// unknown-option rule work the same way for both (TASK-008 decision).
export const trueFalseOptionIdSchema = z.enum(["true", "false"]);
export type TrueFalseOptionId = z.infer<typeof trueFalseOptionIdSchema>;

export const TRUE_FALSE_OPTIONS = [
  { id: "true", text: "True" },
  { id: "false", text: "False" },
] as const;

export const trueFalseOptionsSchema = z.tuple([
  z.strictObject({ id: z.literal("true"), text: z.literal("True") }),
  z.strictObject({ id: z.literal("false"), text: z.literal("False") }),
]);
