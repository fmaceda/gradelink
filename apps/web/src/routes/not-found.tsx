import { Link } from "react-router";

export function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This page doesn't exist.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline underline-offset-4">
        Go to the home page
      </Link>
    </main>
  );
}
