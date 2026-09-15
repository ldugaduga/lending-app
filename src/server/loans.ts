import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '@/db'
import { loans, installments } from '@/db/schema'
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

    const [loan] = await db
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

    await db.insert(installments).values(
      schedule.map((row) => ({
        loanId: loan.id,
        installmentNumber: row.installmentNumber,
        dueDate: new Date(row.dueDate),
        principalPortion: row.principalPortion,
        interestPortion: row.interestPortion,
        totalDue: row.totalDue,
      })),
    )

    return loan
  })
