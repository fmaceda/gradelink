# Test Plan — GradeLink

Each section cites the TASK IDs that build the feature. Limits used below come from the confirmed docs: student name 1-80 characters after trim, short answer up to 200 characters, JSON body 100 KB. Rate-limit numbers are chosen in TASK-022 and are not fixed by any doc.

## Teacher account: create account, sign in, sign out (TASK-003, TASK-009, TASK-010)

**Definition of done:** A teacher can create an account, sign in with email and password, reach only their own data, and sign out, after which the session no longer works.

- [ ] Happy path: create an account with a 15-character password, sign in, see the teacher shell (Questions and Tests links, user menu), sign out, and land on sign-in.
- [ ] Happy path: after sign-out, replaying the old session cookie against any `/api/teacher/*` route returns 401 (the server-side session row is deleted, not only the cookie cleared).
- [ ] Edge case: a 14-character password is rejected at create-account; a 15-character one and a 64+ character one containing spaces are accepted.
- [ ] Edge case: opening any teacher page while signed out redirects to sign-in; sign-in and create-account pages show no app navigation.
- [ ] Error handling: wrong password and unknown email both show the identical "Email or password is incorrect" message; the API error bodies are identical too.
- [ ] Error handling: a sign-in network failure shows an inline error and the button returns from its loading state.
- [ ] Permissions: every `/api/teacher/*` route returns 401 without a session; the teacher id used in queries comes from the session, never from the body.
- [ ] Input validation: malformed email is rejected inline, focus moves to the first invalid field, and the error is linked via `aria-describedby`.
- [ ] Input validation: repeated wrong sign-ins hit Better Auth's rate limit on `/api/auth/*` in a test environment that is configured, not rate-limiting-disabled.
- [ ] Input validation: registering with an already-used email shows a visible error and creates no second account.
- [ ] Config check: session cookie is HttpOnly, Secure (production), SameSite=Lax; no session token in `localStorage` or `sessionStorage`.

> **Assumption:** The breached-password check applies only if TASK-003 finds Better Auth supports it; otherwise it is a recorded gap, not a test.

## Question bank: multiple choice and true/false (TASK-008, TASK-011, TASK-012)

**Definition of done:** A teacher can create, list, open, and edit their own multiple-choice and true/false questions, each with points, and see them in the bank.

- [ ] Happy path: create a multiple-choice question (prompt, options, one correct, points left at default 1); it appears in the bank list with 1 point.
- [ ] Happy path: create a true/false question with 2 points; edit the prompt and points; reload and see the saved values.
- [ ] Edge case: first visit with no questions shows "No questions yet" and an "Add question" button.
- [ ] Edge case: points of 0.5 are accepted and stored exactly (numeric, not a float rounding); points of 0, a negative number, and non-numeric text are rejected.
- [ ] Edge case: the bank list renders as cards below `md` and as a table from `md`.
- [ ] Error handling: the list API failing shows an error message with "Try again"; a save failure shows a message and keeps the entered data in the form.
- [ ] Error handling: loading shows skeleton rows (list) or skeleton (edit existing).
- [ ] Error handling: leaving the editor with unsaved changes shows "Discard changes?"; cancelling stays, confirming leaves.
- [ ] Permissions: teacher B gets 404 (not 403) on get and update of teacher A's question id; teacher B's list does not include A's questions.
- [ ] Input validation: a body containing `teacher_id` (or any unknown field) is rejected with 400; a prompt or option over its length cap is rejected with a visible field error; a multiple-choice question with no correct option is rejected.
- [ ] Input validation: an update that changes a question's type is rejected, and the editor shows the type as read-only.
- [ ] Input validation: a prompt of `<img src=x onerror=alert(1)>` is stored and displayed as literal text, never executed.

> **Assumption:** The exact prompt/option length caps and option-count limits are set in TASK-008 and are not stated in any doc; testers should use the values TASK-008 records, one under and one over each.

## Question bank: short-answer and multiple-answer questions (TASK-024, TASK-025)

**Definition of done:** A teacher can create and edit short-answer questions with one or more accepted answers and multiple-answer questions with several correct options.

- [ ] Happy path: create a short-answer question with accepted answers "USA" and "United States"; reload and both are present in order.
- [ ] Happy path: create a multiple-answer question with 4 options, 3 correct, 4 points; the correct-option checkboxes persist.
- [ ] Edge case: removing the only accepted answer is blocked; at least one is required, with a visible message.
- [ ] Edge case: an accepted answer of exactly 200 characters is accepted; 201 is rejected with a field error.
- [ ] Edge case: a multiple-answer question with zero correct options is rejected.
- [ ] Error handling: save failure keeps the typed accepted answers and checkbox state.
- [ ] Permissions: teacher B gets 404 on teacher A's short-answer and multiple-answer questions across every changed route.
- [ ] Input validation: an accepted answer that is empty or whitespace-only is rejected; an accepted-answers value that is not an array is rejected with 400.
- [ ] Layout: editor has no horizontal scroll at 360 px and rows are at least 44 px tall.

> **Assumption:** Whether two accepted answers that normalize to the same text (for example "USA" and " usa ") are rejected or merely allowed is undefined; the plan only requires that grading still works either way.

## Tags and topics (TASK-027, TASK-028) — applies only if built

Tags are deferrable per TASKS.md. If deferred, mark this section "not built" and skip it; no other section depends on tags.

**Definition of done:** A teacher can attach tags to their questions and filter the bank by tag.

- [ ] Happy path: add tags "algebra" and "week 3" to a question, see them as chips on its card, and filter the bank by "algebra" to show only matching questions.
- [ ] Edge case: filtering by a tag with no matching questions shows "No questions match this tag" with a clear-filter action that restores the full list.
- [ ] Edge case: typing an existing tag name picks the existing tag rather than creating a duplicate (unique per teacher and name).
- [ ] Error handling: tag save failure shows a message and keeps the chips entered.
- [ ] Permissions: teacher B cannot see A's tags; setting a question's tags with A's tag id from B's session is rejected (404 or 400, no tag attached); same tag name for two teachers is allowed.
- [ ] Input validation: a tag name of HTML renders as text; a 50-character tag name is accepted; a 51-character or empty tag name is rejected; "Algebra" and "algebra" count as the same tag for one teacher.

## Deleting (archiving) a bank question (TASK-029, TASK-031)

**Definition of done:** Deleting a bank question removes it from the bank and from the add-to-test picker, while published tests keep serving and grading their own copy and a draft containing it cannot be published until it is removed.

- [ ] Happy path: delete a question via the "Delete question" dialog (it explains published tests keep their copy); it disappears from the bank list.
- [ ] Happy path: a test published before the deletion still serves the question to students and grades it correctly.
- [ ] Edge case: a draft that contains the question then deleted: Publish is blocked with a message naming the question and a way to remove it; after removal, publish succeeds.
- [ ] Edge case: adding the archived question to a test (by id, directly against the API) is rejected.
- [ ] Error handling: delete failure shows an error and the question stays in the list.
- [ ] Permissions: teacher B deleting A's question id gets 404 and A's question is still present.
- [ ] Dialog: Escape cancels, focus moves into the dialog and returns to the trigger on close, confirm button is labelled "Delete question".

## Building a test from bank questions (TASK-013, TASK-014)

**Definition of done:** A teacher can create a draft test, name it, choose and order bank questions, and see it in the test list as Draft with no share link.

- [ ] Happy path: create a test, add three bank questions, reorder two, remove one, save; reload and the order is preserved.
- [ ] Happy path: rename a draft; the new title shows in the list and page header.
- [ ] Edge case: first visit shows "No tests yet" with a "Create test" button; a new test shows "No questions added yet" with a button to pick from the bank; with an empty bank it points to "Add question".
- [ ] Edge case: status badge reads "Draft" as text (not color alone); draft response has no share token.
- [ ] Error handling: list/builder load failure shows "Try again"; a save failure keeps the draft intact.
- [ ] Error handling: leaving with unsaved changes shows "Discard changes?".
- [ ] Permissions: teacher B cannot get, rename, or edit A's draft (404); teacher B cannot attach A's question id to B's test (rejected, nothing copied).
- [ ] Input validation: unknown body fields (`status`, `share_token`, `teacher_id`, and a per-test `points`) are rejected with 400; a non-UUID question id is rejected; a repeated question id is rejected; a test of 100 questions is accepted and 101 is rejected.

## Publishing, snapshot, and share link (TASK-016, TASK-017)

**Definition of done:** Publishing a draft freezes a copy of its questions and produces a random share link that the teacher can copy; bank edits afterward never change that test.

- [ ] Happy path: publish via the dialog ("Publishing freezes a copy of the questions for this test."); badge becomes "Published"; Share tab shows a read-only monospace link and "Copy link" shows an inline "Copied" message announced via `aria-live`.
- [ ] Happy path: edit a bank question's prompt, options, answer, and points after publishing; the student view and grading of the published test are unchanged (existing grades never change); a test built afterward uses the new version.
- [ ] Happy path: the snapshot's points equal the bank question's points at publish.
- [ ] Edge case: publishing an empty test is rejected with a visible message; the draft stays a draft.
- [ ] Edge case: publishing an already published or closed test is rejected (no re-publish); the snapshot row is not modified.
- [ ] Edge case: Share tab of a draft shows "Publish this test to get a share link"; there is no link or copy button.
- [ ] Error handling: publish failure keeps the draft intact with no half-written state (no snapshot without status change, no status change without snapshot).
- [ ] Error handling: clipboard failure shows a message and the link remains selectable.
- [ ] Permissions: teacher B publishing A's draft gets 404 and the draft stays draft.
- [ ] Token check: generate many tokens; each is at least 16 random bytes encoded URL-safe (at least 22 characters), all unique; no `Math.random` in the token path.
- [ ] Layout: Publish button is full width at 360 px.

## Student: opening a test link (TASK-018, TASK-021, TASK-030, TASK-031, TASK-033)

**Definition of done:** A student opening a valid published link sees the title and the questions without any answer key; any invalid link gets the same generic not-found.

- [ ] Happy path: open `/t/<token>` for a published test at 360 px; see the loading indicator, then the start screen with a "Your name" field (autofocused), the "Use your first name or a nickname" notice, and the title only in the header; no navigation links.
- [ ] Edge case: a token that is unknown, a never-published draft, a malformed token (wrong length or characters), and the token of a deleted test all return the identical 404 body; the page shows "This test link isn't valid. Check the link with your teacher."
- [ ] Edge case: a closed test's link returns 200 with `title` and `status: closed` only (no questions, no ids); the page shows the title and "This test is no longer accepting submissions." with no form.
- [ ] Error handling: error bodies contain no stack, SQL, or snapshot content.
- [ ] Input validation: a token with 1 character, 10,000 characters, or `../` is rejected as the generic 404 before any DB lookup.
- [ ] Answer-key check: the open-content response lists question text and options only (see Cross-Cutting Checks).

## Student: answering and submitting (TASK-019, TASK-021, TASK-026, TASK-030, TASK-031, TASK-033)

**Definition of done:** A student enters a name, answers, submits, and sees only their score as points; every submission is stored as its own attempt.

- [ ] Happy path: submit a mixed test of all four types; the result card shows "N / M" in display size with the test title and the student's name, a neutral line at most, and no per-question correctness, no answer review, no correct/incorrect icons or colors.
- [ ] Happy path: the submit response body contains only score and max score.
- [ ] Edge case: the same name submits twice; two `attempts` rows exist, nothing is overwritten, and the second result is graded independently. Reopening the link starts a new empty attempt (the earlier score is not shown again).
- [ ] Edge case: name of exactly 80 characters is accepted; 81 is rejected; `"  Ana  "` is stored as `Ana`; a name of only spaces is rejected; a 1-character name is accepted.
- [ ] Edge case: a short answer of exactly 200 characters is accepted; 201 is rejected.
- [ ] Edge case: a JSON body just under 100 KB is processed; one over 100 KB returns 413.
- [ ] Edge case: leaving questions unanswered is allowed, and each scores 0; a blank short answer scores 0. Submit stays enabled with no confirmation prompt, and submitting with nothing selected shows 0 / M.
- [ ] Error handling: a submit after the test was deleted returns the generic 404, and the student sees the invalid-link message.
- [ ] Error handling: submitting while the test is closed returns 409, writes no `attempts` or `attempt_answers` rows, and the student sees "This test is no longer accepting submissions." (also for a test closed after the student loaded it and before they submit).
- [ ] Error handling: network failure on submit shows a clear message with "Try again"; name and selected answers are preserved; the submit button shows "Submitting..." and is disabled while in flight so a double tap makes one attempt.
- [ ] Error handling: a submission that references an option id not in the test returns 400 and is not graded or stored.
- [ ] Error handling: a failure partway through writing leaves no partial `attempts` row without its `attempt_answers` (single transaction).
- [ ] Input validation: reject with 400 and write nothing for each of: unknown question key, duplicate question key, wrong response shape for the type (string for a choice question, array for short answer), too many answers (more than the snapshot's question count), more selected options than the question has, a client-sent `score`, `awarded_points`, or any other extra field, a name containing a control character, a name with HTML (accepted as text only if it passes the rules, and displayed escaped to the teacher).
- [ ] Input validation: a non-JSON content type is rejected.
- [ ] Layout: radio and checkbox rows are at least 44 px tall, text and inputs at least 16 px, groups are in `fieldset` with `legend`, "Select all that apply" shown on multiple-answer questions, no horizontal scroll at 360 px.

## Auto-grading: multiple choice and true/false (TASK-015)

**Definition of done:** A multiple-choice or true/false answer earns the question's full points when it matches the key and 0 otherwise, computed only from the snapshot.

- [ ] Happy path: 1-point multiple choice answered correctly gives 1 of 1; true/false with 2 points answered correctly gives 2 of 2.
- [ ] Edge case: wrong answer gives 0 of the question's points (never negative); the max still counts toward the total, e.g. a 3-question test answering 2 of 3 correct with 1 point each gives 2 / 3.
- [ ] Edge case: a 0.5-point question answered correctly contributes exactly 0.5 and a test of 0.5 + 1 + 1.5 all correct gives 3 / 3 (no float drift such as 2.9999999).
- [ ] Edge case: no selection gives 0 of the question's points.
- [ ] Error handling: an unknown question type reaches the exhaustive `never` check and fails the typecheck, not a silent 0.
- [ ] Guard: a test or lint check fails if anything in `apps/api/src/grading/` imports `db/`, Express, `node:crypto`, or reads the clock or randomness.
- [ ] Input validation: a client-sent score is rejected, and grading never reads a live `questions` row.

> **Assumption:** Multiple choice and true/false are all-or-nothing with no negative marking; no doc states this explicitly, but the partial-credit decision applies only to multiple-answer questions.

## Auto-grading: short exact-match (TASK-023)

**Definition of done:** A short answer is correct when, after trimming edges, collapsing repeated internal whitespace, and case-insensitive comparison, it equals any one of the accepted answers.

- [ ] Happy path: accepted ["USA", "United States"]; responses `usa`, `USA`, `United States`, `  united   STATES  ` all earn full points.
- [ ] Edge case: `U.S.A.` and `USA.` earn 0 (punctuation still differs); with accepted answer "cafe", `café` earns 0 (accents still differ); `United  States` (two spaces) earns full points; `UnitedStates` earns 0.
- [ ] Edge case: the response exactly 200 characters long is graded normally; accepted answers are also normalized, so accepted `" Paris "` matches response `paris`.
- [ ] Edge case: an empty or whitespace-only response earns 0 (does not match unless an accepted answer is also empty, which creation forbids).
- [ ] Error handling: a short answer of the wrong type (number, array) is a 400, not graded as 0.
- [ ] Storage: the raw response is stored exactly as submitted (`"  united   STATES  "` is stored unchanged) while grading uses the normalized form.
- [ ] Rule location: normalization lives in one function with table-driven tests; no normalization in `apps/web`, `packages/shared`, a handler, or SQL.

> **Assumption:** Tabs and newlines count as whitespace to collapse; the decision says "repeated internal whitespace" without naming them. A single-line input makes newlines unlikely, but an API-level test with a tab should confirm the intended behavior.

## Auto-grading: multiple-answer partial credit (TASK-023)

**Definition of done:** A multiple-answer question awards an equal share of its points per correct option selected, subtracts an equal share per incorrect option selected, and never goes below zero.

Worked cases below use a 3-point question with correct options A, B, C and incorrect option D. The equal share is 3 / 3 = 1 point.

- [ ] Happy path: select A, B, C: 3 of 3. Select A, B: 2 of 3. Select A: 1 of 3.
- [ ] Mixed: select A, B, D: 1 + 1 - 1 = 1 of 3. Select A, B, C, D: 3 - 1 = 2 of 3.
- [ ] Floor at zero: select D only: raw -1, awarded 0 of 3 (stored and shown as 0, not -1). Select A and D: 1 - 1 = 0 exactly.
- [ ] None selected: 0 of 3.
- [ ] Fractional points: a 4-point question with correct A, B, C and incorrect D has a share of 4 / 3 = 1.3333... Select A, B: 2.6667 (8/3) of 4. Select A, B, D: 4/3 = 1.3333 of 4. Select A, B, C: exactly 4 (no 3.9999 from float arithmetic). Select D only: 0.
- [ ] Fractional totals: a test of one 1-point multiple-choice (correct) plus the 4-point question above with A, B selected scores 1 + 8/3 of 5, stored more precisely and displayed as 3.67 / 5 and 73.3%.
- [ ] Edge case: 1 correct option out of 2, 2 points (correct A, incorrect B; share 2 / 1 = 2): select A = 2, select A and B = 2 - 2 = 0, select B = raw -2, awarded 0.
- [ ] Error handling: selected option ids not in the question return 400; duplicate selected ids are rejected or collapsed with a defined result.
- [ ] Guard: no `===` on scores after arithmetic; one helper calculates from the totals so a full score stays exact.
- [ ] Display: scores go through the shared formatter, with points to at most 2 decimals and percentages to 1 decimal.

## Submissions list: Results tab (TASK-020)

**Definition of done:** The teacher sees every attempt of their own test, one row each, with name, submitted time, points, and percentage, and repeats are marked but never merged.

- [ ] Happy path: three students submit; Results shows three rows, newest first, with name, date and time, points ("8 / 10"), and percentage (80%).
- [ ] Edge case: "Ana" submits twice and "ana" once; three rows, each with a text "Repeat" badge on the same-name rows (case-insensitive); none merged or hidden.
- [ ] Edge case: no attempts shows "No submissions yet. Share the link with your students."
- [ ] Edge case: below `md` rows become stacked cards; from `md` a table with proper header cells.
- [ ] Error handling: load failure shows "Try again"; loading shows a skeleton table.
- [ ] Permissions: teacher B requesting A's test attempts gets 404.
- [ ] Input validation: a student name `<script>alert(1)</script>` renders as literal text in table and card.

## Closing a test (TASK-030, TASK-031)

**Definition of done:** A teacher can close their own published test once, after which students can only see that it is closed, no new submissions are accepted, and existing results are kept.

- [ ] Happy path: close via the "Close test" dialog (explains submissions stop, results are kept, cannot be reopened); badge becomes "Closed" (neutral, with text); the Share tab shows the link as inactive.
- [ ] Happy path: the closed test's GET returns 200 with title and `status: closed` only, no questions; the student page shows the title and "This test is no longer accepting submissions."
- [ ] Edge case: a student submits after a close: rejected, no `attempts` row. A student who started before the close and submits after sees the closed message, and their answers are not saved.
- [ ] Edge case: a close racing a submit (submit begun, close committed first) never lets the attempt through; tested with the status re-check inside the transaction.
- [ ] Edge case: closing is one-way; there is no reopen control, and re-calling close on a closed test returns 409. Closing a draft returns 409.
- [ ] Edge case: existing attempts remain visible in Results and analytics after close.
- [ ] Error handling: close failure shows an error and the test stays published.
- [ ] Permissions: teacher B closing A's test gets 404, and A's test remains published.
- [ ] Dialog: Escape cancels, focus is trapped and restored, confirm button labelled "Close test".

## Deleting one attempt (TASK-032)

**Definition of done:** A teacher can permanently delete one attempt of their own test, with its answers, leaving all other attempts intact.

- [ ] Happy path: "Delete submission" row action opens a confirmation dialog; confirming removes the row; its `attempt_answers` rows are gone from the database.
- [ ] Edge case: with two attempts under the same name, deleting one leaves the other, and its "Repeat" badge disappears if it is now unique.
- [ ] Edge case: deleting the last attempt returns Results to its empty state.
- [ ] Error handling: delete failure shows an error and the row remains; cancelling the dialog deletes nothing.
- [ ] Permissions: teacher B deleting A's attempt id gets 404 and the attempt remains; an attempt id from another of A's tests used with the wrong test id does not delete.
- [ ] Input validation: a non-UUID attempt id is rejected with 400.

## Deleting a test with its attempts (TASK-033)

**Definition of done:** A teacher can permanently delete one of their own tests and everything under it, without touching their bank.

- [ ] Happy path: "Delete test" dialog states all submissions are permanently deleted; after confirming the test is gone from the list and no `test_questions`, snapshot, `attempts`, or `attempt_answers` rows remain for it.
- [ ] Edge case: the old share link now returns the same generic 404 as an unknown token, and the student page shows the invalid-link message.
- [ ] Edge case: bank questions that were in the test are unchanged and still listed; other tests of the same teacher are unaffected.
- [ ] Edge case: deleting a draft test (no snapshot, no attempts) works.
- [ ] Error handling: failure shows an error and the test remains; cancelling deletes nothing.
- [ ] Permissions: teacher B gets 404 deleting A's test, and A's test and attempts remain.

## Analytics tables (TASK-034, TASK-035)

**Definition of done:** For a test, the teacher sees class scores and each question's correct rate, computed as total points earned over total points possible across all submissions, with every submission counted.

- [ ] Happy path: a 2-question test with Q1 (1 point) and Q2 (4 points, multiple-answer, correct A, B, C, incorrect D); four submissions give Q2 awards of 4, 8/3, 4/3, 0. Q2 correct rate is (4 + 8/3 + 4/3 + 0) / 16 = 8 / 16 = 50%, shown as points with percentage; the header helper says partial credit counts proportionally.
- [ ] Happy path: a second worked case with 3-point question and awards 3, 2, 1, 0 gives 6 / 12 = 50%.
- [ ] Edge case: repeat submissions under the same name are each counted; two identical rows double the denominator and numerator.
- [ ] Edge case: a question that every student got fully wrong shows 0%; fully right shows 100%.
- [ ] Edge case: a test with no attempts shows "Analytics will appear after the first submission"; no divide-by-zero or NaN in the API or UI.
- [ ] Edge case: deleting one attempt, or deleting the test, changes or removes the figures; bank edits after publish do not change them.
- [ ] Edge case: correct rate is per test; the same bank question in two tests has independent rates.
- [ ] Edge case: closed tests still show analytics.
- [ ] Error handling: load failure shows "Try again"; loading shows a skeleton.
- [ ] Permissions: teacher B gets 404 on A's analytics and per-question analytics routes.
- [ ] Layout: below `md` the per-question table scrolls horizontally inside its own container with a visible scroll hint, with the question prompt still visible; numbers right-aligned.
- [ ] Happy path: class scores show average, high, and low plus each submission's score, and the summary tiles agree with the rows.
- [ ] Rule check: analytics are SQL aggregates, not a JavaScript loop over all attempts.

## Analytics charts (TASK-036) — applies only if built

Charts are deferrable per TASKS.md and require TASK-004 to have proven Recharts. If not built, mark "not built" and skip.

**Definition of done:** Charts appear with the tables as an addition, and the tables remain the accessible equivalent.

- [ ] Happy path: a chart appears above or beside the tables with a text title, and its values match the table.
- [ ] Edge case: with no attempts no empty or broken chart appears; the empty-state text shows.
- [ ] Edge case: the chart uses color plus a label, not color alone; the table is still present.
- [ ] Student bundle: the student page (`/t/<token>`) does not download the Recharts chunk.
- [ ] Error handling: if the chart fails to render, the tables still render.

## Cross-Cutting Checks

- [ ] Responsive layout at 360 px: student flow (start, answering with all four question types, result, invalid link, closed) and all teacher screens (sign-in, bank, editor, test list, builder, Share, Results, Analytics) have no horizontal page scroll; only data tables scroll inside their own container (TASK-010, 012, 014, 021, 025, 026, 035).
- [ ] Touch and text size: tappable rows and buttons at least 44 x 44 px on phones; body text and all inputs at least 16 px (no iOS zoom on focus); the student Submit and teacher Publish buttons are full width on phones.
- [ ] Keyboard navigation: every screen is fully operable by keyboard in logical order with a visible focus indicator; dialogs (Publish, Close test, Delete question, Delete submission, Delete test, Discard changes) trap focus, close with Escape, and restore focus; tabs on the test page are keyboard operable; radio and checkbox groups work with arrow keys and space; no keyboard traps.
- [ ] Accessibility semantics: one H1 per page; labels bound to inputs; choice groups in `fieldset` with `legend`; tables with header cells; loading, saved, copied, and error messages announced via `aria-live`; `aria-current="page"` on the current nav link; status never by color alone.
- [ ] Error states match DESIGN.md: for each screen in the "Required states per screen" table, force loading, empty, and error and confirm the exact text and actions ("No questions yet", "No tests yet", "No questions added yet", "No submissions yet. Share the link with your students.", "Analytics will appear after the first submission", "Try again", "This test link isn't valid. Check the link with your teacher.", "This test is no longer accepting submissions."); none is a blank page.
- [ ] Error bodies: every API error is `{ error: { code, message } }` with no stack, SQL, snapshot content, or internal ids; unknown `/api/*` paths return a JSON 404, never the SPA HTML; unsupported methods return 405 or 404.
- [ ] Student answer-key allow-list (TASK-018, 019, 024, 030): the Vitest test walks every `/api/public/*` response across all three shapes: open content (question text and options only), submit response (score and max score only), and closed-test response (title and status only), including error bodies (404, 400, 413, 429, closed rejection), comparing field paths to an explicit list. Seed a test containing all four question types and assert that answer keys, accepted short answers, correct option ids, `snapshot_question_key`, `source_question_id`, and teacher ids never appear in any of them. Adding a field to a student DTO without editing the allow-list fails the test. Student schemas must not import from `teacher/`.
- [ ] Cross-teacher isolation (TASK-009 harness, extended by TASK-011, 013, 016, 020, 024, 027, 029, 030, 032, 033, 034): with two teacher accounts, teacher B gets 404 (never 403) for teacher A's resource on every `/api/teacher/*` read, update, delete, publish, close, and analytics route; B cannot attach A's question or tag ids to B's test or question; B's lists never include A's items. Add a route-inventory check so a new teacher route without an isolation case fails.
- [ ] Rate limits with a classroom-sized burst (TASK-022): 40 students from one IP fetching the test and submitting within one minute are not blocked (no 429); abusive volume from one IP gets 429 on `POST .../attempts`, with the stricter limit than on `GET`; token lookups are limited; `/api/teacher/*` has a general limit; Better Auth's limiter is active on `/api/auth/*`; limits are per client IP and, behind Railway's proxy, `trust proxy` makes two different client IPs counted separately.
- [ ] Size and field limits: body over 100 KB returns 413 on public and teacher routes; every Zod cap (name 1-80, short answer up to 200, answer count, selected-option count) is rejected one past its limit and accepted at its limit.
- [ ] Strict validation: every endpoint rejects unknown body fields with 400 and validates body, params, and query; ids from path or query that are not the expected type are rejected before a query.
- [ ] Output encoding: names, prompts, options, titles (and tags if built) containing HTML render as text; no `dangerouslySetInnerHTML` in `apps/web`.
- [ ] Headers and CSP (TASK-005, TASK-037): built SPA served with helmet headers, CSP with no `unsafe-inline` script, and a referrer policy that does not leak `/t/<token>` URLs; no `cors` package or wildcard CORS header.
- [ ] Logs: request logs hold method, route pattern (never the raw URL, which holds the share token), status, and request id only; no bodies, cookies, tokens, answer keys, or student names.
- [ ] Atomicity: publish and submit each run in one transaction; a forced failure mid-way leaves no partial snapshot or attempt.
- [ ] Production-readiness gates (TASK-037 to TASK-039): SECURITY.md's Before Production Checklist code items each have a passing test or recorded check; TASK-039 items (backups with a restore tested, Hobby terms, Postgres version, encryption, FERPA/COPPA/GDPR decision, open vs invite registration) are verified by documentation and action, not code.
- [ ] End-to-end (TASK-021, 026, 031): the mobile-viewport Playwright test covers teacher creates and publishes, student submits a mixed four-type test, score appears, teacher sees the row, teacher closes, student sees the closed message; it runs in CI.

## Notes

- Sections for Tags (TASK-027/028) and Analytics charts (TASK-036) apply only if built; the rest are MVP.
- Setup tasks (TASK-001, 002, 004, 006, 038) are verified by the proof steps written in their own task text and are not given feature sections here, except where they surface in Cross-Cutting Checks.
- The worked grading examples use the confirmed share: points divided by number of correct options, for both reward and penalty (PRD Product Decision 4).
- No numeric rate-limit thresholds or prompt and option caps are fixed by the docs; tests use whatever TASK-022 and TASK-008 record.
