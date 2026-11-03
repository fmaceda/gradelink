# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

TASK-001 implemented and awaiting validation. Toolchain pinned and proven on Node 26.13.0; no feature code written yet.

## Completed

- Project scaffolded (source skeleton + Claude setup)

## Current Task

TASK-001 — Workspace, toolchain, and version recheck

## Known Issues

- [question] What should the session lifetime and idle-refresh values be? Blocks TASK-003 AC4. Docs require finite, recorded values and give no numbers; the Product Owner suggests keeping them short enough for a shared school device.
- [question] What are the rate-limit values and storage for Better Auth on `/api/auth/*`? Blocks TASK-003 AC5. Docs fix no numbers and only require limiting to stay on in tests; options for storage are memory (DEC-008 accepts it for express-rate-limit on a single instance) or database.
- [question] May `drizzle.config.ts` read `process.env` as an exception to BP-044, and what loads `.env`? Blocks TASK-002 AC7. Options: read `DATABASE_URL` and throw if missing (replacing `?? ""`); loader `--env-file`, `process.loadEnvFile` or `dotenv` (Product Owner suggests a built-in over a new dependency).

## Next Step

/validate-task TASK-001
