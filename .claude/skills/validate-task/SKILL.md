---
name: validate-task
description: Validate the work done for a task — acceptance criteria, tests/lint, and code review against docs/BEST_PRACTICES.md
argument-hint: "[TASK-ID]  (default: Current Task in docs/MEMORY.md)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Task, Bash(git status *), Bash(git diff *), Bash(git log *), PowerShell(git status *), PowerShell(git diff *), PowerShell(git log *)
---

Validate the implementation of a task. Arguments: `$ARGUMENTS`

## Steps

1. **Identify the task.** Use the given `TASK-ID`, else the Current Task in
   `docs/MEMORY.md`. Read its entry in `docs/TASKS.md` (including any
   `Story` / `Acceptance criteria` block from `/next-tasks`). If there is
   none, derive criteria and say you did: for a task under a
   `Phase N: Release <version>` heading, from `docs/releases/<version>.md` and
   its `FEAT` entries in `docs/BACKLOG.md`; otherwise from `docs/PRD.md`. Use
   the matching `docs/TEST_PLAN.md` section too. That source is the task's
   **approved scope**.
2. **Find what changed.** `git status` and `git diff` (plus `git log` for
   committed work on the branch). If the change set isn't obvious, or
   includes files unrelated to the task, ask the user which files belong to
   it. No commits yet → there's no diff to review, so ask for the file list and
   suggest making a baseline commit of everything except this task's work.
3. **Run the automated checks** listed under *Commands* in `CLAUDE.md`:
   test, lint, typecheck, build — whichever apply. Run them as written.
   Never run an install or any command that touches the network; if
   dependencies are missing, report that and stop that step.
   *(The `allowed-tools` header only pre-approves read-only git; the
   project's test/lint commands will prompt for permission as usual.)*
4. **Check the acceptance criteria** one by one against the code and test
   results: met / not met / can't verify, with evidence (`path:line` or test
   name). Also walk the task's checklist in `docs/TEST_PLAN.md`.
5. **Code review.** Delegate to the `code-reviewer` subagent with the task ID,
   changed files, the diff, criteria, and approved-scope source. It reviews against
   `docs/BEST_PRACTICES.md` (citing BP-IDs), `docs/ARCHITECTURE.md` rules,
   `docs/RULES.md`, and `docs/SECURITY.md`.
6. **Scope check.** Flag changes beyond the task or its approved scope.

## Report

Give a verdict — **PASS**, **PASS WITH NOTES**, or **FAIL** — followed by:

- Automated checks: each command, result.
- Acceptance criteria: table of criterion → status → evidence.
- Review findings, most severe first, each with severity, `path:line`, the
  rule cited, and the fix.
- Scope notes and any docs gaps (e.g. a missing best practice).

Verdict rules, applied in order:

1. **FAIL** — any `blocker` finding, failing check, unmet criterion, or
   applicable check that couldn't run (e.g. missing dependencies). Checks
   listed as `n/a` don't count.
2. **PASS WITH NOTES** — any `major`, `minor`, or `nit` finding, or any
   criterion marked "can't verify".
3. **PASS** — none of the above.

## After the report

Updates are automatic — don't ask first.

- **FAIL:** don't touch `docs/TASKS.md`. Add each thing to fix to `docs/MEMORY.md`
  Known Issues, one line each with its severity and task ID (e.g.
  `[blocker] TASK-007: ...`), replacing older entries from the same task. List
  the fixes and suggest `/implement-task <TASK-ID>`, which works from those
  entries.
- **PASS / PASS WITH NOTES:**
  1. In `docs/TASKS.md`, tick the task's *Test*, *Review*, and *Complete*
     boxes (and *Implement* if it isn't already ticked). Touch nothing else.
  2. In `docs/MEMORY.md`, move the task from Current Task to Completed, pull
     the next unfinished task from TASKS.md into Current Task, update Next
     Step, remove this task's entries that are now fixed, and add any PASS WITH
     NOTES findings, unverified criteria, and docs gaps under Known Issues, one
     line each with its severity.
  3. Tell the user exactly what you changed.
