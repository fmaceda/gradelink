# Product Requirements Document — GradeLink

## Product Description

GradeLink is a test-making web app, usable on phones, for teachers. A teacher builds a reusable bank of questions, assembles tests from it, and shares a test with students by public link. Students open the link, enter a name, answer, and submit, and see their score immediately. The app grades automatically and shows the teacher class-level analytics. It is being built because existing quiz tools (Google Forms, Typeform, Kahoot) fall short on reusable question banks, grading, and analytics.

## Problem Statement

Teachers can quiz students with tools like Google Forms, Typeform, or Kahoot, but those tools fall short on three things: reusable question banks, grading, and analytics. Without GradeLink, a teacher re-creates questions for each quiz, grades by hand or with limited tooling, and has little insight into how a class did on each question.

## Target Users

- **Teachers (primary):** create and sign in to an account, manage a question bank, build and share tests, and review grades and analytics. They are testing student knowledge.
- **Students:** take tests through a public link on a phone or computer. They have no account and identify themselves by typing a name.

## Goal

A teacher can create a test, share a link, and have grades ready automatically, with no manual grading.

## Core Features

- Teacher sign-in (email and password; teachers only).
- Question bank with topics or tags.
- Test building from bank questions.
- Sharing a test by public link.
- Student test-taking: enter a name, answer, submit, and see the score immediately.
- Auto-grading for multiple choice, true/false, and short exact-match answers, with partial credit on multiple-answer questions.
- Analytics: class scores and per-question correct rates. A question's correct rate is the total points earned divided by the total points possible across a test's submissions, calculated per test, so partial credit counts proportionally.
- Closing a test: a teacher can manually stop a published test from accepting submissions. There are no scheduled open or close windows.
- Deleting student data: a teacher can delete one attempt, or a whole test with its attempts.
- Mobile-friendly layout for both teacher and student screens.

## MVP

The MVP is the confirmed discovery scope:

- Teacher sign-in
- Question bank with topics or tags
- Tests built from the bank and shared by public link
- Students enter a name, answer, and submit, then see their score immediately
- Auto-grading for multiple choice, true/false, and short exact-match answers, with partial credit on multiple-answer questions
- Analytics for class scores and per-question correct rates

The user also confirmed two small additions during doc review: a manual control that lets a teacher close a published test to new submissions, and teacher deletion of one attempt or of a whole test with its attempts.

**Pushback on MVP size:** For one developer working a few weekends, this is not a true minimum. It is six capabilities that span auth, a content-management area (bank plus tags), a test builder, a public student flow, a grading engine with four question behaviors, and an analytics view. The stack adds setup work on top (an API and a client app, Postgres, a separate auth library, and several integrations flagged as unproven). The scope is kept as confirmed, since it was the user's call. The user confirmed the build order below; nothing is removed from the MVP unless the user decides so.

1. **Thin end-to-end slice first:** sign-in, create questions (multiple choice and true/false only), build a test, share the link, student submits, score appears. This alone delivers the goal for those question types.
2. **Then add:** short exact-match answers, multiple-answer questions with partial credit, and tags on bank questions.
3. **Last:** analytics. Recommended default: render class scores and per-question correct rates as simple tables first, with charts added only if time remains. Tags are the first thing to defer if the weekends run out, since tests can be built without them.

If the user wants to keep everything, the realistic expectation is that the MVP takes more than "a few weekends".

## Out of Scope

Confirmed in discovery:

- **Open-text and manual grading:** they break "grades ready automatically".
- **Rubrics:** not needed without open-text grading.
- **Randomized tests:** cut from the first version.
- **Rosters and identity checks:** name entry was chosen.
- **Time limits and other exam conditions:** cut from the first version.
- **Teacher-controlled score release:** immediate scores were chosen.

> **Assumption:** Because identity checks are out of scope, one-attempt limits are treated as out of scope too, since discovery did not list them separately.

## Success Criteria

Discovery gave a goal but no numeric targets. The criteria below are derived from the goal and are not user-confirmed.

> **Assumption:** The criteria below are proposed by the PRD author, not confirmed targets.

- A teacher can go from a signed-in session to a shared test link without any manual grading step, using only questions from the bank.
- After a student submits, a score is shown immediately and matches the automatic grading rules for all supported question types.
- The teacher can view class scores and per-question correct rates for a test without exporting or calculating anything by hand.
- A teacher can close a published test, after which no new submissions are accepted, and can delete one attempt or a whole test with its attempts.
- The student flow works on a phone-sized screen.
- No student-facing response contains answer keys (the stack enforces this with an allow-list test).

## User Stories / Use Cases

- As a teacher, I want to sign in with my own account, so that my question bank and tests are mine.
- As a teacher, I want to add questions to a bank and label them with topics or tags, so that I can reuse and find them later.
- As a teacher, I want to build a test from questions in my bank, so that I do not retype questions for each quiz.
- As a teacher, I want to share a test by a public link, so that students can take it without accounts.
- As a student, I want to open a link, enter my name, answer, and submit, so that I can take the test on any device without signing up.
- As a student, I want to see my score right after submitting, so that I know how I did.
- As a teacher, I want multiple choice, true/false, and short exact-match answers graded automatically, with partial credit on multiple-answer questions, so that I do not grade by hand.
- As a teacher, I want to see class scores and per-question correct rates, so that I can see how the class did and which questions were hard.
- As a teacher, I want to close a published test, so that it stops accepting submissions.
- As a teacher, I want to delete one attempt or a whole test with its attempts, so that I control what student data is kept.
- As a teacher, I want to delete a question from my bank, so that it no longer appears there or gets added to new tests, while tests already published keep their own copy.

## Assumptions

All assumptions from this document, in one place:

> **Assumption:** One-attempt limits are out of scope, because identity checks are out of scope and discovery did not list them separately.

> **Assumption:** The success criteria are proposed, not confirmed, and discovery set no numeric targets.

> **Assumption:** Teachers sign in with email and password (from the confirmed stack), and discovery did not mention password reset, email verification, or teacher self-registration. Teacher self-registration is assumed to be open and the others assumed to be later work.

> **Assumption:** Students can take a test on a standard phone or desktop browser; no offline use or native app is needed.

> **Assumption:** Teachers can view results only for their own tests.

> **Assumption:** No compliance requirement (for example FERPA or COPPA) was stated in discovery ("Hard constraints: None"), and none is assumed to apply. Student names are stored data; SECURITY.md carries a short student-data privacy note.

> **Assumption:** The product is for personal or small-scale classroom use for now; commercial use is not planned.

## Risks

- **Scope versus time:** the MVP is large for a solo developer on a few weekends (see MVP pushback). The likely failure mode is an unfinished analytics or tag feature.
- **Stack unknowns:** several stack pieces are unproven and must be proven in early setup tasks (Better Auth mounting on Express 5, React Router 8 SPA mode, shadcn/ui with Tailwind 4.3, Recharts compatibility, and Drizzle peer dependencies). Any could cost weekend time.
- **Answer-key exposure:** if a student-facing response leaks correct answers, the tests are worthless. The stack mitigates this with server-side grading and an allow-list test.
- **Student data stored:** the app stores student names alongside scores and answers. The handling is covered in SECURITY.md; the PRD records only that this data exists.
- **No identity check:** names are self-typed, so results can be duplicated, misspelled, or entered under someone else's name. Unlimited retries combined with immediate scores also let a student work out answers by resubmitting. Both are accepted by choice, and teachers can see repeat submissions, but this limits how far a teacher can trust a result.
- **Hosting terms and backups:** Railway Hobby is described as for personal projects, with commercial-use terms, backups, and Postgres version unconfirmed. These should be checked before real student data is stored.
- **Auto-grading edge cases:** even with the grading rules below settled, teachers may dispute how a particular answer was scored.

## Product Decisions

Confirmed by the user during doc review:

1. **Per-question feedback for students:** students see only their score after submitting, not which questions they got right or wrong. Showing correctness would let answers spread through the shared link.
2. **Repeat submissions under the same name:** every submission is kept as a separate result and shown to the teacher, labelled by name and submission time. Analytics count each submission.
3. **Short exact-match normalization:** trim leading and trailing whitespace, collapse repeated internal whitespace, and compare case-insensitively, with no other normalization.
4. **Partial credit on multiple-answer questions:** each correct option selected earns an equal share of the points, each incorrect option selected subtracts the same share, and the question score is floored at zero. The share is the question's points divided by its number of correct options.
5. **Editing a bank question after a test is published:** a published test keeps its own copy of its questions, so later bank edits affect only tests built afterward and never change existing grades.
6. **Question points:** each question's points are set in the bank, with no per-test override.
7. **Several accepted short answers:** a short-answer question can list more than one accepted answer, for example "USA" and "United States". Each is compared using the normalization in decision 3.
8. **No re-publishing:** a published test can't be re-published or synced after a bank question is edited. The teacher creates a new test instead.
9. **Score display:** students see points ("8 / 10"). Teacher views show percentages as well.
10. **Seeing a score again:** a student sees the score once, on the result screen. Reopening the link starts a new attempt.
11. **Closing during an attempt:** if a test closes while a student is taking it, the submission is rejected and the student sees the closed message.
12. **Unknown options:** a submission that references an option not in the test is rejected with a 400 error instead of being graded.
13. **Data retention:** student data is kept until the teacher deletes it, with no automatic expiry.
14. **Closing is one-way:** a closed test can't be reopened.
15. **Deleting a bank question archives it:** the question is hidden from the bank and can't be added to new tests. Published tests aren't affected, because they keep their own copy. A draft test that contains an archived question can't be published until the teacher removes that question.
16. **Unanswered questions:** students can leave questions unanswered, and those score 0. A blank short answer also scores 0.
17. **Fractional scores:** points are shown to at most 2 decimals and percentages to 1 decimal. Stored values are more precise.
18. **Class scores:** the analytics view shows average, high, and low, plus the per-submission table, with no distribution.
19. **Test length:** a test has at most 100 questions, and a question can't appear twice in one test.
20. **Question type:** a question's type can't change after it's created. The teacher creates a new question instead.
21. **Results order:** the submissions list shows newest first, with no column sorting in the MVP.
22. **Deleting a test during an attempt:** the submit gets the generic not-found response, and the student sees the invalid-link message.
23. **Tag rules:** a tag name has up to 50 characters, and names are unique per teacher, ignoring case.

## Open Questions

Each has a recommended default so the build is not blocked. Neither has been decided by the user.

1. **Analytics if time runs short:** analytics stays in the MVP and is built last, but it is not part of the main outcome. If the weekends run out, should it ship later? *Recommended default:* decide when the first two build steps are done.
2. **Hosting for real student data:** Who confirms Railway backups, commercial-use terms, and Postgres version, and when? *Recommended default:* before any real class uses the app.
