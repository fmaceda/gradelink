import { z } from "zod";

// Caps accepted in TASK-008 and recorded in TEST_PLAN.md.
export const PROMPT_MAX = 1000;
export const OPTION_TEXT_MAX = 200;
export const TITLE_MAX = 100;
export const PERSON_NAME_MAX = 80;

// Messages are fixed text and never repeat the input (TASK-005 decision).
const CONTROL_CHARACTER = /\p{Cc}/u;
const CONTROL_CHARACTER_EXCEPT_NEWLINE = /(?!\n)\p{Cc}/u;

function singleLineText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !CONTROL_CHARACTER.test(value), "Must not contain control characters.");
}

// Prompts may span lines, so newline is the one control character allowed (TASK-008 decision).
export const promptSchema = z
  .string()
  .trim()
  .min(1)
  .max(PROMPT_MAX)
  .refine(
    (value) => !CONTROL_CHARACTER_EXCEPT_NEWLINE.test(value),
    "Must not contain control characters other than line breaks.",
  );

export const optionTextSchema = singleLineText(OPTION_TEXT_MAX);
export const titleSchema = singleLineText(TITLE_MAX);

// Student names: 1-80 characters after trimming (PRD, TEST_PLAN.md).
export const personNameSchema = singleLineText(PERSON_NAME_MAX);
