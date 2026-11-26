import { z } from "zod";

// Better Auth's get-session response, cut down to what the teacher UI uses. Better Auth sends
// much more (the session token and id, timestamps, the user's name and image). A plain object,
// not strict, so those fields are dropped on parse and never reach the UI.
export const teacherSessionSchema = z
  .object({
    user: z.object({ id: z.string().min(1), email: z.email() }),
  })
  .nullable();
export type TeacherSession = z.infer<typeof teacherSessionSchema>;

// Better Auth's sign-out response.
export const signOutResponseSchema = z.object({ success: z.literal(true) });
