# GradeLink

GradeLink is a test-making web app, usable on phones, where teachers build a reusable question bank, assemble tests, share them by public link, and get automatic grading and class analytics.

Planning docs live in `docs/` and are the source of truth. Read the relevant
one before working — don't rely on memory of them.

Current status: @docs/MEMORY.md

| Doc | Read it for |
|---|---|
| `docs/PRD.md` | What and why; the **MVP baseline**; what is out of scope |
| `docs/BACKLOG.md` | Everything proposed after the MVP: accepted / deferred / rejected features and improvements |
| `docs/releases/` | One file per planned/shipped release: scope, requirements, tasks, cut criteria |
| `docs/ARCHITECTURE.md` | Structure, folder layout, hard layer rules |
| `docs/DESIGN.md` | Look and feel, components, UX requirements |
| `docs/RULES.md` | Dev process: before coding, testing, git |
| `docs/BEST_PRACTICES.md` | Stack-specific coding practices (BP-IDs) used in review |
| `docs/SECURITY.md` | Production security considerations |
| `docs/TASKS.md` | Phased task list; each task: Implement → Test → Review → Complete |
| `docs/TEST_PLAN.md` | What "working" means per feature |
| `docs/DECISIONS.md` | Why the stack/architecture is what it is |
| `docs/STACK.md` | Pinned versions and what each setup task proved |
| `docs/MEMORY.md` | Living status — current task, known issues, next step |

## Stack

- Language: TypeScript 6.0.3 (strict, exact pin), @types/node 26.6.6, Node.js 26.x LTS (26.13.0)
- API: Express 5.3.0, Zod 4.6.7, tsx 4.23.15 (dev runner)
- Client: React 19.3.1, Vite 8.3.5, React Router 8.5.1 (library/data mode: `createBrowserRouter` from `react-router`, `RouterProvider` from `react-router/dom`), Tailwind CSS 4.3.3 with shadcn/ui (CLI 4.23.0, Radix base, components in `apps/web/src/components/ui/`)
- Database: PostgreSQL with Drizzle ORM 0.45.4, drizzle-kit 0.31.11, pg 8.23.1
- Auth: Better Auth 1.7.15 (email and password, teachers only)
- Tests and lint: Vitest 5.0.5, Playwright 1.64.1, Biome 2.6.4
- Hosting and CI: Railway Hobby with Railway Postgres; GitHub Actions
- Recorded, not installed: express-rate-limit 8.7.3 and helmet 8.3.0 (TASK-005), Recharts 3.11.0 (proven in a scratch project, added only with the charts task)

## Commands

- Install: `npm install` *(ask before running — touches the network)*
- Local Postgres: `docker compose up -d` (first run pulls the image), then `npm run db:migrate -w @gradelink/api`; stop with `docker compose down`
- Dev server: `npm run dev:api` and `npm run dev:web` (two terminals; Vite on port 5173 proxies `/api` to Express on `PORT`, default 3000)
- Add a shadcn/ui component: `npx shadcn@4.23.0 add <name>` from `apps/web` *(network)*, then `npm run lint` so Biome formats it
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`

## Working agreements

- Work one task at a time, in `docs/TASKS.md` order. Stay within the task's
  approved scope: the PRD MVP, or `docs/releases/<version>.md` for a task in a
  `Release <version>` phase. If something seems missing, raise it
  (`/ask-stakeholder`) instead of building it.
- Follow `docs/ARCHITECTURE.md`'s Folder Structure and Architectural Rules,
  and `docs/RULES.md`. New code must satisfy `docs/BEST_PRACTICES.md`.
- Never run installs or other network-touching commands without asking.
- Never commit secrets; follow `docs/SECURITY.md`.
- Keep `docs/MEMORY.md` current whenever a task's status changes.
- `docs/PRD.md` is the MVP baseline; post-MVP requirements live in
  `docs/BACKLOG.md` and only become work after you accept them and they are
  scheduled with `/plan-release`.

## Project skills (in `.claude/skills/`, invoked as slash commands)

The everyday loop is `/next-tasks`, then `/implement-task`, then `/validate-task`.

- `/next-tasks [N | TASK-ID]` — turn the next unfinished tasks into user
  stories with acceptance criteria, derived from the docs.
- `/implement-task [TASK-ID]` — build one task with its tests, or fix what a
  failed validation found.
- `/validate-task [TASK-ID]` — verify a task's work: acceptance criteria,
  tests/lint, and a code review against `docs/BEST_PRACTICES.md`.
- `/ask-stakeholder <question>` — ask the Product Owner a domain question
  (answers only from the docs/code, and flags what it can't answer).
- `/suggest-features [focus]` — the Product Owner proposes new features and
  improvements to what's built; **you decide** which to accept. Accepted ones
  are recorded as requirements in `docs/BACKLOG.md`.
- `/write-tests [TASK-ID | feature | path] [unit|integration|e2e|all]` — the
  QA engineer designs and writes tests, runs them, and reports defects.
- `/plan-release [version | check]` — the Release Manager (with the Product
  Owner) scopes a release — requirements and tasks — or checks whether the
  project is ready to cut one.

## Subagents (in `.claude/agents/`)

- `story-writer` — drafts stories/acceptance criteria from the docs.
- `code-reviewer` — reviews a diff against BEST_PRACTICES, RULES,
  ARCHITECTURE, and SECURITY. Read-only.
- `product-owner` — owns the domain; answers questions and proposes how the
  product should evolve. Suggests; never decides scope.
- `qa-engineer` — writes unit/integration/e2e tests; touches only test files.
- `release-manager` — scopes releases and judges readiness to cut; recommends,
  never tags or publishes.

## Notes

- Repo shape: one repo, small npm workspace (`apps/api`, `apps/web`, `packages/shared`), no Turborepo or Nx; one deployable (Express serves the built SPA and `/api`). Branches are `<type>/<short-slug>` off `main`, Conventional Commits (see `docs/RULES.md`).
- `package-lock.json` is committed; CI installs with `npm ci`.
- Express serves `apps/web/dist` whenever it exists (SPA fallback for GET/HEAD, JSON 404 for unknown `/api/*`). API tests use `apps/api/test/fixtures/web-dist` instead of the real build.
- API tests need a running local Postgres: `docker compose up -d` (see `docs/STACK.md`).
- `apps/web/e2e` and Playwright are present but not wired into CI until TASK-021.
