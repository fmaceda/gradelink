import { CircleAlert } from "lucide-react";
import { type ReactNode, type RefObject, useEffect } from "react";
import type { z } from "zod";
import { ApiError } from "@/lib/api";

export type AuthField = "email" | "password";

// What a sign-in or create-account action returns when it doesn't redirect. Passwords are never
// sent back; the browser keeps what was typed, since the form isn't remounted.
export type AuthActionData = {
  fieldErrors?: Partial<Record<AuthField, string>>;
  formError?: string;
  // Create account only: offer "Sign in instead" next to the error.
  accountExists?: boolean;
};

export const INCORRECT_CREDENTIALS = "Email or password is incorrect.";
export const NETWORK_ERROR = "We couldn't reach GradeLink. Check your connection and try again.";
export const RATE_LIMITED = "Too many attempts. Wait a minute, then try again.";
export const GENERIC_ERROR = "Something went wrong. Please try again.";

// The first message for each field, from a shared-schema parse (DESIGN.md: Zod messages from
// packages/shared shown as plain sentences).
export function fieldErrorsFrom(error: z.ZodError): Partial<Record<AuthField, string>> {
  const fieldErrors: Partial<Record<AuthField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "password") && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

// Messages both forms share. fetch rejects with a TypeError when the network fails; anything
// else unexpected (such as a response that fails its schema) gets the generic message.
export function commonErrorMessage(error: unknown): string | undefined {
  if (error instanceof TypeError) {
    return NETWORK_ERROR;
  }
  if (error instanceof ApiError && error.status === 429) {
    return RATE_LIMITED;
  }
  return undefined;
}

// Moves focus to the first invalid field each time a submit comes back with field errors
// (DESIGN.md Forms & Inputs). Fields are listed in form order.
export function useFocusFirstInvalid(
  actionData: AuthActionData | undefined,
  fields: readonly (readonly [AuthField, RefObject<HTMLInputElement | null>])[],
) {
  useEffect(() => {
    const fieldErrors = actionData?.fieldErrors;
    if (fieldErrors === undefined) {
      return;
    }
    const firstInvalid = fields.find(([name]) => fieldErrors[name] !== undefined);
    firstInvalid?.[1].current?.focus();
  }, [actionData, fields]);
}

// The form-level error. The live region is always rendered so the message is announced when it
// appears; the form points at it with aria-describedby. The box shows only when there's a message:
// children (such as a "Sign in instead" link) are extra content after it, and deciding on them
// would show an empty box, since several children arrive as an always-truthy array.
export function FormError({
  id,
  message,
  children,
}: {
  id: string;
  message: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div id={id} aria-live="polite">
      {message ? (
        <div className="flex items-start gap-2 rounded-md bg-destructive-tint p-3 text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            {message}
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Sign-in and create-account have no app navigation (DESIGN.md Navigation).
export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4 sm:p-6">
      <div>
        <p className="text-lg font-semibold">GradeLink</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      </div>
      {children}
    </main>
  );
}
