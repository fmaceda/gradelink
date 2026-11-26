import { describe, expect, it } from "vitest";
import { signOutResponseSchema, teacherSessionSchema } from "../src/teacher/index.ts";

// Shaped like Better Auth 1.7's get-session response (fabricated values).
const betterAuthSession = {
  session: {
    id: "fabricated-session-id",
    token: "fabricated-session-token",
    userId: "user-1",
    expiresAt: "2026-11-27T10:00:00.000Z",
    ipAddress: "10.0.0.1",
    userAgent: "test",
  },
  user: {
    id: "user-1",
    email: "teacher@example.com",
    name: "teacher",
    emailVerified: false,
    image: null,
    createdAt: "2026-11-26T10:00:00.000Z",
  },
};

describe("teacherSessionSchema", () => {
  it("keeps only the user id and email", () => {
    expect(teacherSessionSchema.parse(betterAuthSession)).toEqual({
      user: { id: "user-1", email: "teacher@example.com" },
    });
  });

  it("drops the session token and id so they never reach the UI", () => {
    const parsed = JSON.stringify(teacherSessionSchema.parse(betterAuthSession));

    expect(parsed).not.toContain("fabricated-session-token");
    expect(parsed).not.toContain("fabricated-session-id");
  });

  it("accepts null, Better Auth's answer when signed out", () => {
    expect(teacherSessionSchema.parse(null)).toBeNull();
  });

  it("rejects a response without a valid email or id", () => {
    expect(teacherSessionSchema.safeParse({ user: { id: "u", email: "nope" } }).success).toBe(
      false,
    );
    expect(teacherSessionSchema.safeParse({ user: { id: "", email: "a@b.co" } }).success).toBe(
      false,
    );
  });
});

describe("signOutResponseSchema", () => {
  it("accepts Better Auth's success body and nothing else", () => {
    expect(signOutResponseSchema.safeParse({ success: true }).success).toBe(true);
    expect(signOutResponseSchema.safeParse({ success: false }).success).toBe(false);
  });
});
