---
name: implement-task
description: Implement one task from docs/TASKS.md within its approved scope, with tests, or fix what a failed /validate-task found. Stops short of marking the task complete; /validate-task does that.
argument-hint: "[TASK-ID]  (default: Current Task in docs/MEMORY.md)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(git status *), Bash(git diff *), Bash(git log *), PowerShell(git status *), PowerShell(git diff *), PowerShell(git log *)
---

Implement a task. Arguments: `$ARGUMENTS`

## Steps

1. **Identify the task.** Use the given `TASK-ID`, else the Current Task in
   `docs/MEMORY.md`. Read its entry in `docs/TASKS.md`, including any `Story` /
   `Acceptance criteria` block. If it has no acceptance criteria, suggest
   `/next-tasks <TASK-ID>` first; continue only if the user wants to.
2. **Check it's ready.** Warn if an earlier task in the same phase isn't
   Complete, and let the user decide. Read `docs/MEMORY.md` Known Issues for
   entries naming this task.
3. **Find the approved scope.** That's `docs/PRD.md`'s MVP, or for a task under
   a `Phase N: Release <version>` heading, `docs/releases/<version>.md` and its
   `FEAT` entries in `docs/BACKLOG.md`.
4. **Read the guardrails** for the layers this touches: `docs/ARCHITECTURE.md`
   (Folder Structure, Architectural Rules), `docs/BEST_PRACTICES.md`,
   `docs/RULES.md`, `docs/SECURITY.md`, `docs/DESIGN.md` if it touches the UI,
   and the matching `docs/TEST_PLAN.md` section.
5. **State a short plan**: files to change, behavior to add, tests to write, and
   anything the docs don't answer. If the docs don't answer something that
   affects behavior, ask or suggest `/ask-stakeholder`; don't guess. For a small
   task, carry on after stating it. Stop for the user's approval if the task
   looks too big for one sitting or needs a new dependency.
6. **Implement it**, including tests for the new behavior next to the code, per
   the project's conventions. Stay inside the task: if you notice unrelated
   problems, add them to Known Issues instead of fixing them.
7. **Run the checks** listed under *Commands* in `CLAUDE.md`: test, lint,
   typecheck, build. Never run an install or a network command without asking.
   If a check fails, fix the cause; never weaken or skip a test to pass.
8. **Update status.** In `docs/TASKS.md`, tick only this task's *Implement* box.
   In `docs/MEMORY.md`, set the Current Task and set Next Step to
   `/validate-task <TASK-ID>`. Remove Known Issues entries you actually fixed.
9. **Report** what changed, check results, and anything left open, and suggest
   `/validate-task`. Don't commit unless the user asks.

## Fixing a failed validation

If Known Issues has entries from a failed `/validate-task` for this task, those
are the work. Fix each one, then repeat steps 7 to 9. Don't re-implement what's
already working, and don't argue a finding away: if you think one is wrong, tell
the user and let them decide.

## Rules

- One task at a time.
- Never tick *Test*, *Review*, or *Complete*; `/validate-task` does that.
- Scope questions go to the user, not into the code.
