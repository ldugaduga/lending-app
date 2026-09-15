# Lending App — Clients / Loans / Payments / Collections

A focused TanStack Start app covering exactly four features:

1. **Clients** — add/list borrowers, suspend/activate
2. **Loans** — create a loan (fixed or declining-balance interest), preview the full amortization schedule before committing, view any loan's schedule + payment history
3. **Payments** — record a payment against a loan; it's automatically applied to the oldest unpaid installment(s) first, and the loan is marked `paid_off` once every installment is fully paid
4. **Collections** — a live view of every outstanding installment across all loans, bucketed into Overdue / Due Today / Due This Week / Upcoming — computed on the fly from the schedule, no separate tracking table needed

## Loan engine (`src/lib/loan-engine.ts`)

Ported from a reference Python engine, using `decimal.js` instead of floats to avoid rounding drift:

- **Fixed interest**: total interest computed once on the full principal/rate, then spread evenly across installments
- **Declining balance**: interest recalculated each period on the actual remaining balance, so later installments cost less
- **Cent-safe distribution**: `distributeMoney()` splits any total into exact cent values that always sum back to the original total (remainder cents go to the first N installments) — this is what keeps a 24-installment schedule from drifting a few cents off its stated total
- **Effective APR**: solved numerically (bisection method) against the dated cash flows — same idea as Excel's XIRR, not a shortcut formula
- **Frequencies**: daily / weekly / biweekly / monthly, each converting the loan term into an installment count and set of due dates

## Setup

```bash
npm install
npm run db:push      # creates lending.db with the schema
npm run dev          # http://localhost:3000
```

## Structure

```
src/
  lib/
    loan-engine.ts        # fixed/declining interest, schedule, APR
  db/
    schema.ts              # clients, loans, installments, payments
    index.ts
  server/
    clients.ts              # list/create/suspend clients
    loans.ts                # list/get/preview/create loans (generates schedule)
    payments.ts             # record payment, applies oldest-unpaid-first
    collections.ts          # derives overdue/due-today/etc from installments
  routes/
    clients.tsx
    loans.tsx                # list + create form w/ live preview
    loans.$loanId.tsx        # schedule + payment history + record payment
    collections.tsx
```

## What's intentionally left out (vs. a full lending platform)

No auth, no guarantors/collateral, no penalties/late fees, no SMS reminders, no PDF/Excel export, no multi-currency. These are all straightforward to layer on top of this schema later — the installments table already has everything needed to compute overdue penalties, and the loans table can grow a `guarantorId`/collateral relation without touching the engine.

## Notes on the payment logic

`recordPayment` currently applies a payment to the oldest open installment first, splitting across multiple installments if the payment is larger than one installment owes. If you want borrowers to pay a specific installment directly (rather than always oldest-first), pass an `installmentId` through the form and target that row instead — the `payments` table already has an optional `installmentId` column for this.
