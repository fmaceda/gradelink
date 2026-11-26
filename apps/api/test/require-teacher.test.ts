import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { auth } from "../src/auth.ts";
import { db, pool } from "../src/db/client.ts";
import { session, user } from "../src/db/schema.ts";
import { env } from "../src/env.ts";
import { currentTeacherId } from "../src/middleware/require-teacher.ts";
import { createApiRouter } from "../src/routes/index.ts";
import { captureOutput, listen } from "./support/server.ts";
import { createTwoTeachers, type TeacherPair } from "./support/teachers.ts";

const UNAUTHENTICATED = { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } };

// A probe behind requireTeacher that reports which teacher it sees.
function probeRouter() {
  const router = Router();
  router.all("/whoami", (_req, res) => {
    res.json({ teacherId: currentTeacherId(res) });
  });
  return router;
}

// The raw session token inside a `name=value` cookie pair (the value is `token.signature`).
function tokenOf(cookie: string) {
  return decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)).split(".")[0] ?? "";
}

describe("requireTeacher", () => {
  let probe: Awaited<ReturnType<typeof listen>>;
  let real: Awaited<ReturnType<typeof listen>>;
  let teachers: TeacherPair;

  function get(path: string, headers: Record<string, string> = {}, server = probe) {
    return fetch(`${server.url}${path}`, { headers });
  }

  beforeAll(async () => {
    probe = await listen(
      createApp({ apiRouter: createApiRouter({ teacherRouter: probeRouter() }) }),
    );
    real = await listen(createApp());
    teachers = await createTwoTeachers(probe.url);
  });

  afterAll(async () => {
    try {
      await teachers?.cleanup();
      await probe?.close();
      await real?.close();
    } finally {
      await pool.end();
    }
  });

  describe("identity", () => {
    it("puts the signed-in teacher's id on res.locals", async () => {
      const response = await teachers.a.request({ path: "/api/teacher/whoami" });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ teacherId: teachers.a.id });
    });

    it("ignores an x-teacher-id header naming another teacher", async () => {
      const response = await get("/api/teacher/whoami", {
        cookie: teachers.a.cookie,
        "x-teacher-id": teachers.b.id,
      });

      expect(await response.json()).toEqual({ teacherId: teachers.a.id });
    });

    it("ignores teacher_id and teacherId in the body", async () => {
      const response = await teachers.a.request({
        method: "POST",
        path: "/api/teacher/whoami",
        body: { teacher_id: teachers.b.id, teacherId: teachers.b.id },
      });

      expect(await response.json()).toEqual({ teacherId: teachers.a.id });
    });

    it("rejects an x-teacher-id header without a session", async () => {
      const response = await get("/api/teacher/whoami", { "x-teacher-id": teachers.a.id });

      expect(response.status).toBe(401);
    });

    it("lets a teacher with an unverified email through (email verification is post-MVP)", async () => {
      const [row] = await db.select().from(user).where(eq(user.id, teachers.a.id));
      expect(row?.emailVerified).toBe(false);

      const response = await teachers.a.request({ path: "/api/teacher/whoami" });

      expect(response.status).toBe(200);
    });
  });

  describe("rejections", () => {
    async function expectUnauthenticated(response: Response) {
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.json()).toEqual(UNAUTHENTICATED);
    }

    it("rejects a request with no cookie", async () => {
      await expectUnauthenticated(await get("/api/teacher/whoami"));
    });

    it("rejects a garbage session cookie", async () => {
      const name = teachers.a.cookie.split("=")[0];

      await expectUnauthenticated(await get("/api/teacher/whoami", { cookie: `${name}=garbage` }));
    });

    it("rejects a real token with a forged signature", async () => {
      const name = teachers.a.cookie.split("=")[0];
      const forged = `${name}=${encodeURIComponent(`${tokenOf(teachers.a.cookie)}.forged`)}`;

      await expectUnauthenticated(await get("/api/teacher/whoami", { cookie: forged }));
    });

    it("rejects an expired session, deletes it, and clears the cookie", async () => {
      const cookie = await teachers.a.newSession();
      const token = tokenOf(cookie);
      await db
        .update(session)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(session.token, token));

      const response = await get("/api/teacher/whoami", { cookie });

      const cleared = response.headers.getSetCookie().find((c) => c.includes("session_token="));
      await expectUnauthenticated(response);
      expect(cleared?.toLowerCase()).toContain("max-age=0");
      expect(await db.select().from(session).where(eq(session.token, token))).toHaveLength(0);
    });

    it("rejects a cookie replayed after sign-out", async () => {
      const cookie = await teachers.a.newSession();
      expect((await get("/api/teacher/whoami", { cookie })).status).toBe(200);

      const signOut = await fetch(`${probe.url}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie, origin: env.BETTER_AUTH_URL, "content-type": "application/json" },
        body: "{}",
      });

      expect(signOut.status).toBe(200);
      await expectUnauthenticated(await get("/api/teacher/whoami", { cookie }));
    });

    it("answers 401, not 400, when Better Auth throws its own 401 mid-refresh", async () => {
      const spy = vi
        .spyOn(auth.api, "getSession")
        .mockRejectedValueOnce(new APIError("UNAUTHORIZED", { message: "Failed to get session" }));
      try {
        await expectUnauthenticated(
          await get("/api/teacher/whoami", { cookie: teachers.a.cookie }),
        );
      } finally {
        spy.mockRestore();
      }
    });

    it("answers a session lookup failure with a generic 500, logging only its code", async () => {
      const failure = Object.assign(new Error(`query failed, params: ${teachers.a.cookie}`), {
        code: "57P01",
      });
      const spy = vi.spyOn(auth.api, "getSession").mockRejectedValueOnce(failure);
      const output = captureOutput();
      try {
        const response = await get("/api/teacher/whoami", { cookie: teachers.a.cookie });

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
        const logs = await output.waitFor("[request]");
        expect(logs).toContain("unhandled (57P01)");
        expect(logs).not.toContain(tokenOf(teachers.a.cookie));
      } finally {
        output.stop();
        spy.mockRestore();
      }
    });
  });

  describe("session refresh", () => {
    it("forwards the refreshed cookie when it extends a session", async () => {
      const cookie = await teachers.a.newSession();
      await db
        .update(session)
        .set({ expiresAt: new Date(Date.now() + 22 * 3_600_000) })
        .where(eq(session.token, tokenOf(cookie)));

      const response = await get("/api/teacher/whoami", { cookie });

      expect(response.status).toBe(200);
      const refreshed = response.headers.getSetCookie().find((c) => c.includes("session_token="));
      expect(refreshed?.toLowerCase()).toContain("max-age=86400");
    });

    it("sets no cookie on an ordinary request", async () => {
      const response = await teachers.a.request({ path: "/api/teacher/whoami" });

      expect(response.headers.getSetCookie()).toEqual([]);
    });
  });

  describe("logs", () => {
    it("never records the cookie, token or session id of a rejected session (BP-043)", async () => {
      const name = teachers.a.cookie.split("=")[0];
      const expired = await teachers.a.newSession();
      const signedOut = await teachers.a.newSession();
      const ids: string[] = [];
      for (const cookie of [expired, signedOut]) {
        const [row] = await db
          .select()
          .from(session)
          .where(eq(session.token, tokenOf(cookie)));
        ids.push(row?.id ?? "missing");
      }
      await db
        .update(session)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(session.token, tokenOf(expired)));
      await fetch(`${probe.url}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          cookie: signedOut,
          origin: env.BETTER_AUTH_URL,
          "content-type": "application/json",
        },
        body: "{}",
      });
      const rejected = [expired, signedOut, `${name}=garbage-cookie-value`];

      const output = captureOutput();
      try {
        for (const cookie of rejected) {
          expect((await get("/api/teacher/whoami", { cookie })).status).toBe(401);
        }
        // One request line per rejection, written when each response closes.
        const logs = await output.waitFor(/(?:\[request\][\s\S]*){3}/);

        for (const cookie of rejected) {
          expect(logs).not.toContain(cookie);
          expect(logs).not.toContain(tokenOf(cookie));
        }
        for (const id of ids) {
          expect(logs).not.toContain(id);
        }
      } finally {
        output.stop();
      }
    });
  });

  describe("mounting on the real app", () => {
    it("rejects an unknown teacher path when signed out", async () => {
      const response = await get("/api/teacher/nope", {}, real);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual(UNAUTHENTICATED);
    });

    it("rejects the teacher root and a write when signed out", async () => {
      expect((await get("/api/teacher", {}, real)).status).toBe(401);
      const post = await fetch(`${real.url}/api/teacher/questions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(post.status).toBe(401);
    });

    it("answers an unknown teacher path with a JSON 404 when signed in", async () => {
      const response = await get("/api/teacher/nope", { cookie: teachers.a.cookie }, real);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "Not found." },
      });
    });

    it("leaves other /api paths and Better Auth alone", async () => {
      expect((await get("/api/nope", {}, real)).status).toBe(404);
      expect((await get("/api/teachers", {}, real)).status).toBe(404);
      const authSession = await get("/api/auth/get-session", {}, real);
      expect(authSession.status).toBe(200);
    });
  });
});
