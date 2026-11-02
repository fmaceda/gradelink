# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

Planning complete and project scaffolded — no feature code written yet.

## Completed

- Project scaffolded (source skeleton + Claude setup)

## Current Task

TASK-001 — Workspace, toolchain, and version recheck

## Known Issues

- Nothing has been installed or run yet. The apps/api typecheck is expected to fail until TASK-001 adds @types/node.
- CI runs npm ci, so it fails until package-lock.json is committed after the first install.

## Next Step

Begin TASK-001. Run /next-tasks to start.
