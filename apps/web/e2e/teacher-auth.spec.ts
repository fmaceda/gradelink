import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

// Fabricated accounts on a reserved domain. They stay in the local database; CI (TASK-021)
// runs against a fresh one.
const PASSWORD = "fabricated e2e pass phrase";

function uniqueEmail() {
  return `${randomUUID()}@e2e.gradelink.example`;
}

async function createAccount(page: Page, email = uniqueEmail()) {
  await page.goto("/create-account");
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Question bank" })).toBeVisible();
  return email;
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
}

// No horizontal page scroll, and every visible button, input and menu link at least 44 x 44 px
// (DESIGN.md Responsiveness). Links inside a sentence are exempt, as WCAG 2.5.8 allows.
async function expectPhoneLayout(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal page scroll at 360 px").toBeLessThanOrEqual(0);

  const targets = page.locator("button:visible, input:visible, nav a:visible, header a:visible");
  for (const target of await targets.all()) {
    const box = await target.boundingBox();
    // Layout can land a fraction under a whole pixel (43.99998 for h-11), so compare whole pixels.
    const height = Math.round(box?.height ?? 0);
    const width = Math.round(box?.width ?? 0);
    const label = (await target.getAttribute("aria-label")) ?? (await target.textContent());
    expect(height, `${label} is at least 44 px tall`).toBeGreaterThanOrEqual(44);
    expect(width, `${label} is at least 44 px wide`).toBeGreaterThanOrEqual(44);
  }
}

test("create account, sign out, and sign back in", async ({ page }) => {
  const email = await createAccount(page);
  await expect(page).toHaveURL(/\/questions$/);

  await signOut(page);
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, email);
  await expect(page.getByRole("heading", { level: 1, name: "Question bank" })).toBeVisible();
});

test("redirects: signed out to sign-in, signed in away from the auth pages", async ({ page }) => {
  await page.goto("/tests");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);

  await createAccount(page);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/questions$/);
  await page.goto("/create-account");
  await expect(page).toHaveURL(/\/questions$/);
});

test("a wrong password and an unknown email get the same message", async ({ page }) => {
  const email = await createAccount(page);
  await signOut(page);

  await signIn(page, email, "fabricated wrong pass phrase");
  const message = page.getByText("Email or password is incorrect.");
  await expect(message).toBeVisible();

  await signIn(page, uniqueEmail());
  await expect(message).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("an email that's already registered shows an error and creates nothing", async ({ page }) => {
  const email = await createAccount(page);
  await signOut(page);

  await page.goto("/create-account");
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("An account with this email already exists.")).toBeVisible();
  await expect(page).toHaveURL(/\/create-account$/);
});

test("sign-in, create-account and the shell fit a 360 px phone", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expectPhoneLayout(page);

  await page.goto("/create-account");
  await expect(page.getByRole("heading", { level: 1, name: "Create an account" })).toBeVisible();
  await expectPhoneLayout(page);

  await createAccount(page);
  await expectPhoneLayout(page);

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectPhoneLayout(page);
});

// TASK-005 left this open: Radix's scroll lock for modal menus and sheets injects a <style>
// element. The first run here proved style-src 'self' blocked it (the page behind an open Sheet
// kept scrolling), so the server now sends a per-response nonce for <style> elements only.
test("the Sheet and the dropdown menu open under the CSP with no violation", async ({ page }) => {
  const violations: string[] = [];
  // The page's own violation events (kept across navigations), plus the browser's console report.
  await page.exposeFunction("reportCspViolation", (detail: string) => violations.push(detail));
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    const report = (window as unknown as { reportCspViolation: (detail: string) => void })
      .reportCspViolation;
    document.addEventListener("securitypolicyviolation", (event) => {
      report(
        `${event.violatedDirective} blocked ${event.blockedURI} from ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });

  const response = await page.goto("/sign-in");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("style-src 'self';");
  expect(csp).toMatch(/style-src-elem 'self' 'nonce-[A-Za-z0-9+/]+={0,2}'/);
  expect(csp).not.toContain("unsafe-inline");
  await createAccount(page);

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // The scroll lock is on while the Sheet is open.
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: /Account menu/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");

  expect(violations).toEqual([]);
});
