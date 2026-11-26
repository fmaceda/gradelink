import { Router } from "express";
import { requireTeacher } from "../middleware/require-teacher.ts";
import { createTeacherRouter } from "./teacher/index.ts";

type ApiRouterOptions = {
  // Tests pass a router of probe routes to exercise requireTeacher; the app passes its real one.
  teacherRouter?: Router;
};

// Everything under /api except Better Auth, each router on a static mount path (BP-046). The
// public router joins here with TASK-018.
export function createApiRouter({ teacherRouter = createTeacherRouter() }: ApiRouterOptions = {}) {
  const router = Router();
  // ARCHITECTURE.md rule 11: every /api/teacher/* request needs a session, including unknown
  // paths, so a signed-out client can't tell which teacher routes exist.
  router.use("/teacher", requireTeacher, teacherRouter);
  return router;
}
