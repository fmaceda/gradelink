import { LoaderCircle } from "lucide-react";

// HydrateFallback for routes with a loader (BP-019): shown while the first load runs, and
// announced to screen readers.
export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 p-4 sm:p-6">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
      <span>Loading...</span>
    </div>
  );
}
