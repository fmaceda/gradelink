# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

TASK-004 validated (PASS WITH NOTES) and committed on branch `feat/web-stack`; no PR yet. React Router 8, Tailwind 4.3, shadcn/ui and Express serving the SPA are proven, Recharts is proven in a scratch project, and all 60 API tests pass against the Docker Postgres from `compose.yaml`. The manual proxy sign-in check is still open. No feature screens or routes yet; `/` is a temporary stack-proof page.

## Completed

- Project scaffolded (source skeleton + Claude setup)
- TASK-001 — Workspace, toolchain, and version recheck
- TASK-002 — Postgres, Drizzle, and env module
- TASK-003 — Prove Better Auth on Express 5 and set the auth config
- TASK-004 — Prove the web stack (React Router 8, Tailwind 4.3, shadcn/ui, Recharts) and Express serving the SPA

## Current Task

TASK-005 — API hardening baseline (helmet, rate-limit plumbing, body limit, error handler)

## Known Issues

- [minor] TASK-004: criterion 6 is unverified. Nobody has signed in through the Vite proxy yet to confirm the cookie is HttpOnly, SameSite=Lax and not Secure. The Vitest half passes. Sign-up calls the Have I Been Pwned service, so do it by hand or approve the network call. Do it before TASK-010 builds the sign-in screen.
- [minor] TASK-004: `apps/web/src/router.tsx:22`: the `*` route has no `ErrorBoundary`, and there's no root one, so an error there shows React Router's default screen with the raw message. TASK-010 should put `RouteError` on a pathless root route that wraps every route.
- [nit] TASK-004: `--primary-hover` and `--secondary-hover` in `apps/web/src/styles.css:18` are unused. The generated Button uses `hover:bg-primary/80` and a `color-mix`, so hover doesn't match DESIGN.md. TASK-010 should use `hover:bg-primary-hover` and `hover:bg-secondary-hover` when it sets the button styles.
- [nit] TASK-004: in `apps/web/src/routes/stack-proof.tsx:65`, the loader's `notes` shadows the module-level `notes` array. The file is temporary and TASK-010 removes it.
- [nit] TASK-004: the wrong-method test in `apps/api/test/app.test.ts:104` checks "not HTML" but not `application/json`. TASK-037 should assert JSON when it re-checks every route.
- [note] TASK-004: git reports "dubious ownership" for the repo folder on this machine. Commands used `git -c safe.directory=...`. The owner can run `git config --global --add safe.directory D:/Development/portfolio-projects/gradelink` to fix it permanently.
- [minor] TASK-004: the SPA bundle is 685 kB minified (212 kB gzip), mostly react-dom, react-router and zod, before any screen exists. TASK-010 and TASK-021 must lazy-load teacher routes (BP-024) so `/t/<token>` stays small. Consider `zod/mini` for the student bundle.
- [minor] TASK-004: the shadcn `nova` buttons default to `h-8` (32 px), and the Dialog and Sheet close buttons are `icon-sm` (about 28 px, `components/ui/dialog.tsx:61`). Both are below DESIGN.md's 44 px touch target. The proof page passes `h-11` only to its own buttons. TASK-010 should set the app's button and icon-button sizes in `components/ui/button.tsx`.
- [minor] TASK-004: a non-GET request to a non-`/api` path, such as `POST /t/x`, gets Express's default HTML "Cannot POST" 404. That's outside criterion 7, but TASK-005's last error handler should cover it.
- [note] TASK-004: `/` is a temporary stack-proof page (`apps/web/src/routes/stack-proof.tsx`) with a temporary local schema in `lib/api.ts`. TASK-010 replaces both with the app shell and a schema from `@gradelink/shared`.
- [note] TASK-004: `npm audit` reports 8 moderate findings and no high or critical. The 4 new ones come through `shadcn` → `ts-morph` → `minimatch`, a devDependency CLI. TASK-006 records them.

- [minor] TASK-001: `apps/api/package.json:8` keeps `--passWithNoTests`, which would hide a future case of no tests being found. TASK-006 drops it.
- [note] TASK-003: `NODE_ENV` is required, so Railway must set `NODE_ENV=production`. Local tests now run in development mode because `.env` sets it, while CI runs them in test mode.
- [minor] TASK-003: `apps/api/src/app.ts:10` calls `next(error)` when headers are already sent, and Express's final handler then prints the whole error, including any query params. Hard to reach today. TASK-005 ends the response instead of calling `next`.
- [minor] TASK-003: `writeAuthLog` in `apps/api/src/auth.ts:30` assumes `message` is a string, but Better Auth's list-sessions route logs an `Error` as the message. The split throws and the real cause is lost. TASK-005 handles non-strings without printing their text.
- [minor] TASK-003: with `onAPIError.throw`, Better Auth's own 500s aren't logged, including the breached-password service being down. TASK-005 logs a code-only line for them.
- [minor] TASK-003: the leak test at `apps/api/test/auth.test.ts:274` finds the session `id`, not the `token`, because both are 32 characters and `id` comes first. Its other assertions still catch the leak, but it should check the token itself.
- [nit] TASK-003: `apps/api/test/db.test.ts:21` skips `mockRestore` if the `not.toThrow` assertion fails. Use `try`/`finally`.
- [nit] TASK-003: `writeAuthLog` strips newlines but not other control characters, such as ANSI escapes in an attacker-supplied `Origin`. TASK-005 strips them.
- [major] TASK-003: behind Railway's proxy, `x-forwarded-for` may hold several addresses, and Better Auth then puts every client in one rate-limit bucket, so one client could lock every teacher out of sign-in. Unverified on Railway. Express `trust proxy` doesn't help: TASK-038 checks this and sets `advanced.ipAddress.trustedProxies`.
- [minor] TASK-003: TASK-005 and TASK-006 overlap work already done: the 100 KB `express.json` limit, the auth error handler in `app.ts`, the pool handler, and the CI `db:migrate` step. Build on them rather than redoing them. TASK-005's shared error handler must never log a Drizzle error's message.
- [minor] TASK-003: sign-up requires `name`, but `docs/DESIGN.md` and the create-account mockup have no such field. TASK-010 must add one or derive it. Check `docs/DESIGN.md` then.
- [minor] TASK-003: `auth.ts` trusts `http://localhost:5173` in development. TASK-004 pinned Vite to that port (`strictPort`), but sign-in through the proxy is still unchecked. See the TASK-004 Postgres entry above.
- [note] TASK-003: API tests write to the database in `.env`. They delete their fabricated accounts, but a crashed run could leave some behind.
- [minor] TASK-002: `BETTER_AUTH_SECRET` is only checked as non-empty, so a very short secret starts in production. Add a production minimum, or record the gap in `docs/SECURITY.md`.
- [minor] TASK-002: the placeholder in `apps/api/src/env.ts:4` duplicates `.env.example` with nothing linking them (they match today). Add a test that compares them.
- [minor] TASK-002: migrations `0000` and `0001` create and drop `stack_proof`, so every deploy replays them. Squash them before any shared database exists, or note them as intentional history.
- [nit] TASK-002: `apps/api/test/db.test.ts:17` only restates the pool constant.
- [nit] TASK-002: the `test` and `db:*` scripts in `apps/api/package.json` use direct paths into the root `node_modules`, which depend on workspace hoisting.
- [minor] TASK-001: `docs/STACK.md` records the Biome exclusions of `.claude` and Markdown without the reason. Add it, and check that no `.claude` JSON needs formatting.
- [nit] TASK-001: `biome.json` uses the deprecated `linter.rules.recommended`, with no owner for running `biome migrate`.
- [nit] TASK-001: `apps/api/test/smoke.test.ts:19` ignores any error from `server.close`.
- [note] TASK-002: local Postgres (now `compose.yaml`) and CI both use `postgres:17`, a floating minor tag. Railway's major version is unconfirmed; align all three once TASK-039 confirms it.

## Next Step

Open a PR for `feat/web-stack`. Still uncommitted: the `.claude/skills` edits and the `.env.example` change. Then run `/implement-task TASK-005`; its story and accepted decisions are in `docs/TASKS.md`.
