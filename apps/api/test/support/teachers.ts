// The two-teacher harness for cross-teacher isolation (TASK-009, BP-031, SECURITY.md).
//
// How later tasks add cases: every new /api/teacher/* route that takes a resource id gets a case
// in test/teacher-isolation.test.ts in the same task. Create the resource as teacher A (through
// the route or the service), then call
//   await expectNotFoundForOtherTeacher(teachers, id, (id) => ({ path: `/api/teacher/questions/${id}` }))
// A POST, PUT or PATCH case must also pass `readOwned`, which reads A's row so the helper can
// show B's request changed nothing (the helper throws without it):
//   await expectNotFoundForOtherTeacher(teachers, id, (id) => ({ method: "PATCH", path, body }),
//     { readOwned: () => db.select().from(questions).where(eq(questions.id, id)) })
// List routes assert that B's list leaves out A's items, and routes that take ids in the body
// (questionIds, tagIds) assert that B gets the same 404 or 400 for A's ids as for unknown ones.
// A task that adds a teacher-owned table also adds it to deleteTeachers below, children first.
// The check that every route has a case is TASK-037's.
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { expect } from "vitest";
import { db } from "../../src/db/client.ts";
import { questions, tests, user } from "../../src/db/schema.ts";
import { env } from "../../src/env.ts";

export const TEACHER_EMAIL_DOMAIN = "teachers.gradelink.example";
const PASSWORD = "fabricated harness pass phrase";
const PWNED_URL = "https://api.pwnedpasswords.com/range/";
// A hash suffix no password has, so the breach check always passes without the network.
const NOT_PWNED = "0000000000000000000000000000000000A:1\n";

export type TeacherRequest = { method?: string; path: string; body?: unknown };

export type Teacher = {
  id: string;
  email: string;
  // The `name=value` pair of the session cookie.
  cookie: string;
  request(request: TeacherRequest): Promise<Response>;
  // Signs in again and returns the new session's cookie pair, for tests that expire or sign out
  // a session without touching `cookie`.
  newSession(): Promise<string>;
};

export type TeacherPair = { a: Teacher; b: Teacher; cleanup: () => Promise<void> };

let ipCounter = 0;

// Better Auth limits sign-up and sign-in per IP, and its limiter stays on in tests, so each call
// comes from its own address. auth.test.ts uses 10.20.*; this range keeps them apart.
function uniqueIp() {
  ipCounter += 1;
  return `10.30.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

// Origin is the app's own, as a browser would send it, so Better Auth's origin check stays on.
function send(baseUrl: string, { method = "GET", path, body }: TeacherRequest, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      origin: env.BETTER_AUTH_URL,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

// The breached-password check calls an outside service; tests answer it locally, as
// auth.test.ts does. Every other request goes through to whatever fetch was in place. A plain
// swap rather than vi.spyOn: spying on an already-spied fetch reuses that spy, so a test's own
// fetch mock would be replaced instead of wrapped.
async function withBreachCheckMocked<T>(run: () => Promise<T>) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.startsWith(PWNED_URL)
      ? Promise.resolve(new Response(NOT_PWNED))
      : previousFetch(input, init);
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function sessionCookiePair(response: Response) {
  const cookie = response.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (cookie === undefined) {
    throw new Error("Sign-in returned no session cookie");
  }
  return cookie.split(";")[0] ?? "";
}

// Signs a teacher up and then in through the real Better Auth endpoints. The email is recorded
// before sign-up, so cleanup finds the account even if a later step fails.
async function createTeacher(baseUrl: string, emails: string[]): Promise<Teacher> {
  const email = `${randomUUID()}@${TEACHER_EMAIL_DOMAIN}`;
  emails.push(email);
  const credentials = { email, password: PASSWORD };

  const signUp = await withBreachCheckMocked(() =>
    send(
      baseUrl,
      {
        method: "POST",
        path: "/api/auth/sign-up/email",
        body: { name: "Test Teacher", ...credentials },
      },
      { "x-forwarded-for": uniqueIp() },
    ),
  );
  if (!signUp.ok) {
    throw new Error(`Teacher sign-up failed with ${signUp.status}`);
  }

  const { cookie, id } = await signIn(baseUrl, credentials);
  return {
    id,
    email,
    cookie,
    request: (request) => send(baseUrl, request, { cookie }),
    newSession: async () => (await signIn(baseUrl, credentials)).cookie,
  };
}

async function signIn(baseUrl: string, credentials: { email: string; password: string }) {
  const response = await send(
    baseUrl,
    { method: "POST", path: "/api/auth/sign-in/email", body: credentials },
    { "x-forwarded-for": uniqueIp() },
  );
  if (!response.ok) {
    throw new Error(`Teacher sign-in failed with ${response.status}`);
  }
  const cookie = sessionCookiePair(response);
  const { user: signedIn } = (await response.json()) as { user: { id: string } };
  return { cookie, id: signedIn.id };
}

// Removes the accounts and everything they own. Owned rows go first: teacher_id has no cascade.
// Deleting tests cascades to test_questions, snapshots, attempts and attempt answers.
async function deleteTeachers(emails: readonly string[]) {
  if (emails.length === 0) {
    return;
  }
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.email, [...emails]));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return;
  }
  await db.delete(tests).where(inArray(tests.teacherId, ids));
  await db.delete(questions).where(inArray(questions.teacherId, ids));
  await db.delete(user).where(inArray(user.id, ids));
}

// Two signed-in teachers. Call `cleanup` in afterAll, which runs even when a test fails. If
// setup itself fails, whatever it created is removed before the error is rethrown.
export async function createTwoTeachers(baseUrl: string): Promise<TeacherPair> {
  const emails: string[] = [];
  const cleanup = () => deleteTeachers(emails);
  try {
    const a = await createTeacher(baseUrl, emails);
    const b = await createTeacher(baseUrl, emails);
    return { a, b, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

// For a single test: the teachers exist only while `run` does, and are removed in `finally`.
export async function withTwoTeachers<T>(
  baseUrl: string,
  run: (teachers: TeacherPair) => Promise<T>,
): Promise<T> {
  const teachers = await createTwoTeachers(baseUrl);
  try {
    return await run(teachers);
  } finally {
    await teachers.cleanup();
  }
}

// Methods whose request could change A's row while still answering B with a 404. A DELETE needs
// no read: A deleting it successfully afterwards shows B's delete didn't happen.
const STATE_CHANGING = new Set(["POST", "PUT", "PATCH"]);

type IsolationOptions = {
  // Reads A's resource straight from the database (or as A). Called before and after B's
  // requests; the two results must be equal, so B's update can't have changed anything.
  // Required for POST, PUT and PATCH.
  readOwned?: () => Promise<unknown>;
};

// Asserts that teacher B can't reach teacher A's resource `ownedId` through `requestFor`, and
// can't tell it exists: B gets a 404 (never 403) whose body is identical to the 404 for an id
// that doesn't exist (BP-031, BP-045). For an update, `readOwned` shows B changed nothing. A
// goes last, so it also shows the route works and, for a delete, that B's delete didn't happen.
export async function expectNotFoundForOtherTeacher(
  { a, b }: Pick<TeacherPair, "a" | "b">,
  ownedId: string,
  requestFor: (id: string) => TeacherRequest,
  { readOwned }: IsolationOptions = {},
) {
  const method = (requestFor(ownedId).method ?? "GET").toUpperCase();
  if (STATE_CHANGING.has(method) && readOwned === undefined) {
    throw new Error(`A ${method} isolation case must pass readOwned, to show B changed nothing`);
  }
  const before = await readOwned?.();

  const crossTeacher = await b.request(requestFor(ownedId));
  const crossTeacherBody = await crossTeacher.text();
  expect(crossTeacher.status, "teacher B must get 404, never 403, for teacher A's resource").toBe(
    404,
  );

  const missing = await b.request(requestFor(randomUUID()));
  const missingBody = await missing.text();
  expect(missing.status, "an id that doesn't exist must get 404").toBe(404);
  expect(crossTeacher.headers.get("content-type")).toBe(missing.headers.get("content-type"));
  expect(crossTeacherBody, "teacher A's resource must look exactly like a missing one").toBe(
    missingBody,
  );

  if (readOwned !== undefined) {
    expect(await readOwned(), "teacher B's request must not change teacher A's resource").toEqual(
      before,
    );
  }

  const owner = await a.request(requestFor(ownedId));
  expect(owner.ok, `teacher A must reach their own resource, got ${owner.status}`).toBe(true);
}
