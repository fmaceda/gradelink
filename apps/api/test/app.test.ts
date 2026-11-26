import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";

// A tiny stand-in for apps/web/dist: CI runs the tests before `npm run build`.
const FIXTURE_DIST = fileURLToPath(new URL("./fixtures/web-dist", import.meta.url));
const MISSING_DIST = fileURLToPath(new URL("./fixtures/no-such-dist", import.meta.url));
const INDEX_MARKER = "spa-fixture-index";
const ASSET_MARKER = "spa-fixture-asset";

function listen(app: Express) {
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function urlOf(server: Server) {
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function expectJsonNotFound(response: Response) {
  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
}

describe("Express serving the API and the SPA", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await listen(createApp({ webDist: FIXTURE_DIST }));
    baseUrl = urlOf(server);
  });

  afterAll(async () => {
    await close(server);
  });

  describe("SPA fallback", () => {
    it.each(["/", "/t/fabricated-share-token", "/teacher/questions"])(
      "answers GET %s with index.html",
      async (path) => {
        const response = await fetch(`${baseUrl}${path}`);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(await response.text()).toContain(INDEX_MARKER);
      },
    );

    it("answers HEAD on a client path with index.html's headers", async () => {
      const response = await fetch(`${baseUrl}/t/fabricated-share-token`, { method: "HEAD" });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("serves a built asset as itself", async () => {
      const response = await fetch(`${baseUrl}/assets/app.js`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("javascript");
      expect(await response.text()).toContain(ASSET_MARKER);
    });

    it("answers a missing asset with 404, not index.html", async () => {
      const response = await fetch(`${baseUrl}/assets/missing-abc123.js`);

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(INDEX_MARKER);
    });
  });

  describe("unknown /api paths", () => {
    it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])(
      "answers %s with a JSON 404",
      async (method) => {
        const response = await fetch(`${baseUrl}/api/no-such-route`, { method });

        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toContain("application/json");
        if (method !== "HEAD") {
          await expectJsonNotFound(response);
        }
      },
    );

    it("answers /api itself and nested unknown paths with a JSON 404", async () => {
      await expectJsonNotFound(await fetch(`${baseUrl}/api`));
      await expectJsonNotFound(await fetch(`${baseUrl}/api/teacher/questions/123`));
    });

    // TASK-037 confirms this across every real route once routers exist.
    it("answers a wrong method on a known path with JSON, never the SPA", async () => {
      const response = await fetch(`${baseUrl}/api/auth/get-session`, { method: "DELETE" });

      expect(response.ok).toBe(false);
      expect(response.headers.get("content-type") ?? "").not.toContain("text/html");
      expect(await response.text()).not.toContain(INDEX_MARKER);
    });

    // ARCHITECTURE.md rule 7: Better Auth keeps its own shape under /api/auth.
    it("leaves unknown /api/auth paths to Better Auth, which answers without HTML", async () => {
      const response = await fetch(`${baseUrl}/api/auth/no-such-endpoint`);

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type") ?? "").not.toContain("text/html");
      expect(await response.text()).not.toContain(INDEX_MARKER);
    });
  });

  it("parses JSON bodies for routes after express.json()", async () => {
    const response = await fetch(`${baseUrl}/api/no-such-route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fabricated: true }),
    });

    await expectJsonNotFound(response);
  });
});

describe("Express with no SPA build", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await listen(createApp({ webDist: MISSING_DIST }));
    baseUrl = urlOf(server);
  });

  afterAll(async () => {
    await close(server);
  });

  it("still starts and answers the API", async () => {
    await expectJsonNotFound(await fetch(`${baseUrl}/api/no-such-route`));

    const session = await fetch(`${baseUrl}/api/auth/get-session`);
    expect(session.status).toBe(200);
  });

  it("answers client paths with a 404 instead of crashing", async () => {
    const response = await fetch(`${baseUrl}/t/fabricated-share-token`);

    expect(response.status).toBe(404);
  });
});
