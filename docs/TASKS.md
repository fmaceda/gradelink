# Tasks — GradeLink

Phases follow the build order confirmed in PRD.md (MVP): prove the unproven stack, a thin end-to-end slice, more question types and tags, the test lifecycle and data controls, analytics last, then production readiness. Each task is sized for one weekend session or less. Security and design requirements sit inside the task they belong to; there is no separate "security" or "polish" phase.

## Phase 1: Setup and stack proof

### TASK-001: Workspace, toolchain, and version recheck

Create the npm workspace (`apps/api`, `apps/web`, `packages/shared`), `tsconfig.base.json` (strict), `biome.json`, `.nvmrc` (26.x), `engines`, `.gitignore` (`.env`, `node_modules`, `dist`, local Claude settings), and `.env.example` with placeholder values only. Recheck every version in STACK.md against the npm registry (`npm view <pkg> version` and `peerDependencies`), not changelogs or search results: pin the exact TypeScript 6.0.x patch (`npm view typescript@6.0 version`), pin `@types/node` against Node 26.13, and record express-rate-limit, helmet, and Recharts versions. Prove the tools work together by running them: `tsc --noEmit` on the pinned TypeScript, `biome check` against that language version, a Vitest smoke test, and `tsx` starting a hello-world Express 5 app. Commit `package-lock.json`. Update STACK.md and ARCHITECTURE.md with what was proven or disproven.

**Story:** As a developer, I want the workspace and every stack version proven by running the tools on Node 26, so that later tasks build on a reproducible base.

**Acceptance criteria:**

1. `node -v`, `.nvmrc` and `engines` all agree on Node 26.x.
2. `npm view <pkg> version` and `peerDependencies` have been run for every package in STACK.md. STACK.md shows each verified version or discrepancy, and each "not confirmed" item is marked proven, disproven, or pending with its owning task.
3. `typescript` is pinned to the exact 6.0.x patch from `npm view typescript@6.0 version`, with no `~`. `@types/node` is pinned against Node 26.13, and `npm ls @types/node typescript` shows one version of each.
4. Versions and peer ranges for `express-rate-limit`, `helmet` and Recharts are recorded in STACK.md, and none of them is installed.
5. These proofs pass, and each command and result is recorded: `npm run typecheck` exits 0; `npm run lint` exits 0; `npm test` runs at least one real test, so it doesn't pass only through `--passWithNoTests`; `tsx` starts a hello-world Express 5 app, and a request to it returns 200.
6. `package-lock.json` is committed, and `npm ci` succeeds from a clean state on Node 26.13.
7. `.env.example` holds placeholders only, and `git ls-files` doesn't list `.env`.
8. STACK.md and ARCHITECTURE.md record what was proven, including the Node 22 / npm 10.9.8 crash as "cause unverified, not reproduced on Node 26.13.0 / npm 11.20.0".

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-002: Postgres, Drizzle, and env module

Get a local Postgres running and prove Drizzle ORM 0.45.4, drizzle-kit 0.31.11, and pg 8.23.1 work together: read their `peerDependencies` from the registry, install, generate and apply a trivial migration, run a query. Add `db/client.ts` (limited pool size) and a single `env.ts` that parses `process.env` with Zod at startup, fails fast on missing values, gives secrets no defaults, and refuses to start in production if `BETTER_AUTH_SECRET` is missing or a known placeholder. Record the result in STACK.md.

**Story:** As a developer, I want a local Postgres, a working Drizzle toolchain and one fail-fast env module, so that later tasks can store data and read config safely.

**Acceptance criteria:**

1. Peer dependencies for `drizzle-orm`, `drizzle-kit` and `pg` are recorded in STACK.md, and `npm ls` shows none unmet or invalid.
2. Local Postgres runs, its start command is documented, and a query through Drizzle succeeds.
3. `db:generate` creates a committed SQL file, `db:migrate` applies it, and a second run changes nothing. `drizzle-kit push` isn't used.
4. `db/client.ts` sets an explicit small pool `max`, reads config only from `env`, and never uses `rejectUnauthorized: false`.
5. `env.ts` parses `process.env` once with Zod at startup, and secrets have no defaults. A missing value exits non-zero, and the error names the variable but not its value. Unit tests cover this.
6. With `NODE_ENV=production`, a missing, empty or known-placeholder `BETTER_AUTH_SECRET` stops startup, and a real value starts normally.
7. A search finds `process.env` only in `env.ts`, plus any exception agreed for `drizzle.config.ts`.

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-003: Prove Better Auth on Express 5 and set the auth config

Mount `toNodeHandler(auth)` at `/api/auth/*splat` before `express.json()` and confirm sign-up, sign-in, session lookup via `auth.api.getSession` with `fromNodeHeaders`, and sign-out (deletes the server-side session row). Confirm against Better Auth 1.7.15 that each option SECURITY.md names exists and works: `minPasswordLength: 15`, explicit cookie attributes (HttpOnly, Secure, SameSite=Lax), finite session lifetime and idle refresh, built-in rate limiting on `/api/auth/*`, trusted origins set to the app origin only, `baseURL` and `secret` from env, and a generic wrong-credentials error. Check whether a breached-password hook exists; if not, record it as a known gap. Test that a 14-character password is rejected and a 15-character one is accepted. Test environment is configured, not rate-limiting-disabled. Update ARCHITECTURE.md rule 8 and SECURITY.md notes with the result.

**Story:** As a teacher, I want to create an account, sign in, stay signed in and sign out securely, so that my questions and results are only reachable by me.

**Acceptance criteria:**

1. `toNodeHandler(auth)` is mounted at `/api/auth/*splat` before `express.json()`, and a test confirms the sign-up body isn't consumed by it. The Better Auth tables come from a generated migration, and ARCHITECTURE rule 8 is updated.
2. Sign-up creates a user, and sign-in returns a cookie. `auth.api.getSession` with `fromNodeHeaders` returns the user with that cookie and null without it. Sign-out deletes the session row, and replaying the old cookie returns no session.
3. A 14-character password is rejected and a 15-character one is accepted. A password of 64 or more characters with spaces is also accepted.
4. Cookies are HttpOnly and SameSite=Lax, with `Secure` on in production. `expiresIn` and `updateAge` are finite and recorded, and the session token rotates on sign-in.
5. Repeated wrong sign-ins return 429 with rate limiting left on in tests. `trustedOrigins` contains only the app origin and rejects a foreign `Origin`. `baseURL` and `secret` come from `env.ts`.
6. A wrong password and an unknown email return the same status and body, and a duplicate email creates no second user.
7. A breached-password hook is either wired with a test or recorded as a known gap in SECURITY.md.
8. ARCHITECTURE and SECURITY are updated with the results, and production-only checks stay unticked.

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-004: Prove the web stack (React Router 8, Tailwind 4.3, shadcn/ui, Recharts) and Express serving the SPA

Stand up `apps/web` with Vite, React 19.3, React Router 8 in library/data mode (`createBrowserRouter` plus loaders and actions, no framework-mode features), Tailwind 4.3 via `@tailwindcss/vite` with an `@theme` block holding the DESIGN.md tokens, and shadcn/ui through its CLI (try Button, Dialog, Sheet). Add the Vite `server.proxy` for `/api`. In `apps/api/src/app.ts`, serve `apps/web/dist` with SPA fallback, and make unknown `/api/*` return a JSON 404, never the SPA fallback. Separately, in a throwaway scratch project or branch, install Recharts and render one chart under React 19.3 to prove compatibility; do not add Recharts to the repo yet. If shadcn/ui or Recharts fails, record the fallback from DESIGN.md (plain Tailwind elements, table-only analytics) and update the affected docs.

**Story:** As a developer, I want the web stack and Express serving the built SPA proven by running them, so that teacher and student screens start from a known-good base.

**Acceptance criteria:**

1. Router: `apps/web` uses `createBrowserRouter` and `RouterProvider` with no framework-mode features. At least one `loader` and one `action` work in the browser, and an unknown client path doesn't render a blank page. The import path and API shape are recorded in `docs/STACK.md`.
2. Tailwind: `styles.css` has `@import "tailwindcss"` and an `@theme` block with the `docs/DESIGN.md` tokens. There's no `tailwind.config.js`, PostCSS config or `@tailwind` directive, and a built page shows a token colour correctly.
3. shadcn/ui: it's added through its CLI under `src/components/ui/`. Button, Dialog and Sheet render, Dialog and Sheet close with Escape, and there are no console errors or peer warnings.
4. Quality gates: typecheck, lint and build pass with the new files.
5. Proxy: a real API request through Vite's `/api` proxy returns the API's response, and the target matches the API's port.
6. Dev origin (trusting `localhost:5173` is already done): sign-in through the proxy succeeds and sets an HttpOnly, SameSite=Lax, non-Secure cookie, and a foreign `Origin` gets 403. A Vitest case covers the development branch, and the proxy half is a recorded manual check.
7. Express serving: `createApp()` serves `apps/web/dist`, with `index.html` as the fallback for GET and HEAD on non-`/api` paths, including `/` and `/t/<token>`. A missing file under `/assets/` gets a 404, not `index.html`. Any method on an unknown `/api/*` path gets a JSON 404, never HTML. The order is auth, `express.json`, routers, `/api` 404, static files, fallback.
8. Tests use a fixture directory rather than the real build, because CI tests run before `npm run build`. The API also starts and works with no `dist`.
9. `/api/hello` is removed, and `smoke.test.ts:22` and `auth.test.ts:157` are replaced.
10. Recharts: one chart is rendered under React 19.3.1 in a scratch project, with the version, peer ranges and result recorded. It isn't added to the repo.
11. Docs: `docs/STACK.md`, `docs/ARCHITECTURE.md`, `docs/BEST_PRACTICES.md` and `CLAUDE.md` are updated. If shadcn or Recharts fails, the `docs/DESIGN.md` fallback is recorded.

**Decisions (accepted 2026-11-03):**

- The proof `loader` and `action` go through `lib/api.ts`, calling an existing route such as `/api/auth/get-session` with a temporary local Zod schema, or use in-memory data. No endpoint schemas in `packages/shared` yet, and no `fetch` in route modules.
- The Vite proxy reads `PORT` with a 3000 fallback, recorded as a BP-044 exception, and `strictPort: true` is set.
- Biome formats the generated shadcn files; they aren't excluded.
- The `@/` alias uses tsconfig `paths` without `baseUrl`, with a matching Vite `resolve.alias`. Confirm that shadcn's CLI accepts it.
- The API serves `dist` whenever it exists, with no `NODE_ENV` check.
- Unknown `/api/auth/*` paths keep Better Auth's own response shape (ARCHITECTURE rule 7). A test proves the response is JSON and never HTML.
- The JSON 404 test also covers a wrong method on a known path. TASK-037 confirms this across all routes.

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-005: API hardening baseline (helmet, rate-limit plumbing, body limit, error handler)

Verify helmet and express-rate-limit versions work with Express 5 by running them. Wire helmet with a CSP that allows no `unsafe-inline` script and a referrer policy that does not leak `/t/<token>` URLs; no `cors` package. Set `express.json({ limit })` to 100 KB after the auth mount, returning 413 when exceeded, and accept only `application/json` on body routes. Add the shared validation middleware (Zod over body, params, query), a typed `AppError`, and one last four-argument error handler returning `{ error: { code, message } }` with no stack traces, SQL, or snapshot content. Add request logging of method, route pattern (for example `/api/public/tests/:token`, never the raw URL), status, and request id only (no bodies, cookies, tokens, or keys). Set `trust proxy` from an env value. Actual per-route limits come in TASK-022.

**Story:** As a developer, I want safe defaults for headers, bodies, validation, errors and logging, so that every later route inherits them and can't leak stack traces, SQL, answer keys or share tokens.

**Acceptance criteria:**

1. Install proof: helmet 8.3.0 and express-rate-limit 8.7.3 install with no invalid peers, and a real request through each works on Express 5.3.0. Results are recorded in `docs/STACK.md` and `docs/ARCHITECTURE.md`.
2. helmet runs before the auth mount. The CSP has no `unsafe-inline` in `script-src`, and the referrer policy doesn't leak `/t/<token>` URLs. Tests check the headers on an API response and on the SPA fallback, and no CORS headers are set.
3. Body limit (the 100 KB limit is already set): a body just under the limit is accepted, one over gets a JSON 413, and malformed JSON gets a JSON 400 with no parser detail.
4. Content type: a body that isn't `application/json` is rejected with a JSON error, while bodyless POSTs and `/api/auth/*` still work.
5. Errors: `AppError` carries a status, code and safe message, and one last four-argument handler returns `{ error: { code, message } }`. A test throws an error containing a fake token, SQL and a stack, and none of it reaches the response or stderr. A Drizzle-style error is logged by code only.
6. Headers already sent: the handler ends the response and never calls `next(error)`.
7. Validation: Zod middleware covers body, params and query. Failures return a JSON 400 with no echoed values, and handlers get parsed values without `as` casts.
8. Request logging: one line per request, holding only method, route pattern, status and a server-generated request ID. A test sends a fake token, body, cookie and `Authorization` header, and none of them appear in the log. Unmatched paths log a fixed pattern, and no IP is logged.
9. `trust proxy` comes from one parsed value in `env.ts` with a safe default. Tests show how it changes `req.ip`, and the variable is added to `.env.example` and CI.
10. Rate-limit plumbing: no per-route limits yet. Any factory returns the shared 429 body and never counts `/api/auth/*`, which already has Better Auth's own limiter with different thresholds.
11. Vitest covers all new behaviour, and tests, typecheck and lint pass.

**Decisions (accepted 2026-11-03):**

- Deleting or wrapping `handleAuthError` is the developer's choice. Unexpected `/api/auth/*` failures still return the generic 500 and log only a code.
- `TRUST_PROXY` is a non-negative integer, default 0, and anything else is rejected. TASK-038 sets Railway's value.
- Error bodies may carry an optional `fields` entry for validation messages. Messages never include submitted values, the schema lives in `packages/shared`, and public routes allow-list it.
- One shared enum of error codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `NOT_FOUND`, `TEST_CLOSED`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `RATE_LIMITED`, `INTERNAL_ERROR`.
- `AppError` lives in `apps/api/src/errors.ts`, importing nothing from Express.
- `style-src` allows `unsafe-inline` only if a check proves Radix needs it, with the reason and check recorded in `docs/SECURITY.md`. HSTS and `upgrade-insecure-requests` are off outside production, and a test proves production sends them.
- `X-Request-Id` is optional. If added, it holds the server-generated ID and never an incoming header.
- The rate-limit factory is optional. If added, it is tested and stays unmounted until TASK-022.
- All app logs go to one destination, `process.stderr.write`, with no new logging dependency.
- `writeAuthLog` handles non-string messages without printing their text, and strips control characters.
- Better Auth's own 500s, including the breached-password service being down, get a code-only log line.
- Router mount paths stay static (BP-046).

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-006: CI, secret scanning, and dependency audit

Add `.github/workflows/ci.yml`: `npm ci`, typecheck, Biome, Vitest, build, with a Postgres service container using throwaway credentials. Add secret scanning (gitleaks in CI or GitHub push protection) and run `npm audit`, recording any deferred high or critical finding in MEMORY.md. Playwright joins CI in TASK-021.

**Story:** As a developer, I want CI to also scan for secrets and audit dependencies, so that a leaked secret or vulnerable package can't merge unnoticed.

**Acceptance criteria:**

1. Already done: `ci.yml` runs `npm ci`, typecheck, Biome, `db:migrate`, Vitest and build, using throwaway Postgres credentials, and it has passed on GitHub. New: remove the stale lockfile comment at `ci.yml:36`.
2. Secret scanning runs on every PR and push across full history. A fabricated secret on a throwaway branch makes it fail, and the committed placeholders pass through a narrow allow-list with a reason per entry.
3. `npm audit` runs in CI against the tree after TASK-004 and TASK-005. The step fails on high and critical findings, which are fixed or deferred in `docs/MEMORY.md` with the deferred advisory IDs named in the workflow, and the 4 moderate `drizzle-kit` findings stay recorded.
4. CI stays green on `main`, uses only throwaway values, and doesn't include Playwright.

**Decisions (accepted 2026-11-03):**

- Secret scanning uses the gitleaks Action in CI, after verifying its licence terms for a personal account. Push protection may run alongside it.
- The allow-list is a committed `.gitleaks.toml` targeting only the committed placeholders, with a comment per entry and no broad paths or regexes.
- Drop `--passWithNoTests` from `apps/api/package.json`. Check that `npm test` still works if `apps/web` has no tests, and keep the flag on web only if needed.
- The workflow sets `permissions: contents: read` and pins actions to major tags or SHAs, with the reason recorded.
- `postgres:17` stays until TASK-039 confirms Railway's version.
- Changed 2026-11-25 (owner): CI runs the gitleaks CLI image (v8.30.1, pinned by digest) in its own `secret-scan.yml`, not gitleaks-action. On push and PR events the action scans only that event's commits, and criterion 2 needs the full history on every run. Details are in `docs/STACK.md`.

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

## Phase 2: Thin end-to-end slice (multiple choice and true/false)

### TASK-007: Core database schema and first migration

Drizzle tables for `questions`, `tests`, `test_questions`, `test_snapshots`, `attempts`, and `attempt_answers` per ARCHITECTURE.md: `numeric` for points and scores, `timestamptz` timestamps, JSONB columns typed with `.$type<T>()`, `source_question_id` with `ON DELETE SET NULL`, cascades from test to its children and from attempt to its answers, unique `share_token`, no unique constraint on (`test_id`, `student_name`), and the indexes BP-017 lists. Generate and commit the migration. Tags tables come in TASK-027.

**Order (accepted 2026-11-25):** Do this task after TASK-008. BP-016 says JSONB `.$type<T>()` takes `T` from the shared schema, so the schemas have to exist first. The numbering stays as it is.

**Story:** As a developer, I want the six core tables defined in Drizzle with a generated, committed migration, so that the question, test and attempt features have a typed, indexed schema that cascades correctly.

**Acceptance criteria:**

1. Migrations `0000`/`0001` (the `stack_proof` create and drop) and `0002` (auth) are squashed into one clean baseline, in its own `chore:` commit. This is allowed only because no shared or Railway database has applied them (owner confirmed 2026-11-25). Local databases are reset. `docs/STACK.md` records the squash, and the TASK-002 migration known issue in MEMORY.md is closed.
2. `db/schema.ts` defines `questions`, `tests`, `test_questions`, `test_snapshots`, `attempts` and `attempt_answers` with ARCHITECTURE.md's columns, including `questions.archived_at`. Primary keys are `uuid` with `defaultRandom()`. Each `teacher_id` is `text` and references `user.id`.
3. `points`, `score`, `max_score`, `awarded_points` and `max_points` are `numeric`. A test inserts `0.5` and reads back exactly `0.5` (BP-033).
4. All timestamps are `timestamptz` (BP-018). Each JSONB column (`options`, `answer_key`, snapshot `content`, `response`) uses `.$type<T>()`, with `T` inferred from the TASK-008 shared schemas (BP-016).
5. `type` is `text` with a CHECK constraint for the four question types: `multiple_choice`, `multiple_answer`, `true_false`, `short_answer`. `status` is `text` with a CHECK for `draft`, `published`, `closed`. A test shows the database rejects any other value.
6. `test_questions` has the composite primary key (`test_id`, `question_id`), which enforces no repeats. `position` is an integer, read in ascending order. There's no unique (`test_id`, `position`) index yet.
7. `attempt_answers.snapshot_question_key` is a column. The same key appears inside each question entry in `test_snapshots.content`.
8. The foreign keys work as follows, and a database test checks both deletes:
   - `source_question_id` is `ON DELETE SET NULL`.
   - Deleting a test deletes its `test_questions`, its snapshot, its attempts and their answers.
   - Deleting an attempt deletes its answers.
9. `share_token` is unique, and `test_snapshots.test_id` is unique. There's no unique constraint on (`test_id`, `student_name`): two attempts with the same name both insert (BP-030).
10. These BP-017 indexes exist:
    - `teacher_id` on `questions` and `tests`
    - `test_id` and `snapshot_id` on `attempts`
    - `attempt_id` and `source_question_id` on `attempt_answers`
    - `share_token`
11. The generated migration is committed. It holds schema statements only and applies cleanly to a fresh database with `db:migrate`. Running generate again produces nothing new (BP-015).
12. There are no tags tables, services, routes or share-token generation. ARCHITECTURE.md's Data model records the uuid primary keys, the CHECK constraints and the `position` rules.

**Decisions (accepted 2026-11-25, from the Product Owner's suggestions):** uuid primary keys. `text` plus CHECK rather than `pgEnum`, because it's easier to change later. Squash before any shared database exists.

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-008: Shared Zod schemas for multiple choice and true/false

In `packages/shared`: `common/` (question type enum, ids), `teacher/` (full question with answer key, test, request bodies as `z.strictObject`), and `student/` (the three response shapes: open test content, closed-test response, submit response; plus the strict submit request). Question types as a discriminated union on `type`, with only `multiple_choice` and `true_false` for now. Include length caps: prompt and option text, name 1-80 after trim with control characters rejected, option counts. Student schemas must not import from `teacher/`; add a test that enforces it. Add a single shared score formatter: points to at most 2 decimals, percentages to 1 decimal.

**Order (accepted 2026-11-25):** This task runs before TASK-007, whose JSONB column types come from these schemas.

**Story:** As a developer, I want shared Zod schemas and one score formatter, so that the API, the client and JSONB validation share one contract, and student types can never carry an answer key.

**Acceptance criteria:**

1. `common/` has:
   - the question-type enum with all four values
   - the uuid id schemas (`z.uuid()`)
   - the short option-id schema, for ids like `"a"` that are unique within one question

   Question shapes are a `z.discriminatedUnion("type")` of `multiple_choice` and `true_false` only. A test shows `short_answer` and `multiple_answer` bodies are rejected until TASK-024 (BP-007).
2. True/false uses fixed True/False options with `correctOptionIds`, the same shape as multiple choice, so grading and the unknown-option rule work the same way for both.
3. `teacher/` has the full question with its answer key, the test, and request bodies as `z.strictObject` (BP-006). Tests show that:
   - `teacher_id` or any other extra key is rejected
   - a multiple-choice question needs exactly one correct option and 2 to 10 options
   - option text that repeats within a question, after trimming and ignoring case, is rejected
   - points of 0, below 0 or non-numeric are rejected, `0.5` is accepted, and the default is 1
4. The caps are prompt 1–1000 characters, option text 1–200 and title 1–100. Each is tested at its limit and one past it, and the values are recorded in TEST_PLAN.md in place of the line-40 note. Prompts reject control characters except newline. Option text and titles are single-line and reject all control characters.
5. The person-name schema trims, needs 1–80 characters after trimming and rejects control characters: `"  Ana  "` becomes `Ana`, a name of only spaces is rejected, 80 characters pass and 81 fail.
6. `student/` has the open-test content, the closed-test response (title and status only), the submit response (score and max score only) and a strict submit request. Each answer in the request is an array of option ids for its question. The number of answers, the ids per answer and the name length are capped. No student schema has an answer-key field, and student options are `{ id, text }` only.
7. A Vitest test fails if anything in `student/` imports from `teacher/`, directly or through re-exports (ARCHITECTURE.md rule 5). A one-off violating import, not committed, shows the test catches it.
8. The score formatter lives in `common/`. It writes points with at most 2 decimals and percentages with 1. Table tests cover `0.5`, `1/3`, `2.005`, `66.666…`, `0`, `100` and `0.1+0.2`. It only formats: it doesn't compute or grade (ARCHITECTURE.md rule 1). The API computes percentages.
9. A test covers the `fields` output for an invalid discriminated-union body. Extending `unwrap` in `validate.ts` belongs to TASK-011.
10. Everything is exported from `index.ts` with `.ts` imports and `z.infer` types. Typecheck and build pass, and the API imports shared at runtime. As an early check, Vite and `tsc` resolve one shared import from `apps/web`. The full web check stays with TASK-010.

**Decisions (accepted 2026-11-25, from the Product Owner's suggestions):**
- caps as listed
- 2 to 10 options, with duplicate text rejected
- fixed True/False options
- short option ids generated by the API
- an array of option ids per answer
- the newline exception for prompts only
- the formatter in `common/`

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-009: requireTeacher, teacher-scoping helpers, and the two-teacher test harness

Build `requireTeacher` (session via `auth.api.getSession` with `fromNodeHeaders`, teacher id on typed `res.locals`) and mount all `/api/teacher/*` behind it. Build the Vitest harness that creates two teacher accounts, signs both in, and offers a helper asserting that teacher B gets 404 (not 403) for teacher A's resource. This is the seed of the cross-teacher isolation test; every later teacher route adds cases to it in the same task.

**Story:** As a developer, I want one `requireTeacher` middleware, teacher-scoping helpers and a two-teacher harness, so that every later teacher route is authenticated, scoped to its owner, and tested for cross-teacher leaks from day one.

**Acceptance criteria:**

1. `requireTeacher` (`middleware/require-teacher.ts`) gets the user only through `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` and puts the teacher id on a typed `res.locals` (BP-012). Sending `x-teacher-id` or `teacher_id` has no effect. Teachers with an unverified email are allowed through, because email verification is out of the MVP.
2. A missing, garbage, expired or signed-out cookie gets 401 `UNAUTHENTICATED` in the shared error shape. Replaying a cookie after sign-out also gets 401.
3. The middleware is mounted statically at `/api/teacher`, before an empty `routes/teacher/index.ts` (BP-046), and affects nothing else. A signed-out `/api/teacher/nope` gets 401. A signed-in one gets a JSON 404. The stale "from TASK-008 on" comment in `routes/index.ts` is fixed.
4. The owned-resource lookup helper lives in `services/`. It can't be called without a `teacherId`, which always goes in the `where` clause. Another teacher's row gives the same `AppError(404, "NOT_FOUND")` as an id that doesn't exist (BP-031).
5. The harness (`apps/api/test/support/`) signs up and signs in two teachers through the real Better Auth endpoints. It uses a distinct IP per sign-up and mocks the breached-password check, as `auth.test.ts` does. Cleanup runs in `finally` even when a test fails, and rate limits and origin checks stay on.
6. `expectNotFoundForOtherTeacher` asserts that teacher A succeeds and teacher B gets a 404 whose body is identical to the 404 for a missing id, never 403. It's proven with probe routes: a scoped probe passes, and an unscoped probe makes the helper fail.
7. A short note explains how later tasks add cases. The route-inventory check is left to TASK-037.
8. Rejected-session logs contain no cookie, token or session id (BP-043).

**Decisions (accepted 2026-11-25, from the Product Owner's suggestions):** probe routes rather than domain tables. The helper goes in `services/`. Cross-teacher 404 bodies must be identical to missing-id 404 bodies. Unverified email is allowed.

- [x] Implement
- [x] Test
- [x] Review
- [x] Complete

### TASK-010: Teacher sign-in, create-account, and app shell (web)

Sign-in and create-account pages with button loading state, inline errors focused on the first invalid field, and the generic "Email or password is incorrect" message. Teacher shell: top bar with Questions and Tests links, user menu with sign out, shadcn Sheet menu below `md`, `aria-current` on the current page, signed-out redirect. Registering with an already-used email shows a visible error and creates no second account. Build `lib/api.ts` as the only `fetch` module with relative `/api` paths and schema-parsed responses. Check at 360 px.

**Story:** As a teacher, I want to create an account, sign in and out, and move around a Questions/Tests shell that works on my phone, so that my question bank and tests are mine and I can reach them from any device.

**Acceptance criteria:**

1. The sign-in page has email and password, with always-visible labels, 44 px inputs and 16 px text. The button reads "Signing in..." and is disabled while pending (BP-021). Success lands on Questions. The page has no app navigation.
2. A wrong password and an unknown email show the identical "Email or password is incorrect". A network failure shows a separate inline error, and the button leaves its loading state. Errors have text and an icon, are announced via `aria-live`, and are linked with `aria-describedby`.
3. The create-account page has email and password only. The password needs at least 15 characters, accepts 64+ with spaces, and has no composition rules. The limits come from `@gradelink/shared`. An invalid field shows an inline error, and focus moves to the first invalid field. The server stays the boundary.
4. Create-account server errors:
   - An already-used email shows a visible error and creates no second account.
   - A breached password, an outage of the breach-check service, and a 429 each show a plain message, and no account is created.
5. Better Auth's required `name` is derived from the email: the part before `@`, put through the shared person-name schema (1-80 characters after trimming, control characters rejected). There's no name field. `docs/DESIGN.md` Forms & Inputs records this.
6. The shell:
   - A top bar with "GradeLink", "Questions" and "Tests" links, and a user menu that shows the teacher's email and "Sign out".
   - Below `md`, the links move into a shadcn Sheet opened by a 44 px button.
   - The current link has `aria-current="page"` and a non-colour indicator, and every page has one H1.
   - Sign out lands on sign-in. If sign-out fails, the teacher stays on the page and sees an `aria-live` error.
7. Redirects, decided in router loaders (BP-019):
   - A signed-out visit to a teacher route goes to sign-in.
   - A signed-in visit to sign-in or create-account goes to Questions.
   - `/` redirects.
   - Questions and Tests are stubs that TASK-012 and TASK-014 fill.
   - The stack-proof page and its temporary schema are deleted.
   - Returning to the originally requested page after sign-in is out of scope.
8. `lib/api.ts`:
   - It stays the only `fetch` module, with relative `/api` paths (BP-020).
   - Every response is parsed with a shared schema (BP-005): a new session schema in `packages/shared` (user id and email only) and `errorBodySchema` for errors.
   - A 401 from any teacher API call sends the teacher to sign-in. A "Session expired" message is optional.
   - No token is read or kept in `localStorage` or `sessionStorage`.
9. `RouteError` goes on a pathless root route that wraps every route. Unknown paths still show `NotFound`, and a raw error message is never shown.
10. Buttons in `components/ui/button.tsx`:
    - Default and icon sizes, and the Dialog/Sheet close buttons, are at least 44 px.
    - Hover uses `hover:bg-primary-hover` and `hover:bg-secondary-hover`.
    - The focus ring is 2 px Indigo with an offset.
11. Bundle:
    - Teacher routes load lazily (BP-024).
    - `@gradelink/shared` gets subpath exports (`./common`, `./student`, `./teacher`), and the web imports from the narrowest one. Record this in `docs/ARCHITECTURE.md`.
    - The entry chunk is smaller than 717 kB, and the before and after sizes go in `docs/STACK.md`.
    - TASK-021 checks what the student route pulls in.
12. In the built SPA served by Express with the CSP on, open the Sheet and a Dialog, and record the result in `docs/SECURITY.md`. If a `<style>` element is blocked, fix it with a nonce or a narrow `style-src-elem`, never `unsafe-inline`.
13. Sign in once through the Vite proxy and confirm the cookie is HttpOnly, SameSite=Lax and not Secure. This closes TASK-004 criterion 6. It's manual or needs an approved network call (Have I Been Pwned). Automated tests mock the breach check.
14. Checks:
    - At 360 px there's no horizontal page scroll, and every tap target is at least 44 px.
    - Playwright (mobile viewport, run locally until TASK-021) covers create account, sign out, sign in, and both redirects.
    - Vitest covers the error mapping and focus-on-first-invalid-field.
    - `docs/SECURITY.md` records that sign-up reveals an already-registered email. The sign-up rate limit is the mitigation.

**Decisions (accepted 2026-11-26, from the Product Owner's suggestions):**
- name derived from the email
- the enumeration on sign-up accepted
- land on Questions, with signed-in teachers redirected away from the auth pages
- no return-to-page
- the user menu shows the email
- sign-out failure stays on the page
- 401 handling owned here
- subpath exports here, not TASK-021

- [x] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-011: Question bank API for multiple choice and true/false

Service and `/api/teacher/questions` routes: create, list, get, update, scoped by `teacherId` in every where clause. Points default to 1, numeric, positive. A question's type can't change after creation. JSONB `options` and `answer_key` validated per type on read and write. Reject unknown body fields (no client-sent `teacher_id`). Add isolation cases to the two-teacher test for every route.

**Story:** As a teacher, I want to create, list, open and edit my own multiple choice and true/false questions through the API, so that I can build a reusable bank that only I can see or change.

**Acceptance criteria:**

1. The routes are `POST /api/teacher/questions` (201), `GET /`, `GET /:id` and `PUT /:id` (full body). They sit on a static mount behind `requireTeacher` (BP-046). There is no DELETE: archiving is TASK-029.
2. Validation:
   - Body, params and query are parsed with shared schemas via `validated()`.
   - A non-uuid `:id` gets a 400 before any lookup.
   - Bodies are the strict TASK-008 schemas (BP-006). Unknown keys such as `teacher_id`, `id` or `status` get a 400 that doesn't echo them.
   - `short_answer` and `multiple_answer` bodies are rejected until TASK-024.
   - Each cap is tested at its limit and one past it.
3. `unwrap`/`fieldPath` in `validate.ts` follow unions, discriminated unions (by the discriminator), tuples, `ZodLazy` and `ZodCatch`. An invalid body then reports e.g. `body.options.1.text`, not `body.*`. Keys the client typed stay masked. `hardening.test.ts` is updated to the new paths (accepted 2026-11-25).
4. Create:
   - `teacher_id` comes from the session only.
   - The service generates the option ids.
   - Points default to 1, are stored as numeric, and 0.5 round-trips exactly.
   - The response is `teacherQuestionSchema`, parsed from the stored row.
5. Points of 0, below 0, non-numeric or over 1000 get a 400. A PUT that leaves `points` out stores 1, the create default. TEST_PLAN.md records this.
6. JSONB `options` and `answer_key` are validated per type with the shared schema on write and on read (BP-016). A stored row that fails is a 500 with a code-only log, and no partial object leaks (BP-043, BP-045). For the list, one bad row fails the whole list. Responses are built from the parsed shape, never a raw row.
7. The list holds only the signed-in teacher's non-archived questions, newest first by `created_at` with `id` as tiebreak. There is no pagination and no bank size cap. Record that known limit in TEST_PLAN.md. The response uses a shared list schema.
8. Update:
   - It replaces the prompt, options, correct answer and points. Option ids are regenerated on each edit.
   - True/false options stay fixed.
   - A `type` that differs from the stored one gets a 400 with a `type` field error, and the question is unchanged.
   - `updated_at` changes and `created_at` doesn't. Choose `.$onUpdate` in the `updatedAt()` helper or the service, and prove it with a test (closes a TASK-007 item).
9. Every service function takes `teacherId` and uses `findOwned` (BP-031). Another teacher's id, a missing id and an archived id all give the identical 404. ARCHITECTURE.md records that archived questions are 404 on GET/PUT. Responses don't include `archivedAt`.
10. Add isolation cases to the `routes` block of `teacher-isolation.test.ts` for every route:
    - GET and PUT (PUT with `readOwned`).
    - B's list leaves out A's questions.
    - B's create can't touch A's rows.
    - Every route gets 401 when signed out.
11. Handlers only parse, call one service function, and return (BP-037, rule 9). There's no SQL in routes.
12. Tests cover the TEST_PLAN question-bank API cases:
    - both types, the points default and 0.5
    - type change rejected, caps, unknown fields
    - `<img onerror>` returned as literal text
    - the 400 `fields` shape with no submitted values echoed

**Decisions (accepted 2026-11-26, from the Product Owner's suggestions):**
- option ids regenerated on edit
- newest first, with no pagination or cap
- archived questions are 404 on GET/PUT now
- a bad stored row fails the list
- no `archivedAt` in responses
- an omitted `points` on PUT stores 1
- true/false options fixed

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-012: Question bank UI (list and editor)

Bank list (cards on phones, table from `md`) and question editor for multiple choice and true/false with a points input. Loading skeletons, "No questions yet" empty state, error with "Try again", field-level validation, save failure keeping entered data, and the "Discard changes?" confirmation. Prompts and options render as text only.

**Story:** As a teacher, I want to see my question bank and add or edit multiple choice and true/false questions with points, on my phone or laptop, so that I can build a reusable bank without retyping questions for each quiz.

**Acceptance criteria:**

1. The list:
   - Below `md`, cards show the prompt (clamped to a few lines), the type as text, and the points. The whole card links to the editor with a visible focus state.
   - From `md`, a table shows the prompt, type and points. It has header cells, right-aligned points and a caption.
   - No page scroll at 360 px. Table overflow stays inside its container.
2. List states:
   - A skeleton from the loader while loading.
   - "No questions yet" with an "Add question" button when empty. "Add question" is also in the header of a non-empty list.
   - An error with "Try again" in an `aria-live` region.
   - The one H1 is "Question bank".
3. Create:
   - The type is a radio or segmented choice in the same form, and the options area changes with it.
   - Multiple choice has a prompt, 2 to 10 options with add and remove buttons, and one correct option chosen by radio.
   - True/false has a prompt and a "Correct answer" radio pair (True/False) in a `fieldset` with a `legend`.
   - Points default to 1 and accept a decimal point only (0.5), with helper text. A comma or other text is a field error.
   - Labels are always visible. Buttons are verbs ("Save question", "Add option"), and "Saving..." blocks a double submit.
4. Edit:
   - It opens with a skeleton, shows the type as read-only text, and shows the full prompt.
   - After saving an edit, the teacher stays on the page with an announced "Saved".
   - After a create, the teacher returns to the list.
   - Reloading shows the saved values.
5. Validation:
   - Shared-schema messages appear under each field with an icon and `aria-describedby`. Checks run on blur and on submit, not while typing.
   - Focus moves to the first invalid field on submit.
   - The checks cover the caps, repeated options, no correct option, and invalid points.
   - Server 400 `fields` map back to their inputs. Anything that doesn't map shows as a form-level error.
6. A failed save keeps everything entered and shows a message, and Save is usable again.
7. "Discard changes?":
   - Leaving with unsaved changes asks for confirmation, whether by back, a nav link, Cancel or the router blocker. Cancel stays, and confirm leaves.
   - The dialog traps focus, closes with Escape, and restores focus.
   - It never shows when nothing changed or after a save.
8. Prompts and options render as text only (BP-022). `<img src=x onerror=alert(1)>` shows literally in the list and the editor. There's no `dangerouslySetInnerHTML`. Newlines display via `whitespace-pre-wrap`.
9. API:
   - Screens use `lib/api.ts` functions (list, get, create, update) through loaders and actions (BP-019). Responses are parsed with the shared schemas.
   - A 401 sends the teacher to sign-in.
   - A 404 shows "Question not found" with a link back to the bank.
10. Tests:
    - Component tests cover validation, the server field mapping, the discard dialog and the states.
    - Playwright (mobile viewport, run locally until TASK-021) covers creating an MC question at the default 1 point, a T/F at 2 points, editing and reloading, and the empty state.
    - Every control works by keyboard, with arrow keys in radio groups.
    - `docs/DESIGN.md` records the editor and list choices (columns, clamp, type control, after-save behaviour, points format).

**Decisions (accepted 2026-11-26, from the Product Owner's suggestions):**
- return to the list after create, stay with "Saved" after edit
- the type as a radio or segmented choice in the form
- columns prompt, type and points
- clamped prompts in the list
- "Add question" in the header
- true/false as a "Correct answer" radio pair
- validation on blur and submit
- decimal point only

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-013: Test draft API

Service and routes to create, list, get, and rename draft tests, and set a draft's ordered questions. Every `questionId` in a request must belong to the signed-in teacher; add the isolation cases, including that teacher B cannot attach teacher A's question id to B's test. A test has at most 100 questions, and a repeated question id is rejected. A per-test `points` field is rejected as an unknown field. Responses show status `draft` and no share token.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-014: Test list and test builder UI

Test list with status badges (text, not color alone), "No tests yet" empty state, and test page tabs (Questions, Share, Results; Results is a placeholder until TASK-020). Builder lets the teacher pick bank questions, reorder or remove them, with empty states for "No questions added yet" and an empty bank, loading, and error states, plus the "Discard changes?" confirmation.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-015: Grading module for multiple choice and true/false

Pure functions in `apps/api/src/grading/` taking a snapshot question and a raw response and returning `{ awardedPoints, maxPoints }`. No imports of `db/`, Express, `node:crypto`, clock, or randomness. Exhaustive `switch` on type with a `never` check. Table-driven Vitest cases. Add a lint or test guard that `grading/` has none of the forbidden imports.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-016: Publish API with snapshot and share token

Publish in one `db.transaction`: write the single `test_snapshots` row (prompt, options, answer key, points, stable `snapshot_question_key`, `source_question_id`), set status `published`, `published_at` (server time), and a share token from `randomBytes(16)` or longer, URL-safe. Never update a snapshot after writing it. Reject re-publishing and empty tests. Tests: token length and uniqueness, no `Math.random`, snapshot points match the bank question's points at publish, snapshot unchanged after a bank edit, and isolation cases for the publish route.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-017: Publish dialog and Share tab UI

Publish confirmation dialog ("Publishing freezes a copy of the questions for this test."), full-width Publish button on phones, and the Share tab: read-only monospace link, "Copy link" with an inline "Copied" message announced via `aria-live`, copy-failure state with the link still selectable, and the draft empty state "Publish this test to get a share link".

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-018: Public fetch-test route and the student allow-list test

`GET /api/public/tests/:token` through a DTO mapper in `apps/api/src/dto/` that copies named fields from the snapshot (question text and options only). Validate token length and character set before lookup; unknown, draft, and malformed tokens return the same generic 404. Build the allow-list Vitest test that walks every `/api/public/*` response, including error bodies, and compares field paths to an explicit list. It covers the open-content shape now and grows with each later student route and shape (submit in TASK-019, closed in TASK-030). It must also prove that answer keys, snapshot keys, and ids beyond the allow-list never appear.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-019: Public submit route and grading

`POST /api/public/tests/:token/attempts` with a strict body of student name and raw responses only (no client-sent score or points). Reject with 400: unknown or duplicate question keys, wrong response shape for the type, unknown option ids, too many answers or selections. In one transaction re-check `status = 'published'`, grade from the snapshot, insert the `attempts` row and all `attempt_answers` (raw `response` stored as submitted), no dedupe by name. Unanswered questions and blank short answers are allowed and score 0. Return the score/max-score DTO only. Extend the allow-list test to the submit response and its errors. Test draft rejection writes no row; the closed-test test arrives in TASK-030.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-020: Submissions list (Results tab)

API returning a test's attempts newest first (name, submitted time, points and percentage) scoped to the owner, and the Results tab: table from `md`, stacked cards below, a text "Repeat" badge for same-name (case-insensitive) rows, no merging, empty state "No submissions yet. Share the link with your students.", loading and error states. Isolation cases added. This gives teachers their grades in the first working version; the delete action comes in TASK-032.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-021: Student flow UI and the first Playwright test

Student screens at `/t/<token>`: loading, invalid-link message, start screen (name field "Your name" autofocused, "Use your first name or a nickname" notice), answering (radio groups in fieldset/legend, 44 px tappable rows, 16 px text), submit with loading state (always enabled, even with unanswered questions, and no confirmation prompt), network-failure message with "Try again" that preserves name and answers, the invalid-link message if the test was deleted during the attempt, and the result card showing "8 / 10" with the title and name and no per-question correctness. No navigation chrome. Add Playwright at a mobile viewport covering teacher creates and publishes, student submits, score appears; add it to CI. Verify no horizontal scroll at 360 px.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-022: Rate limits, body and field limits, and the classroom burst test

Apply express-rate-limit per client IP: a stricter limit on `POST /api/public/tests/:token/attempts` than on `GET`, limits on token lookups, a general limit on `/api/teacher/*`, with Better Auth's limiter confirmed active for `/api/auth/*`. Limits are env-tunable starting points. Set `trust proxy` appropriately; Better Auth ignores it and uses `advanced.ipAddress.trustedProxies`, which TASK-038 sets. Tests: a burst sized for a classroom (for example 40 students from one IP submitting within a minute) is not blocked, abusive volume is; oversized body returns 413 on public routes; the name, answer-count, and multiple-choice selection caps are rejected past their limits. Short-answer and multiple-answer caps are tested in TASK-024.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

## Phase 3: More question types and tags

### TASK-023: Grading for short exact-match and multiple-answer partial credit

Two pure functions, each confirmed decision in exactly one place. Normalization: trim edges, collapse internal whitespace, compare case-insensitively, nothing else, matched against any of several accepted answers. Partial credit: equal share per correct option selected, the same penalty per incorrect option selected, floored at zero, where the share is the question's points divided by its number of correct options. Table-driven tests per BP-026: trims, collapses, case-insensitive, punctuation and accents still differ, any accepted answer matches; all correct, some correct, mixed, only incorrect (floored), none selected. Fractional points handled via one helper; no `===` on scores after arithmetic.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-024: Short-answer and multiple-answer in shared schemas, API, and submit validation

Extend the discriminated union, JSONB validation, question routes, snapshot, and student DTO for `short_answer` (one or more accepted answers, each up to 200 characters, at least one required) and `multiple_answer`. Submit validation for both: a short answer is a string within the cap, selected options are known and no more than the option count. Test each cap at and one past its limit. Extend the allow-list test so accepted answers and correct option ids never reach a student. Add isolation cases for any changed routes.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-025: Teacher editor UI for short-answer and multiple-answer

Question editor support: accepted-answers list with "Add accepted answer" (at least one required), correct-option checkboxes for multiple answer, validation messages, and the existing loading, empty, and error states. Check at 360 px.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-026: Student inputs for short-answer and multiple-answer, and e2e extension

Checkbox group with "Select all that apply" and a single-line text input for short answer, both with 44 px rows and proper labels. Extend the Playwright test to a mixed test of all four types. Confirm the result card still shows only the score.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-027: Tags: schema, API, and bank filter (deferrable)

First thing to defer if time runs out; tests can be built without tags. Add `tags` (up to 50 characters, unique per teacher and name, ignoring case) and `question_tags` with a migration, shared schemas, and routes to list tags and set a question's tags. Every `tagId` must belong to the signed-in teacher. Bank list supports filtering by tag. Add isolation cases, including foreign tag ids.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-028: Tags UI (deferrable)

Tag chips input in the question editor (type to add or pick existing), tag filter chips in the bank, "No questions match this tag" with a clear-filter action, and tags shown on cards. Rendered as text only.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

## Phase 4: Test lifecycle and data controls

### TASK-029: Archive a bank question and block publishing archived drafts

Deleting a bank question sets `archived_at`: hidden from the bank list, cannot be added to tests, published tests unaffected (they use the snapshot). The publish service rejects a draft that still contains an archived question with an error naming it. Tests: archived question absent from list, rejected on add, published test still served and graded, publish blocked, isolation case for the delete route.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-030: Close test API and the closed-test response

One-way close endpoint for the owner's published tests (409 for a draft or an already closed test; no reopen). `GET /api/public/tests/:token` for a closed test returns 200 with title and `status: closed` only, through its own DTO mapper, with no questions. Submit returns 409 for a closed test and checks status inside the transaction, so a close racing a submit cannot let the attempt through. Tests: closed-test submit is rejected and writes no `attempts` row, closed shape added to the allow-list test (now all three student shapes), isolation case for close.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-031: Close and delete-question UI, and the student closed screen

"Close test" dialog (explains submissions stop, results are kept, cannot be reopened), Closed badge, share link shown inactive. "Delete question" dialog (explains published tests keep their copy) and the builder's publish-blocked message naming the archived question with a way to remove it. Student closed screen: title plus "This test is no longer accepting submissions."; a submit rejected mid-attempt shows the same message. Extend Playwright to cover close.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-032: Delete one attempt

Owner-scoped delete route cascading to `attempt_answers`, plus a "Delete submission" row action with confirmation dialog. Tests: attempt and answers are gone, other attempts remain, teacher B gets 404.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-033: Delete a test with its attempts

Owner-scoped delete route cascading to `test_questions`, snapshot, attempts, and answers, plus a "Delete test" dialog stating that all submissions are permanently deleted. Tests: everything cascades, the old share link returns the generic 404, bank questions are untouched, teacher B gets 404.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

## Phase 5: Analytics

### TASK-034: Analytics API

`GET /api/teacher/tests/:id/analytics` (and the per-question variant) computed in SQL aggregates, not in JavaScript loops: class scores (average, high, low, and per-submission) from `attempts.score` and `max_score`, per-question correct rate as `sum(awarded_points) / sum(max_points)` per test, every submission counted including repeats. Tests: partial credit counts proportionally, repeats counted, deleting an attempt or test changes results, test with no attempts, and teacher B gets 404.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-035: Analytics tables UI

Summary tiles (average, high, low), class-scores table, and per-question correct-rate table with the "partial credit counts proportionally" header helper, points with percentage, right-aligned numbers. Below `md` the per-question table scrolls horizontally in its own container with a scroll hint. Loading skeleton, "Analytics will appear after the first submission", and "Try again" error states.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-036: Analytics charts (optional, deferrable)

Only if time remains and TASK-004 proved Recharts works. Add Recharts, lazy-loaded so students never download it, above or beside the tables, with a text title, colour plus label, and the table remaining as the accessible equivalent. Skip entirely if the stack proof failed or time is short.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

## Phase 6: Production readiness

### TASK-037: Security verification pass

Walk SECURITY.md's Before Production Checklist code items and confirm each with a test or a recorded check: allow-list test covers every `/api/public/*` response including errors; isolation test covers every teacher route including foreign ids in bodies; closed-test rejection writes no row; strict Zod on every endpoint; body limit and field caps; CSP and helmet headers verified against the built SPA (no `unsafe-inline` script, referrer policy); no `dangerouslySetInnerHTML`, no `cors` package, no `sql.raw` on request data, no `drizzle-kit push` in scripts; unsupported HTTP methods return 405 or 404; `npm audit` clean or deferrals noted in MEMORY.md; log review for secrets, cookies, tokens, answer keys, and student data. Record in MEMORY.md any gap that stays open.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-038: Deploy to Railway

Production build and start scripts, migrations applied by `drizzle-kit migrate` at deploy (schema-only, no push), Railway variables for `DATABASE_URL`, `BETTER_AUTH_SECRET` (CSPRNG, 32 bytes or more, distinct from every other environment), and `BETTER_AUTH_URL`. Set `trust proxy` to the correct hop count and Better Auth's `advanced.ipAddress.trustedProxies` to match the observed proxy chain, so one client can't lock every teacher out of sign-in, and confirm in a browser behind Railway that the cookie is HttpOnly, Secure, SameSite=Lax, Better Auth rate limiting is active, per-client-IP limits work for a class sharing an IP, and the app refuses to start without the secret. Use the private-network database URL where available, a runtime role if practical (otherwise record the gap), and no public database TCP proxy. Write the manual forgotten-password recovery procedure.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-039: Railway data-readiness checks (before real student data)

Not code. Gate for any real class. Check from Railway's documentation and by doing: Postgres backups exist, with frequency and retention, and one restore tested; Hobby terms fit the intended use; Postgres major version and support status recorded; encryption at rest and in transit confirmed, not assumed; decide who owns these checks; decide whether FERPA, COPPA, or GDPR could apply and get proper advice if schools are involved; decide open registration versus invite code. Record results in SECURITY.md and MEMORY.md.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

## Notes

- **Sequencing:** setup proves the unconfirmed stack items first, since any can cost weekend time. Auth precedes everything per-teacher; the DB schema precedes services; grading and publish precede the public routes, which precede the student UI.
- **Security grows with the routes.** The two-teacher harness (TASK-009) and the allow-list test (TASK-018) are created early, and each later route task adds its own cases to them. TASK-037 verifies coverage rather than creating it.
- **Deferral order if time runs out:** (1) TASK-036 charts, (2) TASK-027 and TASK-028 tags, then, only if the user decides (PRD Open Question 1), the analytics pair TASK-034 and TASK-035. Nothing else is deferrable; TASK-037 to TASK-039 gate real student use.
- **Delivery checkpoints:** after TASK-022 the goal is met for multiple choice and true/false; after TASK-026 all four question types work.

> **Assumption:** Rate limits and size limits are tunable starting points (SECURITY.md); TASK-022 picks initial values.

> **Assumption:** A local Postgres (installed or in a container) is available for development; ARCHITECTURE.md does not say how it runs locally. TASK-002 chooses.

> **Assumption:** The closed-test response shape arrives with the close feature (TASK-030), so the allow-list test covers all three student shapes from that task on.

> **Assumption:** Teacher self-registration stays open for the MVP (PRD.md); the invite-versus-open decision is made in TASK-039, not built.

> **Assumption:** Tasks for `CLAUDE.md` and `.claude/` are omitted; the optional scaffolding stage generates them.

Pushed out of MVP (no tasks): password reset, email verification, MFA, teacher account deletion, CSV export, re-publishing or reopening tests, and everything in PRD.md's Out of Scope.
