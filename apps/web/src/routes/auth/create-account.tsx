import { Link } from "react-router";

// Temporary placeholder (BP-047): TASK-010 part B replaces the body with the create-account
// form. The route, its signed-out-only loader and the layout without app navigation are final.
export function CreateAccount() {
  return (
    <main className="mx-auto max-w-md p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <p className="mt-2 text-muted-foreground">The create-account form is on its way.</p>
      <Link to="/sign-in" className="mt-4 inline-block text-primary underline underline-offset-4">
        Sign in instead
      </Link>
    </main>
  );
}
