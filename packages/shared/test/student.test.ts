import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as student from "../src/student/index.ts";
import {
  choiceResponseSchema,
  closedTestSchema,
  openTestContentSchema,
  publicTestSchema,
  submitAttemptBodySchema,
  submitAttemptResultSchema,
} from "../src/student/index.ts";

// Collects every object key a schema can produce, following wrappers, arrays, tuples and unions.
function keysOf(schema: unknown, found = new Set<string>()): Set<string> {
  if (schema instanceof z.ZodObject) {
    for (const [key, child] of Object.entries(schema.shape)) {
      found.add(key);
      keysOf(child, found);
    }
  } else if (schema instanceof z.ZodArray) {
    keysOf(schema.element, found);
  } else if (schema instanceof z.ZodTuple) {
    for (const item of schema.def.items) keysOf(item, found);
  } else if (schema instanceof z.ZodUnion) {
    for (const option of schema.options) keysOf(option, found);
  } else if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    keysOf(schema.unwrap(), found);
  } else if (schema instanceof z.ZodPipe) {
    keysOf(schema.in, found);
    keysOf(schema.out, found);
  }
  return found;
}

const studentSchemas = Object.entries(student).filter(([, value]) => value instanceof z.ZodType);

const openTest = {
  status: "published",
  title: "Week 3 quiz",
  questions: [
    {
      key: "q1",
      type: "multiple_choice",
      prompt: "Which is prime?",
      options: [
        { id: "a", text: "4" },
        { id: "b", text: "7" },
      ],
    },
    {
      key: "q2",
      type: "true_false",
      prompt: "The sky is blue.",
      options: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ],
    },
  ],
};

describe("student schemas", () => {
  it("export at least the five student shapes", () => {
    expect(studentSchemas.length).toBeGreaterThanOrEqual(5);
  });

  it.each(studentSchemas)("%s has no answer-key, correctness or points field", (_name, schema) => {
    const keys = [...keysOf(schema)];
    expect(keys.filter((key) => /answer.?key|correct|points|source/i.test(key))).toEqual([]);
  });

  it("gives students options as { id, text } only", () => {
    expect(openTestContentSchema.parse(openTest)).toEqual(openTest);
    const withKey = structuredClone(openTest);
    Object.assign(withKey.questions[0]?.options[0] ?? {}, { correct: true });
    expect(openTestContentSchema.safeParse(withKey).success).toBe(false);
  });

  it("rejects a question carrying an answer key or points", () => {
    for (const extra of [{ answerKey: { correctOptionIds: ["b"] } }, { points: 1 }]) {
      const leaky = structuredClone(openTest);
      Object.assign(leaky.questions[0] ?? {}, extra);
      expect(openTestContentSchema.safeParse(leaky).success).toBe(false);
    }
  });

  it("gives a closed test its title and status only", () => {
    expect(closedTestSchema.parse({ status: "closed", title: "Quiz" })).toEqual({
      status: "closed",
      title: "Quiz",
    });
    expect(
      closedTestSchema.safeParse({ status: "closed", title: "Quiz", questions: [] }).success,
    ).toBe(false);
    expect(publicTestSchema.parse({ status: "closed", title: "Quiz" }).status).toBe("closed");
    expect(publicTestSchema.parse(openTest).status).toBe("published");
    expect(publicTestSchema.safeParse({ status: "draft", title: "Quiz" }).success).toBe(false);
  });

  it("returns score and max score only after submitting", () => {
    expect(submitAttemptResultSchema.parse({ score: 7.5, maxScore: 10 })).toEqual({
      score: 7.5,
      maxScore: 10,
    });
    expect(
      submitAttemptResultSchema.safeParse({ score: 7.5, maxScore: 10, correct: [] }).success,
    ).toBe(false);
  });
});

describe("submit request", () => {
  function body(overrides: Record<string, unknown> = {}) {
    return {
      studentName: "  Ana  ",
      answers: [
        { questionKey: "q1", response: ["b"] },
        { questionKey: "q2", response: [] },
      ],
      ...overrides,
    };
  }

  it("accepts a name and one array of option ids per answer", () => {
    expect(submitAttemptBodySchema.parse(body())).toEqual({
      studentName: "Ana",
      answers: [
        { questionKey: "q1", response: ["b"] },
        { questionKey: "q2", response: [] },
      ],
    });
  });

  it.each([
    ["score", { score: 10 }],
    ["points", { points: 10 }],
    ["testId", { testId: "x" }],
  ])("rejects a client-sent %s", (_label, extra) => {
    expect(submitAttemptBodySchema.safeParse(body(extra)).success).toBe(false);
  });

  it("rejects an extra key inside an answer", () => {
    const answers = [{ questionKey: "q1", response: ["b"], points: 1 }];
    expect(submitAttemptBodySchema.safeParse(body({ answers })).success).toBe(false);
  });

  it("caps the number of answers at 100", () => {
    const answers = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ questionKey: `q${index}`, response: ["a"] }));
    expect(submitAttemptBodySchema.safeParse(body({ answers: answers(100) })).success).toBe(true);
    expect(submitAttemptBodySchema.safeParse(body({ answers: answers(101) })).success).toBe(false);
  });

  it("caps the option ids per answer at 10 and checks their form", () => {
    const ids = "abcdefghijk".split("");
    expect(choiceResponseSchema.safeParse(ids.slice(0, 10)).success).toBe(true);
    expect(choiceResponseSchema.safeParse(ids).success).toBe(false);
    expect(choiceResponseSchema.safeParse(["<script>"]).success).toBe(false);
    expect(choiceResponseSchema.safeParse("b").success).toBe(false);
  });

  it("applies the name rules", () => {
    expect(submitAttemptBodySchema.safeParse(body({ studentName: "   " })).success).toBe(false);
    expect(submitAttemptBodySchema.safeParse(body({ studentName: "n".repeat(80) })).success).toBe(
      true,
    );
    expect(submitAttemptBodySchema.safeParse(body({ studentName: "n".repeat(81) })).success).toBe(
      false,
    );
    expect(submitAttemptBodySchema.safeParse(body({ studentName: "A\u0000na" })).success).toBe(
      false,
    );
  });
});
