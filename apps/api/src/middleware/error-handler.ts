import type { ErrorBody } from "@gradelink/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors.ts";
import { errorCode, writeLogLine } from "../log.ts";

const INTERNAL_ERROR: ErrorBody = {
  error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
};

// express.json() errors carry a `type` and a 4xx status. Their messages quote the parser, and
// sometimes the body itself, so only fixed text is returned.
function fromBodyParser(error: unknown): AppError | undefined {
  if (!(error instanceof Error) || !("type" in error) || typeof error.type !== "string") {
    return undefined;
  }
  switch (error.type) {
    case "entity.too.large":
      return new AppError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
    case "entity.parse.failed":
      return new AppError(400, "VALIDATION_ERROR", "The request body isn't valid JSON.");
    case "encoding.unsupported":
    case "charset.unsupported":
      return new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as UTF-8 JSON.");
    default:
      return undefined;
  }
}

function clientStatus(error: Error): number | undefined {
  for (const key of ["status", "statusCode"]) {
    if (key in error) {
      const value: unknown = Reflect.get(error, key);
      if (typeof value === "number" && Number.isInteger(value) && value >= 400 && value < 500) {
        return value;
      }
    }
  }
  return undefined;
}

// Any other error that Express or a parser marks as the client's fault (a 4xx status), such as
// Express 5's 400 for a path it can't percent-decode, or an aborted upload. It's a fixed-text
// 400, not a logged 500, and its message is never used: it can quote the request.
function fromClientError(error: unknown): AppError | undefined {
  if (!(error instanceof Error) || clientStatus(error) === undefined) {
    return undefined;
  }
  return new AppError(400, "VALIDATION_ERROR", "The request isn't valid.");
}

function bodyOf(error: AppError): ErrorBody {
  const { code, message, fields } = error;
  return { error: fields === undefined ? { code, message } : { code, message, fields } };
}

// The JSON 404 for anything nothing else answered: unknown /api paths and, past the SPA,
// non-GET requests and paths when there's no build (ARCHITECTURE.md rule 7).
export const notFound: RequestHandler = () => {
  throw new AppError(404, "NOT_FOUND", "Not found.");
};

// Registered last (BP-009). Returns `{ error: { code, message } }` and never a stack, SQL or
// snapshot content (BP-045). Unexpected errors are logged by code only, never by message,
// since a Drizzle error's message holds the query params (BP-043).
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const known =
    error instanceof AppError ? error : (fromBodyParser(error) ?? fromClientError(error));
  if (known === undefined) {
    writeLogLine(`[error] ${res.locals.requestId} unhandled (${errorCode(error)})`);
  }

  // Too late for a status: end what was sent. Calling next(error) would hand the error to
  // Express's final handler, which prints it whole.
  if (res.headersSent) {
    res.end();
    return;
  }

  if (known === undefined) {
    res.status(500).json(INTERNAL_ERROR);
    return;
  }
  res.status(known.status).json(bodyOf(known));
};
