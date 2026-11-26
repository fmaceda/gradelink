import type { ErrorBody } from "@gradelink/shared";
import { rateLimit } from "express-rate-limit";

const RATE_LIMITED: ErrorBody = {
  error: { code: "RATE_LIMITED", message: "Too many requests. Wait a moment and try again." },
};

// Express matches paths case-insensitively, so /API/Auth reaches Better Auth too.
const AUTH_PATH = /^\/api\/auth(?:[/?]|$)/i;

type RateLimitOptions = {
  windowMs: number;
  limit: number;
};

// Per-IP limiter with the shared 429 body. Unmounted until TASK-022 sets the real limits.
// /api/auth/* is never counted: Better Auth already limits it with its own thresholds.
// Counts are in memory, which is fine for one Railway instance (SECURITY.md).
export function createRateLimit({ windowMs, limit }: RateLimitOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => AUTH_PATH.test(req.originalUrl),
    handler: (_req, res, _next, options) => {
      res.status(options.statusCode).json(RATE_LIMITED);
    },
  });
}
