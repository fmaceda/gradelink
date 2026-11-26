---
name: guide-task
description: Coach the user through implementing one task from docs/TASKS.md themselves, one small step at a time, reviewing their work and giving hints instead of writing the code. The hands-on alternative to /implement-task. Stops short of marking the task complete; /validate-task does that.
argument-hint: "[TASK-ID]  (default: Current Task in docs/MEMORY.md)"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit(./docs/TASKS.md), Edit(./docs/MEMORY.md), Bash(git status *), Bash(git diff *), Bash(git log *), PowerShell(git status *), PowerShell(git diff *), PowerShell(git log *)
---

Guide the user through a task. They write all the code. Arguments: `$ARGUMENTS`

## Set up

1. **Identify the task.** Use the given `TASK-ID`, else the Current Task in
   `docs/MEMORY.md`. Read its entry in `docs/TASKS.md`, including any `Story` /
   `Acceptance criteria` block. If it has no acceptance criteria, suggest
   `/next-tasks <TASK-ID>` first; continue only if the user wants to.
2. **Resume if already started.** If Current Task in `docs/MEMORY.md` has a
   guided checklist for this task, keep it and its mode. Run a review (step 3 of
   the loop) on any work since the last ticked step, then carry on from the first
   unticked step. Skip the rest of this section.
3. **Check it's ready.** Warn if an earlier task in the same phase isn't
   Complete, and let the user decide. Read `docs/MEMORY.md` Known Issues for
   entries naming this task.
4. **Find the approved scope.** That's `docs/PRD.md`'s MVP, or for a task under
   a `Phase N: Release <version>` heading, `docs/releases/<version>.md` and its
   `FEAT` entries in `docs/BACKLOG.md`.
5. **Read the guardrails** for the layers this touches: `docs/ARCHITECTURE.md`
   (Folder Structure, Architectural Rules), `docs/BEST_PRACTICES.md`,
   `docs/RULES.md`, `docs/SECURITY.md`, `docs/DESIGN.md` if it touches the UI,
   and the matching `docs/TEST_PLAN.md` section. If the docs don't answer
   something that affects behavior, ask or suggest `/ask-stakeholder`; don't
   guess.
6. **Ask the mode, once.** Is the user **learning** this part of the stack, or do
   they already **know** it? Learning means smaller steps, more explanation of
   why, and hints that start concrete. Knowing means larger steps, a brief that
   states only the goal and constraints, and hints that start as a question.
7. **Propose the steps.** Split the task into 3 to 7 small steps in build order,
   each ending in something the user can run or see. Tests are steps too, and the
   user writes them. Let the user reorder, merge, or split them.
8. **Save the checklist** once approved, under Current Task in `docs/MEMORY.md`,
   and set Next Step to `/guide-task <TASK-ID>`:

   ```markdown
   **Guided (/guide-task, learning):**
   - [ ] 1. <step>
   - [ ] 2. <step>
   ```

## The loop

Repeat for each step, and stay in this mode until the task is finished, the user
pauses, or the user hands off.

1. **Brief.** State the goal of the step, why it comes now, which files are
   involved, the rule that applies (such as a BP-ID), and how the user will know
   it works. Don't give the code.
2. **Wait.** The user codes, then says "check" or asks a question. Answer
   questions about concepts, the stack, and the docs freely. For "how do I write
   this", use the hint ladder.
3. **Review.** Use `git status` and `git diff`, and read new untracked files,
   since `git diff` doesn't show them. Run the checks under *Commands* in
   `CLAUDE.md` that are relevant to this step. A test written before its code
   should fail, and for the right reason. Then say what works, and point at each
   problem by `path:line`, naming what's wrong or the rule it breaks, with a hint
   rather than a fix. Flag anything outside this step or the task's scope, and
   say so if a test was weakened to make it pass.
4. **Advance.** When the step holds up, tick it in `docs/MEMORY.md`. If it
   doesn't, go back to step 2. The user can choose to move on anyway: add the
   problem to Known Issues (`[severity] TASK-ID: ...`), then tick the step.

## Hint ladder

Go up one level each time the user asks for more help or stays stuck on the same
problem. Start at level 1 in *know* mode and level 2 in *learning* mode.

1. A guiding question.
2. Where to look: the concept, a doc section, or similar code in this repo.
3. The shape of the solution, in pseudocode or prose.
4. A short snippet in chat for the user to type, covering only the part they're
   stuck on, never a whole function or file.

## Finishing

After the last step, run every check under *Commands* in `CLAUDE.md`, and treat
failures as one more round of the loop. Never run an install or a network
command without asking. When they pass, or the user chooses to carry a failure as
a Known Issues entry:

1. In `docs/TASKS.md`, tick only this task's *Implement* box.
2. In `docs/MEMORY.md`, remove the guided checklist, set Next Step to
   `/validate-task <TASK-ID>`, and remove Known Issues entries the user actually
   fixed.
3. Report what was built, check results, and anything left open, and suggest
   `/validate-task`. Don't commit unless the user asks.

## Fixing a failed validation

If Known Issues has entries from a failed `/validate-task` for this task, those
are the steps. Build the checklist from them and run the loop, explaining each
finding without giving the fix. Don't re-teach what's already working, and don't
argue a finding away: if you think one is wrong, tell the user and let them
decide.

## Pausing and handing off

- **Pausing:** the checklist stays in `docs/MEMORY.md`, so `/guide-task` resumes
  from it later.
- **Handing off:** if the user wants Claude to write the code, don't do it here.
  Stop guiding and suggest `/implement-task <TASK-ID>`, which continues from
  their work and the remaining checklist steps.

## Rules

- One task at a time.
- Never create or edit source, test, or config files, by any means. The only
  files you change are `docs/TASKS.md` and `docs/MEMORY.md`.
- The user runs any install, after you've named the exact command and it fits the
  task's approved scope. A new dependency needs their decision first.
- Stay inside the task: add unrelated problems to Known Issues.
- Never tick *Test*, *Review*, or *Complete*; `/validate-task` does that.
