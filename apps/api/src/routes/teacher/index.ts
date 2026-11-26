import { Router } from "express";

// Every route under /api/teacher. requireTeacher runs before this router (routes/index.ts), so
// handlers read the teacher with currentTeacherId and pass it to a service (BP-031). Routers join
// on static paths (BP-046), and each new route adds its cases to test/teacher-isolation.test.ts.
export function createTeacherRouter() {
  return Router();
}
