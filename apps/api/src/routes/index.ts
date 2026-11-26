import { Router } from "express";

// Everything under /api except Better Auth. Teacher and public routers join this from TASK-008
// on, each on a static mount path (BP-046).
export function createApiRouter() {
  return Router();
}
