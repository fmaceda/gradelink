import { fileURLToPath } from "node:url";
import { createQuestionBodySchema, errorBodySchema } from "@gradelink/shared";
import express, { Router } from "express";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../src/app.ts";
import { env } from "../src/env.ts";
import { AppError } from "../src/errors.ts";
import { errorHandler } from "../src/middleware/error-handler.ts";
import { createRateLimit } from "../src/middleware/rate-limit.ts";
import { securityHeaders } from "../src/middleware/security-headers.ts";
import { validated } from "../src/middleware/validate.ts";
import { captureOutput, listen } from "./support/server.ts";

const FIXTURE_DIST = fileURLToPath(new URL("./fixtures/web-dist", import.meta.url));
const FAKE_TOKEN = "fabricated-share-token-7f3a9c";
const FAKE_SQL = "select answer_key from questions where share_token = $1";
const FAKE_SECRET = "fabricated-session-cookie-value-91b2";
const JSON_LIMIT_BYTES = 100 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

class FakeDrizzleQueryError extends Error {
  constructor() {
    super(`Failed query: ${FAKE_SQL}\nparams: ${FAKE_TOKEN}`);
    this.name = "DrizzleQueryError";
    this.cause = Object.assign(new Error(`duplicate key ${FAKE_TOKEN}`), { code: "23505" });
  }
}

// Probe routes standing in for the routers later tasks add.
function probeRouter() {
  const router = Router();
  router.get("/probe/ip", (req, res) => {
    res.json({ ip: req.ip });
  });
  router.post(
    "/probe/items/:id",
    validated(
      {
        body: z.strictObject({ name: z.string().min(1).max(10), text: z.string().optional() }),
        params: z.strictObject({ id: z.coerce.number().int().positive() }),
        query: z.strictObject({ page: z.coerce.number().int().min(1).default(1) }),
      },
      ({ body, params, query }, _req, res) => {
        // Typed without casts: params.id and query.page are numbers here.
        const total: number = params.id + query.page;
        res.json({ id: params.id, page: query.page, total, name: body.name });
      },
    ),
  );
  router.post(
    "/probe/bodyless",
    validated(
      { body: z.undefined(), params: z.strictObject({}), query: z.strictObject({}) },
      (_input, _req, res) => {
        res.status(204).end();
      },
    ),
  );
  router.post(
    "/probe/answers",
    validated(
      {
        body: z.strictObject({
          answers: z.record(z.string(), z.number()),
          items: z.array(z.strictObject({ label: z.string() })).optional(),
        }),
        params: z.strictObject({}),
        query: z.strictObject({}),
      },
      (_input, _req, res) => {
        res.status(204).end();
      },
    ),
  );
  router.post(
    "/probe/questions",
    validated(
      { body: createQuestionBodySchema, params: z.strictObject({}), query: z.strictObject({}) },
      (_input, _req, res) => {
        res.status(204).end();
      },
    ),
  );
  router.get("/probe/tokens/:token", (_req, res) => {
    res.json({ ok: true });
  });
  router.get("/probe/app-error", () => {
    throw new AppError(404, "NOT_FOUND", "Not found.");
  });
  router.get("/probe/leaky-error", () => {
    const error = new Error(`boom ${FAKE_TOKEN} ${FAKE_SQL}`);
    error.stack = `Error: boom ${FAKE_TOKEN}\n    at secretFrame (/srv/app/leak.ts:1:1)`;
    throw error;
  });
  router.get("/probe/drizzle-error", async () => {
    throw new FakeDrizzleQueryError();
  });
  router.get("/probe/partial", (_req, res) => {
    res.status(200).type("text/plain");
    res.write("partial-body");
    throw new Error(`late failure ${FAKE_TOKEN}`);
  });
  return router;
}

async function expectErrorBody(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  const body = errorBodySchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  return body;
}

describe("API hardening baseline", () => {
  let baseUrl: string;
  let close: () => Promise<void>;
  let output: ReturnType<typeof captureOutput> | undefined;

  function capture() {
    output = captureOutput();
    return output;
  }

  beforeAll(async () => {
    ({ url: baseUrl, close } = await listen(
      createApp({ webDist: FIXTURE_DIST, apiRouter: probeRouter() }),
    ));
  });

  afterEach(() => {
    output?.stop();
    output = undefined;
  });

  afterAll(async () => {
    await close();
  });

  describe("security headers", () => {
    function cspDirective(response: Response, name: string) {
      const csp = response.headers.get("content-security-policy") ?? "";
      return csp
        .split(";")
        .map((directive) => directive.trim())
        .find((directive) => directive.split(" ")[0] === name);
    }

    it.each([
      ["an API response", "/api/no-such-route"],
      ["the SPA fallback", `/t/${FAKE_TOKEN}`],
      ["a Better Auth response", "/api/auth/get-session"],
    ])("sets them on %s", async (_label, path) => {
      const response = await fetch(`${baseUrl}${path}`);

      expect(cspDirective(response, "script-src")).toBe("script-src 'self'");
      expect(cspDirective(response, "script-src-attr")).toBe("script-src-attr 'none'");
      expect(cspDirective(response, "style-src")).toBe("style-src 'self'");
      expect(cspDirective(response, "frame-ancestors")).toBe("frame-ancestors 'none'");
      expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    // TASK-010 CSP check: Radix's scroll lock injects a <style> element, allowed by nonce only.
    it("allows only nonce-carrying <style> elements, with a fresh nonce per response", async () => {
      const first = await fetch(`${baseUrl}/t/${FAKE_TOKEN}`);
      const second = await fetch(`${baseUrl}/api/no-such-route`);

      const nonceOf = (response: Response) =>
        cspDirective(response, "style-src-elem")?.match(
          /^style-src-elem 'self' 'nonce-([A-Za-z0-9+/]{22}==)'$/,
        )?.[1];
      const firstNonce = nonceOf(first);
      expect(firstNonce).toBeDefined();
      expect(nonceOf(second)).toBeDefined();
      expect(nonceOf(second)).not.toBe(firstNonce);
      expect(cspDirective(first, "style-src-attr")).toBeUndefined();
    });

    it("sets no CORS headers, even for a foreign Origin", async () => {
      const response = await fetch(`${baseUrl}/api/no-such-route`, {
        headers: { origin: "https://evil.example" },
      });

      const corsHeaders = [...response.headers.keys()].filter((name) =>
        name.startsWith("access-control-"),
      );
      expect(corsHeaders).toEqual([]);
    });

    it("leaves HSTS and upgrade-insecure-requests off outside production", async () => {
      expect(env.NODE_ENV).not.toBe("production");
      const response = await fetch(`${baseUrl}/t/${FAKE_TOKEN}`);

      expect(response.headers.get("strict-transport-security")).toBeNull();
      expect(response.headers.get("content-security-policy")).not.toContain(
        "upgrade-insecure-requests",
      );
    });

    it("sends HSTS and upgrade-insecure-requests in production", async () => {
      const app = express();
      app.use(securityHeaders(true));
      app.get("/", (_req, res) => {
        res.send("ok");
      });
      const server = await listen(app);
      try {
        const response = await fetch(server.url);

        expect(response.headers.get("strict-transport-security")).toContain("max-age=");
        expect(response.headers.get("content-security-policy")).toContain(
          "upgrade-insecure-requests",
        );
        expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
      } finally {
        await server.close();
      }
    });
  });

  describe("body limit and parsing", () => {
    function postText(size: number) {
      const overhead = JSON.stringify({ name: "a", text: "" }).length;
      return fetch(`${baseUrl}/api/probe/items/1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "a", text: "x".repeat(size - overhead) }),
      });
    }

    it("accepts a body just under 100 KB", async () => {
      const response = await postText(JSON_LIMIT_BYTES - 16);

      expect(response.status).toBe(200);
    });

    it("rejects a body over 100 KB with a JSON 413", async () => {
      const response = await postText(JSON_LIMIT_BYTES + 16);

      const body = await expectErrorBody(response, 413, "PAYLOAD_TOO_LARGE");
      expect(body.error.message).toBe("The request body is too large.");
    });

    it("rejects malformed JSON with a JSON 400 and no parser detail", async () => {
      const response = await fetch(`${baseUrl}/api/probe/items/1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: `{"name": "${FAKE_TOKEN}",`,
      });

      const body = await expectErrorBody(response, 400, "VALIDATION_ERROR");
      expect(body.error.message).toBe("The request body isn't valid JSON.");
      expect(JSON.stringify(body)).not.toContain(FAKE_TOKEN);
      expect(JSON.stringify(body)).not.toMatch(/position|Unexpected|SyntaxError/);
    });
  });

  describe("content type", () => {
    it("rejects a body that isn't application/json with a JSON 415", async () => {
      const response = await fetch(`${baseUrl}/api/probe/items/1`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ name: "a" }),
      });

      await expectErrorBody(response, 415, "UNSUPPORTED_MEDIA_TYPE");
    });

    it("rejects a form-encoded body", async () => {
      const response = await fetch(`${baseUrl}/api/probe/items/1`, {
        method: "POST",
        body: new URLSearchParams({ name: "a" }),
      });

      await expectErrorBody(response, 415, "UNSUPPORTED_MEDIA_TYPE");
    });

    it("accepts application/json with a charset", async () => {
      const response = await fetch(`${baseUrl}/api/probe/items/1`, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ name: "a" }),
      });

      expect(response.status).toBe(200);
    });

    it("rejects JSON in a charset other than UTF-8 with a JSON 415", async () => {
      const response = await fetch(`${baseUrl}/api/probe/items/1`, {
        method: "POST",
        headers: { "content-type": "application/json; charset=latin1" },
        body: JSON.stringify({ name: "a" }),
      });

      const body = await expectErrorBody(response, 415, "UNSUPPORTED_MEDIA_TYPE");
      expect(body.error.message).toBe("Send the request body as UTF-8 JSON.");
    });

    it("lets a bodyless POST through", async () => {
      const response = await fetch(`${baseUrl}/api/probe/bodyless`, { method: "POST" });

      expect(response.status).toBe(204);
    });

    it("leaves /api/auth/* to Better Auth", async () => {
      const response = await fetch(`${baseUrl}/api/auth/sign-out`, {
        method: "POST",
        headers: { origin: env.BETTER_AUTH_URL },
      });

      expect(response.status).not.toBe(415);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("errors", () => {
    it("turns an AppError into its status and shared body", async () => {
      const response = await fetch(`${baseUrl}/api/probe/app-error`);

      const body = await expectErrorBody(response, 404, "NOT_FOUND");
      expect(body).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
    });

    it("keeps a thrown error's token, SQL and stack out of the response and the logs", async () => {
      const logs = capture();

      const response = await fetch(`${baseUrl}/api/probe/leaky-error`);
      const body = await expectErrorBody(response, 500, "INTERNAL_ERROR");
      const text = await logs.waitFor("/api/probe/leaky-error 500");

      const leaks = [FAKE_TOKEN, FAKE_SQL, "secretFrame", "leak.ts", "boom"];
      for (const leak of leaks) {
        expect(JSON.stringify(body)).not.toContain(leak);
        expect(text).not.toContain(leak);
      }
      expect(text).toMatch(new RegExp(`\\[error\\] ${UUID} unhandled \\(Error\\)`));
    });

    it("logs a Drizzle-style error by its code only", async () => {
      const logs = capture();

      const response = await fetch(`${baseUrl}/api/probe/drizzle-error`);
      await expectErrorBody(response, 500, "INTERNAL_ERROR");
      const text = await logs.waitFor("/api/probe/drizzle-error 500");

      expect(text).toContain("unhandled (23505)");
      expect(text).not.toContain(FAKE_TOKEN);
      expect(text).not.toContain("Failed query");
      expect(text).not.toContain("duplicate key");
    });

    it("ends a response whose headers were already sent, without leaking the error", async () => {
      const logs = capture();

      const response = await fetch(`${baseUrl}/api/probe/partial`);
      const received = await response.text();
      const text = await logs.waitFor("/api/probe/partial 200");

      expect(received).toBe("partial-body");
      expect(text).not.toContain(FAKE_TOKEN);
      expect(text).not.toContain("late failure");
    });

    it("never calls next(error) once headers are sent", () => {
      const next = vi.fn();
      const end = vi.fn();
      const res = { headersSent: true, end, locals: { requestId: "fabricated-id" } };
      const logs = capture();

      errorHandler(new Error(FAKE_TOKEN), {} as express.Request, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(end).toHaveBeenCalledOnce();
      expect(logs.text()).not.toContain(FAKE_TOKEN);
    });

    it.each([
      ["an /api route parameter", "/api/probe/tokens/%E0%A4%A"],
      ["a Better Auth path", "/api/auth/%E0%A4%A"],
      ["the SPA fallback", "/t/%E0%A4%A"],
    ])("answers a path that can't be decoded in %s with a JSON 400", async (_label, path) => {
      const logs = capture();

      const response = await fetch(`${baseUrl}${path}`);
      const body = await expectErrorBody(response, 400, "VALIDATION_ERROR");
      const text = await logs.waitFor(/\[request\] \S+ GET .* 400/);

      expect(body.error.message).toBe("The request isn't valid.");
      expect(text).not.toContain("unhandled");
      expect(text).not.toContain("%E0");
    });

    it("answers a non-GET request to a client path with a JSON 404, not HTML", async () => {
      const response = await fetch(`${baseUrl}/t/${FAKE_TOKEN}`, { method: "POST" });

      await expectErrorBody(response, 404, "NOT_FOUND");
    });
  });

  describe("validation", () => {
    function postItem(path: string, body: unknown) {
      return fetch(`${baseUrl}/api/probe/items/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("hands the handler parsed, coerced values", async () => {
      const response = await postItem("7?page=3", { name: "Quiz" });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: 7, page: 3, total: 10, name: "Quiz" });
    });

    it.each([
      ["body", "1", { name: "" }, "body.name"],
      ["params", "not-a-number", { name: "a" }, "params.id"],
      ["query", "1?page=0", { name: "a" }, "query.page"],
    ])("rejects a bad %s with a JSON 400 naming the field", async (_label, path, body, field) => {
      const response = await postItem(path, body);

      const error = await expectErrorBody(response, 400, "VALIDATION_ERROR");
      expect(Object.keys(error.error.fields ?? {})).toContain(field);
    });

    it("never echoes submitted values or unexpected keys", async () => {
      const response = await postItem(`${FAKE_TOKEN}?${FAKE_SECRET}=1`, {
        name: FAKE_TOKEN,
        [FAKE_SECRET]: FAKE_TOKEN,
      });

      const error = await expectErrorBody(response, 400, "VALIDATION_ERROR");
      const text = JSON.stringify(error);
      expect(text).not.toContain(FAKE_TOKEN);
      expect(text).not.toContain(FAKE_SECRET);
      expect(error.error.fields?.body).toBe("Contains an unexpected field.");
    });

    it("masks client-chosen record keys but keeps declared keys and indexes", async () => {
      const response = await fetch(`${baseUrl}/api/probe/answers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { abc123: "x" }, items: [{ label: 5 }] }),
      });

      const error = await expectErrorBody(response, 400, "VALIDATION_ERROR");
      expect(Object.keys(error.error.fields ?? {}).sort()).toEqual([
        "body.answers.*",
        "body.items.0.label",
      ]);
      expect(JSON.stringify(error)).not.toContain("abc123");
    });

    // validate.ts can't walk into a discriminated union yet, so every field under one is
    // masked as body.*. That is vague but leaks nothing; TASK-011 extends the walk.
    it.each([
      ["an unknown question type", { type: FAKE_TOKEN, prompt: "Pick one" }, ["body.*"]],
      [
        "a type that isn't built yet",
        { type: "short_answer", prompt: "Capital of France?" },
        ["body.*"],
      ],
      [
        "a bad field inside a known type",
        {
          type: "multiple_choice",
          prompt: "",
          options: [{ text: FAKE_TOKEN, isCorrect: true }],
          [FAKE_SECRET]: FAKE_TOKEN,
        },
        ["body", "body.*"],
      ],
    ])("masks the fields of a discriminated-union body with %s", async (_label, body, fields) => {
      const response = await fetch(`${baseUrl}/api/probe/questions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const error = await expectErrorBody(response, 400, "VALIDATION_ERROR");
      expect(Object.keys(error.error.fields ?? {}).sort()).toEqual(fields);
      const text = JSON.stringify(error);
      expect(text).not.toContain(FAKE_TOKEN);
      expect(text).not.toContain(FAKE_SECRET);
    });

    it("rejects a body on a route that takes none", async () => {
      const response = await fetch(`${baseUrl}/api/probe/bodyless`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unexpected: true }),
      });

      await expectErrorBody(response, 400, "VALIDATION_ERROR");
    });
  });

  describe("request logging", () => {
    it("writes one line with only the request id, method, route pattern and status", async () => {
      const logs = capture();

      const response = await fetch(`${baseUrl}/api/probe/tokens/${FAKE_TOKEN}?key=${FAKE_SECRET}`, {
        headers: {
          cookie: `better-auth.session_token=${FAKE_SECRET}`,
          authorization: `Bearer ${FAKE_SECRET}`,
          "x-forwarded-for": "203.0.113.99",
          "x-request-id": "client-chosen-id",
        },
      });
      await response.text();
      const text = await logs.waitFor("/api/probe/tokens/:token");

      const lines = text.trim().split("\n");
      expect(lines).toHaveLength(1);
      const requestId = response.headers.get("x-request-id");
      expect(requestId).toMatch(new RegExp(`^${UUID}$`));
      expect(lines[0]).toBe(`[request] ${requestId} GET /api/probe/tokens/:token 200`);
      for (const leak of [FAKE_TOKEN, FAKE_SECRET, "203.0.113.99", "127.0.0.1", "client-chosen"]) {
        expect(text).not.toContain(leak);
      }
    });

    it("keeps request bodies out of the log", async () => {
      const logs = capture();

      await fetch(`${baseUrl}/api/probe/items/1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "a", text: FAKE_SECRET }),
      });
      const text = await logs.waitFor("POST /api/probe/items/:id 200");

      expect(text).not.toContain(FAKE_SECRET);
    });

    it("keeps the mount path when a routed request fails", async () => {
      const logs = capture();

      await fetch(`${baseUrl}/api/probe/app-error`);

      await logs.waitFor(new RegExp(`\\[request\\] ${UUID} GET /api/probe/app-error 404`));
    });

    // req.baseUrl is the matched text, not the mount pattern, so the client's casing of a static
    // mount path reaches the log. Harmless with static mounts; a mount with a parameter would put
    // its value in the log, which is why BP-046 keeps mount paths static.
    it("logs the mount path as the client cased it", async () => {
      const logs = capture();

      await (await fetch(`${baseUrl}/API/probe/tokens/${FAKE_TOKEN}`)).text();
      const text = await logs.waitFor("/probe/tokens/:token");

      expect(text).toMatch(new RegExp(`\\[request\\] ${UUID} GET /API/probe/tokens/:token 200`));
      expect(text).not.toContain(FAKE_TOKEN);
    });

    it.each([
      ["an unknown /api path", `/api/no-such/${FAKE_TOKEN}`],
      ["a static file", "/assets/app.js"],
    ])("logs a fixed pattern for %s", async (_label, path) => {
      const logs = capture();

      await (await fetch(`${baseUrl}${path}`)).text();
      const text = await logs.waitFor(/\[request\] /);

      expect(text).toMatch(new RegExp(`\\[request\\] ${UUID} GET \\(no route\\) \\d{3}`));
      expect(text).not.toContain(FAKE_TOKEN);
      expect(text).not.toContain("assets");
    });

    it("logs the pattern, not the token, for the SPA fallback", async () => {
      const logs = capture();

      await (await fetch(`${baseUrl}/t/${FAKE_TOKEN}`)).text();
      const text = await logs.waitFor("GET /{*splat} 200");

      expect(text).not.toContain(FAKE_TOKEN);
    });
  });

  describe("Better Auth's own 500s", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("get a status-only log line when the breached-password service is down", async () => {
      const realFetch = globalThis.fetch;
      vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.startsWith("https://api.pwnedpasswords.com/")) {
          return Promise.resolve(new Response("unavailable", { status: 503 }));
        }
        return realFetch(input, init);
      });
      const logs = capture();

      const response = await realFetch(`${baseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: env.BETTER_AUTH_URL,
          "x-forwarded-for": "10.99.0.1",
        },
        body: JSON.stringify({
          name: "Test Teacher",
          email: `pwned-down-${Date.now()}@hardening-test.gradelink.example`,
          password: "fabricated pass phrase 02",
        }),
      });
      const text = await logs.waitFor("POST /api/auth/*splat 500");

      expect(response.status).toBe(500);
      expect(text).toContain("[auth] error: Better Auth answered 500");
      expect(text).not.toContain("fabricated pass phrase 02");
      expect(text).not.toContain("Failed to check password");
    });
  });
});

describe("trust proxy", () => {
  async function ipSeen(trustProxy: number) {
    const server = await listen(createApp({ apiRouter: probeRouter(), trustProxy }));
    try {
      const response = await fetch(`${server.url}/api/probe/ip`, {
        headers: { "x-forwarded-for": "203.0.113.7" },
      });
      const { ip } = z.object({ ip: z.string() }).parse(await response.json());
      return ip;
    } finally {
      await server.close();
    }
  }

  it("defaults to 0", () => {
    expect(env.TRUST_PROXY).toBe(0);
  });

  it("ignores X-Forwarded-For when no proxy is trusted", async () => {
    expect(await ipSeen(0)).not.toBe("203.0.113.7");
  });

  it("takes the client address from X-Forwarded-For with one trusted hop", async () => {
    expect(await ipSeen(1)).toBe("203.0.113.7");
  });
});

describe("rate-limit factory", () => {
  async function appWithLimit(limit: number) {
    const app = express();
    app.use(createRateLimit({ windowMs: 60_000, limit }));
    app.all("/api/auth/*splat", (_req, res) => {
      res.json({ auth: true });
    });
    app.get("/api/limited", (_req, res) => {
      res.json({ ok: true });
    });
    return listen(app);
  }

  it("answers over-limit requests with the shared 429 body", async () => {
    const server = await appWithLimit(2);
    try {
      const statuses = [];
      for (let i = 0; i < 2; i += 1) {
        statuses.push((await fetch(`${server.url}/api/limited`)).status);
      }
      const limited = await fetch(`${server.url}/api/limited`);

      expect(statuses).toEqual([200, 200]);
      const body = await expectErrorBody(limited, 429, "RATE_LIMITED");
      expect(body.error.message).toBe("Too many requests. Wait a moment and try again.");
    } finally {
      await server.close();
    }
  });

  it("never counts /api/auth/*, whatever the case", async () => {
    const server = await appWithLimit(1);
    try {
      const statuses = [];
      for (const path of ["/api/auth/get-session", "/API/Auth/sign-in/email", "/api/auth/x"]) {
        statuses.push((await fetch(`${server.url}${path}`)).status);
      }
      statuses.push((await fetch(`${server.url}/api/limited`)).status);

      expect(statuses).toEqual([200, 200, 200, 200]);
    } finally {
      await server.close();
    }
  });
});
