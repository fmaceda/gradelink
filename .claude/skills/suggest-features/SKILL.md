---
name: suggest-features
description: Ask the Product Owner for suggestions on how the product should evolve — new features, improvements to what's built, gaps — then decide which to pursue. Accepted ones are recorded as requirements in docs/BACKLOG.md.
argument-hint: "[optional focus, e.g. 'dashboard' or 'onboarding']"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Edit, Write, Task, Bash(git log *), Bash(git status *), PowerShell(git log *), PowerShell(git status *)
---

Get evolution suggestions from the Product Owner and decide what to pursue.
Focus (optional): `$ARGUMENTS`

## Steps

1. **Read current state.** `docs/MEMORY.md`, `docs/TASKS.md` (what's done),
   `docs/BACKLOG.md` (existing entries and their statuses — create it from the
   format in its header if missing), and skim `docs/PRD.md` goals/out of scope.
2. **Ask the Product Owner.** Delegate to the `product-owner` subagent in
   **Mode 2 — Proposing evolution**, passing the focus (if any) and recent
   `git log` output, and telling it to inspect the actual code, not just the
   docs. It returns at most 5 proposals.
3. **Present the proposals** clearly: title, type, why/value, requirements,
   acceptance criteria, effort estimate, risks, and any scope flags. Don't
   editorialize beyond the Product Owner's content, and don't hide an
   out-of-scope flag.
4. **Let the user decide**, per proposal: **Accept**, **Defer**, **Reject**,
   or **Refine** (they give feedback and you re-run step 2 for that item
   only). Do not assume a decision for any item; if the user doesn't decide
   on one, leave it `Proposed`.
5. **Record decisions** in `docs/BACKLOG.md`. For each proposal the user
   responded to, append an entry in the file's format with the next free
   `FEAT-NNN` ID, the status from their decision (`Accepted`, `Deferred`,
   `Rejected`; `Proposed` for undecided), today's date, the full
   requirements and acceptance criteria, and a Decision note (their reason, if
   given). Only edit `docs/BACKLOG.md` — never `docs/PRD.md`, `TASKS.md`, or
   code.
6. **Say what's next.** For Accepted items: they're requirements now, not yet
   scheduled — run `/plan-release` to put them into a release and generate
   tasks. Summarize what was recorded.

## Rules

- The Product Owner suggests; **the user decides.** Never mark anything
  Accepted without an explicit yes.
- Don't build anything here. This skill only produces decisions and records.
- If the Product Owner finds nothing worth proposing, say so; don't pad.
