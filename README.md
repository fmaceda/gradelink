# GradeLink

A test-making web app for teachers: build a reusable question bank, assemble tests, share them by public link, and get automatic grading and class analytics. Students need no account. See `docs/PRD.md` for the product and `docs/` for all planning docs.

This is a starter skeleton. Real work is listed in `docs/TASKS.md`, starting with TASK-001.

## Repo shape

A single repo organised as a small npm workspace, with no Turborepo or Nx:

- `apps/api`: Express 5, Drizzle, Better Auth, grading (the only place grading lives)
- `apps/web`: Vite + React + React Router SPA
- `packages/shared`: Zod schemas and types, with separate `student/` and `teacher/` schemas

Why: one solo builder and one deployable (Express serves the built SPA and the API under `/api`), while shared Zod schemas need a package boundary that keeps student and teacher payload types apart. See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.

## Getting started

Requires Node 26.x (`.nvmrc`).

```
npm install            # creates package-lock.json on first run; commit it
cp .env.example .env   # then fill in real local values
npm run dev:api        # terminal 1
npm run dev:web        # terminal 2 (Vite proxies /api to Express; no CORS)
```

Checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

## Git conventions

From `docs/RULES.md`: default branch `main`; short-lived branches named `<type>/<short-slug>` (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`); Conventional Commits; merge through pull requests with CI green; never commit `.env`.

## Secrets

Follows OWASP ASVS secrets-handling guidance (industry best practice): `.env` is gitignored, `.env.example` holds placeholders only, and real values live in Railway variables. *Security-adjacent topic: not yet checked against an internal standard; verify before shipping real auth flows.*

## Claude Code

`CLAUDE.md` and `.claude/` hold the project's agents and skills. The everyday loop is `/next-tasks`, `/implement-task`, `/validate-task`.
