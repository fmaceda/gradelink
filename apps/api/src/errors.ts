import type { ErrorCode, ErrorFields } from "@gradelink/shared";

// Thrown by services and handlers; the error handler turns it into `{ error: { code, message } }`.
// No Express import, so services can throw it without depending on the web layer.
// `message` reaches the client as-is: never put submitted values, SQL or snapshot content in it.
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields: ErrorFields | undefined;

  constructor(status: number, code: ErrorCode, message: string, fields?: ErrorFields) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// The one 404. An unknown path, a missing id and another teacher's id all answer with this, so
// a response never reveals that a resource exists (BP-031, BP-045).
export function notFoundError() {
  return new AppError(404, "NOT_FOUND", "Not found.");
}
