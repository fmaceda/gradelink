import { Link } from "react-router";

// Temporary placeholder (BP-047): TASK-010 part B replaces the body with the sign-in form.
// The route, its signed-out-only loader and the layout without app navigation are final.
export function SignIn() {
  return (
    <main className="mx-auto max-w-md p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">The sign-in form is on its way.</p>
      <Link
        to="/create-account"
        className="mt-4 inline-block text-primary underline underline-offset-4"
      >
        Create an account
      </Link>
    </main>
  );
}
