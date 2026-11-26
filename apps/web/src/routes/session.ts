// Loaders and the sign-out action that decide where a teacher may be. They stay in the main
// bundle so a redirect never waits for a lazy teacher chunk, and they call only lib/api.ts
// (BP-019, BP-020).
import { redirect } from "react-router";
import { getSession, SIGN_IN_PATH, signOut } from "@/lib/api";

// Where a signed-in teacher lands (TASK-010 decision).
export const HOME_PATH = "/questions";

export const SIGN_OUT_ERROR = "We couldn't sign you out. Please try again.";

// Every teacher route sits under this one. A signed-out visit goes to sign-in.
export async function requireTeacherLoader() {
  const session = await getSession();
  if (session === null) {
    throw redirect(SIGN_IN_PATH);
  }
  return { email: session.user.email };
}

// Sign-in and create-account: a signed-in teacher has nothing to do there.
export async function signedOutOnlyLoader() {
  const session = await getSession();
  if (session !== null) {
    throw redirect(HOME_PATH);
  }
  return null;
}

// If sign-out fails the server session may still exist, so the teacher stays where they are and
// sees an error rather than a sign-in page that would suggest they were signed out (TASK-010
// decision).
export async function signOutAction() {
  try {
    await signOut();
  } catch {
    return { error: SIGN_OUT_ERROR };
  }
  return redirect(SIGN_IN_PATH);
}
