import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/api";
import { createRoutes } from "../../router";
import { ACCOUNT_EXISTS, PASSWORD_BREACHED, SIGN_UP_UNAVAILABLE } from "./create-account";
import { INCORRECT_CREDENTIALS, NETWORK_ERROR, RATE_LIMITED } from "./form";

// The forms' actions import these by name, so the module is replaced (see router.test.tsx).
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSession: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

const PASSPHRASE = "fabricated pass phrase";
const SIGNED_IN = { user: { id: "user-1", email: "teacher@example.com" } };

function renderAt(path: string) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

async function fill(label: RegExp, value: string) {
  const user = userEvent.setup();
  const input = await screen.findByLabelText(label);
  await user.clear(input);
  if (value !== "") await user.type(input, value);
}

async function submit(name: string) {
  await userEvent.setup().click(screen.getByRole("button", { name }));
}

// Once signed in, the Questions loader sees a session.
function signInSucceeds(mock: typeof api.signIn | typeof api.signUp) {
  vi.mocked(mock).mockImplementation(async () => {
    vi.mocked(api.getSession).mockResolvedValue(SIGNED_IN);
  });
}

beforeEach(() => {
  vi.mocked(api.getSession).mockReset().mockResolvedValue(null);
  vi.mocked(api.signIn).mockReset();
  vi.mocked(api.signUp).mockReset();
});

// The form-level error region is always there for screen readers, but empty until an error.
async function expectNoFormError(regionId: string) {
  await screen.findByLabelText(/Email/);
  const region = document.getElementById(regionId);
  expect(region).not.toBeNull();
  expect(region?.childElementCount).toBe(0);
  expect(region?.textContent).toBe("");
}

describe("sign-in form", () => {
  it("shows no error box before a submit", async () => {
    renderAt("/sign-in");

    await expectNoFormError("sign-in-error");
  });

  it("has labelled email and password fields marked Required, and no app navigation", async () => {
    renderAt("/sign-in");

    const email = await screen.findByLabelText(/Email/);
    expect(email.getAttribute("type")).toBe("email");
    expect(screen.getByLabelText(/Password/).getAttribute("type")).toBe("password");
    expect(screen.getAllByText("Required")).toHaveLength(2);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows field errors and focuses the first invalid field, without calling the API", async () => {
    renderAt("/sign-in");
    await screen.findByLabelText(/Email/);

    await submit("Sign in");

    const email = screen.getByLabelText(/Email/);
    expect(await screen.findByText("Enter an email address, like name@school.org.")).toBeDefined();
    expect(screen.getByText("Enter your password.")).toBeDefined();
    expect(document.activeElement).toBe(email);
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")).toBe("field-email-error");
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it("focuses the password when only the password is missing", async () => {
    renderAt("/sign-in");
    await fill(/Email/, "teacher@example.com");

    await submit("Sign in");

    await screen.findByText("Enter your password.");
    expect(document.activeElement).toBe(screen.getByLabelText(/Password/));
  });

  it("shows the one generic message for a rejected sign-in, announced and linked", async () => {
    vi.mocked(api.signIn).mockRejectedValue(
      new api.ApiError(401, undefined, "INVALID_EMAIL_OR_PASSWORD"),
    );
    renderAt("/sign-in");
    await fill(/Email/, "teacher@example.com");
    await fill(/Password/, PASSPHRASE);

    await submit("Sign in");

    const message = await screen.findByText(INCORRECT_CREDENTIALS);
    const region = message.closest("[aria-live]");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("id")).toBe(
      document.querySelector("form")?.getAttribute("aria-describedby"),
    );
  });

  it("shows a network error and leaves the loading state", async () => {
    vi.mocked(api.signIn).mockRejectedValue(new TypeError("Failed to fetch"));
    renderAt("/sign-in");
    await fill(/Email/, "teacher@example.com");
    await fill(/Password/, PASSPHRASE);

    await submit("Sign in");

    expect(await screen.findByText(NETWORK_ERROR)).toBeDefined();
    const button = screen.getByRole("button", { name: "Sign in" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a rate-limit message on 429", async () => {
    vi.mocked(api.signIn).mockRejectedValue(new api.ApiError(429));
    renderAt("/sign-in");
    await fill(/Email/, "teacher@example.com");
    await fill(/Password/, PASSPHRASE);

    await submit("Sign in");

    expect(await screen.findByText(RATE_LIMITED)).toBeDefined();
  });

  it("disables the button and shows Signing in... while the request runs", async () => {
    let finish: () => void = () => {};
    vi.mocked(api.signIn).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderAt("/sign-in");
    await fill(/Email/, "teacher@example.com");
    await fill(/Password/, PASSPHRASE);

    await submit("Sign in");

    const pending = await screen.findByRole("button", { name: "Signing in..." });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(api.getSession).mockResolvedValue(SIGNED_IN);
    finish();
    expect(await screen.findByRole("heading", { level: 1, name: "Question bank" })).toBeDefined();
  });

  it("signs in with the trimmed email and lands on Questions", async () => {
    signInSucceeds(api.signIn);
    const router = renderAt("/sign-in");
    await fill(/Email/, "  teacher@example.com ");
    await fill(/Password/, PASSPHRASE);

    await submit("Sign in");

    expect(await screen.findByRole("heading", { level: 1, name: "Question bank" })).toBeDefined();
    expect(router.state.location.pathname).toBe("/questions");
    expect(api.signIn).toHaveBeenCalledWith({ email: "teacher@example.com", password: PASSPHRASE });
  });
});

describe("create-account form", () => {
  async function fillValid() {
    await fill(/Email/, "ana@school.org");
    await fill(/Password/, PASSPHRASE);
  }

  it("shows no error box before a submit", async () => {
    renderAt("/create-account");

    await expectNoFormError("create-account-error");
  });

  it("shows the password helper and has no name field", async () => {
    renderAt("/create-account");

    expect(await screen.findByText(/At least 15 characters/)).toBeDefined();
    expect(screen.queryByLabelText(/name/i)).toBeNull();
    expect(screen.getByLabelText(/Password/).getAttribute("aria-describedby")).toBe(
      "field-password-helper",
    );
  });

  it("rejects a malformed email and a 14-character password, focusing the email", async () => {
    renderAt("/create-account");
    await fill(/Email/, "not-an-email");
    await fill(/Password/, "a".repeat(14));

    await submit("Create account");

    expect(await screen.findByText("Enter an email address, like name@school.org.")).toBeDefined();
    expect(screen.getByText("Use at least 15 characters.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(/Email/));
    expect(screen.getByLabelText(/Password/).getAttribute("aria-describedby")).toBe(
      "field-password-error field-password-helper",
    );
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it("accepts a 15-character password", async () => {
    signInSucceeds(api.signUp);
    renderAt("/create-account");
    await fill(/Email/, "ana@school.org");
    await fill(/Password/, "a".repeat(15));

    await submit("Create account");

    expect(await screen.findByRole("heading", { level: 1, name: "Question bank" })).toBeDefined();
  });

  it("creates the account and lands on Questions", async () => {
    signInSucceeds(api.signUp);
    const router = renderAt("/create-account");
    await fillValid();

    await submit("Create account");

    expect(await screen.findByRole("heading", { level: 1, name: "Question bank" })).toBeDefined();
    expect(router.state.location.pathname).toBe("/questions");
    expect(api.signUp).toHaveBeenCalledWith({ email: "ana@school.org", password: PASSPHRASE });
  });

  it("shows a visible error with a sign-in link for an email that's already registered", async () => {
    vi.mocked(api.signUp).mockRejectedValue(
      new api.ApiError(422, undefined, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"),
    );
    renderAt("/create-account");
    await fillValid();

    await submit("Create account");

    expect(await screen.findByText(ACCOUNT_EXISTS)).toBeDefined();
    expect(screen.getByRole("link", { name: "Sign in instead" }).getAttribute("href")).toBe(
      "/sign-in",
    );
  });

  it("puts a breached-password refusal on the password field and focuses it", async () => {
    vi.mocked(api.signUp).mockRejectedValue(
      new api.ApiError(400, undefined, "PASSWORD_COMPROMISED"),
    );
    renderAt("/create-account");
    await fillValid();

    await submit("Create account");

    expect(await screen.findByText(PASSWORD_BREACHED)).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(/Password/));
  });

  it("shows a plain message when the breach-check service is down (a 500)", async () => {
    vi.mocked(api.signUp).mockRejectedValue(new api.ApiError(500));
    renderAt("/create-account");
    await fillValid();

    await submit("Create account");

    expect(await screen.findByText(SIGN_UP_UNAVAILABLE)).toBeDefined();
  });

  it("shows a rate-limit message on 429", async () => {
    vi.mocked(api.signUp).mockRejectedValue(new api.ApiError(429));
    renderAt("/create-account");
    await fillValid();

    await submit("Create account");

    expect(await screen.findByText(RATE_LIMITED)).toBeDefined();
  });
});
