# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

TASK-002 validated (PASS WITH NOTES). Toolchain, Postgres, Drizzle, and the env module are proven; no feature code written yet.

## Completed

- Project scaffolded (source skeleton + Claude setup)
- TASK-001 — Workspace, toolchain, and version recheck
- TASK-002 — Postgres, Drizzle, and env module

## Current Task

TASK-003 — Prove Better Auth on Express 5 and set the auth config

## Known Issues

- [minor] TASK-001: `apps/api/package.json:8` keeps `--passWithNoTests`, which would hide a future case of no tests being found. Drop it or record why it stays.
- [minor] TASK-001: `/api/hello` in `apps/api/src/app.ts:8` has no removal owner. The task that adds the routers and JSON 404 should remove it and replace the smoke test, or record it as a kept route.
- [minor] TASK-002: `apps/api/src/db/client.ts` has no pool `error` handler, so a dropped idle connection would crash the process. Nothing imports it yet, but TASK-003 will, before TASK-005 adds logging, so TASK-003 must handle it.
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
- [question] What should the session lifetime and idle-refresh values be? Blocks TASK-003 AC4. Docs require finite, recorded values and give no numbers; the Product Owner suggests keeping them short enough for a shared school device.
- [question] What are the rate-limit values and storage for Better Auth on `/api/auth/*`? Blocks TASK-003 AC5. Docs fix no numbers and only require limiting to stay on in tests; options for storage are memory (DEC-008 accepts it for express-rate-limit on a single instance) or database.

## Next Step

Merge `chore/postgres-drizzle-env` through a pull request. Answer the session and rate-limit questions above, then run /implement-task TASK-003.
