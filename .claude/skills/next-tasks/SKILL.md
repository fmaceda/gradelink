---
name: next-tasks
description: Turn the next unfinished tasks from docs/TASKS.md into user stories with acceptance criteria
argument-hint: "[N | TASK-ID]  (default: next 3 tasks)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Task
---

Generate the next user stories / work items for this project, derived from
the docs. Arguments: `$ARGUMENTS`

## Steps

1. **Read current state.** `docs/MEMORY.md` (current task, known issues),
   `docs/TASKS.md` (what's done, ordering), and `docs/PRD.md` (MVP and out of
   scope). For a task under a `Phase N: Release <version>` heading, also read
   `docs/releases/<version>.md` and its `FEAT` entries in `docs/BACKLOG.md`.
2. **Pick the tasks.**
   - No argument → the next 3 unfinished tasks in TASKS.md order, starting
     with MEMORY.md's Current Task.
   - A number → that many tasks.
   - A `TASK-NNN` ID → just that task.
   Respect ordering: never pick a task whose predecessor in the same phase
   isn't Complete unless the user named it explicitly — and if they did,
   warn about the unmet dependency.
3. **Draft the stories.** Delegate to the `story-writer` subagent with the
   chosen task IDs. It reads `docs/ARCHITECTURE.md`, `docs/TEST_PLAN.md`,
   `docs/BEST_PRACTICES.md`, `docs/RULES.md`, and `docs/SECURITY.md` itself.
4. **Present them** in task order, each with: story, acceptance criteria,
   where it goes, guardrails, dependencies, out of scope, open questions.
5. **Surface open questions.** List every open question the drafts raised and
   offer to run `/ask-stakeholder` on them. Don't answer them yourself.
6. **Offer to save.** Ask whether to write each approved story into
   `docs/TASKS.md` beneath its task as a `**Story:**` / `**Acceptance
   criteria:**` block (so `/validate-task` can check against it later).
   Only edit TASKS.md after the user says yes, and only add those blocks —
   never reorder, renumber, or tick checkboxes. Then suggest
   `/implement-task <TASK-ID>` for the first one.

## Rules

- Stay within each task's approved scope: the PRD MVP, or the release file for
  a task in a release phase. If the docs imply work that isn't in TASKS.md,
  flag it as a gap for the user; don't invent a task.
- If every task is Complete, say so and point to `docs/MEMORY.md` /
  `docs/PRD.md` success criteria instead of making up more work.
