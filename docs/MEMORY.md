# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

TASK-001 validated (PASS WITH NOTES). Toolchain pinned and proven on Node 26.13.0; no feature code written yet.

## Completed

- Project scaffolded (source skeleton + Claude setup)
- TASK-001 — Workspace, toolchain, and version recheck

## Current Task

TASK-002 — Postgres, Drizzle, and env module

## Known Issues

- [minor] TASK-001: `apps/api/package.json:8` keeps `--passWithNoTests`, which would hide a future case of no tests being found. Drop it or record why it stays.
- [minor] TASK-001: `/api/hello` in `apps/api/src/app.ts:8` has no removal owner. The task that adds the routers and JSON 404 should remove it and replace the smoke test, or record it as a kept route.
- [minor] TASK-001: `apps/api/src/index.ts:1` says "load env" but doesn't yet, and the port is hard-coded to 3000. TASK-002's criteria don't name the port, and Railway needs it from the environment.
- [minor] TASK-001: `docs/STACK.md` records the Biome exclusions of `.claude` and Markdown without the reason. Add it, and check that no `.claude` JSON needs formatting.
- [nit] TASK-001: `biome.json` uses the deprecated `linter.rules.recommended`, with no owner for running `biome migrate`.
- [nit] TASK-001: `apps/api/test/smoke.test.ts:19` ignores any error from `server.close`.
- [docs gap] `CLAUDE.md` still says `~6.0.3`, "Not yet pinned" and no lockfile, and its doc table has no `docs/STACK.md` row.
- [docs gap] `docs/BEST_PRACTICES.md` has no rule on temporary stack-proof routes or `biome.json` path exclusions.
- [note] TASK-001: `npm ci` ran in the working copy before the commit, not from a fresh clone. CI's first run will be the first test from a fresh checkout.
- [question] What should the session lifetime and idle-refresh values be? Blocks TASK-003 AC4. Docs require finite, recorded values and give no numbers; the Product Owner suggests keeping them short enough for a shared school device.
- [question] What are the rate-limit values and storage for Better Auth on `/api/auth/*`? Blocks TASK-003 AC5. Docs fix no numbers and only require limiting to stay on in tests; options for storage are memory (DEC-008 accepts it for express-rate-limit on a single instance) or database.
- [question] May `drizzle.config.ts` read `process.env` as an exception to BP-044, and what loads `.env`? Blocks TASK-002 AC7. Options: read `DATABASE_URL` and throw if missing (replacing `?? ""`); loader `--env-file`, `process.loadEnvFile` or `dotenv` (Product Owner suggests a built-in over a new dependency).

## Next Step

Merge `chore/workspace-toolchain` through a pull request. Answer the `drizzle.config.ts` and `.env` loader question above, then run /implement-task TASK-002.
