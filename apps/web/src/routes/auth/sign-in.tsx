import { signInBodySchema } from "@gradelink/shared/teacher";
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
import { ApiError, signIn } from "@/lib/api";
import { HOME_PATH } from "../session";
import {
  type AuthActionData,
  AuthPage,
  commonErrorMessage,
  FormError,
  fieldErrorsFrom,
  GENERIC_ERROR,
  INCORRECT_CREDENTIALS,
  useFocusFirstInvalid,
} from "./form";

const FORM_ERROR_ID = "sign-in-error";

export async function signInAction({
  request,
}: ActionFunctionArgs): Promise<AuthActionData | Response> {
  const form = await request.formData();
  const parsed = signInBodySchema.safeParse({
    email: form.get("email") ?? "",
    password: form.get("password") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await signIn(parsed.data);
  } catch (error) {
    // A wrong password and an unknown email get the same 401 from Better Auth, and the same
    // message here, which never says which one was wrong (SECURITY.md Authentication).
    if (error instanceof ApiError && error.status === 401) {
      return { formError: INCORRECT_CREDENTIALS };
    }
    return { formError: commonErrorMessage(error) ?? GENERIC_ERROR };
  }
  return redirect(HOME_PATH);
}

export function SignIn() {
  const actionData = useActionData<AuthActionData>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting" && navigation.formAction === "/sign-in";
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const fields = useRef([
    ["email", email],
    ["password", password],
  ] as const).current;
  useFocusFirstInvalid(actionData, fields);

  return (
    <AuthPage title="Sign in">
      <Form
        method="post"
        noValidate
        aria-describedby={actionData?.formError ? FORM_ERROR_ID : undefined}
        className="flex flex-col gap-5"
      >
        <FormError id={FORM_ERROR_ID}>{actionData?.formError}</FormError>
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
          autoComplete="current-password"
          required
          error={actionData?.fieldErrors?.password}
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </Form>
      <p>
        New to GradeLink?{" "}
        <Link to="/create-account" className="text-primary underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthPage>
  );
}
