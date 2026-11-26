// The only module that calls fetch against /api (ARCHITECTURE.md rule 10).
// Every response is parsed with a schema before use (BP-005).
import { z } from "zod";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

// Temporary local schema for the TASK-004 stack proof, accepted in that task's decisions.
// TASK-010 replaces it with a schema from @gradelink/shared. It keeps only the email, so
// nothing else from the session reaches the UI.
const currentSessionSchema = z.object({ user: z.object({ email: z.email() }) }).nullable();

export type CurrentSession = z.infer<typeof currentSessionSchema>;

// Relative path, so the Vite proxy and production behave the same way (BP-020).
export async function getCurrentSession(): Promise<CurrentSession> {
  const response = await fetch("/api/auth/get-session", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return currentSessionSchema.parse(await response.json());
}
