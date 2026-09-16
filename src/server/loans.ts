import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '@/db'
import { loans, installments, payments, trustFundContributions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateAmortizationSchedule, getLoanSummary } from '@/lib/loan-engine'

const createLoanSchema = z.object({
  clientId: z.number(),
  principal: z.number().positive(),
  interestRate: z.number().min(0),
  interestType: z.enum(['fixed', 'declining']),
  termMonths: z.number().int().positive(),
  repaymentFrequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).default('monthly'),
  startDate: z.string(), // YYYY-MM-DD
  fundDrawdown: z.number().nonnegative().optional(),
})

export const listLoans = createServerFn({ method: 'GET' }).handler(async () => {
  return db.query.loans.findMany({
    with: { client: true },
    orderBy: (loans, { desc }) => [desc(loans.createdAt)],
  })
})

export const getLoan = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    return db.query.loans.findFirst({
      where: eq(loans.id, data.id),
      with: {
        client: true,
        installments: { orderBy: (i, { asc }) => [asc(i.installmentNumber)] },
        payments: true,
        trustFundContributions: true,
      },
    })
  })

// Preview the schedule/summary before committing to a loan (used by the create-loan form)
export const previewLoan = createServerFn({ method: 'POST' })
  .validator(createLoanSchema)
  .handler(async ({ data }) => {
    const summary = getLoanSummary({
      principal: data.principal,
      rate: data.interestRate,
      interestType: data.interestType,
      termMonths: data.termMonths,
      repaymentFrequency: data.repaymentFrequency,
      startDateStr: data.startDate,
    })
    const schedule = generateAmortizationSchedule(
      data.principal, data.interestRate, data.interestType, data.termMonths,
      data.startDate, data.repaymentFrequency,
    )
    return { summary, schedule }
  })

export const createLoan = createServerFn({ method: 'POST' })
  .validator(createLoanSchema)
  .handler(async ({ data }) => {
    const schedule = generateAmortizationSchedule(
      data.principal, data.interestRate, data.interestType, data.termMonths,
      data.startDate, data.repaymentFrequency,
    )

    const fundDrawdown = data.fundDrawdown ?? 0
    if (fundDrawdown > 0) {
      if (fundDrawdown > data.principal) {
        throw new Error('Trust fund drawdown cannot exceed the loan principal.')
      }
      const clientContributions = await db
        .select({ amount: trustFundContributions.amount, type: trustFundContributions.type })
        .from(trustFundContributions)
        .where(eq(trustFundContributions.clientId, data.clientId))
      const balance = clientContributions.reduce(
        (sum, c) => sum + (c.type === 'drawdown' ? -c.amount : c.amount),
        0,
      )
      if (fundDrawdown > balance) {
        throw new Error('Trust fund balance is insufficient for this drawdown.')
      }
    }

    const loan = db.transaction((tx) => {
      const newLoan = tx
        .insert(loans)
        .values({
          clientId: data.clientId,
          principal: data.principal,
          interestRate: data.interestRate,
          interestType: data.interestType,
          termMonths: data.termMonths,
          repaymentFrequency: data.repaymentFrequency,
          startDate: new Date(data.startDate),
          status: 'active',
        })
        .returning()
        .get()

      tx.insert(installments)
        .values(
          schedule.map((row) => ({
            loanId: newLoan.id,
            installmentNumber: row.installmentNumber,
            dueDate: new Date(row.dueDate),
            principalPortion: row.principalPortion,
            interestPortion: row.interestPortion,
            totalDue: row.totalDue,
          })),
        )
        .run()

      if (fundDrawdown > 0) {
        tx.insert(trustFundContributions)
          .values({
            clientId: data.clientId,
            amount: fundDrawdown,
            type: 'drawdown',
            loanId: newLoan.id,
          })
          .run()
      }

      return newLoan
    })

    return loan
  })

export const updateLoan = createServerFn({ method: 'POST' })
  .validator(createLoanSchema.omit({ clientId: true, fundDrawdown: true }).extend({ id: z.number() }))
  .handler(async ({ data }) => {
    const existingLoan = await db.select({ id: loans.id }).from(loans).where(eq(loans.id, data.id))
    if (existingLoan.length === 0) {
      throw new Error('Loan not found')
    }

    const existingPayments = await db.select({ id: payments.id }).from(payments).where(eq(payments.loanId, data.id))
    if (existingPayments.length > 0) {
      throw new Error('Cannot edit a loan with recorded payments')
    }

    const schedule = generateAmortizationSchedule(
      data.principal, data.interestRate, data.interestType, data.termMonths,
      data.startDate, data.repaymentFrequency,
    )

    db.transaction((tx) => {
      tx.delete(installments).where(eq(installments.loanId, data.id)).run()
      tx.update(loans)
        .set({
          principal: data.principal,
          interestRate: data.interestRate,
          interestType: data.interestType,
          termMonths: data.termMonths,
          repaymentFrequency: data.repaymentFrequency,
          startDate: new Date(data.startDate),
        })
        .where(eq(loans.id, data.id))
        .run()
      tx.insert(installments)
        .values(
          schedule.map((row) => ({
            loanId: data.id,
            installmentNumber: row.installmentNumber,
            dueDate: new Date(row.dueDate),
            principalPortion: row.principalPortion,
            interestPortion: row.interestPortion,
            totalDue: row.totalDue,
          })),
        )
        .run()
    })

    return { id: data.id }
  })

export const deleteLoan = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    db.transaction((tx) => {
      tx.delete(payments).where(eq(payments.loanId, data.id)).run()
      tx.delete(installments).where(eq(installments.loanId, data.id)).run()
      tx.delete(loans).where(eq(loans.id, data.id)).run()
    })
    return { id: data.id }
  })
