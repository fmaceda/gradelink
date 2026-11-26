import { CircleAlert } from "lucide-react";
import { useRevalidator } from "react-router";
import { Button } from "@/components/ui/button";

// Shown when a loader or action throws. It never prints the error itself, which could hold
// server detail; the message is fixed text (DESIGN.md: error state with "Try again").
export function RouteError() {
  const revalidator = useRevalidator();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <div role="alert" className="flex items-start gap-2 text-destructive">
        <CircleAlert aria-hidden="true" className="mt-1 size-5 shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2">We couldn't load this page. Please try again.</p>
        </div>
      </div>
      <Button className="mt-4 h-11 px-4" onClick={() => revalidator.revalidate()}>
        Try again
      </Button>
    </main>
  );
}
