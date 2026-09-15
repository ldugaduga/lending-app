import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '@/db'
import { payments, installments, loans } from '@/db/schema'
import { eq, and, asc, ne } from 'drizzle-orm'

const recordPaymentSchema = z.object({
  loanId: z.number(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'bank_transfer', 'card', 'other']).default('cash'),
})

export const listPayments = createServerFn({ method: 'GET' })
  .validator(z.object({ loanId: z.number().optional() }).optional())
  .handler(async ({ data }) => {
    if (data?.loanId) {
      return db.query.payments.findMany({
        where: eq(payments.loanId, data.loanId),
        orderBy: (p, { desc }) => [desc(p.paidAt)],
      })
    }
    return db.query.payments.findMany({
      with: { loan: { with: { client: true } } },
      orderBy: (p, { desc }) => [desc(p.paidAt)],
    })
  })

/**
 * Records a payment against a loan and applies it to the oldest unpaid/partial
 * installments first, marking each fully-covered installment as paid.
 */
export const recordPayment = createServerFn({ method: 'POST' })
  .validator(recordPaymentSchema)
  .handler(async ({ data }) => {
    const [payment] = await db.insert(payments).values(data).returning()

    const openInstallments = await db
      .select()
      .from(installments)
      .where(and(eq(installments.loanId, data.loanId), ne(installments.status, 'paid')))
      .orderBy(asc(installments.installmentNumber))

    let remaining = data.amount
    for (const inst of openInstallments) {
      if (remaining <= 0) break
      const owed = inst.totalDue - inst.amountPaid
      const applied = Math.min(remaining, owed)
      const newAmountPaid = inst.amountPaid + applied
      const newStatus = newAmountPaid >= inst.totalDue - 0.005 ? 'paid' : 'partial'

      await db
        .update(installments)
        .set({ amountPaid: newAmountPaid, status: newStatus })
        .where(eq(installments.id, inst.id))

      remaining -= applied
    }

    // If every installment is now paid, mark the loan paid off
    const stillOpen = await db
      .select()
      .from(installments)
      .where(and(eq(installments.loanId, data.loanId), ne(installments.status, 'paid')))

    if (stillOpen.length === 0) {
      await db.update(loans).set({ status: 'paid_off' }).where(eq(loans.id, data.loanId))
    }

    return payment
  })
