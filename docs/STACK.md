# Tech Stack — GradeLink

## Core Stack

| Layer | Choice | Version (verified) | Why |
|---|---|---|---|
| Language | TypeScript (strict), Node.js LTS | TypeScript ~6.0.3 (exact highest 6.0.x patch not checked; first setup task runs `npm view typescript@6.0 version` and pins it); Node.js 26.13.0 LTS (pin 26.x in CI and in `engines` / `.nvmrc`) | One language across API, client, and shared schemas for a solo builder. TypeScript 6 rather than the latest 7.0.2 because Drizzle and Better Auth compatibility under 7 is unconfirmed and nothing needs 7. |
| API framework | Express | Express 5.3.0, @types/express 5.0.6 | Small, well-known REST layer. Grading and answer keys stay server-side in `apps/api`. |
| Client framework | React + Vite SPA, React Router (library/data router mode) | React 19.3.1, Vite 8.3.5, @vitejs/plugin-react 6.2.1, React Router 8.5.1 | No SSR need. A static SPA works on phones and is served by Express, so there is one deployable. |
| Database | PostgreSQL with Drizzle ORM | PostgreSQL: managed host's current major (not confirmed); Drizzle ORM 0.45.4, drizzle-kit 0.31.11, pg 8.23.1 | Connected data (questions reused across tests, tags) and analytics aggregates are core features. Typed SQL through Drizzle. |
| Teacher auth | Better Auth, email and password, teachers only | Better Auth 1.7.15 | Avoids owning security-sensitive session code. Students have no accounts. |
| Validation / shared types | Zod | Zod 4.6.7 | One schema source shared by API and client, with separate student-facing and teacher-facing schemas. |
| Hosting / Infra | Railway Hobby with Railway Postgres in the same project | $5/month, includes $5 of usage | One vendor for app and database. Express serves the built client and the API under `/api`. |

### Architecture notes tied to the stack

- **Sessions:** same origin, Better Auth HttpOnly / Secure / SameSite=Lax cookie, no CORS. In dev, Vite `server.proxy` forwards `/api` to Express.
- **Auth mounting:** mount `toNodeHandler(auth)` at `/api/auth/*splat` before `express.json()`. > **Assumption:** this comes from the advisor's knowledge, not a fetched doc; confirm in the first setup task.
- **Repo shape:** single repo, small npm workspace with no Turborepo or Nx:
  - `apps/api`: Express, Drizzle, Better Auth, grading
  - `apps/web`: Vite, React, React Router
  - `packages/shared`: Zod schemas and types, with separate student-facing and teacher-facing schemas
- **Answer-key protection:** grading lives only in `apps/api`. Student routes use explicit response DTOs that return question text and options only. A Vitest test fails on any student payload field that is not allow-listed. Share tokens are random, 128 bits or more.

### Alternative(s) considered

- **Hosting:**
  - Render plus Neon lost: two vendors, Render's free tier sleeps after 15 minutes, and its free Postgres expires after 30 days.
  - Cloudflare for the SPA lost: it splits origins, and Express is a poor fit on Workers.
  - Fly.io and a VPS were not evaluated.
- **Deployment shape:** client on a CDN with the API on a separate origin lost: CORS with credentials and two deploy targets.
- **Repo shape:**
  - Single package with `client/` and `server/` is simpler but blurs the boundary. It is a credible fallback.
  - Two repos lost: versioning overhead and type drift.
- **Type sharing:** tRPC or an OpenAPI-generated client lost: an extra layer on top of REST for a solo project.
- **Client framework:** Next.js, Remix, or React Router framework mode lost: no SSR need, and they add a second server runtime. The first proposal was a single Next.js app on Vercel with Neon, which the user rejected in favor of Express plus a separate React client.
- **Routing:** TanStack Router has stronger typing, but React Router has the longer track record.
- **API framework:** Express 4 lost: old major, no benefit.
- **Auth:** Passport or hand-rolled sessions lost: more security-sensitive code to own.
- **Database:** MongoDB was considered and not chosen. SQLite/Turso lost because Postgres is better for analytics and concurrent submissions.
- **Backend-as-a-service:** Firebase or Supabase lost: answer-key security rules are easy to get wrong.
- **Other frameworks:** SvelteKit lost: smaller ecosystem.

## Nice-to-haves

| Category | Choice | Why |
|---|---|---|
| UI / CSS library | Tailwind CSS 4.3.3, @tailwindcss/vite 4.3.3, shadcn/ui (Vite path) | Fast, mobile-friendly UI without hand-rolling components. |
| Charts | Recharts (version not confirmed) | Class-score and per-question analytics charts. |
| Testing library | Vitest 5.0.5; Playwright 1.64.1 | Vitest for unit and API tests, including the answer-key allow-list test. Playwright for the teacher-creates, student-submits flow on a mobile viewport. |
| Linter / formatter | Biome 2.6.4 | One fast tool for lint and format. |
| Dev runner | tsx 4.23.15 | Runs the TypeScript API in development without a build step. |
| API hardening | express-rate-limit, helmet (versions not yet verified) | Rate limits and security headers for the public, unauthenticated routes. Accepted by the user during second-wave review. |
| CI provider | GitHub Actions | Typecheck, Biome, Vitest, build, then Playwright against a Postgres service container. |

## Notes

- **Verification:** versions listed above were confirmed by the advisor during the Propose phase, except where marked as unconfirmed. This Record phase did not re-check them.
- **Not confirmed (prove in early setup tasks):**
  - The exact TypeScript 6.0.x patch.
  - express-rate-limit and helmet versions and their compatibility with Express 5.
  - Recharts version and React 19.3 compatibility.
  - shadcn/ui setup with Tailwind 4.3 and React 19.3.
  - React Router 8 API in SPA mode.
  - Better Auth mounting on Express 5.
  - @types/node patch level against Node 26.13.
  - Drizzle's peerDependencies could not be read.
- **Railway risks accepted:**
  - Monthly cost.
  - Hobby is described as "for personal projects"; commercial-use terms are unconfirmed.
  - Backups, pricing, and Postgres major version are unconfirmed. Check these before storing real student data.
- **Database detail (suggestion only, not a decision):** JSONB columns for type-specific question options and for published test snapshots could cover most of what MongoDB's flexible documents would offer. ARCHITECTURE.md owns this. MongoDB's version and adapter specifics were not checked.
- **TypeScript 7:** try later by bumping the version and running `tsc --noEmit`.
