# Best Practices — GradeLink

## How this file is used

Contributors consult this file while coding, and the `/validate-task` command reviews each diff against it. Practices carry an ID (BP-001...) and a level so review findings can cite them. Process lives in `RULES.md`, structure in `ARCHITECTURE.md`, and production hardening in `SECURITY.md`; this file does not repeat them and only points to them.

- **MUST** — a violation fails review.
- **SHOULD** — a violation is noted; justify deviations in the PR.

Versions are the ones in `STACK.md` (TypeScript ~6.0.3, Node 26.13, Express 5.3.0, React 19.3.1, Vite 8.3.5, React Router 8.5.1, Zod 4.6.7, Drizzle ORM 0.45.4 with drizzle-kit 0.31.11 and pg 8.23.1, Better Auth 1.7.15, Tailwind 4.3.3, Biome 2.6.4, Vitest 5.0.5). Those versions were carried over from the stack decision and not re-checked here.

> **Assumption:** The idioms below were checked with web searches that mostly returned third-party summaries and docs mirrors, not the official pages for the exact pinned versions. Items marked "unconfirmed" must be proven in the early setup tasks. Treat the installed package's own docs as the final word where they differ.

## Stack Practices

### TypeScript (strict, ~6.0.3, Node 26)

- **BP-001 (MUST)** No `any`, and no `as` cast on data from outside the process (request bodies, query strings, JSONB columns, `fetch` responses). Parse with a shared Zod schema instead (see BP-005). Casts hide exactly the shape errors that would leak an answer key or crash grading.
- **BP-002 (SHOULD)** Derive types from schemas with `z.infer` (or `z.input` / `z.output` when they differ), exported from `packages/shared`. Do not hand-write a second interface for a shape that already has a schema.
- **BP-003 (SHOULD)** Switch on `question.type` exhaustively and end with a `never` check (`const _exhaustive: never = q`), so adding a question type fails the typecheck instead of silently grading as zero.
- **BP-004 (SHOULD)** Use ES modules everywhere (Better Auth does not support CommonJS) and `import type` for type-only imports. Run the API in dev with `tsx`; do not add `ts-node` or a second runner.

### Validation and shared types (Zod 4.6.7, `packages/shared`)

- **BP-005 (MUST)** Every value that crosses a trust boundary goes through `schema.parse` or `schema.safeParse` from `packages/shared` before use: `req.body`, `req.params`, `req.query`, JSONB columns read from Postgres (`options`, `answer_key`, snapshot `content`), and every response body in `apps/web/src/lib/api.ts`. Do not read fields off unparsed input.
- **BP-006 (SHOULD)** Use Zod 4's top-level forms: `z.email()`, `z.uuid()`, `z.strictObject()`, `z.looseObject()`. Avoid the deprecated chained forms (`z.string().email()`, `.strict()`). Note `z.uuid()` is stricter in v4; use `z.guid()` only if a non-RFC id is genuinely needed.
- **BP-007 (SHOULD)** Model question types as `z.discriminatedUnion("type", [...])` so each type has its own `options` and `answer_key` shape. Make student request schemas `z.strictObject` so unexpected fields are rejected rather than silently ignored.
- **BP-008 (SHOULD)** Put explicit bounds on every student-supplied value in the schema: `student_name` length, number of responses, and length of each short-answer string.
  > **Assumption:** No limits were specified. Suggested starting values are name 1-80 characters and short answers up to 200 characters; adjust when real use shows otherwise.

### Backend / API (Express 5.3.0)

- **BP-009 (SHOULD)** Write route handlers as plain `async` functions and let a rejected promise reach error middleware, which Express 5 does automatically. Do not add `try/catch` just to call `next(err)`, and do not add `express-async-errors`. Throw a small typed `AppError` (status, code) from services. Register one four-argument error handler last, in `middleware/`.
- **BP-010 (SHOULD)** Use Express 5 path syntax. Wildcards must be named (`/api/auth/*splat`), and a bare `*` is invalid. Avoid Express 4 APIs that Express 5 removed (`res.json(obj, status)`, `res.send(status)`, `req.param()`, `app.del`); use `res.status(n).json(...)`. Do not assign to `req.query`; treat it as read-only and parse it with a schema.
  > **Assumption:** The removed-API list and `req.query` behavior are from the Express 5 migration notes as remembered, not fetched for 5.3.0. The `/*splat` form is confirmed by the Better Auth Express docs.
- **BP-011 (SHOULD)** Call `express.json({ limit: ... })` with an explicit small limit, mounted after the Better Auth handler (order is `ARCHITECTURE.md` rule 8, pending the setup-task confirmation).
  > **Assumption:** A limit such as `100kb` is enough for any test submission; no payload sizes were specified.
- **BP-012 (MUST)** Identify the teacher only through `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` (both from Better Auth's Node helpers), inside the single `requireTeacher` middleware. Put the resulting teacher id on a typed `res.locals` field. Never take a teacher id from the body, params, query, or a client-set header. Do not hand-parse the session cookie, and do not store tokens in `localStorage`.

### Database / data access (PostgreSQL, Drizzle ORM 0.45.4, pg 8.23.1)

- **BP-013 (MUST)** Build queries with Drizzle's query builder or the `sql` template tag, which parameterizes values. Never concatenate or interpolate user input into SQL strings, and do not use `sql.raw` with anything that came from a request.
- **BP-014 (MUST)** Wrap multi-statement writes in `db.transaction(async (tx) => { ... })` and use `tx` for every query inside. This applies to publishing (write the snapshot and set status and `share_token` together) and to submitting an attempt (insert `attempts` and all `attempt_answers` together). A half-written attempt corrupts analytics.
- **BP-015 (MUST)** Change the schema by editing `db/schema.ts`, running `drizzle-kit generate`, and committing the generated SQL in `apps/api/drizzle/`. Apply with `drizzle-kit migrate` (or the programmatic migrator at deploy). Never run `drizzle-kit push` against the Railway database, and never hand-edit an applied migration. Migrations change schema only (`ARCHITECTURE.md` rule 13).
- **BP-016 (MUST)** Type every JSONB column with `.$type<T>()` where `T` is inferred from the shared schema, and still validate it with that schema on read and write (BP-005). `$type` is compile-time only and does not check what is stored.
- **BP-017 (SHOULD)** Add indexes for the columns the app filters and joins on, since Postgres does not index foreign keys automatically: `teacher_id` on `questions`, `tags`, `tests`; `test_id` and `snapshot_id` on `attempts`; `attempt_id` and `source_question_id` on `attempt_answers`; and the unique index on `share_token`.
- **BP-018 (SHOULD)** Use `timestamp with time zone` for all timestamps, and set `submitted_at` and `published_at` on the server, never from the client.

### Frontend (React 19.3.1, Vite 8.3.5, React Router 8.5.1)

- **BP-019 (SHOULD)** Use React Router in library/data mode: `createBrowserRouter` plus `RouterProvider`, with route `loader` and `action` functions for reads and writes, and `<Form>` / `useFetcher` for mutations. Do not fetch inside `useEffect`. Do not adopt framework-mode features (`react-router.config.ts`, `ssr: false`, generated route types, a React Router server); this is a plain Vite SPA served by Express.
  > **Assumption:** Unconfirmed. Library/data mode is documented for v7/v8, but the v8.5.1 API in this setup is one of the items `STACK.md` says to prove in an early setup task. Loaders and actions still call only `lib/api.ts` (BP-020).
- **BP-020 (MUST)** All network calls go through `apps/web/src/lib/api.ts`, which parses every response with a shared schema (`ARCHITECTURE.md` rule 10). No `fetch` in components or route modules, and no hard-coded `http://localhost` URLs; use relative `/api/...` paths so the Vite proxy and production behave identically.
- **BP-021 (SHOULD)** Use React 19 idioms in new components. Accept `ref` as an ordinary prop rather than wrapping in `forwardRef`. Use `useActionState` or `useTransition` for pending and error state on forms rather than hand-rolled `isLoading` flags. Do not add `useMemo` / `useCallback` without a measured reason.
  > **Assumption:** Unconfirmed for 19.3.1 specifically; these are React 19 idioms. If shadcn/ui components still use `forwardRef` after setup, leave them as generated.
- **BP-022 (MUST)** Never use `dangerouslySetInnerHTML` or assign `innerHTML` for question prompts, options, tags, titles, or student names. Teacher-authored text is shown to students and student-typed names are shown to teachers; React's default escaping is the only output encoding used.
- **BP-023 (SHOULD)** Use Tailwind 4's CSS-first setup: the `@tailwindcss/vite` plugin in `vite.config.ts`, `@import "tailwindcss";` in `styles.css`, and design tokens in an `@theme` block. Do not add a `tailwind.config.js`, PostCSS config, or the v3 `@tailwind base/components/utilities` directives. Style mobile-first (unprefixed classes for phones, `sm:`/`md:` to widen).
  > **Assumption:** Setup details come from third-party v4 summaries, and shadcn/ui with Tailwind 4.3 and React 19.3 is unconfirmed (`STACK.md`). Follow the shadcn Vite instructions at setup time if they differ.
- **BP-024 (SHOULD)** Keep the student bundle small: load Recharts and teacher routes with `React.lazy` / route-level lazy loading so a student on a phone never downloads them. Build analytics as plain tables first (PRD build order) and add charts last.
  > **Assumption:** Recharts version and React 19.3 compatibility are unconfirmed.

## Project-Nature Practices

GradeLink's nature: automatic grading with confirmed rules, public unauthenticated student routes, answer keys that must never reach students, frozen snapshots, per-teacher data, and one developer on a short timeline.

- **BP-025 (MUST)** Grading is pure functions in `apps/api/src/grading/`: input is a snapshot question and a raw response, output is `{ awardedPoints, maxPoints }`. The `grading/` directory must not import `db/`, Express, `node:crypto`, or anything that reads the clock or randomness. Services load data and call the grader; the grader never loads data.
- **BP-026 (MUST)** Each confirmed grading decision (`PRD.md` Product Decisions 3 and 4) lives in exactly one function, with table-driven Vitest cases in `apps/api/test/`. Required cases: exact-match trims edges, collapses internal whitespace, and is case-insensitive, with no other normalization (so punctuation and accents still differ), and matches any of a question's accepted answers (Product Decision 7); multiple-answer partial credit with all correct, some correct, a mix of correct and incorrect, only incorrect (floored at zero), and none selected. A change to either function must change its tests in the same diff.
- **BP-027 (MUST)** Students are served and graded from the `test_snapshots` row, never from live `questions` rows (`ARCHITECTURE.md` rule 12). Never `UPDATE` a snapshot row after it is written, and never `DELETE` one except when its whole test is deleted. Each test has one snapshot, since re-publishing isn't in the MVP (`PRD.md` Product Decision 8).
- **BP-028 (MUST)** Student-facing responses are built only by mappers in `apps/api/src/dto/` that copy named fields. A change that adds or alters a `/api/public/*` response must edit the allow-list in the answer-key test in the same diff (`ARCHITECTURE.md` rules 2, 3, 14). Student schemas in `packages/shared/src/student/` must not import from `teacher/`. There are three student response shapes: open test content (question text and options only), the closed-test response (title and status only), and the submit response (score and max score only, `PRD.md` Product Decision 1).
- **BP-029 (MUST)** Generate share tokens with `node:crypto` `randomBytes(16)` or longer, encoded URL-safe (`ARCHITECTURE.md` rule 4). Look up by the unique `share_token` column. No `Math.random`, `uuid` v1, ids, titles, or timestamps.
- **BP-030 (MUST)** Never deduplicate, upsert, or overwrite attempts by student name. Every submission inserts a new `attempts` row (`PRD.md` Product Decision 2). No unique constraint on (`test_id`, `student_name`), and analytics count every row.
- **BP-031 (MUST)** Every service function that touches teacher-owned data (`questions`, `tags`, `tests`, analytics) takes `teacherId` as a required parameter and applies it in the query's `where`, including by-id lookups (`where id = ? and teacher_id = ?`). Each new `/api/teacher/*` route ships with a test that a second teacher gets 404 for the first teacher's resource. See `SECURITY.md` for the authorization model.
- **BP-032 (MUST)** Re-check inside the submit transaction that the test is `published` (not `draft` or `closed`) and reject otherwise, so a close takes effect immediately. Cover it with a test.
- **BP-033 (SHOULD)** Treat points as possibly fractional (equal shares on multiple-answer questions). Compute in one helper from the totals (points × net correct options ÷ correct options, so a full score stays exact), keep the stored column a `numeric` type rather than `real`/`double precision` (`ARCHITECTURE.md`), and format scores for display in one shared formatter. Do not compare scores with `===` after arithmetic.
- **BP-034 (SHOULD)** Compute analytics in SQL (`sum`, `avg`, `group by` over `attempts` and `attempt_answers`) and return aggregates. Do not load every attempt into JavaScript to loop over it, and avoid one query per question or per attempt. A question's correct rate is `sum(awarded_points) / sum(max_points)` (`PRD.md` Core Features).
- **BP-035 (SHOULD)** If a student's response references an option id that is not in the snapshot question, reject the submit with a 400 instead of grading it (`PRD.md` Product Decision 12).

## Code Quality

- **BP-036 (SHOULD)** Run `biome check` (lint and format together) before every commit; CI runs it too. Do not add ESLint or Prettier. Any `biome-ignore` needs a one-line reason.
- **BP-037 (SHOULD)** Keep route handlers short: parse, call one service function, return a DTO or the teacher schema. If a handler grows past roughly 30 lines, logic belongs in `services/`. Name files and functions for what they do (`publishTest`, `gradeAttempt`), not `utils` or `helpers`.
- **BP-038 (SHOULD)** Comments explain why, and name the decision when a rule comes from one (for example `// PRD Product Decision 4: floor at zero`). Do not comment what the code already says.
- **BP-039 (SHOULD)** Add a dependency only when the standard library or an existing dependency cannot do the job. Commit `package-lock.json`, install in CI with `npm ci`, and keep versions pinned as in `STACK.md`. Bump the TypeScript, Drizzle, or Better Auth major only after a `tsc --noEmit` and test run.
- **BP-040 (SHOULD)** Work in the PRD build order: thin end-to-end slice first (multiple choice and true/false), then short answer and multiple-answer, then tags, then analytics. Write the grading tests before or with the grading code. Do not add abstractions, config options, or generic layers for features that are out of scope (`PRD.md` Out of Scope).

## Performance & Accessibility

- **BP-041 (SHOULD)** Design student screens mobile-first and check them at a 360px-wide viewport: no horizontal scroll, tap targets at least 44x44px, body text at least 16px so iOS does not zoom on focus. The Playwright flow runs on a mobile viewport.
  > **Assumption:** The 44px and 16px figures are common mobile guidance chosen here, not specified in the PRD.
- **BP-042 (SHOULD)** Use semantic form controls: `<label>` tied to every input; radio inputs for single-answer questions and checkboxes for multiple-answer ones, grouped in `<fieldset>` with a `<legend>` holding the prompt; a visible focus style; everything reachable and submittable by keyboard. Target WCAG 2.2 AA for the student flow. Convey correctness or status with text as well as color.

## Security-Relevant Practices

Coding-level guidance follows OWASP ASVS (V5 validation and encoding, V4 access control, V7 logging, V13 API) and NIST SSDF (PW.5 secure coding, PW.7 code review). Production hardening, session policy, rate limiting, and student-data privacy are in `SECURITY.md`; process rules for secrets and dependencies are in `RULES.md`. *Security-adjacent topic — not yet checked against an internal standard; verify before implementation.*

Practices that are already security-critical appear above and are not repeated: BP-005 (input validation), BP-012 (session identity), BP-013 (parameterized SQL), BP-022 (output encoding), BP-028 and BP-029 (answer-key and token handling), BP-031 (per-teacher authorization).

- **BP-043 (MUST)** Do not log answer keys, snapshot `content`, share tokens, passwords, session cookies, or `BETTER_AUTH_SECRET`. Student names and raw responses are logged only if there is a specific debugging need, and not at default log level. Do not include a share token in an error message or URL logged server-side beyond what the access log necessarily records.
- **BP-044 (SHOULD)** Read environment variables in one module (for example `apps/api/src/env.ts`) that parses `process.env` with a Zod schema at startup and fails fast on missing values. Do not read `process.env` elsewhere, and do not give secrets default values. The one exception is `apps/api/drizzle.config.ts`, which `drizzle-kit` loads outside the app: it reads only `DATABASE_URL` and throws if it is missing.
- **BP-045 (SHOULD)** Error responses are a uniform JSON shape (`{ error: { code, message } }`) with no stack traces, SQL, or internal ids in production. An unknown share token, a draft test, and a nonexistent test return the same 404 so tokens cannot be probed.

## Anti-Patterns to Reject

- Returning a Drizzle row, a snapshot object, or a teacher-schema type from any `/api/public/*` route (violates BP-028).
- A `fetch` call in a component, loader, or hook outside `lib/api.ts`, or a response used without a schema parse (BP-020, BP-005).
- `as SomeType` on `req.body`, JSON, or a JSONB column (BP-001).
- `` sql`... ${userInput} ...` `` built with `sql.raw`, or a template string passed to `pool.query` (BP-013).
- A service query that filters by `id` alone, or a teacher id read from the request body (BP-031, BP-012).
- Scoring, normalizing, or comparing answers in `apps/web`, `packages/shared`, a route handler, or a SQL expression (BP-025).
- Grading or serving a student from `questions` rather than the snapshot, or updating a snapshot row (BP-027).
- `INSERT ... ON CONFLICT` or a find-then-update on `attempts` keyed by student name (BP-030).
- Two separate awaited writes for publish or submit outside a transaction (BP-014).
- `drizzle-kit push` in a deploy script or against production; editing an already-applied migration (BP-015).
- `dangerouslySetInnerHTML` with teacher or student text (BP-022).
- A `tailwind.config.js`, `@tailwind` directives, the `cors` package, or `useEffect` data fetching (BP-023, `ARCHITECTURE.md` rule 6, BP-019).
- `console.log` of a request body, token, or key (BP-043).

## Review Checklist

- [ ] BP-028 — Any change to a `/api/public/*` response goes through an `dto/` mapper and edits the allow-list test in the same diff; no student schema imports from `teacher/`.
- [ ] BP-031 — Every new or changed teacher-data query filters by `teacherId` (including by-id lookups); a cross-teacher 404 test exists for new routes.
- [ ] BP-027 — Student reads and grading use the snapshot; no write to an existing `test_snapshots` row.
- [ ] BP-025 — Nothing in `grading/` imports `db/`, Express, clock, or randomness; no grading logic outside `grading/`.
- [ ] BP-026 — Changes to normalization or partial credit come with updated table-driven tests covering the listed cases.
- [ ] BP-005 — Each new request body, param, query, JSONB read, and client response is parsed with a shared schema.
- [ ] BP-001 — No `any`, and no `as` on external data.
- [ ] BP-013 — No string-built SQL; no `sql.raw` with request-derived values.
- [ ] BP-014 — Publish and submit (and any other multi-write) run inside one `db.transaction` using `tx`.
- [ ] BP-015 — Schema changes include a generated, committed migration; no `push` against production; no edits to applied migrations.
- [ ] BP-016 — New JSONB columns use `.$type<T>()` from a shared schema and are validated on read and write.
- [ ] BP-012 — Teacher identity comes only from `requireTeacher` via `auth.api.getSession` with `fromNodeHeaders`.
- [ ] BP-029 — Share tokens come from `randomBytes(16+)`; no other token source.
- [ ] BP-030 — No dedupe, upsert, or unique-by-name logic on attempts.
- [ ] BP-020 — `fetch` appears only in `lib/api.ts`, with relative `/api` paths and schema-parsed responses.
- [ ] BP-022 — No `dangerouslySetInnerHTML` or `innerHTML` with teacher or student text.
- [ ] BP-043 — No logging of keys, snapshot content, tokens, passwords, or cookies.
- [ ] BP-003 — `switch` on question type is exhaustive with a `never` check.
- [ ] BP-032 — Submit re-checks `published` status inside the transaction.
- [ ] BP-034 — Analytics use SQL aggregates; no per-row queries or JS loops over all attempts.
- [ ] BP-019 / BP-021 — Router loaders/actions used instead of `useEffect` fetching; no framework-mode features; no `forwardRef` in new components.
- [ ] BP-009 / BP-010 — No manual `try/catch → next(err)` wrappers; Express 5 path syntax; no removed Express 4 APIs.
- [ ] BP-017 / BP-018 — New foreign-key and filter columns are indexed; timestamps are `timestamptz` and server-set.
- [ ] BP-023 / BP-024 — Tailwind 4 CSS-first config only; Recharts and teacher routes lazy-loaded.
- [ ] BP-041 / BP-042 — Student screens work at 360px; inputs have labels; choice groups use fieldset/legend.
- [ ] BP-036 / BP-039 — `biome check` clean; any new dependency is justified and the lockfile is committed.

## Notes

Assumptions made in the absence of a stated team convention (each also marked inline):

- Idioms for Express 5 removed APIs, React Router 8.5.1 library/data mode, React 19.3.1, and Tailwind 4.3.3 plus shadcn/ui are unconfirmed against the pinned versions (BP-010, BP-019, BP-021, BP-023, BP-024).
- Numeric limits: student name and short-answer lengths (BP-008), JSON body limit (BP-011), tap target and font sizes (BP-041).

Revisit once real code exists:

- BP-019 and BP-010, after the React Router 8 and Better Auth setup tasks prove the actual APIs on Express 5.
- BP-043 and BP-044, against the final logging and env setup, and `SECURITY.md` once it is confirmed.
- MUST count (18) against what a solo developer actually holds to; demote any that `/validate-task` flags as noise rather than real defects.
