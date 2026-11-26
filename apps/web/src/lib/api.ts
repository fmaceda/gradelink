// The only module that calls fetch against /api (ARCHITECTURE.md rule 10, BP-020).
// Every response is parsed with a shared schema before use (BP-005). Paths are relative, so the
// Vite proxy and production behave the same way. The session lives in Better Auth's HttpOnly
// cookie; nothing here reads it or stores a token (BP-012).
import { type ErrorCode, errorBodySchema } from "@gradelink/shared/common";
import {
  signOutResponseSchema,
  type TeacherSession,
  teacherSessionSchema,
} from "@gradelink/shared/teacher";
import { redirect } from "react-router";
import type { z } from "zod";

export const SIGN_IN_PATH = "/sign-in";

export class ApiError extends Error {
  readonly status: number;
  // From the shared error body when the server sent one; Better Auth's own errors have none.
  readonly code: ErrorCode | undefined;

  constructor(status: number, code?: ErrorCode) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function apiErrorFrom(response: Response) {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = errorBodySchema.safeParse(body);
  return new ApiError(response.status, parsed.success ? parsed.data.error.code : undefined);
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

// Better Auth deletes the session row and clears the cookie.
export async function signOut(): Promise<void> {
  await requestJson("/api/auth/sign-out", signOutResponseSchema, { method: "POST", body: {} });
}
