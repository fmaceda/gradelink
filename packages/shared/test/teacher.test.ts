import { describe, expect, it } from "vitest";
import {
  choiceAnswerKeySchema,
  choiceOptionsSchema,
  createQuestionBodySchema,
  createTestBodySchema,
  renameTestBodySchema,
  setTestQuestionsBodySchema,
  snapshotContentSchema,
  teacherQuestionSchema,
  teacherTestSchema,
  updateQuestionBodySchema,
} from "../src/index.ts";

const QUESTION_ID = "0b6f1e4c-2f4a-4c1e-9a43-5d2b8c1f7e90";
const NOW = "2026-11-26T10:00:00.000Z";

function multipleChoiceBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "multiple_choice",
    prompt: "Which is a prime number?",
    options: [
      { text: "4", isCorrect: false },
      { text: "7", isCorrect: true },
      { text: "9", isCorrect: false },
    ],
    ...overrides,
  };
}

function trueFalseBody(overrides: Record<string, unknown> = {}) {
  return { type: "true_false", prompt: "The sky is blue.", correctOptionId: "true", ...overrides };
}

function options(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    text: `Option ${index}`,
    isCorrect: index === 0,
  }));
}

function storedMultipleChoice(overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTION_ID,
    type: "multiple_choice",
    prompt: "Which is a prime number?",
    options: [
      { id: "a", text: "4" },
      { id: "b", text: "7" },
    ],
    answerKey: { correctOptionIds: ["b"] },
    points: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function storedTrueFalse(overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTION_ID,
    type: "true_false",
    prompt: "The sky is blue.",
    options: [
      { id: "true", text: "True" },
      { id: "false", text: "False" },
    ],
    answerKey: { correctOptionIds: ["false"] },
    points: 2,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("question request bodies", () => {
  it("accepts a multiple-choice question and defaults points to 1", () => {
    const body = createQuestionBodySchema.parse(multipleChoiceBody());
    expect(body).toMatchObject({ type: "multiple_choice", points: 1 });
  });

  it("accepts a true/false question with the fixed option ids", () => {
    expect(createQuestionBodySchema.parse(trueFalseBody({ points: 2 }))).toEqual({
      type: "true_false",
      prompt: "The sky is blue.",
      points: 2,
      correctOptionId: "true",
    });
    expect(
      createQuestionBodySchema.safeParse(trueFalseBody({ correctOptionId: "maybe" })).success,
    ).toBe(false);
  });

  it.each(["short_answer", "multiple_answer", "essay", undefined])(
    "rejects the %j type until it is built",
    (type) => {
      const body = { ...multipleChoiceBody(), type, acceptedAnswers: ["USA"] };
      expect(createQuestionBodySchema.safeParse(body).success).toBe(false);
    },
  );

  it.each([
    ["teacher_id", { teacher_id: "someone-else" }],
    ["teacherId", { teacherId: "someone-else" }],
    ["id", { id: QUESTION_ID }],
    ["answerKey", { answerKey: { correctOptionIds: ["a"] } }],
  ])("rejects the extra key %s", (_key, extra) => {
    expect(createQuestionBodySchema.safeParse(multipleChoiceBody(extra)).success).toBe(false);
    expect(createQuestionBodySchema.safeParse(trueFalseBody(extra)).success).toBe(false);
  });

  it("rejects an extra key inside an option", () => {
    const body = multipleChoiceBody({
      options: [...options(2), { text: "x", isCorrect: false, id: "z" }],
    });
    expect(createQuestionBodySchema.safeParse(body).success).toBe(false);
  });

  it.each([
    [
      "no correct option",
      [
        { text: "a", isCorrect: false },
        { text: "b", isCorrect: false },
      ],
    ],
    [
      "two correct options",
      [
        { text: "a", isCorrect: true },
        { text: "b", isCorrect: true },
      ],
    ],
  ])("rejects a multiple-choice question with %s", (_label, optionList) => {
    const result = createQuestionBodySchema.safeParse(multipleChoiceBody({ options: optionList }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Mark exactly one option as correct.",
    );
  });

  it("needs 2 to 10 options", () => {
    for (const count of [0, 1, 11]) {
      expect(
        createQuestionBodySchema.safeParse(multipleChoiceBody({ options: options(count) })).success,
      ).toBe(false);
    }
    for (const count of [2, 10]) {
      expect(
        createQuestionBodySchema.safeParse(multipleChoiceBody({ options: options(count) })).success,
      ).toBe(true);
    }
  });

  it("rejects option text that repeats after trimming and ignoring case", () => {
    const result = createQuestionBodySchema.safeParse(
      multipleChoiceBody({
        options: [
          { text: "Paris", isCorrect: true },
          { text: "  paris ", isCorrect: false },
        ],
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ["options", 1, "text"], message: "Repeats another option." }),
    );
    expect(JSON.stringify(result.error?.issues)).not.toContain("aris");
  });

  it.each([0, -1, -0.5, "1", "abc", null, Number.NaN, 1001])("rejects points of %j", (points) => {
    expect(createQuestionBodySchema.safeParse(multipleChoiceBody({ points })).success).toBe(false);
    expect(createQuestionBodySchema.safeParse(trueFalseBody({ points })).success).toBe(false);
  });

  it.each([0.5, 1, 2.25, 1000])("accepts points of %d", (points) => {
    expect(createQuestionBodySchema.parse(multipleChoiceBody({ points })).points).toBe(points);
  });

  it("trims prompts and option text", () => {
    const body = createQuestionBodySchema.parse(
      multipleChoiceBody({
        prompt: "  Pick one  ",
        options: options(2).map((o) => ({ ...o, text: ` ${o.text} ` })),
      }),
    );
    expect(body.prompt).toBe("Pick one");
    expect(body.type === "multiple_choice" && body.options.map((o) => o.text)).toEqual([
      "Option 0",
      "Option 1",
    ]);
  });

  it("uses the same rules for an update", () => {
    expect(updateQuestionBodySchema.safeParse(multipleChoiceBody()).success).toBe(true);
    expect(updateQuestionBodySchema.safeParse(trueFalseBody({ teacher_id: "x" })).success).toBe(
      false,
    );
  });
});

describe("stored question shapes", () => {
  it("parses a multiple-choice and a true/false question with their answer keys", () => {
    expect(teacherQuestionSchema.parse(storedMultipleChoice())).toEqual(storedMultipleChoice());
    expect(teacherQuestionSchema.parse(storedTrueFalse())).toEqual(storedTrueFalse());
  });

  it("rejects a correct id that isn't one of the question's options", () => {
    const result = teacherQuestionSchema.safeParse(
      storedMultipleChoice({ answerKey: { correctOptionIds: ["z"] } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects repeated option ids and repeated option text", () => {
    const repeatedId = [
      { id: "a", text: "4" },
      { id: "a", text: "7" },
    ];
    const repeatedText = [
      { id: "a", text: "Seven" },
      { id: "b", text: "seven" },
    ];
    expect(
      teacherQuestionSchema.safeParse(
        storedMultipleChoice({ options: repeatedId, answerKey: { correctOptionIds: ["a"] } }),
      ).success,
    ).toBe(false);
    expect(
      teacherQuestionSchema.safeParse(
        storedMultipleChoice({ options: repeatedText, answerKey: { correctOptionIds: ["a"] } }),
      ).success,
    ).toBe(false);
  });

  it("needs exactly one correct id for multiple choice", () => {
    const twoCorrect = storedMultipleChoice({ answerKey: { correctOptionIds: ["a", "b"] } });
    expect(teacherQuestionSchema.safeParse(twoCorrect).success).toBe(false);
  });

  it("only accepts the fixed True/False options", () => {
    const renamed = storedTrueFalse({
      options: [
        { id: "true", text: "Yes" },
        { id: "false", text: "No" },
      ],
    });
    const reordered = storedTrueFalse({
      options: [
        { id: "false", text: "False" },
        { id: "true", text: "True" },
      ],
    });
    expect(teacherQuestionSchema.safeParse(renamed).success).toBe(false);
    expect(teacherQuestionSchema.safeParse(reordered).success).toBe(false);
  });

  it("validates the options and answer_key JSONB columns on their own", () => {
    expect(
      choiceOptionsSchema.safeParse([
        { id: "a", text: "x" },
        { id: "b", text: "y" },
      ]).success,
    ).toBe(true);
    expect(
      choiceOptionsSchema.safeParse([
        { id: "a", text: "x", correct: true },
        { id: "b", text: "y" },
      ]).success,
    ).toBe(false);
    expect(choiceAnswerKeySchema.safeParse({ correctOptionIds: ["a"] }).success).toBe(true);
    expect(choiceAnswerKeySchema.safeParse({ correctOptionIds: [] }).success).toBe(false);
  });
});

describe("tests", () => {
  it("parses a draft test with no share token", () => {
    const test = {
      id: QUESTION_ID,
      title: "Week 3 quiz",
      status: "draft",
      shareToken: null,
      publishedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(teacherTestSchema.parse(test)).toEqual(test);
    expect(teacherTestSchema.safeParse({ ...test, status: "archived" }).success).toBe(false);
  });

  it("takes only a title to create or rename", () => {
    expect(createTestBodySchema.parse({ title: "  Quiz  " })).toEqual({ title: "Quiz" });
    expect(createTestBodySchema.safeParse({ title: "Quiz", teacher_id: "x" }).success).toBe(false);
    expect(renameTestBodySchema.safeParse({ title: "x".repeat(101) }).success).toBe(false);
  });

  it("caps a draft at 100 questions and rejects a per-test points field", () => {
    const ids = (count: number) => Array.from({ length: count }, () => QUESTION_ID);
    expect(setTestQuestionsBodySchema.safeParse({ questionIds: ids(100) }).success).toBe(true);
    expect(setTestQuestionsBodySchema.safeParse({ questionIds: ids(101) }).success).toBe(false);
    expect(setTestQuestionsBodySchema.safeParse({ questionIds: [], points: 2 }).success).toBe(
      false,
    );
  });
});

describe("snapshot content", () => {
  function snapshotQuestion(key: string) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...question } = storedMultipleChoice();
    return { key, sourceQuestionId: QUESTION_ID, ...question };
  }

  it("holds each question with its key, source id, answer key and points", () => {
    const content = { questions: [snapshotQuestion("q1"), snapshotQuestion("q2")] };
    expect(snapshotContentSchema.parse(content)).toEqual(content);
  });

  it("rejects a repeated question key", () => {
    const content = { questions: [snapshotQuestion("q1"), snapshotQuestion("q1")] };
    expect(snapshotContentSchema.safeParse(content).success).toBe(false);
  });

  it("rejects an empty snapshot", () => {
    expect(snapshotContentSchema.safeParse({ questions: [] }).success).toBe(false);
  });
});
