import { z } from "zod";

// The one list of API error codes (TASK-005 decision). Clients branch on these, never on messages.
export const errorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "TEST_CLOSED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// Field path -> a fixed message. Messages never repeat what was submitted.
export const errorFieldsSchema = z.record(z.string(), z.string());
export type ErrorFields = z.infer<typeof errorFieldsSchema>;

// Every API error body except Better Auth's own under /api/auth (ARCHITECTURE.md rule 7).
export const errorBodySchema = z.strictObject({
  error: z.strictObject({
    code: errorCodeSchema,
    message: z.string(),
    fields: errorFieldsSchema.optional(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;
