# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

TASK-003 validated (PASS WITH NOTES) after one failed round. Toolchain, Postgres, Drizzle, the env module, and Better Auth on Express 5 are validated; no feature screens or routes yet.

## Completed

- Project scaffolded (source skeleton + Claude setup)
- TASK-001 — Workspace, toolchain, and version recheck
- TASK-002 — Postgres, Drizzle, and env module
- TASK-003 — Prove Better Auth on Express 5 and set the auth config

## Current Task

TASK-004 — Prove the web stack (React Router 8, Tailwind 4.3, shadcn/ui, Recharts) and Express serving the SPA

## Known Issues

- [minor] TASK-001: `apps/api/package.json:8` keeps `--passWithNoTests`, which would hide a future case of no tests being found. Drop it or record why it stays.
- [minor] TASK-001: `/api/hello` in `apps/api/src/app.ts:8` has no removal owner. The task that adds the routers and JSON 404 should remove it and replace the smoke test, or record it as a kept route.
- [action] TASK-003: `NODE_ENV` is now required, so add `NODE_ENV=development` to `.env` and `.env.example`. Permission settings block these edits for Claude. `npm run dev:api` stops at startup until `.env` has it. Tests pass with `NODE_ENV=development` too, but `.env` then makes them run in development mode rather than CI's test mode. Railway must set `NODE_ENV=production`.
- [minor] TASK-003: `apps/api/src/app.ts:10` calls `next(error)` when headers are already sent, and Express's final handler then prints the whole error, including any query params. Hard to reach today. End the response instead of calling `next`.
- [minor] TASK-003: `writeAuthLog` in `apps/api/src/auth.ts:30` assumes `message` is a string, but Better Auth's list-sessions route logs an `Error` as the message. The split throws and the real cause is lost. Handle non-strings without printing their text.
- [minor] TASK-003: with `onAPIError.throw`, Better Auth's own 500s aren't logged, including the breached-password service being down. Log a code-only line for them, or record that they are unlogged in `docs/SECURITY.md`.
- [minor] TASK-003: the leak test at `apps/api/test/auth.test.ts:274` finds the session `id`, not the `token`, because both are 32 characters and `id` comes first. Its other assertions still catch the leak, but it should check the token itself.
- [nit] TASK-003: `apps/api/test/db.test.ts:21` skips `mockRestore` if the `not.toThrow` assertion fails. Use `try`/`finally`.
- [nit] TASK-003: `writeAuthLog` strips newlines but not other control characters, such as ANSI escapes in an attacker-supplied `Origin`.
- [major] TASK-003: behind Railway's proxy, `x-forwarded-for` may hold several addresses, and Better Auth then puts every client in one rate-limit bucket, so one client could lock every teacher out of sign-in. Unverified on Railway. Express `trust proxy` doesn't help: check before deploying and set `advanced.ipAddress.trustedProxies`. Can wait for deployment work.
- [minor] TASK-003: TASK-005 and TASK-006 overlap work already done: the 100 KB `express.json` limit, the auth error handler in `app.ts`, the pool handler, and the CI `db:migrate` step. Build on them rather than redoing them. TASK-005's shared error handler must never log a Drizzle error's message.
- [minor] TASK-003: sign-up requires `name`, but `docs/DESIGN.md` and the create-account mockup have no such field. TASK-010 must add one or derive it. Check `docs/DESIGN.md` then.
- [minor] TASK-003: `auth.ts` trusts `http://localhost:5173` in development, assuming Vite's default port. Confirm it through the proxy in TASK-004.
- [note] TASK-003: API tests write to the database in `.env`. They delete their fabricated accounts, but a crashed run could leave some behind.
- [minor] TASK-002: `BETTER_AUTH_SECRET` is only checked as non-empty, so a very short secret starts in production. Add a production minimum, or record the gap in `docs/SECURITY.md`.
- [minor] TASK-002: the placeholder in `apps/api/src/env.ts:4` duplicates `.env.example` with nothing linking them (they match today). Add a test that compares them.
- [minor] TASK-002: migrations `0000` and `0001` create and drop `stack_proof`, so every deploy replays them. Squash them before any shared database exists, or note them as intentional history.
- [nit] TASK-002: `apps/api/test/db.test.ts:17` only restates the pool constant.
- [nit] TASK-002: the `test` and `db:*` scripts in `apps/api/package.json` use direct paths into the root `node_modules`, which depend on workspace hoisting.
- [minor] TASK-001: `docs/STACK.md` records the Biome exclusions of `.claude` and Markdown without the reason. Add it, and check that no `.claude` JSON needs formatting.
- [nit] TASK-001: `biome.json` uses the deprecated `linter.rules.recommended`, with no owner for running `biome migrate`.
- [nit] TASK-001: `apps/api/test/smoke.test.ts:19` ignores any error from `server.close`.
- [docs gap] `CLAUDE.md` still says `~6.0.3`, "Not yet pinned" and no lockfile, and its doc table has no `docs/STACK.md` row.
- [docs gap] `docs/BEST_PRACTICES.md` has no rule on temporary stack-proof routes or `biome.json` path exclusions.
- [note] TASK-002: local Postgres is 18.4, CI uses `postgres:17`, and Railway's major version is unconfirmed. Align them once TASK-039 confirms Railway's.

## Next Step

Merge `feat/better-auth` through a pull request and add `NODE_ENV=development` to `.env` and `.env.example`. Then run /next-tasks TASK-004, since it has no saved story yet, and /implement-task TASK-004.
