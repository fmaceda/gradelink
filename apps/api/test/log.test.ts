import { afterEach, describe, expect, it } from "vitest";
import { writeAuthLog } from "../src/auth.ts";
import { errorCode, writeLogLine } from "../src/log.ts";
import { captureOutput } from "./support/server.ts";

const FAKE_TOKEN = "fabricated-session-token-3c81";

describe("log helpers", () => {
  let output: ReturnType<typeof captureOutput> | undefined;

  function capture() {
    output = captureOutput();
    return output;
  }

  afterEach(() => {
    output?.stop();
    output = undefined;
  });

  it("strips control characters, so one call is always one line", () => {
    const logs = capture();

    writeLogLine("first\r\nforged line\u001b[31m red\u0007");

    expect(logs.text()).toBe("firstforged line[31m red\n");
  });

  it("strips Unicode line separators and bidi overrides", () => {
    const logs = capture();

    writeLogLine("a b c‮d⁦e");

    expect(logs.text()).toBe("abcde\n");
  });

  describe("errorCode", () => {
    it("prefers the cause's code, as Drizzle wraps pg errors", () => {
      const error = new Error(`Failed query params: ${FAKE_TOKEN}`, {
        cause: Object.assign(new Error(FAKE_TOKEN), { code: "57P01" }),
      });

      expect(errorCode(error)).toBe("57P01");
    });

    it("falls back to the error's own code, then its name", () => {
      expect(errorCode(Object.assign(new Error(FAKE_TOKEN), { code: "ECONNREFUSED" }))).toBe(
        "ECONNREFUSED",
      );
      expect(errorCode(new TypeError(FAKE_TOKEN))).toBe("TypeError");
    });

    it("never returns attacker-shaped text as a code", () => {
      const error = Object.assign(new Error("x"), { code: `bad code ${FAKE_TOKEN}\n` });
      error.name = "has spaces";

      expect(errorCode(error)).toBe("UNKNOWN");
    });

    it("names a thrown non-Error without printing it", () => {
      expect(errorCode(FAKE_TOKEN)).toBe("NON_ERROR_THROWN");
    });
  });

  describe("writeAuthLog", () => {
    it("reduces an Error passed as the message to its code", () => {
      const logs = capture();

      writeAuthLog("error", Object.assign(new Error(FAKE_TOKEN), { code: "SESSION_FAILED" }));

      expect(logs.text()).toBe("[auth] error: (non-text message) (SESSION_FAILED)\n");
    });

    it("never writes the extra arguments", () => {
      const logs = capture();

      writeAuthLog("error", "Query failed", { token: FAKE_TOKEN }, new Error(FAKE_TOKEN));

      expect(logs.text()).toBe("[auth] error: Query failed (Error)\n");
    });

    it("keeps one line of the message and strips control characters from it", () => {
      const logs = capture();

      writeAuthLog("warn", "Untrusted origin: https://evil.example\u001b[2J\nsecond line");

      expect(logs.text()).toBe("[auth] warn: Untrusted origin: https://evil.example[2J\n");
    });
  });
});
