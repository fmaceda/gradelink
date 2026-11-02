# Decisions — GradeLink

## DEC-001: API and client split (Express API plus React SPA)

- **Status:** Accepted
- **Context:** Solo builder, a few weekends, a fullstack app that must work on phones. The first proposal was a single Next.js app on Vercel with Neon Postgres and a single-package repo. The user rejected it and chose an Express API with a separate React client.
- **Decision:** Express 5.3.0 for the API and a React 19.3.1 + Vite 8.3.5 SPA with React Router 8.5.1 (library/data router mode) for the client.
- **Alternatives considered:**
  - Next.js, Remix, or React Router framework mode: no SSR need, and they add a second server runtime. Their one-deployable and no-API/client-split benefits are given up here, though DEC-002 recovers the one-deployable benefit.
  - TanStack Router: stronger typing, but React Router has the longer track record.
  - Express 4: old major, no benefit.
  - SvelteKit: smaller ecosystem.
  - Firebase or Supabase as the backend: answer-key security rules are easy to get wrong.
  - tRPC or an OpenAPI client: an extra layer on top of REST.
- **Trade-offs accepted:** Two apps to build and wire together instead of one framework. Shared types need a deliberate mechanism (see DEC-003). React Router 8 SPA mode and the React 19.3 / Vite 8 combination are to be proven in an early setup task.

## DEC-002: One deployable on Railway

- **Status:** Accepted
- **Context:** Solo builder who wants low operational overhead and a small monthly cost. Teacher sessions use cookies, which are simplest on one origin.
- **Decision:** Express serves the built client and the API under `/api`, on Railway Hobby ($5/month, includes $5 of usage) with Railway Postgres in the same project. Sessions are same-origin with no CORS. In dev, Vite `server.proxy` forwards `/api` to Express.
- **Alternatives considered:**
  - Render plus Neon: two vendors, Render's free tier sleeps after 15 minutes, and its free Postgres expires after 30 days.
  - Cloudflare for the SPA: splits origins, and Express is a poor fit on Workers.
  - Client on a CDN with the API on a separate origin: CORS with credentials and two deploy targets.
  - Fly.io and a VPS: not evaluated.
- **Trade-offs accepted:** Monthly cost. Hobby is described as "for personal projects", and commercial-use terms are unconfirmed. Railway Postgres backups, pricing, and major version are unconfirmed and must be checked before storing real student data. Static assets are not on a CDN.

## DEC-003: Single repo with a small npm workspace and shared Zod schemas

- **Status:** Accepted
- **Context:** The API and client need to agree on request and response shapes, and student-facing payloads must never carry answer keys.
- **Decision:** One repo, an npm workspace with no Turborepo or Nx: `apps/api` (Express, Drizzle, Better Auth, grading), `apps/web` (Vite, React, React Router), and `packages/shared` (Zod 4.6.7 schemas and types, with separate student-facing and teacher-facing schemas). Answer-key protection: grading only in `apps/api`, explicit response DTOs on student routes returning question text and options only, a Vitest test that fails on any student payload field that is not allow-listed, and share tokens that are random and 128 bits or more.
- **Alternatives considered:**
  - Single package with `client/` and `server/`: simpler, but blurs the boundary. A credible fallback.
  - Two repos: versioning overhead and type drift.
  - tRPC or an OpenAPI client: an extra layer on top of REST.
- **Trade-offs accepted:** Workspace setup overhead for a solo project. The allow-list test must be maintained as student payloads change.

## DEC-004: PostgreSQL with Drizzle ORM

- **Status:** Accepted
- **Context:** The user asked for a Postgres versus MongoDB analysis and then explicitly kept Postgres. The data is connected (questions reused across tests, tags), analytics aggregates are a core feature, and typed SQL is wanted.
- **Decision:** PostgreSQL (the managed host's current major) with Drizzle ORM 0.45.4, drizzle-kit 0.31.11, and pg 8.23.1.
- **Alternatives considered:**
  - MongoDB: its flexible question shapes and embedded snapshots are mostly covered by JSONB columns for type-specific options and published test snapshots. Its version and adapter specifics were not checked.
  - SQLite/Turso: Postgres is better for analytics and concurrent submissions.
  - Firebase or Supabase: see DEC-001.
- **Trade-offs accepted:** Schema migrations to manage. Question shapes that vary by type need care. The JSONB approach is a suggestion for ARCHITECTURE.md, not a confirmed decision. Drizzle's peerDependencies could not be read, so compatibility is to be proven in setup.

## DEC-005: Better Auth for teacher sign-in

- **Status:** Accepted
- **Context:** Only teachers have accounts, using email and password. Students enter a name and have no accounts. Session code is security-sensitive and the builder is solo.
- **Decision:** Better Auth 1.7.15 with a HttpOnly / Secure / SameSite=Lax cookie on the same origin. Mount `toNodeHandler(auth)` at `/api/auth/*splat` before `express.json()`.
- **Alternatives considered:**
  - Passport or hand-rolled sessions: more security-sensitive code to own.
- **Trade-offs accepted:** Dependence on a younger library. > **Assumption:** the mounting pattern comes from the advisor's knowledge, not a fetched doc, and must be confirmed in the first setup task. Better Auth compatibility with TypeScript 7 is unconfirmed (see DEC-006).

## DEC-006: TypeScript 6 rather than 7

- **Status:** Accepted
- **Context:** The latest TypeScript release is 7.0.2, but Drizzle and Better Auth compatibility under 7 is unconfirmed, and nothing in the project needs 7.
- **Decision:** TypeScript strict, pinned ~6.0.3, with Node.js 26.13.0 LTS (pin 26.x in CI and in `engines` / `.nvmrc`). The exact highest 6.0.x patch was not checked; the first setup task runs `npm view typescript@6.0 version` and pins it.
- **Alternatives considered:**
  - TypeScript 7.0.2: compatibility with key dependencies unconfirmed, no needed feature.
- **Trade-offs accepted:** Staying one major behind. To try 7 later, bump the version and run `tsc --noEmit`. The @types/node patch level against Node 26.13 is unverified.

## DEC-007: Tooling (UI, charts, tests, lint, CI)

- **Status:** Accepted
- **Context:** Solo builder, mobile-first UI, and a need for fast feedback on the grading and answer-key logic.
- **Decision:** Tailwind CSS 4.3.3 with @tailwindcss/vite 4.3.3 and shadcn/ui (Vite path); Recharts for charts; Vitest 5.0.5 and Playwright 1.64.1 (teacher-creates, student-submits flow on a mobile viewport); Biome 2.6.4; tsx 4.23.15; GitHub Actions running typecheck, Biome, Vitest, build, and Playwright against a Postgres service container.
- **Alternatives considered:**
  - No alternatives were evaluated for these nice-to-haves.
- **Trade-offs accepted:** Recharts version and React 19.3 compatibility are unconfirmed, as is shadcn/ui setup with Tailwind 4.3 and React 19.3. Both are to be proven in an early setup task.

## DEC-008: Rate limiting and security headers

- **Status:** Accepted
- **Context:** Student routes are public and unauthenticated, and SECURITY.md requires rate limits and security headers that the confirmed stack didn't include.
- **Decision:** Add express-rate-limit and helmet to the API. Their versions and Express 5 compatibility are verified against the npm registry in an early setup task, before they're pinned.
- **Alternatives considered:**
  - Custom middleware: more security-sensitive code to own.
- **Trade-offs accepted:** Two more dependencies to patch. An in-memory rate-limit store only works for one instance, which matches the single Railway service.
