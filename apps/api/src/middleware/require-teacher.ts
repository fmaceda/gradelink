import { isAPIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler, Response } from "express";
import { auth } from "../auth.ts";
import { AppError } from "../errors.ts";

declare global {
  namespace Express {
    interface Locals {
      // Set only by requireTeacher, from the session (BP-012). Read it with currentTeacherId.
      teacherId?: string;
    }
  }
}

function unauthenticated() {
  return new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
}

// The only way a teacher is identified (BP-012). The id comes from Better Auth's session lookup,
// never from a header, body, param or query. Unverified emails pass: verification is out of the
// MVP (TASK-009 decision). Nothing from the request is logged here (BP-043): a rejection is a
// plain 401, and a lookup failure reaches the error handler, which logs its code only.
export const requireTeacher: RequestHandler = async (req, res, next) => {
  let result: Awaited<ReturnType<typeof getSessionWithHeaders>>;
  try {
    result = await getSessionWithHeaders(req.headers);
  } catch (error) {
    // Better Auth throws a 401 when the session row vanishes mid-refresh (a concurrent sign-out).
    // Left alone, the error handler would turn its 4xx into a 400.
    if (isAPIError(error) && error.statusCode === 401) {
      throw unauthenticated();
    }
    throw error;
  }

  // Better Auth refreshes the cookie when it extends a session (updateAge), and clears it when the
  // session is gone or expired. Without forwarding, the browser's cookie would still expire 24
  // hours after sign-in however active the teacher is.
  for (const cookie of result.headers.getSetCookie()) {
    res.append("Set-Cookie", cookie);
  }

  if (result.response === null) {
    throw unauthenticated();
  }
  res.locals.teacherId = result.response.user.id;
  next();
};

function getSessionWithHeaders(headers: Parameters<typeof fromNodeHeaders>[0]) {
  return auth.api.getSession({ headers: fromNodeHeaders(headers), returnHeaders: true });
}

// For handlers under /api/teacher. A missing id means the route isn't behind requireTeacher,
// which is a server bug, so it's a 500 rather than a 401.
export function currentTeacherId(res: Response): string {
  const { teacherId } = res.locals;
  if (teacherId === undefined) {
    throw new Error("currentTeacherId called outside requireTeacher");
  }
  return teacherId;
}
