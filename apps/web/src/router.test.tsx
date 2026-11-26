import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/api";

// session.ts imports these by name, so the module itself is replaced (spyOn on the namespace
// would not reach that binding). Everything else, such as SIGN_IN_PATH, stays real.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

import { createRoutes } from "./router";
import { SIGN_OUT_ERROR } from "./routes/session";

const SIGNED_IN = { user: { id: "user-1", email: "teacher@example.com" } };

function renderAt(path: string) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function h1(name: string | RegExp) {
  return screen.findByRole("heading", { level: 1, name });
}

describe("teacher routes", () => {
  beforeEach(() => {
    vi.mocked(api.getSession).mockReset().mockResolvedValue(SIGNED_IN);
    vi.mocked(api.signOut).mockReset();
  });

  describe("redirects", () => {
    it("sends a signed-out visitor from a teacher page to sign-in", async () => {
      vi.mocked(api.getSession).mockResolvedValue(null);
      const router = renderAt("/questions");

      expect(await h1("Sign in")).toBeDefined();
      expect(router.state.location.pathname).toBe("/sign-in");
    });

    it("sends a signed-out visitor from / to sign-in", async () => {
      vi.mocked(api.getSession).mockResolvedValue(null);
      renderAt("/");

      expect(await h1("Sign in")).toBeDefined();
    });

    it("lands a signed-in teacher on Questions from /", async () => {
      const router = renderAt("/");

      expect(await h1("Question bank")).toBeDefined();
      expect(router.state.location.pathname).toBe("/questions");
    });

    it.each(["/sign-in", "/create-account"])(
      "sends a signed-in teacher away from %s to Questions",
      async (path) => {
        const router = renderAt(path);

        expect(await h1("Question bank")).toBeDefined();
        expect(router.state.location.pathname).toBe("/questions");
      },
    );

    it("shows the sign-in and create-account pages without app navigation", async () => {
      vi.mocked(api.getSession).mockResolvedValue(null);
      renderAt("/create-account");

      expect(await h1("Create an account")).toBeDefined();
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByRole("link", { name: "Questions" })).toBeNull();
    });

    it("sends a direct GET of /sign-out home instead of a blank page", async () => {
      const router = renderAt("/sign-out");

      expect(await h1("Question bank")).toBeDefined();
      expect(router.state.location.pathname).toBe("/questions");
    });
  });

  describe("shell", () => {
    it("shows the product name, both links and one H1", async () => {
      renderAt("/questions");

      await h1("Question bank");
      expect(screen.getByRole("link", { name: "GradeLink" })).toBeDefined();
      expect(screen.getByRole("link", { name: "Questions" })).toBeDefined();
      expect(screen.getByRole("link", { name: "Tests" })).toBeDefined();
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });

    it("marks the current page with aria-current and a non-colour indicator", async () => {
      renderAt("/tests");

      await h1("Tests");
      const current = screen.getByRole("link", { name: "Tests" });
      const other = screen.getByRole("link", { name: "Questions" });
      expect(current.getAttribute("aria-current")).toBe("page");
      expect(other.getAttribute("aria-current")).toBeNull();
      expect(current.className).toContain("font-semibold");
      expect(current.className).toContain("border-primary");
    });

    it("opens the phone menu, navigates, and closes it", async () => {
      const user = userEvent.setup();
      const router = renderAt("/questions");
      await h1("Question bank");

      await user.click(screen.getByRole("button", { name: "Open menu" }));
      const menu = await screen.findByRole("dialog");
      await user.click(within(menu).getByRole("link", { name: "Tests" }));

      expect(await h1("Tests")).toBeDefined();
      expect(router.state.location.pathname).toBe("/tests");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows the teacher's email in the user menu", async () => {
      const user = userEvent.setup();
      renderAt("/questions");
      await h1("Question bank");

      await user.click(screen.getByRole("button", { name: /Account menu/ }));

      const menu = await screen.findByRole("menu");
      expect(within(menu).getByText("teacher@example.com")).toBeDefined();
      expect(within(menu).getByRole("menuitem", { name: "Sign out" })).toBeDefined();
    });
  });

  describe("sign out", () => {
    async function signOutFromMenu() {
      const user = userEvent.setup();
      const router = renderAt("/questions");
      await h1("Question bank");
      await user.click(screen.getByRole("button", { name: /Account menu/ }));
      await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
      return router;
    }

    it("signs out and lands on sign-in", async () => {
      const signOut = vi.mocked(api.signOut);
      // Once signed out, the sign-in page's loader sees no session.
      signOut.mockImplementation(async () => {
        vi.mocked(api.getSession).mockResolvedValue(null);
      });

      const router = await signOutFromMenu();

      expect(await h1("Sign in")).toBeDefined();
      expect(signOut).toHaveBeenCalledOnce();
      expect(router.state.location.pathname).toBe("/sign-in");
    });

    it("stays on the page with an announced error when sign-out fails", async () => {
      vi.mocked(api.signOut).mockRejectedValue(new TypeError("Failed to fetch"));

      const router = await signOutFromMenu();

      const message = await screen.findByText(SIGN_OUT_ERROR);
      expect(message.closest("[aria-live]")).not.toBeNull();
      expect(router.state.location.pathname).toBe("/questions");
      expect(screen.getByRole("heading", { level: 1, name: "Question bank" })).toBeDefined();
    });
  });

  describe("errors", () => {
    it("shows the not-found page for an unknown path", async () => {
      renderAt("/no-such-page");

      expect(await h1("Page not found")).toBeDefined();
    });

    it("shows the generic error screen, never the raw message, when a loader fails", async () => {
      vi.mocked(api.getSession).mockRejectedValue(new Error("secret server detail"));
      renderAt("/questions");

      expect(await h1("Something went wrong")).toBeDefined();
      expect(screen.queryByText(/secret server detail/)).toBeNull();
      expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    });
  });
});
