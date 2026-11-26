import { createBrowserRouter, type RouteObject, redirect } from "react-router";
import { NotFound } from "./routes/not-found";
import { PageLoading } from "./routes/page-loading";
import { RouteError } from "./routes/route-error";
import {
  HOME_PATH,
  requireTeacherLoader,
  signedOutOnlyLoader,
  signOutAction,
} from "./routes/session";

// Lazy screens. Each resolves to the module's component; React Router loads it on first use.
const loadSignIn = async () => (await import("./routes/auth/sign-in")).SignIn;
const loadCreateAccount = async () => (await import("./routes/auth/create-account")).CreateAccount;
const loadTeacherLayout = async () => (await import("./routes/teacher/layout")).TeacherLayout;
const loadQuestions = async () => (await import("./routes/teacher/questions")).QuestionsPage;
const loadTests = async () => (await import("./routes/teacher/tests")).TestsPage;

// Library/data mode: a plain route list, with no framework-mode config or generated types
// (BP-019). Loaders stay in this bundle so redirects are immediate; every teacher and sign-in
// screen is lazy, so the student route (TASK-021) never downloads them (BP-024).
//
// A factory, because React Router deletes each `lazy` entry from the route object once it has
// loaded, so a route list can back only one router. Tests build a fresh one per router.
export function createRoutes(): RouteObject[] {
  return [
    {
      // Pathless root: one error screen for every route, which never shows the raw error.
      ErrorBoundary: RouteError,
      children: [
        {
          path: "sign-in",
          loader: signedOutOnlyLoader,
          HydrateFallback: PageLoading,
          lazy: { Component: loadSignIn },
        },
        {
          path: "create-account",
          loader: signedOutOnlyLoader,
          HydrateFallback: PageLoading,
          lazy: { Component: loadCreateAccount },
        },
        // Action only; a GET (typed URL, reload) goes home instead of rendering nothing.
        { path: "sign-out", action: signOutAction, loader: () => redirect("/") },
        {
          path: "/",
          loader: requireTeacherLoader,
          HydrateFallback: PageLoading,
          lazy: { Component: loadTeacherLayout },
          children: [
            { index: true, loader: () => redirect(HOME_PATH) },
            {
              path: "questions",
              lazy: { Component: loadQuestions },
            },
            {
              path: "tests",
              lazy: { Component: loadTests },
            },
          ],
        },
        // Unknown client paths render a page instead of a blank screen.
        { path: "*", Component: NotFound },
      ],
    },
  ];
}

export const router = createBrowserRouter(createRoutes());
