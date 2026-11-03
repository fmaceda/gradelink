# Security — GradeLink

Guidance below follows recognized industry practice: OWASP ASVS (5.0) for application controls, NIST SP 800-63B (revision 4) for authentication, and NIST SSDF (SP 800-218) for secure development. It is tied to the confirmed stack: Better Auth email and password for teachers, same-origin cookie sessions, Express 5, PostgreSQL with Drizzle, Railway. System structure is in ARCHITECTURE.md, and day-to-day process rules are in RULES.md. This file does not repeat them.

GradeLink has two very different trust zones:

- **Teacher zone** (`/api/auth/*`, `/api/teacher/*`): authenticated, sees answer keys and all student results.
- **Student zone** (`/api/public/*`): unauthenticated by design, reachable by anyone who has or guesses a share link. Treat every request here as hostile.

## Authentication

**Scope:** Teachers only, via Better Auth (email and password). Students have no accounts and are never authenticated (see Authorization, "Accepted limits on trusting a result").

**Passwords (NIST 800-63B-4, ASVS V6):**

- Set an explicit `minPasswordLength` of 15 in the Better Auth `emailAndPassword` config, since a password is the only authenticator. Allow long passwords (at least 64 characters) and all characters, including spaces.
- Do not add composition rules (forced symbols or digits) and do not force periodic rotation. NIST advises against both.
- Do not hand-roll hashing. Use Better Auth's default password hashing and do not replace it with a weaker algorithm.
- Block known-breached passwords with Better Auth's `haveIBeenPwned` plugin (enabled in TASK-003). On sign-up and password change it sends only the first 5 characters of the password's SHA-1 hash to `api.pwnedpasswords.com`. If that service is unavailable, sign-up fails with an error and creates no account. Students are never affected.

**Sessions (ASVS V7, OWASP Session Management):**

- Use only Better Auth's database-backed session cookie: HttpOnly, Secure, SameSite=Lax, same origin. Do not store session tokens in `localStorage` or `sessionStorage`, and do not read them from client JS.
- Keep cookie attributes explicit in the Better Auth config and confirm `Secure` is on in production. Behind Railway's TLS-terminating proxy, set Express `trust proxy` correctly so the app sees HTTPS (see Before Production Checklist).
- Sign-out must delete the server-side session row, not only clear the cookie.
- Set a finite session lifetime and idle refresh window in the Better Auth config: 24 hours and 1 hour, chosen for shared school devices. Each sign-in creates a new session with a new token, and the app has no pre-login session to reuse.

**Brute force and abuse of sign-in:**

- Keep Better Auth's built-in rate limiting on for `/api/auth/*` in production and verify it is active there. Do not disable it for convenience in tests; configure the test environment instead. Limits apply per IP and per path, and are stored in memory, so a restart clears them: 10 per 60 seconds for email sign-in and for sign-up, Better Auth's stricter defaults for password and email changes and resets (3 per 10 or 60 seconds), and 100 per 60 seconds for the rest.
- Return the same error for "unknown email" and "wrong password".

**CSRF (ASVS V3):** SameSite=Lax blocks cross-site POSTs from carrying the cookie. As defense in depth, keep Better Auth's trusted-origins and origin checks on, set to the production origin only. `NODE_ENV=development` alone also trusts Vite's `http://localhost:5173`, because that is the origin the browser sees through the dev proxy. All state-changing teacher routes use POST/PUT/PATCH/DELETE, never GET.

**Mounting:** `toNodeHandler(auth)` at `/api/auth/*splat` before `express.json()`. TASK-003 proved this works, with the Better Auth `baseURL` and `secret` coming from env vars.

**Password reset and email verification are later work (per PRD.md). Consequence:** until they exist, a teacher who forgets a password has no self-service recovery, and the operator has to reset it by hand. Since email is not verified, anyone can register with an email address they don't own. The result is junk accounts, and a squatter can hold someone else's address. Reset and verification are also the usual defenses against account takeover through a stale email, so the lack of both raises the risk of a weak teacher account. Mitigations for now: the 15-character minimum, sign-in rate limiting, and a documented manual recovery procedure. If real schools use the app, add both before onboarding them.

> **Assumption:** Teacher self-registration is open (PRD.md assumes this). Open sign-up is acceptable for personal or small-scale use. Before wider use, consider an invite code or an allow-list so strangers cannot create teacher accounts and consume storage.

> **Assumption:** No MFA in the MVP. NIST 800-63B-4 permits a password alone at the 15-character minimum, so this is acceptable for now. Add TOTP (a Better Auth plugin) if the app holds real student data at scale.

## Authorization

**Model:** Two roles, enforced by route namespace.

| Actor | Can do | Enforcement |
|---|---|---|
| Teacher (signed in) | CRUD on their own questions, tags, tests; close their own published tests; view and delete their own tests' attempts; view their own analytics | `requireTeacher` middleware on all `/api/teacher/*`, plus per-query scoping by teacher id |
| Student (anonymous) | Fetch a published test by share token (without answer keys), see that a closed test is closed (title and status only), submit attempts to a published test | `/api/public/*` only, with the checks listed below |

There is no admin role in the MVP.

**Teacher data isolation (ASVS V8, OWASP A01 Broken Access Control; ARCHITECTURE.md rule 11):**

- Every query in `services/` that reads or writes `questions`, `tags`, `tests`, `test_snapshots`, `attempts`, or `attempt_answers` is scoped to the signed-in teacher's id. For child tables, the scope is via a join to the owning `tests.teacher_id` or `questions.teacher_id`.
- Ownership is checked in the service layer, never in the client. The teacher id comes from the validated session, never from the request body, query, or path.
- Return 404, not 403, for another teacher's resource id, so ids can't be probed for existence.
- Referenced ids in a request body must be re-checked for ownership too: when a teacher builds a test from `questionIds`, or applies `tagIds`, every id must belong to that teacher. A foreign question id in `test_questions` would copy another teacher's question and answer key into a snapshot.
- Add a Vitest test with two teacher accounts: teacher B receives 404 on every `/api/teacher/*` read, update, delete, and analytics route for teacher A's resources, and cannot attach A's question or tag ids to B's test.

**Public student routes (unauthenticated):**

- *Share tokens:* random, at least 128 bits, from `node:crypto`, URL-safe (ARCHITECTURE.md rule 4). Lookup is by exact token. An unknown token, a draft test (null token), or a malformed token all return the same generic 404. A closed test returns 200 with its title and `status: closed` only, with no questions, and the allow-list test covers that shape. The token is a capability: anyone with the link can take the test.
- *Closed tests reject submissions server-side.* The submit handler loads the test by token and checks `status = 'published'` at submit time, inside the same transaction that inserts the attempt, so a close that races a submit cannot let the attempt through afterward. A closed test rejects with 409, which the client turns into the closed message, and a draft or deleted test gets the generic 404. Hiding the submit button in the client does not count. Add a Vitest test: submit to a closed test returns the rejection and writes no `attempts` row.
- *Grade only from the snapshot.* The submitted question keys must all belong to the test's snapshot. Unknown keys, duplicate keys, or the wrong response shape for a question's type are a 400. Never trust a client-sent score, points, or question text. The client sends only the student name and raw responses.
- *Answer keys never reach students.* Student responses are built by explicit DTO mappers in `apps/api/src/dto/`, and the Vitest allow-list test fails on any non-allow-listed field (ARCHITECTURE.md rules 2, 3, 14). This covers the fetch-test response, the submit response (score and max score only), and any error body. Error handlers must not echo snapshot content or stack traces. Keys also must not appear in logs.
- *No answer feedback to students.* Per the PRD, students see only a score. Do not add per-question correctness to student responses without updating the allow-list and the PRD, because correctness feedback with unlimited retries makes the answers recoverable.

**Rate limiting and size limits on public routes (ASVS V2 anti-automation, V4):**

- Rate-limit `/api/public/*` per client IP, with a stricter limit on `POST .../attempts` than on `GET`. Rate-limit token lookups too, to slow token guessing and scraping. With 128-bit tokens, guessing is infeasible, so this is mainly about abuse and load.
- Rate-limit `/api/auth/*` (Better Auth's limiter) and apply a general limit to `/api/teacher/*`.
- Set `express.json({ limit })` to 100 KB on public and teacher routes, unless a real need for a larger teacher limit appears. Reject oversized bodies with 413.
- Cap field sizes in Zod: student name length (1-80 characters after trimming), number of answers (at most the snapshot's question count), each short answer's length (up to 200 characters), and number of selected options (at most the question's option count).
- Cap writes per test where cheap: a very high attempt count on one test from one IP is a spam signal. Rate limiting is the control. Don't add an attempt limit per student (see below).
- Behind Railway's proxy, configure Express `trust proxy` for the correct number of hops. Otherwise every request appears to come from the proxy's IP, and one noisy student would be limited together with the whole class (or limiting would be skipped).

Rate limiting uses `express-rate-limit` (STACK.md, DEC-008).

> **Assumption:** The limits quoted above are starting points to tune, not confirmed numbers. An in-memory store is fine for one Railway instance. A shared store would be needed if the app ever scales to several instances.

> **Assumption:** A class often shares one school network, so many students may appear behind one IP. Limits on `POST .../attempts` must be generous enough for a whole classroom submitting at once.

**Accepted limits on trusting a result (product choices, see PRD.md):**

Self-typed names and unlimited retries are deliberate product choices. This document does not add identity checks, attempt limits, rosters, or lockouts, because they are out of scope. Teachers and any later reviewers should be aware of what this means for trust:

- A name proves nothing. A student can submit under someone else's name, misspell their own, or submit several times under different names. Treat a score as "someone who typed this name scored this", not as proof of who took the test.
- Unlimited retries plus an immediate score let a student probe for the answers by resubmitting. Because the link is shared and the score is shown immediately, a determined student can also hand answers to others. Showing only a score (not per-question correctness) slows this down but does not stop it.
- Every attempt is stored and shown to the teacher by name and time, so repeated submissions are visible. That is the only integrity signal the product offers.
- Consequently, results are suitable for low-stakes practice quizzes and formative checks. They are not a sound basis for high-stakes grading.

This limit does not weaken the controls above. Anonymity of students is a trust limit on results, not a license to skip validation, rate limiting, or closed-test enforcement.

## Secrets Management

- **Secrets in this app:** `BETTER_AUTH_SECRET` (signs and encrypts auth data), `DATABASE_URL` (includes DB credentials), and `BETTER_AUTH_URL` (not secret but environment-specific). Names match `.env.example` in ARCHITECTURE.md.
- **Never in source control (NIST SSDF PS.1, ASVS V13):** `.env` is gitignored. Only `.env.example` with placeholder values is committed. Run a secret scanner (for example gitleaks, or GitHub secret scanning and push protection) in CI or on the repo.
- **Per environment:** Local uses an untracked `.env`. Production secrets live in Railway service variables, not in the repo or the image. CI uses GitHub Actions secrets, and the CI Postgres service container uses throwaway credentials that never match production. Use different `BETTER_AUTH_SECRET` and database credentials per environment.
- **Strength and rotation:** Generate `BETTER_AUTH_SECRET` with a CSPRNG, 32 bytes or more (for example `openssl rand -base64 32`). The app must refuse to start in production if it is missing or is a known placeholder. `NODE_ENV` is required with no default, so a deploy that omits it stops at startup instead of running with development security. Rotating the secret invalidates existing sessions. Do that if it leaks, and note that teachers will need to sign in again.
- **Never logged:** Don't log `DATABASE_URL`, secrets, session cookies, request bodies of `/api/auth/*`, or answer keys. Database errors can carry query params such as session tokens and password hashes, so never log a Drizzle error's message. `apps/api/src/auth.ts` gives Better Auth a logger that writes only one line of its message and an error code, and sets `onAPIError.throw` because its router otherwise prints unexpected errors whole. The error handler in `apps/api/src/app.ts` then returns a generic 500. Direct `auth.api.*` calls throw to their caller, so `requireTeacher` and the shared error handler must follow the same rule. Logs should record method, route pattern (for example `/api/public/tests/:token`, never the raw URL, which holds the share token), status, and a request id.
- **Client bundle:** Nothing from `apps/api` env goes into `apps/web`. Only `VITE_`-prefixed variables reach the client bundle, so never put a secret in one.

## Database Security

- **Parameterized queries only (ASVS V1):** Use Drizzle's query builder. If raw SQL is needed (for analytics aggregates), use the `sql` template tag, which parameterizes interpolated values. Never build SQL by concatenating request input, and never use `sql.raw` with user-supplied values.
- **Least privilege:** The app connects with a dedicated role limited to the app's tables (SELECT, INSERT, UPDATE, DELETE), not a superuser. Run migrations with a separate, privileged credential at deploy time, so the runtime credential can't alter or drop schema.

> **Assumption:** Railway Postgres provisions a single default owner-level credential in `DATABASE_URL`, and splitting it into a runtime role and a migration role takes manual setup. Do it if practical, and otherwise record the gap. Railway's behavior here was not checked.

- **In transit:** The app and Railway Postgres run in the same Railway project. Prefer Railway's private network connection string for `DATABASE_URL` and use TLS if the connection crosses the public proxy. Confirm which URL is used and whether `pg` verifies TLS. Don't set `rejectUnauthorized: false` to make a connection work.
- **At rest, backups, region:** Not confirmed (see Before Production Checklist). Do not claim encryption at rest, backup frequency, or retention until checked against Railway's documentation.
- **Network exposure:** Don't enable a public TCP proxy for the database unless needed. If one is enabled for admin access, treat the credential as exposed to the internet and rotate it afterward.
- **Integrity:** Share tokens have a unique constraint and `attempts.test_id` is a foreign key. Foreign keys from `attempt_answers` back to `source_question_id` use `ON DELETE SET NULL`. Deleting a bank question archives it, so this is only a safeguard that keeps past results if a row is ever hard-deleted.
- **Pool and errors:** Limit the `pg` pool size to what the Railway plan's connection limit allows. Database errors are logged server-side and returned to clients as generic messages.
- **Migrations:** Schema-only, reviewed, and applied through drizzle-kit (ARCHITECTURE.md rule 13). No `drizzle-kit push` against production.

## Input Validation

**Server side is the security boundary (ASVS V2.2/V1):** the client's validation is UX only. Use the shared Zod schemas in `packages/shared` on the server for every request, and treat the client's use of them as a convenience.

- **Student name:** trim, require length 1-80, and reject control characters. It is stored and later shown to teachers, so it is the main stored-XSS vector in the product. Store it as-is and encode on output: React escapes text by default, so never use `dangerouslySetInnerHTML` with a student name, a question prompt, or an option. Names that look like HTML or spreadsheet formulas (`=`, `+`, `-`, `@` prefix) must be neutralized if a CSV export is ever added (none is planned).
- **Short answers:** length-capped and validated as strings. Normalization for grading (trim, collapse whitespace, case-insensitive) happens in the grading module and never changes what is stored in `response`.
- **Question content (teacher-authored):** prompts and options are plain text, length-capped, and rendered as text, never as HTML. The shared Zod schemas validate the JSONB shape for `options` and `answer_key` per `type` on every read and write (ARCHITECTURE.md), so malformed or unexpected JSONB is rejected.
- **Identifiers:** ids from path or query are validated as the expected type (UUID or integer, per the schema) before reaching a query. Share tokens are validated for length and character set before lookup.
- **Output encoding:** React's default escaping is the primary defense. Set a Content-Security-Policy with no `unsafe-inline` script (see Before Production Checklist). `style-src` may allow `unsafe-inline` only if TASK-005 proves Radix needs it, and that task records the reason and the check here.

## API Request & Parameter Validation

- **Every endpoint validates `body`, `params`, and `query`** with a Zod schema from `packages/shared`, through shared validation middleware in `apps/api/src/middleware/`. No handler reads `req.body` unvalidated.
- **Reject unexpected fields, don't drop them:** use `.strict()` object schemas on request bodies (Zod 4 also offers `z.strictObject`). An unknown field is a 400. This matters most for attempt submissions (no client-sent `score` or `awarded_points`) and for teacher writes (no client-sent `teacher_id`, `status`, `share_token`, or `points` fields outside the schema, which would allow mass assignment).
- **Separate schemas by audience:** student request and response schemas never extend teacher ones (ARCHITECTURE.md rule 5).
- **Methods and content type:** accept only `application/json` on body-carrying routes. Unsupported methods return 405 or 404.
- **Error handling:** validation failures return a 400 with field-level messages, with no stack traces, SQL, or snapshot content. Unknown `/api/*` paths return a JSON 404 (ARCHITECTURE.md rule 7).
- **Responses are validated too** in the client (`lib/api.ts` parses with the shared schema). On the server, the DTO mappers are the control for student responses.
- **No CORS (ARCHITECTURE.md rule 6):** do not add the `cors` package or wildcard CORS headers. The browser only talks to its own origin, so a cross-origin read is blocked by default.
- **Security headers:** use `helmet` (STACK.md, DEC-008) for `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, frame-ancestors restrictions, and a CSP. A referrer policy that avoids sending the `/t/<token>` URL to other sites is worth setting, because the token is in the URL path.

## File Uploads

**None planned.** The MVP has no file uploads: question content is plain text, answers are typed or selected, and the PRD lists no image, attachment, or import features. No upload endpoint, `multipart` parser, or object storage should exist. If uploads are ever added (for example images in questions), this section must be rewritten first: type allow-list verified by content, not extension; size limits; storage outside the web-served path; random filenames; and malware scanning.

## Student Data Privacy

The app stores student names alongside scores and each raw response, and teachers can see them. That is personal data about students.

- **What is stored:** `attempts.student_name`, `submitted_at`, scores, and `attempt_answers.response`. Names are self-typed, so they may be real, partial, or invented. No student email, account, or device identifier is collected. IP addresses are used transiently for rate limiting and should not be written to the database.
- **Compliance:** The user stated no compliance constraints, and it was not confirmed whether students are minors. Nothing here assumes they are or aren't. Once real schools use the app, laws such as FERPA (US), COPPA (US, children under 13), or GDPR (EU/UK) could apply, depending on who the students are, where they are, and who is operating the service. This note is not legal advice, and none of these are claimed to be met.
- **Data minimization:** collect only the name field, with no extra student fields. Tell students not to enter more than a first name or nickname, with a short line on the name entry screen (see assumption below).
- **Access:** only the owning teacher can read their students' attempts (see Authorization). Student data does not appear in logs, error messages, or analytics sent to third parties. Student requests use no third-party services. The only outside call is the breached-password check on teacher sign-up and password change, which sends no student data.
- **Retention and deletion:** Data is kept until the teacher deletes it, with no automatic expiry. A teacher can delete one attempt, or a whole test with its attempts (PRD.md Core Features). Deletion is permanent, is scoped to the owning teacher, and removes the related `attempt_answers`.

> **Assumption:** The name entry screen carries a brief notice ("Use your first name or a nickname"). This is a suggested design copy item, not confirmed.

- **Teacher account deletion:** an account-deletion path that removes the teacher's questions, tests, snapshots, and attempts is not specified. Decide before onboarding real classes.
- **Operator access:** the operator can read the database. This is true of any hosted data, and it should be considered when deciding what real schools are told.

## Before Production Checklist

**Before any real student data is stored:**

- [ ] Railway Postgres backups checked: whether they exist, their frequency, retention, and how to restore. Unconfirmed in STACK.md. Test one restore.
- [ ] Railway Hobby terms checked for the intended use. Hobby is described as for personal projects, and commercial-use terms are unconfirmed (PRD.md Open Question 2).
- [ ] Railway Postgres major version and its support status recorded (unconfirmed).
- [ ] Database encryption at rest and in-transit settings confirmed from Railway documentation, not assumed.
- [ ] Decide who is responsible for the checks above (PRD.md Open Question 2: recommended default is before any real class uses the app).
- [ ] If schools are involved, determine whether FERPA, COPPA, or GDPR applies and get proper advice.

**Authentication and sessions:**

- [x] Better Auth mounting on Express 5 verified (`toNodeHandler(auth)` at `/api/auth/*splat` before `express.json()`).
- [ ] Cookie is HttpOnly, Secure, SameSite=Lax in production, confirmed in a browser behind Railway's proxy.
- [x] `minPasswordLength` set to 15 and a generic sign-in error confirmed.
- [ ] Better Auth rate limiting verified active in production.
- [ ] Manual recovery procedure for forgotten passwords documented, or password reset built.
- [ ] Decision made on open teacher registration versus invite or allow-list.

**API and data:**

- [ ] No secrets in source control; secret scanning enabled; `.env` gitignored.
- [ ] `BETTER_AUTH_SECRET` generated with a CSPRNG and distinct per environment; app refuses to start without it.
- [ ] Every endpoint validates body, params, and query with strict Zod schemas on the server.
- [ ] Student allow-list test passes and covers every `/api/public/*` response, including errors.
- [ ] Cross-teacher isolation test passes (two teachers, every teacher route, foreign ids in request bodies).
- [ ] Closed-test submission rejection test passes, with no row written.
- [ ] Rate limiting active on `/api/public/*` and `/api/auth/*`; `trust proxy` configured for Railway; limits tested with a classroom-sized burst.
- [ ] JSON body size limit set and field length caps enforced.
- [ ] Database runtime credential is least-privilege, or the gap is recorded.
- [ ] No raw SQL built from user input; `drizzle-kit push` not used against production.
- [ ] Security headers and a CSP set; no `dangerouslySetInnerHTML` in the web app.
- [ ] No CORS package or wildcard headers.
- [ ] Dependencies scanned for known CVEs (`npm audit`) and patched, with the lockfile committed.
- [ ] Logs reviewed: no secrets, cookies, answer keys, or student data beyond ids.

## Notes

> *Security-adjacent topic — not yet checked against an internal standard; verify before shipping real auth/data-handling flows.*

**Assumptions made here (also marked inline):**

- Teacher self-registration is open, and there is no MFA in the MVP.
- The numeric rate limits are starting points.
- Railway Postgres credential splitting, TLS behavior, and `trust proxy` hop count are unchecked.
- The name-entry privacy notice is a suggestion.
- Verified in TASK-003 against the pinned version 1.7.15: the Better Auth mounting pattern and the config options named above (`minPasswordLength`, rate limiting, trusted origins). Their behavior behind Railway's proxy is still unverified.

**Open questions:**

1. Railway Postgres backups, retention, major version, and encryption settings (unconfirmed).
2. Railway Hobby terms for classroom use (unconfirmed).
3. Are students minors, and which of FERPA, COPPA, or GDPR could apply? (Unconfirmed; no constraints were stated.)
4. Teacher account deletion (undecided).
5. Open teacher sign-up versus invite-only before wider use.
6. When password reset and email verification are built, and the manual recovery procedure until then.
