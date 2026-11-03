import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = {
  NODE_ENV: "test",
  PORT: undefined,
  DATABASE_URL: "postgres://fake-user:fake-db-password@localhost:5432/fake",
  BETTER_AUTH_SECRET: "fabricated-secret-value-for-tests-only",
  BETTER_AUTH_URL: "http://localhost:3000",
};
const PLACEHOLDER = "replace-me-with-a-long-random-value";

async function loadEnv(overrides: Partial<Record<keyof typeof VALID, string | undefined>> = {}) {
  for (const [name, value] of Object.entries({ ...VALID, ...overrides })) {
    vi.stubEnv(name, value);
  }
  vi.resetModules();
  const { env } = await import("../src/env.ts");
  return env;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env", () => {
  it("parses a complete environment", async () => {
    const env = await loadEnv({ PORT: "4000" });

    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.PORT).toBe(4000);
  });

  it("defaults PORT to 3000, which the Vite proxy expects", async () => {
    expect((await loadEnv()).PORT).toBe(3000);
  });

  it.each(["NODE_ENV", "DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const)(
    "rejects a missing %s and names it",
    async (name) => {
      await expect(loadEnv({ [name]: undefined })).rejects.toThrow(name);
    },
  );

  it("rejects an empty secret", async () => {
    await expect(loadEnv({ BETTER_AUTH_SECRET: "" })).rejects.toThrow("BETTER_AUTH_SECRET");
  });

  it("rejects an invalid PORT", async () => {
    await expect(loadEnv({ PORT: "not-a-port" })).rejects.toThrow("PORT");
  });

  it("never includes values in the error", async () => {
    const error: Error = await loadEnv({
      DATABASE_URL: "not-a-url-with-fake-db-password",
      BETTER_AUTH_URL: undefined,
    }).catch((caught) => caught);

    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).not.toContain("fake-db-password");
    expect(error.message).not.toContain(VALID.BETTER_AUTH_SECRET);
  });

  describe("in production", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["the .env.example placeholder", PLACEHOLDER],
    ])("refuses a secret that is %s", async (_label, secret) => {
      await expect(loadEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret })).rejects.toThrow(
        "BETTER_AUTH_SECRET",
      );
    });

    it("accepts a real secret", async () => {
      const env = await loadEnv({ NODE_ENV: "production" });

      expect(env.NODE_ENV).toBe("production");
    });
  });

  it("allows the placeholder outside production", async () => {
    const env = await loadEnv({ NODE_ENV: "development", BETTER_AUTH_SECRET: PLACEHOLDER });

    expect(env.BETTER_AUTH_SECRET).toBe(PLACEHOLDER);
  });
});

describe("process startup", () => {
  it("exits non-zero and names the variable without printing values", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts"], {
      encoding: "utf8",
      timeout: 30_000,
      env: {
        NODE_ENV: "production",
        DATABASE_URL: VALID.DATABASE_URL,
        BETTER_AUTH_SECRET: PLACEHOLDER,
        BETTER_AUTH_URL: VALID.BETTER_AUTH_URL,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.status).not.toBeNull();
    expect(result.stderr).toContain("Invalid environment variables: BETTER_AUTH_SECRET");
    expect(result.stderr).not.toContain(PLACEHOLDER);
    expect(result.stderr).not.toContain("fake-db-password");
  }, 40_000); // The whole module graph, now including Better Auth, loads before env.ts runs.
});
