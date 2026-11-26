# Memory — GradeLink

## How to use this file

Update this file whenever a task's status changes or a new issue surfaces
— not just at milestones. Keep entries short; this is a status snapshot,
not a changelog (git history is the changelog). When a task in TASKS.md
moves to Complete, move it from "Current Task" to "Completed" here and
pull the next task into "Current Task."

## Current Status

TASK-009 is merged to `main` (PR #11). TASK-010 part A is built on branch `feat/teacher-shell`, uncommitted except for the stories commit. The teacher shell, redirects and `lib/api.ts` are in place, and the stack-proof page is gone. Sign-in and create-account are placeholders until part B. All 178 API tests, 26 web tests, 123 shared tests, lint, typecheck and build pass with local Postgres running.

## Completed

- Project scaffolded (source skeleton + Claude setup)
- TASK-001 — Workspace, toolchain, and version recheck
- TASK-002 — Postgres, Drizzle, and env module
- TASK-003 — Prove Better Auth on Express 5 and set the auth config
- TASK-004 — Prove the web stack (React Router 8, Tailwind 4.3, shadcn/ui, Recharts) and Express serving the SPA
- TASK-005 — API hardening baseline (helmet, rate-limit plumbing, body limit, error handler)
- TASK-006 — CI, secret scanning, and dependency audit
- TASK-008 — Shared Zod schemas for multiple choice and true/false
- TASK-007 — Core database schema and first migration
- TASK-009 — requireTeacher, teacher-scoping helpers, and the two-teacher test harness

## Current Task

TASK-010 — Teacher sign-in, create-account, and app shell (web). Split in two (owner decision, 2026-11-26). Part A is built, and *Implement* stays unticked until part B is done.

Part A (built, criterion numbers from TASKS.md):
- [x] 6 shell: top bar, phone Sheet menu, user menu with email, sign out, sign-out failure error (`routes/teacher/layout.tsx`)
- [x] 7 redirects in loaders (`routes/session.ts`); Questions and Tests stubs; `/` and `/sign-out` GET redirect; stack-proof deleted
- [x] 8 `lib/api.ts`: shared `teacherSessionSchema` and `signOutResponseSchema`, `errorBodySchema` errors, `teacherRequest` turns a 401 into a redirect to sign-in
- [x] 9 root `RouteError` on a pathless root route
- [x] 10 button sizes (44 px; `xs`, `icon-xs`, `icon-sm` removed), hover tokens, 2 px focus ring; Dialog/Sheet close buttons 44 px
- [x] 11 lazy teacher and auth routes, `@gradelink/shared` subpath exports (ARCHITECTURE.md rule 5), bundle sizes in STACK.md
- [x] Web Vitest setup (jsdom, Testing Library) with tests for `lib/api.ts` and the router and shell

Part B (to do):
- [ ] 1-2 sign-in form and its errors
- [ ] 3-4 create-account form and its server errors
- [ ] 5 `name` derived from the email; record it in DESIGN.md Forms & Inputs
- [ ] 12 CSP check with the Sheet and a Dialog in the built SPA; record it in SECURITY.md
- [ ] 13 cookie check through the Vite proxy (approved network call)
- [ ] 14 360 px check; `playwright.config.ts` and `npx playwright install chromium` (approved); the e2e flow; form component tests; record the sign-up enumeration trade-off in SECURITY.md

## Known Issues

- [minor] TASK-009: `requireTeacher` forwards Better Auth's `Set-Cookie` (`returnHeaders: true`, `require-teacher.ts:37-52`) for session refresh and clear-on-expiry. Criterion 1 didn't ask for this. It's sound and tested. Record it as an accepted change in TASKS.md or DECISIONS.md so the code and the criterion agree. Untested edge case: a lookup that fails after a partial refresh could leave a stale `Set-Cookie` on the 500.
- [minor] TASK-009: `uniqueIp` in `test/support/teachers.ts:43` restarts at `10.30.0.2` in every test file. That's safe only because Better Auth's rate-limit store is in memory per Vitest worker. Fix: seed the counter per worker (`VITEST_POOL_ID` or `process.pid`), or note the assumption.
- [nit] Docs gap (TASK-009): BEST_PRACTICES has no rule that route ids are parsed as uuid before a by-id service lookup. It's implied by BP-005; add it next to BP-031.
- [nit] Docs gap (TASK-009): BP-031 requires a cross-teacher 404 test, but not that the 404 body matches the missing-id body. The harness enforces it; add it to BP-031.

- [minor] TASK-007: `pgErrorCode` in `apps/api/test/schema.test.ts:21` returns `undefined` both on success and for an error with no `code`. So the "accepts the four types", "accepts the three statuses" and "no unique index on positions" tests would pass on a non-Postgres failure. Fix: `await` the success cases directly, and keep `pgErrorCode` only for expected rejections.
- [minor] TASK-007: the "stores the snapshot question key" test (`schema.test.ts:~344`) only re-asserts the helper's hardcoded `"q1"`, so it can't fail. Criterion 7 is a column-only check until TASK-016 builds snapshots. Drop the test, or have TASK-016 test that the publish service writes the same key in both places.
- [minor] TASK-007: `updated_at` on `questions` and `tests` (`apps/api/src/db/schema.ts:~106`) has no `.$onUpdate(() => new Date())`, so a service that forgets to set it leaves a stale value. Add it to the `updatedAt()` helper (no migration needed, it's client-side) or record that services set it. TASK-011 at the latest.
- [nit] TASK-007: the numeric round-trip uses `0.5`, which a float column would also store exactly. The column-type test is the real guard. Add `0.1` or `0.3333` to the round-trip.
- [nit] TASK-007: `test_questions` has no index on `question_id`, and the composite primary key leads with `test_id`. A "which drafts use this question" lookup (archive, TASK-029) scans the table. Add the index then, or record skipping it. Not in BP-017's list.
- [nit] TASK-007: `attempts.test_id` and `snapshot_id` are independent foreign keys, so a row could name another test's snapshot. TASK-019's submit service must load the snapshot by test. Note the invariant in ARCHITECTURE.md's keys paragraph.
- [nit] TASK-007: `schema.test.ts:222` checks ids with `/^[0-9a-f-]{36}$/`, which accepts non-uuids. Use a uuid-shaped regex.
- [note] TASK-007: the squash changed the migration hashes. Any local database other than the one reset on 2026-11-26 must be reset (`docker compose down -v`, or drop the `drizzle` and `public` schemas) before `db:migrate`. See `docs/STACK.md`.
- [note] TASK-007: `questions.options` and `answer_key` are `NOT NULL` and typed as the choice shapes. TASK-024 widens the `$type`, and decides whether short answer stores `[]` or needs a nullable `options`.
- [note] TASK-007: `teacher_id` and `test_questions.question_id` use the default `ON DELETE NO ACTION`, since no doc says otherwise. So deleting a user with questions or tests fails, and so does deleting a bank question that's still in a draft. Bank deletes are archives (TASK-029), and the MVP has no account deletion. Recorded in ARCHITECTURE.md.
- [note] TASK-007: `numeric` columns have no precision or scale. Drizzle reads them as JS numbers (`mode: "number"`), but `sum()` results from raw SQL come back as strings, so analytics (TASK-034) must convert them.
- [minor] TASK-008: single-line fields (option text, title, student name) reject only `\p{Cc}` in `packages/shared/src/common/text.ts:10`. U+2028/U+2029 line separators, bidi overrides such as U+202E and zero-width characters (`\p{Cf}`) still pass, so two options that differ only by a zero-width space get past the repeated-text check. Fix: also reject `\p{Zl}`, `\p{Zp}` and `\p{Cf}` in single-line fields, and consider NFC before the repeat check. Add table tests.
- [minor] TASK-008: `docs/TEST_PLAN.md:302` still says the docs fix no prompt and option caps. The caps table in the question-bank section now fixes them. Drop that clause.
- [nit] TASK-008: `choiceResponseSchema` (`student/submit.ts:8`) allows repeated ids like `["a","a"]`. Add a uniqueness refine there, or add it to TASK-019's criteria, so partial credit never counts an id twice.
- [nit] TASK-008: `multipleChoiceShape`, `trueFalseShape` and `checkStoredChoice` are exported from the package index. Stop exporting them if TASK-007 doesn't need them. `IssueSink` in `teacher/question.ts:24` could be Zod's `RefinementCtx`.
- [nit] TASK-008: prompts reject `\r`, so an API client sending CRLF gets a 400 (browsers send `\n`). Normalise CRLF or note it in the TEST_PLAN caps table.
- [nit] TASK-008: `submitAttemptResultSchema` doesn't require `score <= maxScore`. Teacher response schemas are strict too, so adding a server field breaks a client that hasn't reloaded. Strict is deliberate for students; record the choice for teacher responses.
- [note] TASK-008: points are capped at 1000. No doc sets an upper bound; the owner can change `POINTS_MAX` in `teacher/question.ts`.
- [note] TASK-008: the shared `test` script and `tsconfig.test.json` rely on vitest and `@types/node` being hoisted from `apps/api`, the same as the TASK-002 `db:*` script nit.

- [minor] TASK-006: the owner says both workflows passed every step on the pushed `chore/secret-scan-audit` branch, which covers criterion 1. Still open: criterion 2 needs a red `Secret scan` run on a throwaway branch with a fabricated token (delete the branch afterwards), and criterion 4 needs a green run on `main` after the merge.
- [minor] TASK-006: `actions/checkout@v4` and `actions/setup-node@v4` run on Node 20. gitleaks-action's README says GitHub stopped Node 20 actions on 2026-09-16. The `chore/secret-scan-audit` run passed, so the v4 tags aren't failing. Whether the runner logs a deprecation warning hasn't been checked. If the runner warns or fails, bumping to the Node 24 majors is a deliberate major bump (RULES.md), not a side effect.
- [nit] TASK-006: a high or critical advisory can't be deferred by ID with plain `npm audit`, which has no per-advisory ignore. The first deferral needs a small filter step in place of `npm audit --audit-level=high`. The `ci.yml` comment says so.

- [minor] TASK-005: criterion 9 can't be verified by Claude. The owner says `TRUST_PROXY=0` is in their env files, and `git status` shows `.env.example` modified, but Claude's permission settings block reading `.env*` files. The owner should check the line is in `.env.example` before committing.
- [minor] TASK-005: `fromClientError` in `apps/api/src/middleware/error-handler.ts:44` turns every 4xx into 400 `VALIDATION_ERROR`. An error that carries 404, 413, 415 or 429 from a source other than body-parser loses its real status and code (BP-045). No such source exists today. Fix: keep 404/413/415/429 with their matching code and fixed text, and use 400 only for the rest. TASK-037 at the latest, when it re-checks every route's errors.
- [nit] TASK-005: `fieldPath` in `apps/api/src/middleware/validate.ts:46` echoes every numeric path segment, so the numeric keys of a `z.record(z.number(), ...)` would show up in `fields`. Fix: echo numbers only under a `ZodArray` or `ZodTuple`, otherwise write `*`.
- [nit] TASK-005: `unwrap` in `validate.ts:22` doesn't follow unions, discriminated unions, `ZodLazy`, `ZodCatch` or tuples, so errors inside them report `body.*` instead of the field. That's safe but vague. TASK-011 owns extending the walk (accepted 2026-11-25), since it's the first route that parses a union body. `hardening.test.ts` now pins today's `body.*` output for a union body (TASK-008), so TASK-011 updates that test.
- [nit] TASK-005: `error-handler.ts:75` calls `res.end()` after a mid-stream failure, so the client sees the truncated chunked body as complete. `res.destroy()` would signal the failure. Criterion 6 says "ends", so the owner decides.
- [note] TASK-005: the owner added a root `.gitattributes` (`* text=auto eol=lf`) on `feat/api-hardening` to fix local CRLF lint failures. It isn't TASK-005 work, so give it its own `chore:` commit. On 2026-11-25 Claude deleted the 19 affected files, which had no local changes, and restored them from git so they're LF on disk, and `npm run lint` now passes. Other existing clones need a fresh checkout to pick up LF (`git rm --cached -r . && git reset --hard`, only with a clean tree).
- [minor] TASK-005: the CSP ships with strict `style-src 'self'`, and the Radix check is unverified because no browser was available. The Dialog and Sheet scroll lock injects a `<style>` element, which this policy blocks. TASK-010 must open a Dialog in the built SPA served by Express and record the result in `docs/SECURITY.md`. See the Input Validation section there.
- [note] TASK-005: `middleware/request-log.ts` captures the route pattern by putting an accessor on `req.route`. Express resets `req.baseUrl` before an error reaches the last handler, so reading the pattern at the end would lose the mount path. This relies on Express assigning `req.route` when a route matches. Tests cover it, so an Express upgrade that breaks it shows up as a failing test.
- [nit] TASK-005: the JSON-only body check runs before the routers, so a non-JSON body sent to an unknown `/api` path gets 415, not 404.

- [minor] TASK-004: criterion 6 is unverified. Nobody has signed in through the Vite proxy yet to confirm the cookie is HttpOnly, SameSite=Lax and not Secure. The Vitest half passes. Sign-up calls the Have I Been Pwned service, so do it by hand or approve the network call. Do it before TASK-010 builds the sign-in screen.
- [nit] TASK-004: the wrong-method test in `apps/api/test/app.test.ts:104` checks "not HTML" but not `application/json`. TASK-037 should assert JSON when it re-checks every route.
- [note] TASK-004: git reports "dubious ownership" for the repo folder on this machine. Commands used `git -c safe.directory=...`. The owner can run `git config --global --add safe.directory D:/Development/portfolio-projects/gradelink` to fix it permanently.
- [minor] TASK-004/TASK-008: the entry chunk is 665 kB minified (206 kB gzip) after TASK-010 part A made the teacher routes lazy. It was 717 kB. What remains is react-dom, react-router and zod. TASK-021 must check what `/t/<token>` pulls in, and consider `zod/mini` for the student schemas.
- [note] TASK-006: `npm audit` still reports 8 moderate findings, all dev-only, and no high or critical: GHSA-67mh-4wv8-2f99 (esbuild via `drizzle-kit`) and GHSA-g3hv-75wg-m249 (minimatch via `shadcn`). CI fails only on high or critical. Nothing is deferred. Both IDs are named in `ci.yml`.

- [note] TASK-003: `NODE_ENV` is required, so Railway must set `NODE_ENV=production`. Local tests now run in development mode because `.env` sets it, while CI runs them in test mode.
- [minor] TASK-003: the leak test at `apps/api/test/auth.test.ts:274` finds the session `id`, not the `token`, because both are 32 characters and `id` comes first. Its other assertions still catch the leak, but it should check the token itself.
- [nit] TASK-003: `apps/api/test/db.test.ts:21` skips `mockRestore` if the `not.toThrow` assertion fails. Use `try`/`finally`.
- [major] TASK-003: behind Railway's proxy, `x-forwarded-for` may hold several addresses, and Better Auth then puts every client in one rate-limit bucket, so one client could lock every teacher out of sign-in. Unverified on Railway. Express `trust proxy` doesn't help: TASK-038 checks this and sets `advanced.ipAddress.trustedProxies`.
- [minor] TASK-003: sign-up requires `name`, but `docs/DESIGN.md` and the create-account mockup have no such field. TASK-010 must add one or derive it. Check `docs/DESIGN.md` then.
- [minor] TASK-003: `auth.ts` trusts `http://localhost:5173` in development. TASK-004 pinned Vite to that port (`strictPort`), but sign-in through the proxy is still unchecked. See the TASK-004 Postgres entry above.
- [note] TASK-003: API tests write to the database in `.env`. They delete their fabricated accounts, but a crashed run could leave some behind.
- [minor] TASK-002: `BETTER_AUTH_SECRET` is only checked as non-empty, so a very short secret starts in production. Add a production minimum, or record the gap in `docs/SECURITY.md`.
- [minor] TASK-002: the placeholder in `apps/api/src/env.ts:4` duplicates `.env.example` with nothing linking them (they match today). Add a test that compares them.
- [nit] TASK-002: `apps/api/test/db.test.ts:17` only restates the pool constant.
- [nit] TASK-002: the `test` and `db:*` scripts in `apps/api/package.json` use direct paths into the root `node_modules`, which depend on workspace hoisting.
- [minor] TASK-001: `docs/STACK.md` records the Biome exclusions of `.claude` and Markdown without the reason. Add it, and check that no `.claude` JSON needs formatting.
- [nit] TASK-001: `biome.json` uses the deprecated `linter.rules.recommended`, with no owner for running `biome migrate`.
- [nit] TASK-001: `apps/api/test/smoke.test.ts:19` ignores any error from `server.close`.
- [note] TASK-002: local Postgres (now `compose.yaml`) and CI both use `postgres:17`, a floating minor tag. Railway's major version is unconfirmed; align all three once TASK-039 confirms it.

## Next Step

Commit TASK-010 part A on `feat/teacher-shell`, then `/implement-task TASK-010` again for part B (see the checklist under Current Task). `/validate-task TASK-010` runs once part B is done. Still open from TASK-006: confirm `Secret scan` fails on a throwaway branch with a fabricated token, and that CI is green on `main`.
