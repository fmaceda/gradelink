// Temporary TASK-004 stack proof: a loader through lib/api.ts, an action with <Form>, the
// DESIGN.md tokens, and the shadcn/ui Button, Dialog and Sheet. TASK-010 removes this route.

import { formatPoints } from "@gradelink/shared";
import {
  type ActionFunctionArgs,
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getCurrentSession } from "@/lib/api";

// In-memory data for the action proof, as the task's decisions allow. Lost on reload.
const notes: string[] = [];

export async function stackProofLoader() {
  return { session: await getCurrentSession(), notes: [...notes] };
}

export async function stackProofAction({ request }: ActionFunctionArgs) {
  const note = (await request.formData()).get("note");
  if (typeof note !== "string" || note.trim() === "") {
    return { error: "Enter a note." };
  }
  notes.push(note.trim());
  return { error: null };
}

export function StackProofLoading() {
  return (
    <p role="status" className="p-4 text-muted-foreground">
      Loading...
    </p>
  );
}

const SWATCHES = [
  { name: "Primary", className: "bg-primary text-primary-foreground" },
  { name: "Secondary", className: "bg-secondary text-secondary-foreground" },
  { name: "Surface", className: "bg-card text-card-foreground border" },
  { name: "Success", className: "bg-success-tint text-success" },
  { name: "Warning", className: "bg-warning-tint text-warning" },
  { name: "Danger", className: "bg-destructive-tint text-destructive" },
];

export function StackProof() {
  const { session, notes } = useLoaderData<typeof stackProofLoader>();
  const result = useActionData<typeof stackProofAction>();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";

  return (
    <main className="mx-auto max-w-xl space-y-8 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold">GradeLink stack proof</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Temporary page for TASK-004. It is replaced by the teacher app in TASK-010.
        </p>
      </header>

      <section aria-labelledby="loader-heading" className="space-y-2">
        <h2 id="loader-heading" className="text-xl font-semibold">
          Loader
        </h2>
        <p data-testid="session-status">
          {session ? `Signed in as ${session.user.email}` : "Not signed in"}
        </p>
      </section>

      <section aria-labelledby="action-heading" className="space-y-3">
        <h2 id="action-heading" className="text-xl font-semibold">
          Action
        </h2>
        <Form method="post" className="space-y-2">
          <label htmlFor="note" className="block text-sm font-medium">
            Note
          </label>
          <input
            id="note"
            name="note"
            className="h-11 w-full rounded-md border border-input px-3 text-base"
            aria-describedby={result?.error ? "note-error" : undefined}
          />
          {result?.error ? (
            <p id="note-error" className="text-sm text-destructive">
              {result.error}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full px-4 sm:w-auto" disabled={saving}>
            {saving ? "Saving..." : "Add note"}
          </Button>
        </Form>
        <ul aria-live="polite" data-testid="notes" className="list-disc pl-5">
          {notes.map((note, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only in-memory proof list
            <li key={index}>{note}</li>
          ))}
        </ul>
      </section>

      {/* TASK-008 early check that Vite and tsc resolve @gradelink/shared from apps/web. */}
      <section aria-labelledby="shared-heading" className="space-y-2">
        <h2 id="shared-heading" className="text-xl font-semibold">
          Shared package
        </h2>
        <p data-testid="shared-format">Two thirds of a point: {formatPoints(2 / 3)}</p>
      </section>

      <section aria-labelledby="tokens-heading" className="space-y-3">
        <h2 id="tokens-heading" className="text-xl font-semibold">
          Theme tokens
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SWATCHES.map((swatch) => (
            <li
              key={swatch.name}
              className={`rounded-lg p-3 text-sm font-medium ${swatch.className}`}
            >
              {swatch.name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="components-heading" className="space-y-3">
        <h2 id="components-heading" className="text-xl font-semibold">
          Components
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 px-4">Primary</Button>
          <Button variant="secondary" className="h-11 px-4">
            Secondary
          </Button>
          <Button variant="outline" className="h-11 px-4">
            Outline
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-11 px-4">
                Open dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Close test?</DialogTitle>
                <DialogDescription>
                  A proof dialog. Escape, the close button, or Cancel closes it.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" className="h-11 px-4">
                    Cancel
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 px-4">
                Open menu
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription>A proof sheet. Escape closes it.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
      </section>
    </main>
  );
}
