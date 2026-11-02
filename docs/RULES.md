# Rules — GradeLink

How work gets done day to day. System structure and the hard architectural rules live in `ARCHITECTURE.md` (Architectural Rules 1-14); production security lives in `SECURITY.md`; stack-level coding guidance lives in `BEST_PRACTICES.md`. This file does not restate them. Breaking an `ARCHITECTURE.md` rule is a rule violation here too.

## General

- One task at a time, taken from `TASKS.md`. Finish or park it before starting another.
- Use the pinned versions in `STACK.md`. No new dependency without a one-line reason in the commit message. Prefer what the stack already provides (Zod, Drizzle, Better Auth, Tailwind/shadcn) over adding a library.
- TypeScript strict stays on. No `any`, `@ts-ignore`, or `@ts-expect-error` without a comment saying why.
- No commented-out code, stray `console.log`, or unreferenced TODOs committed. A TODO must name a `TASKS.md` item.
- Biome is the only linter and formatter. Do not add ESLint or Prettier or per-file disables to quiet it.
- Node and package versions are pinned (`.nvmrc`, `engines`, exact or tilde ranges as in `STACK.md`). Do not bump a major version as a side effect of another task.
- When an "unconfirmed" item from `STACK.md` or `ARCHITECTURE.md` is proven or disproven in a setup task, update the affected doc in the same change.
- Never edit a generated migration after it has been applied. Add a new one.

## Before Coding

- The task exists in `TASKS.md` and its acceptance criteria are clear. If not, clarify or add it first.
- Read the relevant parts of `ARCHITECTURE.md` (Architectural Rules, Folder Structure, "Adding a new feature") and `DESIGN.md` for any UI work.
- Consult `BEST_PRACTICES.md` for each layer the task touches (API, web, shared, database).
- No undocumented scope added mid-task. If you find extra work, add it to `TASKS.md` and carry on with the original task.
- If the task touches a student-visible response, a grading rule, or auth, re-read the matching rules in `ARCHITECTURE.md` and `SECURITY.md` first.
- If the task depends on an unconfirmed stack item (Better Auth mounting, React Router 8 SPA mode, shadcn/ui with Tailwind 4.3, Recharts, Drizzle peer dependencies), prove that item first and record the result.
- If the task needs a product decision the PRD leaves open (see the Open Questions in `PRD.md` and the open questions in `SECURITY.md`), stop and ask rather than choosing silently.

## UI

- Follow `DESIGN.md` for tokens, layout, and states. Colors, spacing, and type come from the Tailwind theme; no one-off hex values or arbitrary-value classes where a token exists.
- Reuse an existing component (including shadcn/ui under `apps/web/src/components/ui/`) before writing a new one. Add shadcn components with its CLI, not by pasting from memory.
- Build mobile-first. Every screen, teacher and student, must work at a phone width before it is done; check it at a narrow viewport.
- Every data-driven screen handles loading, empty, and error states.
- Interactive elements are real `button`/`a`/form controls with labels and keyboard access. No click handlers on bare `div`s.
- Components do not call `fetch` or hold data access; follow `ARCHITECTURE.md` rule 10.
- Student screens never display or assume answer keys or per-question correctness (PRD Product Decision 1).

## Security

Dev-practice rules follow OWASP ASVS (configuration, dependency, and secrets-handling controls) and the NIST SSDF (SP 800-218) practices for protecting code and responding to vulnerabilities. Production controls (session, authorization, data protection, student-data privacy) are in `SECURITY.md`; do not duplicate them here.

- Secrets are never committed. `.env` is gitignored; `.env.example` lists variable names only, with placeholder values. Real values (`DATABASE_URL`, `BETTER_AUTH_SECRET`) live in Railway variables and a local `.env`. If a secret is ever committed, rotate it, then remove it.
- Do not paste secrets, real student names, or real attempt data into code, tests, fixtures, logs, issues, or commit messages. Use fabricated data.
- Never disable or bypass auth, ownership scoping, input validation, or the student-payload allow-list test for convenience, including "temporarily", in dev seeds, or behind a flag. If a test is blocking you, fix the cause.
- Every request body, param, and query is parsed with a shared Zod schema at the route boundary; do not trust raw `req.body`.
- Do not log request bodies, session cookies, or tokens.
- Run `npm audit` before each release and when adding or upgrading a dependency. Fix or consciously defer high and critical findings, noting any deferral in `MEMORY.md`.
- Keep dependencies patched: take security patch releases promptly, and review dependency updates through CI before merging.
- Use lockfile installs in CI (`npm ci`). Commit `package-lock.json`.
- Do not add the `cors` package or weaken cookie flags to get around a dev problem; use the Vite proxy (`ARCHITECTURE.md` rule 6).

*Security-adjacent topic: not yet checked against an internal standard; verify before implementation.*

## Testing

`TEST_PLAN.md` defines what to test, by feature and risk. This section only sets the bar for calling a task done.

- A task is not done until its relevant `TEST_PLAN.md` cases exist and pass locally: `typecheck`, Biome, and Vitest at minimum.
- Grading changes (normalization, partial credit, scoring) require unit tests of the pure functions, including edge cases, in the same change.
- Any change that touches a `/api/public/*` response or its DTO mapper must update and pass the student-payload allow-list test.
- Any new `/api/teacher/*` route needs a test that another teacher's data is not reachable.
- Playwright covers the teacher-creates, student-submits flow on a mobile viewport; run it before merging changes to either flow.
- Fix a bug by first writing a failing test that reproduces it where practical.
- Do not skip, `.only`, or delete a failing test to get green. Do not weaken an assertion to make it pass.
- CI must be green before merge.

## Git

- Work on short-lived branches off `main`, named `<type>/<short-slug>` (for example `feat/question-bank`, `fix/partial-credit-floor`). Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
- Commit messages use Conventional Commits (`feat: add tag filter to question bank`), imperative mood, and name the `TASKS.md` ID in the body when there is one.
- One logical change per commit and per branch. Keep a branch to one task; split unrelated cleanup into its own.
- Run `typecheck`, Biome, and Vitest before every push. CI (typecheck, Biome, Vitest, build, Playwright) must pass before merge.
- Even as a solo developer, merge through a pull request, and read your own diff against the `BEST_PRACTICES.md` checklist (the `/validate-task` command does this) before merging.
- Never force-push `main`. Never commit `.env`, `node_modules`, `dist`, or local Claude settings.
- Schema changes ship with their generated Drizzle migration in the same commit.

## Notes

> **Assumption:** No team conventions were stated. The branch naming, Conventional Commits, and use of `main` as the default branch are proposed defaults for a solo developer.

The user confirmed two process choices during review: merging through pull requests so CI runs before merge, and running `npm audit` before each release and on dependency changes, with no automated update tooling such as Dependabot.

> **Assumption:** The ASVS and NIST SSDF citations are general references for dev practice; specific ASVS version and control IDs were not looked up here.
