---
name: plan-release
description: Have the Release Manager and Product Owner scope a release — all requirements and tasks — or check whether the project is ready to cut one. Writes docs/releases/<version>.md and adds the release's tasks to docs/TASKS.md and its test checklists to docs/TEST_PLAN.md after the user approves the scope.
argument-hint: "[version | check]  (default: propose the next release; 'check' = is the planned release ready to cut?)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Task, Bash(git log *), Bash(git status *), Bash(git tag -l *), PowerShell(git log *), PowerShell(git status *), PowerShell(git tag -l *)
---

Plan a release, or check readiness. Arguments: `$ARGUMENTS`

If the argument is `check`, go to **Readiness check** below; otherwise plan.

## Plan a release

1. **Read state.** `docs/BACKLOG.md` (Accepted items not yet released),
   `docs/TASKS.md`, `docs/MEMORY.md`, `docs/PRD.md` (goal, MVP, success
   criteria), and any existing `docs/releases/*.md`.
   Also list defects in `docs/MEMORY.md` Known Issues and ask which to fix in
   this release. For each one the user picks, add a `docs/BACKLOG.md` entry with
   type `defect` and status `Accepted`, the next free `FEAT-NNN`, and its
   expected behavior as requirements. Other defects stay in Known Issues.
   If there are then no Accepted backlog items and no unfinished MVP tasks, say
   there is nothing to release and suggest `/suggest-features`.
2. **Product Owner first.** Delegate to the `product-owner` subagent, passing
   recent `git log` output: rank the Accepted items by user value and flag
   dependencies or conflicts with what is built. (Agents can't talk to each
   other; you carry its output forward.)
3. **Release Manager next.** Delegate to the `release-manager` subagent in
   **Mode 1 — Scope a release**, passing the Product Owner's ranking, the task
   state, `git log` and `git tag -l` output, and the requested version (if
   given). It proposes: version + reason,
   release goal, Must/Should/Could scope with `FEAT`/`TASK` IDs, new tasks
   drafted in dependency order, excluded items with reasons, risks, and cut
   criteria.
4. **Present the proposal** and let the user decide: approve, move items
   between tiers, drop or add Accepted items, change the version. Re-run step 3
   if the change is large. **Do not write anything until the user approves
   the scope.**
5. **Write it down** (only after approval):
   - Create `docs/releases/<version>.md` (e.g. `docs/releases/v0.2.0.md`):
     status `Planned`; goal; scope table (tier, FEAT/TASK ID, title); the full
     text of each included requirement and its acceptance criteria (from
     `docs/BACKLOG.md`); the task list with IDs; excluded items and why;
     risks; cut criteria checklist; date.
   - Append the release's new tasks to `docs/TASKS.md` as a new phase
     `## Phase N: Release <version> — <goal>`, continuing the existing
     `TASK-NNN` numbering and using the standard four checkboxes
     (Implement / Test / Review / Complete). Don't touch existing tasks or
     renumber anything.
   - In `docs/TEST_PLAN.md`, add a section for each included `FEAT` item, in
     the file's existing format, built from its acceptance criteria. Don't
     invent behavior or change existing sections.
   - In `docs/BACKLOG.md`, set each included item's status to
     `Scheduled (<version>)`.
   - In `docs/MEMORY.md`, set Next Step to the first task of the release.
6. **Summarize** what was written and suggest `/next-tasks` to turn the first
   tasks into stories, then `/implement-task` to build them.

## Readiness check (`/plan-release check`)

1. Find the release being checked: the latest `Planned` file in
   `docs/releases/` (ask if there are several).
2. Run the checks listed in `CLAUDE.md` Commands (test, lint, typecheck,
   build) — local only, no installs. Do not run dependency-audit or other
   network commands without asking; ask whether to run the audit.
3. Delegate to the `release-manager` subagent in **Mode 2 — Readiness
   check**, passing the release file, the task state, `docs/MEMORY.md` Known
   Issues, `git status` and `git log` output, and the check results.
4. Present the verdict — **GO**, **GO WITH CONDITIONS**, or **NO-GO** — with
   evidence and, for each blocker, the smallest action that clears it.
5. If **GO** (or the user accepts the conditions), update the release file's
   status to `Ready` and note the date. Don't mark it `Released`, and never
   create git tags, push, or publish: those are the user's explicit actions.
   When the user says the release has shipped, set the file to `Released`
   and its backlog items to `Released (<version>)`.

## Rules

- Only `Accepted` backlog items can enter a release. Never schedule
  Proposed, Deferred, or Rejected ones.
- The Release Manager recommends; **the user approves scope and decides when
  to cut.**
- Don't invent dates or capacity — ask if a constraint matters.
