# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

TASK-005 passed validation with notes on 2026-11-25. The work is on branch `feat/api-hardening`, uncommitted, and has no PR yet. helmet 8.3.0 and express-rate-limit 8.7.3 are installed and proven on Express 5.3.0. The shared error handler, `AppError`, `validated()`, the JSON-only body check, request logging, `TRUST_PROXY` and an unmounted rate-limit factory are in place. All 124 API tests pass against the Docker Postgres. No feature screens or routes yet; `/` is a temporary stack-proof page.

## Completed

- Project scaffolded (source skeleton + Claude setup)
- TASK-001 — Workspace, toolchain, and version recheck
- TASK-002 — Postgres, Drizzle, and env module
- TASK-003 — Prove Better Auth on Express 5 and set the auth config
- TASK-004 — Prove the web stack (React Router 8, Tailwind 4.3, shadcn/ui, Recharts) and Express serving the SPA
- TASK-005 — API hardening baseline (helmet, rate-limit plumbing, body limit, error handler)

## Current Task

TASK-006 — CI, secret scanning, and dependency audit

## Known Issues

- [minor] TASK-005: criterion 9 can't be verified by Claude. The owner says `TRUST_PROXY=0` is in their env files, and `git status` shows `.env.example` modified, but Claude's permission settings block reading `.env*` files. The owner should check the line is in `.env.example` before committing.
- [minor] TASK-005: `fromClientError` in `apps/api/src/middleware/error-handler.ts:44` turns every 4xx into 400 `VALIDATION_ERROR`. An error that carries 404, 413, 415 or 429 from a source other than body-parser loses its real status and code (BP-045). No such source exists today. Fix: keep 404/413/415/429 with their matching code and fixed text, and use 400 only for the rest. TASK-037 at the latest, when it re-checks every route's errors.
- [nit] TASK-005: `fieldPath` in `apps/api/src/middleware/validate.ts:46` echoes every numeric path segment, so the numeric keys of a `z.record(z.number(), ...)` would show up in `fields`. Fix: echo numbers only under a `ZodArray` or `ZodTuple`, otherwise write `*`.
- [nit] TASK-005: `unwrap` in `validate.ts:22` doesn't follow unions, discriminated unions, `ZodLazy`, `ZodCatch` or tuples, so errors inside them report `body.*` instead of the field. That's safe but vague. Add a comment saying it's intentional, or extend the walk when the first union request schema arrives (question types, TASK-008).
- [nit] TASK-005: `error-handler.ts:75` calls `res.end()` after a mid-stream failure, so the client sees the truncated chunked body as complete. `res.destroy()` would signal the failure. Criterion 6 says "ends", so the owner decides.
- [note] TASK-005: the owner added a root `.gitattributes` (`* text=auto eol=lf`) on `feat/api-hardening` to fix local CRLF lint failures. It isn't TASK-005 work, so give it its own `chore:` commit. On 2026-11-25 Claude deleted the 19 affected files, which had no local changes, and restored them from git so they're LF on disk, and `npm run lint` now passes. Other existing clones need a fresh checkout to pick up LF (`git rm --cached -r . && git reset --hard`, only with a clean tree).
- [minor] TASK-005: the CSP ships with strict `style-src 'self'`, and the Radix check is unverified because no browser was available. The Dialog and Sheet scroll lock injects a `<style>` element, which this policy blocks. TASK-010 must open a Dialog in the built SPA served by Express and record the result in `docs/SECURITY.md`. See the Input Validation section there.
- [note] TASK-005: `middleware/request-log.ts` captures the route pattern by putting an accessor on `req.route`. Express resets `req.baseUrl` before an error reaches the last handler, so reading the pattern at the end would lose the mount path. This relies on Express assigning `req.route` when a route matches. Tests cover it, so an Express upgrade that breaks it shows up as a failing test.
- [nit] TASK-005: the JSON-only body check runs before the routers, so a non-JSON body sent to an unknown `/api` path gets 415, not 404.
- [note] TASK-005: `packages/shared` now uses `.ts` relative imports, and `allowImportingTsExtensions` is in `tsconfig.base.json`, because the API's NodeNext build needs them. TASK-010 is the first web import of shared; check Vite and `tsc` there.

- [minor] TASK-004: criterion 6 is unverified. Nobody has signed in through the Vite proxy yet to confirm the cookie is HttpOnly, SameSite=Lax and not Secure. The Vitest half passes. Sign-up calls the Have I Been Pwned service, so do it by hand or approve the network call. Do it before TASK-010 builds the sign-in screen.
- [minor] TASK-004: `apps/web/src/router.tsx:22`: the `*` route has no `ErrorBoundary`, and there's no root one, so an error there shows React Router's default screen with the raw message. TASK-010 should put `RouteError` on a pathless root route that wraps every route.
- [nit] TASK-004: `--primary-hover` and `--secondary-hover` in `apps/web/src/styles.css:18` are unused. The generated Button uses `hover:bg-primary/80` and a `color-mix`, so hover doesn't match DESIGN.md. TASK-010 should use `hover:bg-primary-hover` and `hover:bg-secondary-hover` when it sets the button styles.
- [nit] TASK-004: in `apps/web/src/routes/stack-proof.tsx:65`, the loader's `notes` shadows the module-level `notes` array. The file is temporary and TASK-010 removes it.
- [nit] TASK-004: the wrong-method test in `apps/api/test/app.test.ts:104` checks "not HTML" but not `application/json`. TASK-037 should assert JSON when it re-checks every route.
- [note] TASK-004: git reports "dubious ownership" for the repo folder on this machine. Commands used `git -c safe.directory=...`. The owner can run `git config --global --add safe.directory D:/Development/portfolio-projects/gradelink` to fix it permanently.
- [minor] TASK-004: the SPA bundle is 685 kB minified (212 kB gzip), mostly react-dom, react-router and zod, before any screen exists. TASK-010 and TASK-021 must lazy-load teacher routes (BP-024) so `/t/<token>` stays small. Consider `zod/mini` for the student bundle.
- [minor] TASK-004: the shadcn `nova` buttons default to `h-8` (32 px), and the Dialog and Sheet close buttons are `icon-sm` (about 28 px, `components/ui/dialog.tsx:61`). Both are below DESIGN.md's 44 px touch target. The proof page passes `h-11` only to its own buttons. TASK-010 should set the app's button and icon-button sizes in `components/ui/button.tsx`.
- [note] TASK-004: `/` is a temporary stack-proof page (`apps/web/src/routes/stack-proof.tsx`) with a temporary local schema in `lib/api.ts`. TASK-010 replaces both with the app shell and a schema from `@gradelink/shared`.
- [note] TASK-004: `npm audit` reports 8 moderate findings and no high or critical. The 4 new ones come through `shadcn` → `ts-morph` → `minimatch`, a devDependency CLI. TASK-006 records them.

- [minor] TASK-001: `apps/api/package.json:8` keeps `--passWithNoTests`, which would hide a future case of no tests being found. TASK-006 drops it.
- [note] TASK-003: `NODE_ENV` is required, so Railway must set `NODE_ENV=production`. Local tests now run in development mode because `.env` sets it, while CI runs them in test mode.
- [minor] TASK-003: the leak test at `apps/api/test/auth.test.ts:274` finds the session `id`, not the `token`, because both are 32 characters and `id` comes first. Its other assertions still catch the leak, but it should check the token itself.
- [nit] TASK-003: `apps/api/test/db.test.ts:21` skips `mockRestore` if the `not.toThrow` assertion fails. Use `try`/`finally`.
- [major] TASK-003: behind Railway's proxy, `x-forwarded-for` may hold several addresses, and Better Auth then puts every client in one rate-limit bucket, so one client could lock every teacher out of sign-in. Unverified on Railway. Express `trust proxy` doesn't help: TASK-038 checks this and sets `advanced.ipAddress.trustedProxies`.
- [minor] TASK-003: TASK-006 overlaps work already done: the pool handler and the CI `db:migrate` step. Build on them rather than redoing them.
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

Confirm `TRUST_PROXY=0` is in `.env.example`. Commit `feat/api-hardening`: `.gitattributes` as its own `chore:` commit, then TASK-005 as `feat:`. Open a PR. Then run `/next-tasks TASK-006` or `/implement-task TASK-006`. TASK-006's story and accepted decisions are already in `docs/TASKS.md`.
