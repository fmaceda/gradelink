import { createBrowserRouter } from "react-router";
import { NotFound } from "./routes/not-found";
import { RouteError } from "./routes/route-error";
import {
  StackProof,
  StackProofLoading,
  stackProofAction,
  stackProofLoader,
} from "./routes/stack-proof";

// Library/data mode: a plain route list, with no framework-mode config or generated types
// (BP-019). The "/" proof route is temporary; TASK-010 replaces it with the teacher app shell.
export const router = createBrowserRouter([
  {
    path: "/",
    Component: StackProof,
    loader: stackProofLoader,
    action: stackProofAction,
    HydrateFallback: StackProofLoading,
    ErrorBoundary: RouteError,
  },
  // Unknown client paths render a page instead of a blank screen.
  { path: "*", Component: NotFound },
]);
