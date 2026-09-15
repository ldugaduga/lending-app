# AGENTS.md

Instructions for AI coding agents working in this project. Codex, OpenCode,
Cursor, GitHub Copilot, Gemini CLI, Aider, Zed, Windsurf and others read this
file.

Do not add AI attribution to commits or pull requests, including AI
`Co-Authored-By` trailers or generated-by signatures. Preserve genuine human
attribution.

## What this is

A lending app that covers the lifecycle of a small loan book: register a
borrower, price a loan with a decimal-safe interest engine, preview the exact
amortization schedule before committing, record payments against it, and see
which installments are overdue.

Four areas:

- **Clients** - add and list borrowers, suspend and reactivate
- **Loans** - create a loan (fixed or declining-balance interest), preview the
  full schedule before committing, view a loan's schedule and payment history
- **Payments** - record a payment, applied to the oldest unpaid installments
  first; the loan is marked `paid_off` once every installment is covered
- **Collections** - every outstanding installment across all loans, bucketed
  into Overdue, Due Today, Due This Week and Upcoming, derived from the schedule

See `README.md` for the loan engine's design and what is deliberately left out.

## Stack

- TanStack Start on Vite 7, `node-server` target
- React 19 with TanStack Router (file-based), Query, Table and Form
- Drizzle ORM over better-sqlite3, local `lending.db`
- Zod validation on every server function
- decimal.js for all loan arithmetic
- TypeScript strict, `@/*` alias to `src/`, npm

## Layout

```text
src/
  lib/loan-engine.ts    fixed/declining interest, schedule, APR. Pure, no db.
  db/schema.ts          clients, loans, installments, payments
  db/index.ts           the drizzle client
  server/*.ts           createServerFn handlers, one file per domain
  routes/*.tsx          file-based routes; routeTree.gen.ts is generated
```

## Conventions

- Every server-side operation is a `createServerFn` in `src/server/<domain>.ts`,
  `method: 'GET'` for reads and `'POST'` for writes.
- Every server function taking input declares a Zod schema via `.validator(...)`.
  No unvalidated input reaches the database.
- Route `loader` fetches initial data; the component passes it to `useQuery` as
  `initialData`. Mutations use `useMutation` and invalidate the query key.
- All money arithmetic goes through `decimal.js` in `loan-engine.ts`, never
  native float math. Split totals with `distributeMoney()` so the parts sum back
  to the exact total. Convert to `number` only at the storage or display edge.
- `loan-engine.ts` stays pure: no database access, no implicit clock reads.
- Schema changes ship with `npm run db:push`. There is no migrations directory.
- Styling is currently inline React style objects. That is placeholder; match it
  rather than introducing a second styling system mid-change.
- Never edit `src/routeTree.gen.ts` by hand.
- No em dashes in generated content: docs, comments, commit messages, specs.

## Commands

- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build`
- Production server: `npm run start`
- Push schema to the database: `npm run db:push`
- Database studio: `npm run db:studio`

No test, lint, typecheck or combined verify command is configured. Testing is
opt-in: when a `test` command is added here, tests become a gate for
logic-bearing changes. Until then, verify logic by running the app and the build.
