# Design — GradeLink

> **Assumption:** Discovery surfaced no brand guidelines, colors, logo, or reference product. Everything visual below (fonts, palette, radii, spacing) is a neutral placeholder chosen by the design author, not a user choice. Swapping it later should only mean editing the theme tokens in `apps/web/src/styles.css`.

## Design Principles

1. **Phone-first for students, mobile-friendly for teachers.** Students open a shared link on whatever phone they have, so the student flow is designed at about 360 px wide first and scales up. Teacher screens (bank, test builder, analytics) must work on a phone but are designed for comfortable use on a laptop too. Discovery: "also works on phones", students take tests via a link.
2. **No accounts, no friction for students.** A student goes from link to name to questions to score with as few steps and as little text as possible. No sign-up prompts, no navigation chrome, nothing that is not the test. Discovery: students have no account and type a name.
3. **The score is the only result a student sees.** Student screens never show per-question correctness, correct answers, or hints about them, in text, color, or icons. This is a confirmed product decision (PRD Product Decisions 1), so the student UI has no "right/wrong" visual language at all.
4. **Plain and scannable for teachers.** Teachers want grades ready with no manual work, so screens are quiet and table-first: lists, filters, and tables before charts. Analytics are plain tables first; charts are added only if time remains (PRD MVP build order).
5. **Accessible by default, built from shadcn/ui.** Use the shadcn/ui primitives (Radix-based) for focus handling, labels, and dialogs rather than hand-rolling, so keyboard and screen-reader behavior comes with the components.

## Typography

> **Assumption:** The system font stack is used (no web font download), to keep student pages fast on phones and add no setup work for a solo builder. Not a user choice.

- **Font family:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for everything. Monospace (`ui-monospace`) only for the share link display.
- **Base size:** 16 px minimum for body text and all form inputs (prevents iOS Safari zooming on input focus).

| Step | Tailwind | Size / line height | Weight | Use |
|---|---|---|---|---|
| Display | `text-3xl` | 30 / 36 px | 700 | Student score on the result screen only |
| H1 | `text-2xl` | 24 / 32 px | 600 | Page title (test title, "Question bank") |
| H2 | `text-xl` | 20 / 28 px | 600 | Section headings, card titles, dialog titles |
| H3 | `text-lg` | 18 / 28 px | 600 | Question prompt in the student view, sub-sections |
| Body | `text-base` | 16 / 24 px | 400 | Default text, inputs, table cells, answer options |
| Small | `text-sm` | 14 / 20 px | 400 / 500 | Helper text, table headers, badges, tags |
| Caption | `text-xs` | 12 / 16 px | 400 | Timestamps and secondary metadata only; never for required information |

## Color Palette

> **Assumption:** Placeholder indigo-on-slate palette using Tailwind default colors, which map directly to shadcn/ui theme tokens. Hex values are Tailwind defaults; the contrast ratios noted were estimated against white (#FFFFFF) and should be re-checked with a contrast tool when the theme is set up.

| Role | Color | Usage |
|---|---|---|
| Primary | Indigo 600 `#4F46E5` (hover Indigo 700 `#4338CA`) | Primary buttons, links, focus ring, selected state. About 6:1 against white text. |
| Secondary | Slate 100 `#F1F5F9` (hover Slate 200 `#E2E8F0`) | Secondary buttons, tag chips, subtle fills. Text on it is Slate 900. |
| Background | White `#FFFFFF` | Page background |
| Surface | Slate 50 `#F8FAFC` with Slate 200 `#E2E8F0` border | Cards, table headers, panels |
| Text (primary) | Slate 900 `#0F172A` | Headings, body, input text |
| Text (muted) | Slate 600 `#475569` | Helper text, captions, table secondary columns. About 7:1 on white. |
| Success | Green 700 `#15803D` (tint Green 50 `#F0FDF4`) | "Published" badge, saved confirmations. Never used on student screens to signal answer correctness. |
| Warning | Amber 700 `#B45309` (tint Amber 50 `#FFFBEB`) | "Draft" badge, "closing a test" confirmation notes, repeat-submission marker |
| Danger | Red 700 `#B91C1C` (tint Red 50 `#FEF2F2`) | Destructive buttons (delete question), form errors, load/submit failure messages |

**Light/dark:** Light only. > **Assumption:** Discovery mentioned no dark mode, so none is designed. Using shadcn/ui CSS variables keeps it addable later.

**Color is never the only signal.** Status badges (Draft, Published, Closed) always carry text; errors always carry text and an icon.

## Core Components

Built from shadcn/ui components styled with Tailwind. Only components the MVP uses are listed. Radius: `rounded-md` (6 px) on controls, `rounded-lg` (8 px) on cards. Spacing on a 4 px grid (Tailwind default scale); page padding `p-4` on phones, `p-6` and up on larger screens.

### Buttons

- **Variants:** Primary (Indigo fill, one per screen or form), Secondary (Slate 100 fill), Outline/Ghost (low-emphasis actions such as Cancel, row actions), Destructive (Red 700 fill; used only inside confirmation dialogs or for deleting).
- **Size:** Minimum 44 x 44 px touch target on phones (`h-11`); `h-10` is allowed on desktop only for dense table row actions. Students' "Submit" and teachers' "Publish" are full width on phones.
- **States:** hover, visible focus ring (2 px Indigo with offset), disabled (reduced opacity, `aria-disabled`, not just color), and loading (spinner plus label like "Submitting...", button disabled to block double submits).
- Labels are verbs: "Add question", "Publish test", "Close test", "Submit answers".

### Cards

- Surface (Slate 50) with a 1 px Slate 200 border, no heavy shadows. Used for: a test in the teacher's test list, a question in the bank list and in the test builder, the score result, and the summary tiles (average, high, low) above analytics tables.
- A card is not clickable unless it has one clear primary action; the whole card links to that action with a visible focus state, and secondary actions (such as delete) are separate buttons.
- On phones cards stack in one column; from `md` up, lists may use two columns.

### Forms & Inputs

- One column, labels above inputs, always visible (no placeholder-as-label). Inputs `h-11`, 16 px text, Slate 300 border, Indigo focus ring.
- Required fields marked with text ("Required"), not only an asterisk. Helper text below in muted Small text.
- Validation errors appear under the field in Red 700 with an icon, linked via `aria-describedby`, and the form moves focus to the first invalid field on submit. Zod messages from `packages/shared` are shown as plain sentences.
- **Student name field:** single text input, label "Your name", required, autofocus on the start screen.
- **Answer inputs (student):** multiple choice = radio group; true/false = radio group of two large options; multiple answer = checkbox group, with the instruction "Select all that apply" in the prompt area; short answer = single-line text input. Each option is a full-width tappable row at least 44 px tall with the label as the hit area.
- **Submit (student):** always enabled, even with unanswered questions, which score 0. There is no confirmation prompt.
- **Points (teacher):** a numeric input on the question editor, defaulting to 1.
- **Question type (teacher):** chosen when creating a question and read-only when editing it.
- **Accepted answers (teacher, short-answer questions):** a list of text inputs with an "Add accepted answer" button. At least one is required.
- **Tags input (teacher):** type to add or pick existing tags as chips; a bank filter by tag uses the same chips.

### Navigation

- **Teacher app:** top bar with the product name, links to "Questions", "Tests", and a user menu (sign out). On phones the links collapse into a menu button (shadcn Sheet) with a 44 px target. The current page is marked with `aria-current="page"` and a visible indicator, not color alone.
- **Within a test:** the test page uses tabs, "Questions", "Share", and "Results", so a teacher stays in context. Tabs scroll horizontally if they overflow on phones.
- **Student flow:** no navigation bar. A minimal header shows only the test title. No links away from the test while it is in progress.
- **Signed-out teacher:** sign-in and create-account pages only, no app navigation.

### Data tables

For the question bank list (on larger screens), submission list, class scores, and per-question correct rates.

- Plain table with a Slate 50 header row, Small text headers, 1 px row dividers, right-aligned numbers, and no column sorting in the MVP. The submission list shows newest first.
- Fractional scores show points to at most 2 decimals and percentages to 1 decimal.
- On phones below `md`, the submission list reflows each row into a stacked card (name, score, time), and the per-question table scrolls horizontally inside a container with a visible scroll hint. Keep the primary identifier (student name or question prompt) visible.
- Teacher views show scores as points with a percentage. Each submission row has a "Delete submission" row action.
- Percentages are shown with the underlying count where useful (for example "72% (partial credit counts proportionally)" helper text on the correct-rate column header, matching the PRD definition).
- **Repeat submissions:** every submission is its own row, labelled with the student name and the submission date and time. Rows sharing the same name (case-insensitive) get a small Amber "Repeat" badge with text so the teacher can see it; they are not merged or hidden, and analytics count each one (PRD Product Decisions 2).
- Charts (Recharts) are optional and secondary: if built, they sit above or beside the table, never replace it, include a text title and an accessible table equivalent (the table itself), and use a color plus a label (not color alone).

### Status badges

Small pill with text: Draft (Amber), Published (Green), Closed (Slate, neutral). Used on the test list and the test page header. A closed test is visibly distinct from a draft.

### Dialogs and confirmations

shadcn Dialog/AlertDialog for destructive or hard-to-reverse actions: **Close test** (explains that students will no longer be able to submit, that existing results are kept, and that a closed test can't be reopened), **Publish test** (explains the questions are frozen as a copy and that later bank edits won't reach this test), **Delete question** (explains that published tests keep their own copy), **Delete submission**, and **Delete test** (explains that all its submissions are permanently deleted). Focus moves into the dialog, Escape cancels, the confirm button is the Destructive or Primary variant with a specific label ("Close test", not "OK").

### Share link control

A read-only, monospace input with the full student URL and a "Copy link" button that confirms with an inline "Copied" message (also announced via `aria-live="polite"`). Shown only when a test is published or closed (a closed test shows the link as inactive).

### Score result (student)

A centered card showing the Display-size score as points ("8 / 10") with the test title and the student's name entered. Shows nothing else about individual questions: no correct/incorrect marks, no answer review, no answers. A short neutral line such as "Your answers have been submitted." is allowed.

## UX Requirements

### Responsiveness

- **Mobile-first breakpoints** (Tailwind defaults): base for under 640 px (phones, the design target at 360 px), `sm` 640, `md` 768, `lg` 1024. Student screens use a single centered column (max width about 640 px) at every size.
- No horizontal page scrolling at 360 px. Only data tables may scroll horizontally, inside their own container.
- Teacher screens: single column on phones; from `lg`, the question bank and test builder may use a two-pane layout (list plus detail or selected questions).
- Touch targets at least 44 x 44 px on phones. Inputs at least 16 px text.
- The Playwright flow (teacher creates, student submits) runs at a mobile viewport, per the confirmed stack.

### Accessibility baseline

> **Assumption:** Target is WCAG 2.2 level AA as a baseline; discovery named no accessibility requirement or compliance standard.

- **Keyboard:** every interactive element is reachable and operable by keyboard in a logical order; visible focus indicator on all controls (never `outline: none` without a replacement); dialogs trap focus and restore it on close; no keyboard traps.
- **Contrast:** text at least 4.5:1 and UI component borders/focus at least 3:1. The palette above is chosen to meet this; recheck after any theme change.
- **Semantics and labels:** one H1 per page, real headings in order, labels bound to inputs, radio/checkbox groups wrapped in `fieldset` with `legend` (the question prompt), tables with proper header cells and captions.
- **Not color alone:** statuses, errors, repeats, and selected answers always have text or icon as well.
- **Announcements:** loading, saved, copied, and error messages use `aria-live` regions so screen readers hear them.
- **Motion:** no essential animation; respect `prefers-reduced-motion`.

### Required states per screen

Every screen defines these; none may be left as a blank page.

| Screen | Loading | Empty | Error |
|---|---|---|---|
| Sign-in / create account (teacher) | Button loading state while submitting | n/a | Inline form errors; generic "Email or password is incorrect" message that does not reveal which was wrong |
| Question bank (teacher) | Skeleton rows | "No questions yet" with an "Add question" button; with a tag filter and no matches: "No questions match this tag" plus a clear-filter action | Message with a "Try again" button |
| Question editor (teacher) | Skeleton when editing an existing question; save button loading state | n/a | Field-level validation errors; save failure message that keeps entered data |
| Test list (teacher) | Skeleton cards | "No tests yet" with a "Create test" button | Message with "Try again" |
| Test builder (teacher) | Skeleton | "No questions added yet" with a button to pick questions from the bank; if the bank itself is empty, point to "Add question" | Message with "Try again"; publish failure keeps the draft intact; if the draft contains a deleted question, publishing is blocked with a message naming it and a way to remove it |
| Test page: Share (teacher) | Skeleton | Draft state: "Publish this test to get a share link" | Copy failure message with the link still selectable |
| Test page: Results (teacher) | Skeleton table | "No submissions yet. Share the link with your students." | Message with "Try again" |
| Analytics (teacher) | Skeleton table | "Analytics will appear after the first submission" | Message with "Try again" |
| Student: start | Loading indicator while the test loads | n/a | Link not found: "This test link isn't valid. Check the link with your teacher." |
| Student: closed test | n/a | n/a | See below |
| Student: answering | Submit button loading state; inputs remain filled | n/a | Network failure on submit: a clear message with a "Try again" button; the typed name and selected answers are preserved so nothing is lost. If the test was deleted during the attempt, show the invalid-link message |
| Student: result | n/a | n/a | n/a (if the submit response fails, the error state above applies) |

**Closed test (student):** if a student opens a link for a closed test, the page shows the test title and a plain message: "This test is no longer accepting submissions." No form is shown. If a test is closed while a student is mid-way and they submit, the submission is rejected and the same message is shown (PRD Product Decision 11).

**Student result:** after submit, the student sees only their score (see Score result). They cannot go back to review answers or see the score again; reopening the link starts a new attempt (PRD Product Decision 10). No "already submitted" blocking screen is designed.

**Teacher form data:** before navigating away from an unsaved question or test draft, show a "Discard changes?" confirmation.

### Feedback and tone

Short, plain, and neutral language aimed at both teachers and students (including younger students). No jargon like "snapshot" or "DTO" in the UI; for publishing, say "Publishing freezes a copy of the questions for this test." No success celebrations or gamified elements on the student side.

### Scope guard

Not designed, because they are out of scope in the PRD: open-text or manual grading screens, rubrics, randomized-test settings, rosters or student identity checks, time-limit or exam-condition UI (timers, lock-down), and score-release controls. Re-publishing and reopening a test aren't designed either (PRD Product Decisions 8 and 14). No scheduled open/close pickers either; closing is a single manual action on the test page.

## Notes

- **Assumption:** No brand, palette, or reference product was given, so the visual system is a neutral placeholder (Tailwind default indigo/slate, system fonts, light only).
- **Assumption:** WCAG 2.2 AA is the target; not stated in discovery.
- **Assumption:** The "Repeat" badge and the matching of repeats by case-insensitive name are design proposals for how teachers see repeat submissions; the confirmed behavior is only that each is shown separately, labelled by name and time.
- **Assumption:** Teacher screens and the student screens share one visual system; the student screens simply hide navigation.
- shadcn/ui setup with Tailwind 4.3 and React 19.3 and Recharts compatibility are unconfirmed in the stack (STACK.md, ARCHITECTURE.md). If either fails in the setup task, fall back to plain Tailwind-styled elements and table-only analytics; this design does not depend on charts.
