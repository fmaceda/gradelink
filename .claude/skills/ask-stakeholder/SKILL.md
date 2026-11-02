---
name: ask-stakeholder
description: Ask the Product Owner (the domain expert) a question about the product — answered from docs/ and the built code only
argument-hint: "<your question about the product, users, rules, or priorities>"
allowed-tools: Read, Grep, Glob, Edit, Task
---

Put a question to the Product Owner. Question: `$ARGUMENTS`

## Steps

1. If the question is empty, ask the user what they want to know.
2. Delegate to the `product-owner` subagent in **Mode 1 — Answering domain
   questions**, with the question and any useful context (task ID being
   worked on, the file or feature involved). It searches `docs/` (including
   `docs/BACKLOG.md` and `docs/releases/`) and answers with Answer / Basis /
   Confidence.
3. Relay the answer unchanged, including the confidence level. Don't
   upgrade an `Inferred` or `Not covered` answer into a decision.
4. If confidence is `Inferred` or `Not covered`, say plainly that the real
   stakeholder needs to confirm, and offer to record it as an open question
   in `docs/MEMORY.md` under **Known Issues** (one line starting `[question]`:
   the question, what's blocked, and any suggested options). Add it only if the user agrees.
5. If the answer contradicts or extends a doc (e.g. the PRD), point that out
   and suggest which doc should be updated; don't edit PRD/ARCHITECTURE
   yourself. If it's really a request for a new capability, suggest
   `/suggest-features`.

## Rules

- Never fabricate a business rule to keep work moving. "The docs don't say"
  is a valid, useful answer.
- Don't let the answer silently expand scope beyond the PRD MVP or a planned
  release in `docs/releases/`.
