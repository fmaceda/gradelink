import { describe, expect, it } from "vitest";
import {
  authErrorBodySchema,
  authUserResponseSchema,
  createAccountBodySchema,
  PASSWORD_MAX,
  PASSWORD_MIN,
  signInBodySchema,
} from "../src/teacher/index.ts";

const EMAIL = "teacher@example.com";

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("createAccountBodySchema", () => {
  it("accepts a 15-character password and rejects 14", () => {
    expect(
      createAccountBodySchema.safeParse({ email: EMAIL, password: "a".repeat(15) }).success,
    ).toBe(true);
    const short = createAccountBodySchema.safeParse({ email: EMAIL, password: "a".repeat(14) });
    expect(short.success).toBe(false);
    expect(firstMessage(short)).toBe("Use at least 15 characters.");
  });

  it("accepts a 64+ character passphrase with spaces and no composition rules", () => {
    const password = "a long fabricated pass phrase with several spaces in it, 64+ chars";
    expect(password.length).toBeGreaterThanOrEqual(64);

    expect(createAccountBodySchema.safeParse({ email: EMAIL, password }).success).toBe(true);
  });

  it("caps the password at the same maximum as Better Auth", () => {
    expect(PASSWORD_MIN).toBe(15);
    const atMax = { email: EMAIL, password: "a".repeat(PASSWORD_MAX) };
    const pastMax = { email: EMAIL, password: "a".repeat(PASSWORD_MAX + 1) };

    expect(createAccountBodySchema.safeParse(atMax).success).toBe(true);
    expect(firstMessage(createAccountBodySchema.safeParse(pastMax))).toBe(
      "Use at most 128 characters.",
    );
  });

  it("rejects a malformed email with a plain sentence, and trims spaces around a valid one", () => {
    const bad = createAccountBodySchema.safeParse({
      email: "not-an-email",
      password: "a".repeat(15),
    });
    expect(firstMessage(bad)).toBe("Enter an email address, like name@school.org.");

    const padded = createAccountBodySchema.parse({
      email: `  ${EMAIL} `,
      password: "a".repeat(15),
    });
    expect(padded.email).toBe(EMAIL);
  });

  it("rejects extra fields such as name (the web derives it, BP-006)", () => {
    expect(
      createAccountBodySchema.safeParse({ email: EMAIL, password: "a".repeat(15), name: "x" })
        .success,
    ).toBe(false);
  });
});

describe("signInBodySchema", () => {
  it("accepts any typed password, so old or short ones still get the server's generic answer", () => {
    expect(signInBodySchema.safeParse({ email: EMAIL, password: "short" }).success).toBe(true);
  });

  it("asks for a password when it's empty", () => {
    expect(firstMessage(signInBodySchema.safeParse({ email: EMAIL, password: "" }))).toBe(
      "Enter your password.",
    );
  });
});

describe("authUserResponseSchema", () => {
  it("keeps the user id and email and drops the session token", () => {
    const parsed = authUserResponseSchema.parse({
      redirect: false,
      token: "fabricated-session-token",
      user: { id: "user-1", email: EMAIL, name: "teacher", emailVerified: false },
    });

    expect(parsed).toEqual({ user: { id: "user-1", email: EMAIL } });
  });
});

describe("authErrorBodySchema", () => {
  it("reads Better Auth's error code and ignores its message", () => {
    expect(
      authErrorBodySchema.parse({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    ).toEqual({ code: "INVALID_EMAIL_OR_PASSWORD" });
  });
});
