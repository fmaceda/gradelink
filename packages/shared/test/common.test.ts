import { describe, expect, it } from "vitest";
import {
  formatPercent,
  formatPoints,
  OPTION_TEXT_MAX,
  optionIdSchema,
  optionTextSchema,
  PERSON_NAME_MAX,
  PROMPT_MAX,
  personNameSchema,
  promptSchema,
  questionTypeSchema,
  TITLE_MAX,
  testStatusSchema,
  titleSchema,
  uuidSchema,
} from "../src/index.ts";

describe("enums", () => {
  it("lists all four question types", () => {
    expect(questionTypeSchema.options).toEqual([
      "multiple_choice",
      "multiple_answer",
      "true_false",
      "short_answer",
    ]);
  });

  it("lists the three test statuses", () => {
    expect(testStatusSchema.options).toEqual(["draft", "published", "closed"]);
  });
});

describe("ids", () => {
  it("accepts an RFC uuid and rejects anything else", () => {
    expect(uuidSchema.safeParse("0b6f1e4c-2f4a-4c1e-9a43-5d2b8c1f7e90").success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse(42).success).toBe(false);
  });

  it.each(["a", "j", "true", "false"])("accepts the short option id %j", (id) => {
    expect(optionIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["", "A", "toolong", "a1", " a", 1])("rejects the option id %j", (id) => {
    expect(optionIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("text caps", () => {
  it.each([
    ["prompt", promptSchema, PROMPT_MAX, 1000],
    ["option text", optionTextSchema, OPTION_TEXT_MAX, 200],
    ["title", titleSchema, TITLE_MAX, 100],
    ["person name", personNameSchema, PERSON_NAME_MAX, 80],
  ] as const)("%s accepts %i characters and rejects one more", (_label, schema, max, expected) => {
    expect(max).toBe(expected);
    expect(schema.safeParse("x".repeat(max)).success).toBe(true);
    expect(schema.safeParse("x".repeat(max + 1)).success).toBe(false);
  });

  it.each([
    ["prompt", promptSchema],
    ["option text", optionTextSchema],
    ["title", titleSchema],
    ["person name", personNameSchema],
  ] as const)("%s rejects empty and whitespace-only text", (_label, schema) => {
    expect(schema.safeParse("").success).toBe(false);
    expect(schema.safeParse("   \n\t ").success).toBe(false);
  });

  it("trims before checking the length", () => {
    expect(titleSchema.parse(`  ${"x".repeat(TITLE_MAX)}  `)).toBe("x".repeat(TITLE_MAX));
  });

  it("allows a newline inside a prompt but no other control character", () => {
    expect(promptSchema.parse("Line one\nLine two")).toBe("Line one\nLine two");
    for (const control of ["\t", "\r", "\u0000", "\u001b", "\u007f", "\u0085"]) {
      expect(promptSchema.safeParse(`a${control}b`).success).toBe(false);
    }
  });

  it.each([
    ["option text", optionTextSchema],
    ["title", titleSchema],
    ["person name", personNameSchema],
  ] as const)("%s is single-line and rejects every control character", (_label, schema) => {
    for (const control of ["\n", "\t", "\r", "\u0000", "\u001b", "\u007f"]) {
      expect(schema.safeParse(`a${control}b`).success).toBe(false);
    }
  });

  it("never repeats the input in its messages", () => {
    const result = personNameSchema.safeParse("secret\u0000name");
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain("secret");
  });
});

describe("person name", () => {
  it("trims surrounding spaces", () => {
    expect(personNameSchema.parse("  Ana  ")).toBe("Ana");
  });

  it("rejects a name of only spaces", () => {
    expect(personNameSchema.safeParse("     ").success).toBe(false);
  });

  it("allows 80 characters after trimming and rejects 81", () => {
    expect(personNameSchema.safeParse(` ${"n".repeat(80)} `).success).toBe(true);
    expect(personNameSchema.safeParse("n".repeat(81)).success).toBe(false);
  });
});

describe("score formatter", () => {
  it.each([
    [0.5, "0.5"],
    [1 / 3, "0.33"],
    [2 / 3, "0.67"],
    [2.005, "2.01"],
    [200 / 3, "66.67"],
    [0, "0"],
    [-0, "0"],
    [100, "100"],
    [1234.5, "1234.5"],
    [0.1 + 0.2, "0.3"],
  ])("formats %d points as %j", (value, expected) => {
    expect(formatPoints(value)).toBe(expected);
  });

  it.each([
    [0.5, "0.5%"],
    [100 / 3, "33.3%"],
    [2.005, "2%"],
    [200 / 3, "66.7%"],
    [0, "0%"],
    [100, "100%"],
    [80, "80%"],
    [(0.1 + 0.2) * 100, "30%"],
  ])("formats a %d percentage as %j", (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });
});
