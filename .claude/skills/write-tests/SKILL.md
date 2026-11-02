---
name: write-tests
description: Ask the QA engineer to write unit, integration, and/or end-to-end tests for a task, feature, or file — designed from the docs, written in the project's test framework, run, and any real defects reported.
argument-hint: "[TASK-ID | feature | path] [unit|integration|e2e|all]  (default: Current Task, all relevant levels)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Task, Bash(git status *), Bash(git diff *), Bash(git log *), PowerShell(git status *), PowerShell(git diff *), PowerShell(git log *)
---

Have QA write tests. Arguments: `$ARGUMENTS`

## Steps

1. **Resolve the target and level.** Parse `$ARGUMENTS`: a `TASK-ID`, a
   feature name, or a path, plus an optional level (`unit`, `integration`,
   `e2e`, `all`). Default target: the Current Task in `docs/MEMORY.md`.
   Default level: whatever is appropriate for the code (logic → unit; API
   routes → integration; critical user flows → e2e). If the target is
   ambiguous, ask which one.
2. **Gather context.** The task's entry and acceptance criteria in
   `docs/TASKS.md` (or `docs/BACKLOG.md` for evolution work), the matching
   section of `docs/TEST_PLAN.md`, and the files that implement the target
   (`git diff`/`git log` or Glob). If the code doesn't exist yet, say so — QA
   tests behavior that's implemented; it won't invent it.
3. **Delegate to the `qa-engineer` subagent** with the target, level, files,
   acceptance criteria, and the test command from `CLAUDE.md`. It matches the
   project's existing test framework and conventions, writes only test files,
   and runs them (no installs, no network).
4. **Review its report.** Check that the new tests actually assert behavior
   (not just execute code), cover happy path + edge + error (+ permissions /
   validation where they apply), and that nothing existing was deleted or
   weakened. Ask the agent to revise if not.
5. **Report** to the user: files added, case table, run results, defects, gaps.
6. **Record defects.** If the tests exposed real defects in production code,
   add each as a one-line item under **Known Issues** in `docs/MEMORY.md`,
   starting with its severity and task ID if there is one (test name, expected
   vs actual, location). Don't fix production code here; suggest
   `/implement-task` for the current task, or `/plan-release` for a defect in
   shipped work. Don't tick any `TASKS.md` boxes.

## Rules

- Tests only: no production-code, docs (other than the MEMORY.md Known Issues
  note), or config edits.
- A failing new test caused by a real bug stays failing and is reported — it
  is never rewritten to pass.
- Never run installs or anything that touches the network.
