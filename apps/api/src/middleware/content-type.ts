import type { Request, RequestHandler } from "express";
import { AppError } from "../errors.ts";

// Same test as body-parser: a body exists when it's chunked or has a non-zero length.
function hasBody(req: Request) {
  const length = req.headers["content-length"];
  return req.headers["transfer-encoding"] !== undefined || (length !== undefined && length !== "0");
}

// SECURITY.md: body-carrying routes accept only application/json. A bodyless POST (sign-out,
// close test) carries no type and passes. Mounted after Better Auth, which checks its own.
export const requireJsonBody: RequestHandler = (req, _res, next) => {
  if (hasBody(req) && !req.is("application/json")) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON.");
  }
  next();
};
