// The only module that calls fetch against /api (ARCHITECTURE.md rule 10, BP-020).
// Every response is parsed with a shared schema before use (BP-005). Paths are relative, so the
// Vite proxy and production behave the same way. The session lives in Better Auth's HttpOnly
// cookie; nothing here reads it or stores a token (BP-012).
import {
  type ErrorCode,
  errorBodySchema,
  PERSON_NAME_MAX,
  personNameSchema,
} from "@gradelink/shared/common";
import {
  authErrorBodySchema,
  authUserResponseSchema,
  type CreateAccountBody,
  type SignInBody,
  signOutResponseSchema,
  type TeacherSession,
  teacherSessionSchema,
} from "@gradelink/shared/teacher";
import { redirect } from "react-router";
import type { z } from "zod";

export const SIGN_IN_PATH = "/sign-in";

export class ApiError extends Error {
  readonly status: number;
  // From the shared error body, sent by our own routes.
  readonly code: ErrorCode | undefined;
  // From Better Auth's own error body under /api/auth (for example USER_ALREADY_EXISTS...).
  readonly authCode: string | undefined;

  constructor(status: number, code?: ErrorCode, authCode?: string) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.authCode = authCode;
  }
}

async function apiErrorFrom(response: Response) {
  const body: unknown = await response.json().catch(() => undefined);
  const shared = errorBodySchema.safeParse(body);
  if (shared.success) {
    return new ApiError(response.status, shared.data.error.code);
  }
  const auth = authErrorBodySchema.safeParse(body);
  return new ApiError(response.status, undefined, auth.success ? auth.data.code : undefined);
}

async function requestJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init: { method?: string; body?: unknown } = {},
): Promise<z.output<S>> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (!response.ok) {
    throw await apiErrorFrom(response);
  }
  return schema.parse(await response.json());
}

// For every /api/teacher/* call, from loaders and actions only. A 401 means the session ended
// while the teacher was using the app (expired or signed out elsewhere), so it sends them to
// sign-in instead of showing an error (TASK-010 decision).
export async function teacherRequest<S extends z.ZodType>(
  path: `/api/teacher/${string}`,
  schema: S,
  init: { method?: string; body?: unknown } = {},
): Promise<z.output<S>> {
  try {
    return await requestJson(path, schema, init);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect(SIGN_IN_PATH);
    }
    throw error;
  }
}

// Better Auth answers 200 with null when signed out.
export function getSession(): Promise<TeacherSession> {
  return requestJson("/api/auth/get-session", teacherSessionSchema);
}

// Better Auth answers a wrong password and an unknown email with the same 401.
export async function signIn({ email, password }: SignInBody): Promise<void> {
  await requestJson("/api/auth/sign-in/email", authUserResponseSchema, {
    method: "POST",
    body: { email, password },
  });
}

// Better Auth requires a name, but the form has none (TASK-010 decision): it's the part of the
// email before "@", made to fit the shared person-name rules (1-80 characters, no control
// characters). The fallback covers an email whose local part has none left after that.
export function nameFromEmail(email: string): string {
  const localPart = email.slice(0, email.lastIndexOf("@"));
  const cleaned = localPart.replace(/\p{Cc}/gu, "").slice(0, PERSON_NAME_MAX);
  const parsed = personNameSchema.safeParse(cleaned);
  return parsed.success ? parsed.data : "Teacher";
}

// Better Auth signs the new teacher in, so the session cookie is set on success.
export async function signUp({ email, password }: CreateAccountBody): Promise<void> {
  await requestJson("/api/auth/sign-up/email", authUserResponseSchema, {
    method: "POST",
    body: { name: nameFromEmail(email), email, password },
  });
}

// Better Auth deletes the session row and clears the cookie.
export async function signOut(): Promise<void> {
  await requestJson("/api/auth/sign-out", signOutResponseSchema, { method: "POST", body: {} });
}
