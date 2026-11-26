// The app's only log destination (TASK-005 decision): one line per call on stderr.

// Codes from pg, Node and our own errors look like this; anything else could be attacker text.
const SAFE_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

// Control characters (newlines, ANSI escapes), Unicode line and paragraph separators, and format
// characters such as bidi overrides would let request-derived text forge or disguise log lines.
const UNSAFE_LOG_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

export function writeLogLine(line: string) {
  process.stderr.write(`${line.replace(UNSAFE_LOG_CHARACTERS, "")}\n`);
}

// Never an error's message: a Drizzle error's message holds the query params, which can be
// session tokens and password hashes (BP-043, SECURITY.md Secrets Management).
export function errorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return "NON_ERROR_THROWN";
  }
  const candidates = [readCode(error.cause), readCode(error), error.name];
  return candidates.find((code) => code !== undefined && SAFE_CODE.test(code)) ?? "UNKNOWN";
}

function readCode(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null && "code" in value) {
    const { code } = value;
    if (typeof code === "string" || typeof code === "number") {
      return String(code);
    }
  }
  return undefined;
}
