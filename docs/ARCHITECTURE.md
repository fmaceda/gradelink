# Architecture — GradeLink

## Overview

GradeLink is a single-repo npm workspace that ships as one deployable: an Express 5 API that also serves the built React single-page app, backed by one PostgreSQL database. Teachers sign in (Better Auth, same-origin cookie session), build a reusable question bank with tags, compose tests from it, and publish them behind a random share link. Students open the link with no account, enter a name, answer, and submit. The API grades the submission server-side and returns a score. Class-score and per-question analytics are computed from stored attempts. There are no background workers, no third-party services in the request path, and no CORS: the browser only ever talks to its own origin.

## Technologies

| Layer | Choice | Version (verified) | Why |
|---|---|---|---|
| Frontend | React + Vite SPA, React Router (library/data router mode); Recharts for analytics charts | React 19.3.1, @types/react 19.3.0, @types/react-dom 19.3.0, Vite 8.3.5, @vitejs/plugin-react 6.2.1, React Router 8.5.1; Recharts 3.10.1 recorded, compatibility not confirmed | No SSR need. A static SPA works on phones and is served by Express, so there is one deployable. |
| Styling | Tailwind CSS with shadcn/ui (Vite path) | Tailwind CSS 4.3.3, @tailwindcss/vite 4.3.3; shadcn/ui setup with Tailwind 4.3 and React 19.3 not confirmed | Fast, mobile-friendly UI without hand-rolling components. |
| Backend | Express, TypeScript (strict) on Node.js LTS; Zod for validation and shared types | Express 5.3.0, @types/express 5.0.6, TypeScript 6.0.3, @types/node 26.6.6, Node.js 26.13.0 LTS, Zod 4.6.7; dev runner tsx 4.23.15; express-rate-limit 8.7.3 and helmet 8.3.0 recorded, not yet installed | Small, well-known REST layer. One language across API, client, and shared schemas. Grading and answer keys stay server-side in `apps/api`. |
| Database | PostgreSQL with Drizzle ORM | PostgreSQL: managed host's current major (not confirmed); Drizzle ORM 0.45.4, drizzle-kit 0.31.11, pg 8.23.1 | Connected data (questions reused across tests, tags) and analytics aggregates are core features. Typed SQL through Drizzle. |
| Authentication | Better Auth, email and password, teachers only | Better Auth 1.7.15 | Avoids owning security-sensitive session code. Students have no accounts. |
| Deployment / Hosting | Railway Hobby with Railway Postgres in the same project; GitHub Actions for CI | $5/month, includes $5 of usage | One vendor for app and database. Express serves the built client and the API under `/api`. |

Supporting tooling (restated from the confirmed stack): Vitest 5.0.5 and Playwright 1.64.1 for tests, Biome 2.6.4 for lint and format.

**Not yet confirmed (prove in early setup tasks, do not treat as settled):**

- express-rate-limit and helmet compatibility with Express 5 (TASK-005).
- Recharts compatibility with React 19.3 (TASK-004).
- shadcn/ui setup with Tailwind 4.3 and React 19.3 (TASK-004).
- React Router 8 API in SPA mode (TASK-004).
- Better Auth mounting on Express 5 (TASK-003).
- Drizzle's peerDependencies could not be read, so Drizzle compatibility with the rest of the stack is unproven (TASK-002).
- Railway Postgres major version, backups, and pricing; Hobby commercial-use terms. Check before storing real student data.

**Proven in TASK-001 (2026-11-03):** the pinned versions exist on the npm registry, and TypeScript, Biome, Vitest, the production build, and `tsx` running Express 5 all work together on Node 26.13.0. `STACK.md` holds the details.

## System Architecture

```
 Browser (teacher or student, phone or desktop)
        │  same origin, HTTPS, no CORS
        ▼
 ┌──────────────────────────── Express 5 (one Railway service) ───────────────────────────┐
 │  /api/auth/*splat   Better Auth (toNodeHandler, mounted BEFORE express.json())          │
 │  /api/teacher/*     requires teacher session; full DTOs incl. answer keys; analytics    │
 │  /api/public/*      no session; share-token routes; student DTOs only                   │
 │  /api/*  (other)    JSON 404, never the SPA fallback                                     │
 │  everything else    static files from apps/web/dist, SPA fallback to index.html         │
 └──────────────┬───────────────────────────────────────────────────────────────────────┘
                │ Drizzle + pg
                ▼
        PostgreSQL (Railway, same project)
```

**Request flows**

- **Teacher:** SPA calls `/api/auth/*` to sign in; Better Auth sets an HttpOnly / Secure / SameSite=Lax cookie. All `/api/teacher/*` calls carry the cookie and are authorized by a session middleware, with every query scoped to the signed-in teacher's id.
- **Student:** SPA opens `/t/<share-token>`, calls `GET /api/public/tests/:token` and receives the student-facing test (question text and options only). For a closed test, the same call returns 200 with the title and `status: closed` only, with no questions, and the allow-list test covers that shape. Unknown and draft tokens return the generic 404. On submit, `POST /api/public/tests/:token/attempts` sends the student name and raw responses. The API grades against the stored snapshot, persists the attempt, and returns a response DTO. A submit to a closed test returns 409, and a submit to a deleted test returns the generic 404.
- **Analytics:** `GET /api/teacher/tests/:id/analytics` and a per-question variant run SQL aggregates over `attempts` and `attempt_answers`. Nothing is precomputed or cached.

**State and boundaries**

- All durable state is in Postgres. The API process is stateless apart from Better Auth's database-backed sessions.
- Everything is synchronous request/response. Grading happens inline in the submit request.
- **Dev:** Vite dev server runs `apps/web`; `server.proxy` forwards `/api` to Express, so the browser still sees one origin.
- **Production:** `npm run build` builds shared, web, and api; Express serves `apps/web/dist`.

> **Assumption:** The route prefixes `/api/teacher` and `/api/public` and the `/t/<token>` client path are this document's proposal. The confirmed constraints are only that the API lives under `/api` and that student and teacher payloads use separate schemas.

> **Assumption:** The Better Auth mounting pattern (`toNodeHandler(auth)` at `/api/auth/*splat` before `express.json()`) comes from the stack advisor's knowledge, not a fetched doc. Confirm it in the first setup task.

### Data model

Designed to support question reuse across tests, tags, attempts, and per-question analytics. Better Auth manages its own tables (user, session, account, verification); the tables below are the app's.

| Table | Key columns | Purpose |
|---|---|---|
| `questions` | `id`, `teacher_id` (FK to Better Auth user), `type` (`multiple_choice`, `multiple_answer`, `true_false`, `short_answer`), `prompt`, `options` (JSONB), `answer_key` (JSONB), `points`, `archived_at`, timestamps | The reusable bank. One row per question, owned by a teacher. |
| `tags` | `id`, `teacher_id`, `name` (up to 50 characters); unique (`teacher_id`, `name`), ignoring case | Topics or tags. |
| `question_tags` | (`question_id`, `tag_id`) | Many-to-many between questions and tags. |
| `tests` | `id`, `teacher_id`, `title`, `status` (`draft`, `published`, `closed`), `share_token` (unique, nullable until published), `published_at` | A test as the teacher edits it. A teacher closes a published test manually to stop new submissions; there are no scheduled windows. |
| `test_questions` | (`test_id`, `question_id`), `position` | Draft composition: the same bank question can appear in many tests. |
| `test_snapshots` | `id`, `test_id` (unique), `content` (JSONB), `created_at` | Frozen copy of a test at publish time (see below). One per test, since re-publishing isn't in the MVP. |
| `attempts` | `id`, `test_id`, `snapshot_id`, `student_name`, `submitted_at`, `score`, `max_score` | One row per student submission. |
| `attempt_answers` | `id`, `attempt_id`, `snapshot_question_key`, `source_question_id` (nullable FK, `ON DELETE SET NULL`), `response` (JSONB, raw as submitted), `awarded_points`, `max_points` | One row per question per attempt, written at grading time. This is the table per-question analytics aggregates over. |

How it supports each need:

- **Reuse across tests:** `test_questions` links one `questions` row to many tests; `source_question_id` records which bank question each answer came from. MVP analytics are per test.
- **Tags:** `tags` plus `question_tags`, with bank filtering by tag. Tags are per-teacher.
- **Attempts:** `attempts` plus `attempt_answers`. The raw `response` is stored so grading rules can be re-run if a rule changes.
- **Per-question analytics:** a question's correct rate is `sum(awarded_points) / sum(max_points)` from `attempt_answers`, calculated per test, so partial credit counts proportionally. Class scores come from `attempts.score` / `max_score`.

**Type-specific fields in JSONB.** `options` holds the student-visible part (for example `[{ "id": "a", "text": "..." }]` for choice types) and `answer_key` holds the grader-only part (for example `{ "correctOptionIds": ["a","c"] }` or `{ "acceptedAnswers": ["..."] }`). They are separate columns on purpose: a student DTO built from `options` can never pick up the key by accident. Zod schemas in `packages/shared` validate the JSONB shape per `type` on every read and write.

**Published test snapshots.** On publish, the API writes a `test_snapshots` row whose `content` holds each question's prompt, options, answer key, and points as they were at that moment, each with a stable `snapshot_question_key` and its `source_question_id`. Students are served and graded from the snapshot, never from the live `questions` rows.

**Column types and deletion.** `score`, `max_score`, `points`, `awarded_points`, and `max_points` are `numeric`, because partial credit produces fractions. Awards are calculated from the totals (points × net correct options ÷ correct options) so a full score stays exact, and values are rounded only for display. A question's `type` can't change after creation, and a test has at most 100 questions with no repeats. A teacher can delete one attempt, or a whole test. Deleting an attempt cascades to its `attempt_answers`, and deleting a test cascades to its `test_questions`, snapshot, attempts, and their answers. Analytics are computed live, so they update after a deletion. Closing a test is one-way.

**Deleting a bank question** sets `archived_at` rather than removing the row. Archived questions are hidden from the bank and can't be added to tests, and the publish service rejects a draft that still contains one. Published tests aren't affected, because they use their snapshot.

> **Assumption:** JSONB for type-specific options and published test snapshots is used because it fits this model (one deployable, no extra store, varied question shapes). It was a suggestion in the stack decision, not a confirmed decision; revisit if you prefer fully relational option tables.

Editing a bank question after a test is published does not change that published test or any past result, and a published test can't be re-published or synced (both confirmed in the PRD).

> **Assumption:** `points` defaults to 1 per question. Points are set in the bank, with no per-test override (the no-override part is confirmed in the PRD).

**How the design carries the confirmed product behaviours** (see the PRD's Product Decisions):

- **Score only for students:** the submit response is its own schema in `packages/shared`, holding score and max score only. Adding per-question correctness later would be an additive field on that schema plus an allow-list entry; `attempt_answers` already holds what it needs.
- **Every repeat submission is kept:** there is deliberately no unique constraint on (`test_id`, `student_name`). Teachers see each submission by name and time, and analytics count each one. Changing this policy later needs no migration.
- **Exact-match normalization:** trim, collapse internal whitespace, and compare case-insensitively against each of the question's accepted answers, isolated in one pure function in the grading module. The raw `response` is stored, so a rule change is a code change plus an optional regrade.
- **Partial-credit formula:** equal share per correct option selected, equal penalty per incorrect option selected, floored at zero, isolated in one pure function in the grading module. `awarded_points` is stored per answer, so a formula change is a code change plus an optional regrade.

## Folder Structure

Repo shape: **single repo, small npm workspace, no Turborepo or Nx.** Discovery asked Claude to recommend; the confirmed stack decision chose this. Reasons: one solo builder, one deployable, and shared Zod schemas need a package boundary that keeps student and teacher payload types out of each other's way. A single package with `client/` and `server/` is the credible fallback.

```
gradelink/                      # = output/gradelink/ (the project root)
├── docs/                       # planning docs (PRD, ARCHITECTURE, STACK, DECISIONS, ...)
├── CLAUDE.md                   # project instructions for Claude Code
├── .claude/                    # agents/ and skills/ for this project
│   ├── agents/
│   └── skills/
├── .github/
│   └── workflows/
│       └── ci.yml              # typecheck, Biome, Vitest, build, Playwright (Postgres service container)
├── apps/
│   ├── api/                    # Express 5, Drizzle, Better Auth, grading
│   │   ├── src/
│   │   │   ├── index.ts        # process entry: load env, start server
│   │   │   ├── app.ts          # builds the Express app (auth mount, routers, static + SPA fallback)
│   │   │   ├── auth.ts         # Better Auth instance
│   │   │   ├── db/
│   │   │   │   ├── client.ts   # pg pool + Drizzle instance
│   │   │   │   └── schema.ts   # Drizzle tables
│   │   │   ├── routes/
│   │   │   │   ├── teacher/    # session-protected routers (questions, tags, tests, analytics)
│   │   │   │   └── public/     # share-token routers (fetch test, submit attempt)
│   │   │   ├── dto/            # explicit student response DTO mappers (allow-listed fields)
│   │   │   ├── services/       # business logic called by routes (tests, snapshots, analytics)
│   │   │   ├── grading/        # ONLY place grading lives (score, normalize, partial credit)
│   │   │   └── middleware/     # requireTeacher, error handler, validation
│   │   ├── drizzle/            # generated SQL migrations (drizzle-kit)
│   │   ├── test/               # Vitest: grading, services, student payload allow-list test
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                    # Vite + React + React Router SPA
│       ├── src/
│       │   ├── main.tsx
│       │   ├── routes/         # route components: teacher/ and student/
│       │   ├── components/     # UI components (shadcn/ui under components/ui/)
│       │   ├── lib/
│       │   │   └── api.ts      # the only module that calls fetch against /api
│       │   └── styles.css      # Tailwind entry
│       ├── e2e/                # Playwright: teacher creates, student submits (mobile viewport)
│       ├── index.html
│       ├── vite.config.ts      # React + Tailwind plugins, server.proxy for /api
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/                 # Zod schemas and inferred types, no runtime deps on api or web
│       ├── src/
│       │   ├── student/        # student-facing schemas (no answer keys)
│       │   ├── teacher/        # teacher-facing schemas (full questions, keys, analytics)
│       │   ├── common/         # enums and primitives (question type, ids)
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── package.json                # npm workspaces: ["apps/*", "packages/*"], root scripts, engines
├── tsconfig.base.json          # strict TypeScript settings shared by all packages
├── biome.json
├── .nvmrc                      # Node 26.x
├── .env.example                # DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
└── .gitignore
```

> **Assumption:** The file layout inside `apps/api/src` and `apps/web/src`, the `test/` and `e2e/` locations, and the env var names are this document's proposal. The confirmed parts are the three workspaces (`apps/api`, `apps/web`, `packages/shared`) and the separate student-facing and teacher-facing schemas in `packages/shared`.

### Adding a new feature

Illustrative worked example, not an MVP requirement: "teachers can rename a tag."

1. **Shared contract:** add the request and response schemas to `packages/shared/src/teacher/` and export them from `index.ts`. If students would ever see any of it, that is a separate schema in `student/`, never a reuse of the teacher one.
2. **Database:** if new columns or tables are needed, edit `apps/api/src/db/schema.ts` and run drizzle-kit to generate a migration into `apps/api/drizzle/`. (Renaming needs none.)
3. **Service:** add `renameTag` to `apps/api/src/services/`, doing the Drizzle work scoped by `teacher_id`.
4. **Route:** add `PATCH /api/teacher/tags/:id` in `apps/api/src/routes/teacher/`, validating input with the shared schema and calling the service. No logic in the handler beyond that.
5. **Client:** add a function to `apps/web/src/lib/api.ts` that parses the response with the shared schema, then a control in the bank screen under `apps/web/src/routes/teacher/`.
6. **Tests:** a Vitest test for the service in `apps/api/test/`. If the feature touches a student route, extend the allow-list test.

## Architectural Rules

Security-adjacent rules follow OWASP ASVS and OWASP Session Management guidance, and NIST SP 800-63B for authentication. *Not yet checked against an internal standard; verify before implementation.*

1. **Grading code lives only in `apps/api`** (`apps/api/src/grading/`). `apps/web` and `packages/shared` must not contain scoring, normalization, or answer-comparison logic, and must never import from `apps/api`.
2. **Student routes return explicit response DTOs.** Every `/api/public/*` response is built by a mapper in `apps/api/src/dto/` that copies named fields. There are three student response shapes, each with a schema in `packages/shared/src/student/`: open test content (question text and options only), the closed-test response (title and status only), and the submit response (score and max score only). Database rows and snapshot objects must never be serialized directly to a student.
3. **A Vitest test fails on any student payload field that is not allow-listed.** It exercises each `/api/public/*` response and compares its field paths to an explicit allow-list. Adding a student-visible field requires editing that list in the same change.
4. **Share tokens are random and at least 128 bits.** Generate them with `node:crypto` (`randomBytes(16)` or longer, URL-safe encoding). Never derive them from ids, titles, or timestamps, and never use `Math.random`.
5. **Student-facing and teacher-facing schemas are separate in `packages/shared`** (`student/` and `teacher/`). Student schemas must not extend or import from teacher schemas.
6. **Sessions are same-origin with no CORS.** Do not add the `cors` package or CORS headers. In dev, use Vite `server.proxy`, not cross-origin requests.
7. **Express serves the built client and the API under `/api`.** All API routes are mounted under `/api`; unknown `/api/*` paths return a JSON 404, never the SPA fallback.
8. **Mount `toNodeHandler(auth)` at `/api/auth/*splat` before `express.json()`.** (Pending the confirmation noted above.)
9. **Route handlers contain no business logic or direct SQL.** They validate input with shared Zod schemas and call a service. Only `services/` and `db/` import Drizzle.
10. **UI components must not call `fetch` or contain data access.** Only `apps/web/src/lib/api.ts` talks to the API, and it parses every response with a shared schema.
11. **Every `/api/teacher/*` route requires a teacher session, and every query is scoped to that teacher's id.** Ownership checks happen in the service layer, not the client.
12. **Published tests are served and graded from their snapshot,** never from live `questions` rows.
13. **No business logic in migration files.** Migrations change schema only.
14. **Answer keys never leave the database except in teacher routes and the grader.** `answer_key` columns and snapshot keys are never selected for student DTO construction.

## Notes

**Assumptions made here (also marked inline):**

- Versions were carried over from the stack decision and rechecked against the registry in TASK-001.
- Route prefixes (`/api/teacher`, `/api/public`) and the `/t/<token>` client path.
- Folder layout inside the apps, test locations, and env var names.
- JSONB for type-specific options and published test snapshots.
- Default of 1 point per question.
- Better Auth mounting pattern is from advisor knowledge, not a fetched doc.

**Revisit before build starts:**

- The unconfirmed stack items listed under Technologies, each proven in an early setup task.
- Railway Hobby commercial-use terms, backups, and Postgres major version, before storing real student data.
- Student data privacy: discovery noted that SECURITY.md will cover it. Student names are stored with attempts and kept until the teacher deletes them (see the PRD's Product Decisions).
