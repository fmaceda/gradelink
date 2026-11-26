import { createAccountBodySchema, PASSWORD_MAX, PASSWORD_MIN } from "@gradelink/shared/teacher";
import { useRef } from "react";
import {
  type ActionFunctionArgs,
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { ApiError, signUp } from "@/lib/api";
import { HOME_PATH } from "../session";
import {
  type AuthActionData,
  AuthPage,
  commonErrorMessage,
  FormError,
  fieldErrorsFrom,
  GENERIC_ERROR,
  useFocusFirstInvalid,
} from "./form";

const FORM_ERROR_ID = "create-account-error";

export const ACCOUNT_EXISTS = "An account with this email already exists.";
export const PASSWORD_BREACHED =
  "This password has appeared in a known data breach. Choose a different one.";
export const SIGN_UP_UNAVAILABLE = "We couldn't create your account right now. Please try again.";

// Better Auth's codes for a sign-up it refused. The server is the boundary: these can happen
// even when the form's own checks passed.
function signUpError(error: unknown): AuthActionData {
  if (error instanceof ApiError) {
    const code = error.authCode ?? "";
    // SECURITY.md records that this reveals an existing account (TASK-010 decision); the
    // sign-up rate limit is the mitigation.
    if (code.startsWith("USER_ALREADY_EXISTS")) {
      return { formError: ACCOUNT_EXISTS, accountExists: true };
    }
    if (code === "PASSWORD_COMPROMISED") {
      return { fieldErrors: { password: PASSWORD_BREACHED } };
    }
    if (code === "PASSWORD_TOO_SHORT") {
      return { fieldErrors: { password: `Use at least ${PASSWORD_MIN} characters.` } };
    }
    if (code === "PASSWORD_TOO_LONG") {
      return { fieldErrors: { password: `Use at most ${PASSWORD_MAX} characters.` } };
    }
    // Includes the breached-password service being down: Better Auth answers 500 and creates
    // no account.
    if (error.status >= 500) {
      return { formError: SIGN_UP_UNAVAILABLE };
    }
  }
  return { formError: commonErrorMessage(error) ?? GENERIC_ERROR };
}

export async function createAccountAction({
  request,
}: ActionFunctionArgs): Promise<AuthActionData | Response> {
  const form = await request.formData();
  const parsed = createAccountBodySchema.safeParse({
    email: form.get("email") ?? "",
    password: form.get("password") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await signUp(parsed.data);
  } catch (error) {
    return signUpError(error);
  }
  // Better Auth signs the new teacher in on sign-up.
  return redirect(HOME_PATH);
}

export function CreateAccount() {
  const actionData = useActionData<AuthActionData>();
  const navigation = useNavigation();
  const submitting =
    navigation.state === "submitting" && navigation.formAction === "/create-account";
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const fields = useRef([
    ["email", email],
    ["password", password],
  ] as const).current;
  useFocusFirstInvalid(actionData, fields);

  return (
    <AuthPage title="Create an account">
      <Form
        method="post"
        noValidate
        aria-describedby={actionData?.formError ? FORM_ERROR_ID : undefined}
        className="flex flex-col gap-5"
      >
        <FormError id={FORM_ERROR_ID}>
          {actionData?.formError}
          {actionData?.accountExists ? (
            <>
              {" "}
              <Link to="/sign-in" className="font-medium underline underline-offset-4">
                Sign in instead
              </Link>
            </>
          ) : null}
        </FormError>
        <FormField
          ref={email}
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          error={actionData?.fieldErrors?.email}
        />
        <FormField
          ref={password}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          helper={`At least ${PASSWORD_MIN} characters. A phrase of a few words works well.`}
          error={actionData?.fieldErrors?.password}
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </Form>
      <p>
        Already have an account?{" "}
        <Link to="/sign-in" className="text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthPage>
  );
}
