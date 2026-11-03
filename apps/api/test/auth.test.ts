import { createHash, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fromNodeHeaders } from "better-auth/node";
import { eq, like } from "drizzle-orm";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { auth } from "../src/auth.ts";
import { db, pool } from "../src/db/client.ts";
import { session, user } from "../src/db/schema.ts";
import { env } from "../src/env.ts";

const EMAIL_DOMAIN = "auth-test.gradelink.example";
const PASSWORD = "fabricated pass phrase 01";
const PWNED_URL = "https://api.pwnedpasswords.com/range/";

const realFetch = globalThis.fetch;
let pwnedResponse: (prefixSuffix: string) => Response;
let ipCounter = 0;

function listen(app: Express) {
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function urlOf(server: Server) {
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function uniqueEmail() {
  return `${randomUUID()}@${EMAIL_DOMAIN}`;
}

// A separate address per test, so one test's requests don't count against another's limit.
function uniqueIp() {
  ipCounter += 1;
  return `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function sha1Suffix(password: string) {
  return createHash("sha1").update(password).digest("hex").toUpperCase().slice(5);
}

// The attributes after the name=value pair, so the `__Secure-` name prefix can't match "secure".
function cookieAttributes(setCookie: string) {
  return setCookie
    .split(";")
    .slice(1)
    .map((attribute) => attribute.trim().toLowerCase());
}

// Everything the process could write to a log while `run` executes.
async function captureLogs(run: () => Promise<void>) {
  const chunks: unknown[] = [];
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      chunks.push(chunk);
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      chunks.push(chunk);
      return true;
    }),
    ...(["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation((...args) => {
        chunks.push(args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(" "));
      }),
    ),
  ];
  try {
    await run();
  } finally {
    for (const spy of spies) {
      spy.mockRestore();
    }
  }
  return chunks.map(String).join("");
}

describe("Better Auth on Express 5", () => {
  let server: Server;
  let baseUrl: string;

  function post(path: string, body: unknown, options: { ip?: string; headers?: object } = {}) {
    return fetch(`${baseUrl}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: env.BETTER_AUTH_URL,
        "x-forwarded-for": options.ip ?? uniqueIp(),
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
  }

  function signUp(email = uniqueEmail(), password = PASSWORD, ip?: string) {
    return post("/sign-up/email", { name: "Test Teacher", email, password }, ip ? { ip } : {});
  }

  function signIn(email: string, password = PASSWORD, ip?: string) {
    return post("/sign-in/email", { email, password }, ip ? { ip } : {});
  }

  function sessionCookie(response: Response) {
    const cookie = response.headers.getSetCookie().find((c) => c.includes("session_token="));
    if (!cookie) {
      throw new Error("Expected a session cookie");
    }
    return cookie;
  }

  function cookiePair(setCookie: string) {
    return setCookie.split(";")[0] ?? "";
  }

  function getSession(cookie?: string) {
    return auth.api.getSession({ headers: fromNodeHeaders(cookie ? { cookie } : {}) });
  }

  beforeAll(async () => {
    vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith(PWNED_URL)) {
        return Promise.resolve(pwnedResponse(url.slice(PWNED_URL.length)));
      }
      return realFetch(input, init);
    });
    server = await listen(createApp());
    baseUrl = urlOf(server);
  });

  beforeEach(() => {
    pwnedResponse = () => new Response("0000000000000000000000000000000000A:1\n");
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.delete(user).where(like(user.email, `%@${EMAIL_DOMAIN}`));
    await pool.end();
    vi.unstubAllGlobals();
  });

  describe("mounting", () => {
    it("reads the sign-up body even with express.json() in the app", async () => {
      const email = uniqueEmail();

      const response = await signUp(email);

      expect(response.status).toBe(200);
      const rows = await db.select().from(user).where(eq(user.email, email));
      expect(rows).toHaveLength(1);
    });

    it("leaves other routes working after the JSON middleware", async () => {
      const response = await fetch(`${baseUrl}/api/hello`);

      expect(response.status).toBe(200);
    });
  });

  describe("session flow", () => {
    it("signs in, finds the session, and rejects no cookie", async () => {
      const email = uniqueEmail();
      await signUp(email);

      const response = await signIn(email);

      expect(response.status).toBe(200);
      const current = await getSession(cookiePair(sessionCookie(response)));
      expect(current?.user.email).toBe(email);
      expect(await getSession()).toBeNull();
    });

    it("signs out by deleting the session row, so the old cookie stops working", async () => {
      const email = uniqueEmail();
      await signUp(email);
      const cookie = cookiePair(sessionCookie(await signIn(email)));
      const current = await getSession(cookie);
      const token = current?.session.token ?? "";
      expect(await db.select().from(session).where(eq(session.token, token))).toHaveLength(1);

      const response = await post("/sign-out", {}, { headers: { cookie } });

      expect(response.status).toBe(200);
      expect(await db.select().from(session).where(eq(session.token, token))).toHaveLength(0);
      expect(await getSession(cookie)).toBeNull();
    });

    it("creates a new session for each sign-in", async () => {
      const email = uniqueEmail();
      await signUp(email);

      const first = cookiePair(sessionCookie(await signIn(email)));
      const second = cookiePair(sessionCookie(await signIn(email)));

      expect(second).not.toBe(first);
    });

    it("sets a session lifetime of 24 hours", async () => {
      const email = uniqueEmail();
      await signUp(email);
      const current = await getSession(cookiePair(sessionCookie(await signIn(email))));
      const hours = ((current?.session.expiresAt.getTime() ?? 0) - Date.now()) / 3_600_000;

      expect(hours).toBeGreaterThan(23.9);
      expect(hours).toBeLessThanOrEqual(24);
    });

    it("extends a session used an hour or more after its last refresh", async () => {
      const email = uniqueEmail();
      await signUp(email);
      const cookie = cookiePair(sessionCookie(await signIn(email)));
      const token = (await getSession(cookie))?.session.token ?? "";
      const expiresAt = new Date(Date.now() + 22 * 3_600_000);
      await db.update(session).set({ expiresAt }).where(eq(session.token, token));

      await getSession(cookie);

      const [row] = await db.select().from(session).where(eq(session.token, token));
      const hours = ((row?.expiresAt.getTime() ?? 0) - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(23.9);
    });

    it("leaves a session alone within the first hour", async () => {
      const email = uniqueEmail();
      await signUp(email);
      const cookie = cookiePair(sessionCookie(await signIn(email)));
      const token = (await getSession(cookie))?.session.token ?? "";
      const expiresAt = new Date(Date.now() + 23.5 * 3_600_000);
      await db.update(session).set({ expiresAt }).where(eq(session.token, token));

      await getSession(cookie);

      const [row] = await db.select().from(session).where(eq(session.token, token));
      expect(row?.expiresAt.getTime()).toBe(expiresAt.getTime());
    });
  });

  describe("logging when a database write fails", () => {
    function failInserts(table: string) {
      const realQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;
      const params: string[] = [];
      const spy = vi.spyOn(pool, "query").mockImplementation(((...args: unknown[]) => {
        const [query, values] = args;
        const text = typeof query === "string" ? query : (query as { text?: string }).text;
        if (text?.includes(`insert into "${table}"`)) {
          params.push(...(values as unknown[]).filter((v) => typeof v === "string"));
          const error = Object.assign(new Error("simulated failure"), { code: "57P01" });
          return Promise.reject(error);
        }
        return realQuery(...args);
      }) as never);
      return { params, restore: () => spy.mockRestore() };
    }

    it("keeps session tokens out of the logs and the response", async () => {
      const email = uniqueEmail();
      await signUp(email);
      const insert = failInserts("session");
      let body = "";
      let status = 0;

      const logs = await captureLogs(async () => {
        const response = await signIn(email);
        status = response.status;
        body = await response.text();
      });
      insert.restore();

      expect(status).toBe(500);
      const token = insert.params.find((value) => /^[A-Za-z0-9]{32}$/.test(value));
      expect(token).toBeDefined();
      expect(logs).not.toContain(token);
      expect(body).not.toContain(token);
      expect(logs).not.toContain(email);
      expect(logs).not.toContain("Failed query");
      expect(logs).not.toContain("params:");
    });

    it("keeps password hashes out of the logs and the response, but records the error", async () => {
      const email = uniqueEmail();
      const insert = failInserts("account");
      let body = "";
      let status = 0;

      const logs = await captureLogs(async () => {
        const response = await signUp(email);
        status = response.status;
        body = await response.text();
      });
      insert.restore();

      expect(status).toBe(500);
      const hash = insert.params.find((value) => /^[0-9a-f]+:[0-9a-f]+$/.test(value));
      expect(hash).toBeDefined();
      expect(logs).not.toContain(hash);
      expect(body).not.toContain(hash);
      expect(logs).not.toContain(PASSWORD);
      expect(logs).not.toContain("Failed query");
      expect(logs).toContain("[auth] error");
      expect(logs).toContain("57P01");
    });
  });

  describe("passwords", () => {
    it("rejects 14 characters", async () => {
      const email = uniqueEmail();

      const response = await signUp(email, "a".repeat(14));

      expect(response.status).toBe(400);
      expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
    });

    it("accepts 15 characters", async () => {
      expect((await signUp(uniqueEmail(), "a".repeat(15))).status).toBe(200);
    });

    it("accepts a password of 64 or more characters containing spaces", async () => {
      const email = uniqueEmail();
      const password = "a long fabricated pass phrase with several spaces in it, 64+ chars";
      expect(password.length).toBeGreaterThanOrEqual(64);

      expect((await signUp(email, password)).status).toBe(200);
      expect((await signIn(email, password)).status).toBe(200);
    });

    it("rejects a password found in the breach list, sending only the hash prefix", async () => {
      const password = "fabricated breached password";
      const email = uniqueEmail();
      const prefixes: string[] = [];
      pwnedResponse = (prefix) => {
        prefixes.push(prefix);
        return new Response(`${sha1Suffix(password)}:5\n`);
      };

      const response = await signUp(email, password);

      expect(response.status).toBe(400);
      expect(prefixes).toHaveLength(1);
      expect(prefixes[0]).toHaveLength(5);
      expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
    });

    it("creates no account when the breach service is down", async () => {
      const email = uniqueEmail();
      pwnedResponse = () => new Response("unavailable", { status: 503 });

      const response = await signUp(email);

      expect(response.status).toBe(500);
      expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
    });
  });

  describe("errors", () => {
    it("answers a wrong password and an unknown email identically", async () => {
      const email = uniqueEmail();
      await signUp(email);

      const wrongPassword = await signIn(email, "fabricated wrong password");
      const unknownEmail = await signIn(uniqueEmail());

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(await unknownEmail.json()).toEqual(await wrongPassword.json());
    });

    it("creates no second user for a duplicate email", async () => {
      const email = uniqueEmail();
      await signUp(email);

      const response = await signUp(email);

      expect(response.ok).toBe(false);
      expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(1);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 on the 11th sign-in within a minute, for that IP only", async () => {
      const email = uniqueEmail();
      await signUp(email);
      const ip = uniqueIp();

      const statuses: number[] = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        statuses.push((await signIn(email, "fabricated wrong password", ip)).status);
      }

      expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
      expect(statuses[10]).toBe(429);
      expect((await signIn(email)).status).toBe(200);
    });
  });

  describe("origins", () => {
    it("rejects a foreign Origin", async () => {
      const email = uniqueEmail();
      await signUp(email);

      const response = await post(
        "/sign-in/email",
        { email, password: PASSWORD },
        { headers: { origin: "https://evil.example" } },
      );

      expect(response.status).toBe(403);
    });

    it("rejects a foreign Origin on a request carrying a session cookie", async () => {
      const email = uniqueEmail();
      await signUp(email);
      const cookie = cookiePair(sessionCookie(await signIn(email)));

      const response = await post(
        "/sign-out",
        {},
        { headers: { cookie, origin: "https://evil.example" } },
      );

      expect(response.status).toBe(403);
      expect((await getSession(cookie))?.user.email).toBe(email);
    });
  });

  describe("cookies", () => {
    it("is HttpOnly and SameSite=Lax, without Secure outside production", async () => {
      const email = uniqueEmail();
      await signUp(email);

      const attributes = cookieAttributes(sessionCookie(await signIn(email)));

      expect(attributes).toContain("httponly");
      expect(attributes).toContain("samesite=lax");
      expect(attributes).not.toContain("secure");
      expect(attributes).toContain("max-age=86400");
    });

    describe("in production", () => {
      let productionServer: Server;
      let closePool: () => Promise<void>;

      beforeAll(async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("BETTER_AUTH_SECRET", "fabricated-production-secret-for-tests-only");
        vi.resetModules();
        const app = await import("../src/app.ts");
        const client = await import("../src/db/client.ts");
        closePool = () => client.pool.end();
        productionServer = await listen(app.createApp());
      });

      afterAll(async () => {
        await new Promise((resolve) => productionServer.close(resolve));
        await closePool();
        vi.unstubAllEnvs();
        vi.resetModules();
      });

      it("adds Secure to the session cookie", async () => {
        const email = uniqueEmail();
        // Uses the outer, non-production server. Both share one database and, because Better Auth
        // isn't reloaded by resetModules, one rate-limit store, so each request needs its own IP.
        await signUp(email);

        const response = await fetch(`${urlOf(productionServer)}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: env.BETTER_AUTH_URL,
            "x-forwarded-for": uniqueIp(),
          },
          body: JSON.stringify({ email, password: PASSWORD }),
        });

        expect(response.status).toBe(200);
        const attributes = cookieAttributes(sessionCookie(response));
        expect(attributes).toContain("secure");
        expect(attributes).toContain("httponly");
        expect(attributes).toContain("samesite=lax");
      });
    });
  });
});
