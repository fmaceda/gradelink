import { z } from "zod";

// SECURITY.md Authentication (NIST SP 800-63B): at least 15 characters, long passphrases with
// spaces allowed, no composition rules. 128 is Better Auth's default upper limit, set explicitly
// in apps/api/src/auth.ts from these same constants.
export const PASSWORD_MIN = 15;
export const PASSWORD_MAX = 128;

// Messages are plain sentences shown under the field (DESIGN.md Forms & Inputs).
export const teacherEmailSchema = z
  .string()
  .trim()
  .pipe(z.email("Enter an email address, like name@school.org."));

export const teacherPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

// Sign-in checks only that a password was typed: an older or mistyped password still gets the
// one generic "Email or password is incorrect" answer from the server.
export const signInBodySchema = z.strictObject({
  email: teacherEmailSchema,
  password: z.string().min(1, "Enter your password."),
});
export type SignInBody = z.infer<typeof signInBodySchema>;

export const createAccountBodySchema = z.strictObject({
  email: teacherEmailSchema,
  password: teacherPasswordSchema,
});
export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;

// Better Auth's sign-in and sign-up responses also carry the session token; a plain object
// drops it on parse, like teacherSessionSchema.
export const authUserResponseSchema = z.object({
  user: z.object({ id: z.string().min(1), email: z.email() }),
});

// Better Auth's own error body (`/api/auth/*` keeps its shape, ARCHITECTURE.md rule 7). Only the
// code is used, to pick a fixed message; Better Auth's message is never shown.
export const authErrorBodySchema = z.object({ code: z.string() });
