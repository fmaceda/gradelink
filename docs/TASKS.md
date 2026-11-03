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

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-005: API hardening baseline (helmet, rate-limit plumbing, body limit, error handler)

Verify helmet and express-rate-limit versions work with Express 5 by running them. Wire helmet with a CSP that allows no `unsafe-inline` script and a referrer policy that does not leak `/t/<token>` URLs; no `cors` package. Set `express.json({ limit })` to 100 KB after the auth mount, returning 413 when exceeded, and accept only `application/json` on body routes. Add the shared validation middleware (Zod over body, params, query), a typed `AppError`, and one last four-argument error handler returning `{ error: { code, message } }` with no stack traces, SQL, or snapshot content. Add request logging of method, route pattern (for example `/api/public/tests/:token`, never the raw URL), status, and request id only (no bodies, cookies, tokens, or keys). Set `trust proxy` from an env value. Actual per-route limits come in TASK-022.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-006: CI, secret scanning, and dependency audit

Add `.github/workflows/ci.yml`: `npm ci`, typecheck, Biome, Vitest, build, with a Postgres service container using throwaway credentials. Add secret scanning (gitleaks in CI or GitHub push protection) and run `npm audit`, recording any deferred high or critical finding in MEMORY.md. Playwright joins CI in TASK-021.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

## Phase 2: Thin end-to-end slice (multiple choice and true/false)

### TASK-007: Core database schema and first migration

Drizzle tables for `questions`, `tests`, `test_questions`, `test_snapshots`, `attempts`, and `attempt_answers` per ARCHITECTURE.md: `numeric` for points and scores, `timestamptz` timestamps, JSONB columns typed with `.$type<T>()`, `source_question_id` with `ON DELETE SET NULL`, cascades from test to its children and from attempt to its answers, unique `share_token`, no unique constraint on (`test_id`, `student_name`), and the indexes BP-017 lists. Generate and commit the migration. Tags tables come in TASK-027.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-008: Shared Zod schemas for multiple choice and true/false

In `packages/shared`: `common/` (question type enum, ids), `teacher/` (full question with answer key, test, request bodies as `z.strictObject`), and `student/` (the three response shapes: open test content, closed-test response, submit response; plus the strict submit request). Question types as a discriminated union on `type`, with only `multiple_choice` and `true_false` for now. Include length caps: prompt and option text, name 1-80 after trim with control characters rejected, option counts. Student schemas must not import from `teacher/`; add a test that enforces it. Add a single shared score formatter: points to at most 2 decimals, percentages to 1 decimal.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-009: requireTeacher, teacher-scoping helpers, and the two-teacher test harness

Build `requireTeacher` (session via `auth.api.getSession` with `fromNodeHeaders`, teacher id on typed `res.locals`) and mount all `/api/teacher/*` behind it. Build the Vitest harness that creates two teacher accounts, signs both in, and offers a helper asserting that teacher B gets 404 (not 403) for teacher A's resource. This is the seed of the cross-teacher isolation test; every later teacher route adds cases to it in the same task.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-010: Teacher sign-in, create-account, and app shell (web)

Sign-in and create-account pages with button loading state, inline errors focused on the first invalid field, and the generic "Email or password is incorrect" message. Teacher shell: top bar with Questions and Tests links, user menu with sign out, shadcn Sheet menu below `md`, `aria-current` on the current page, signed-out redirect. Registering with an already-used email shows a visible error and creates no second account. Build `lib/api.ts` as the only `fetch` module with relative `/api` paths and schema-parsed responses. Check at 360 px.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-011: Question bank API for multiple choice and true/false

Service and `/api/teacher/questions` routes: create, list, get, update, scoped by `teacherId` in every where clause. Points default to 1, numeric, positive. A question's type can't change after creation. JSONB `options` and `answer_key` validated per type on read and write. Reject unknown body fields (no client-sent `teacher_id`). Add isolation cases to the two-teacher test for every route.

- [ ] Implement
- [ ] Test
- [ ] Review
- [ ] Complete

### TASK-012: Question bank UI (list and editor)

Bank list (cards on phones, table from `md`) and question editor for multiple choice and true/false with a points input. Loading skeletons, "No questions yet" empty state, error with "Try again", field-level validation, save failure keeping entered data, and the "Discard changes?" confirmation. Prompts and options render as text only.

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

Apply express-rate-limit per client IP: a stricter limit on `POST /api/public/tests/:token/attempts` than on `GET`, limits on token lookups, a general limit on `/api/teacher/*`, with Better Auth's limiter confirmed active for `/api/auth/*`. Limits are env-tunable starting points. Set `trust proxy` appropriately. Tests: a burst sized for a classroom (for example 40 students from one IP submitting within a minute) is not blocked, abusive volume is; oversized body returns 413 on public routes; the name, answer-count, and multiple-choice selection caps are rejected past their limits. Short-answer and multiple-answer caps are tested in TASK-024.

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

Production build and start scripts, migrations applied by `drizzle-kit migrate` at deploy (schema-only, no push), Railway variables for `DATABASE_URL`, `BETTER_AUTH_SECRET` (CSPRNG, 32 bytes or more, distinct from every other environment), and `BETTER_AUTH_URL`. Set `trust proxy` to the correct hop count and confirm in a browser behind Railway that the cookie is HttpOnly, Secure, SameSite=Lax, Better Auth rate limiting is active, per-client-IP limits work for a class sharing an IP, and the app refuses to start without the secret. Use the private-network database URL where available, a runtime role if practical (otherwise record the gap), and no public database TCP proxy. Write the manual forgotten-password recovery procedure.

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
