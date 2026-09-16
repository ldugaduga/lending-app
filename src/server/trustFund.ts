import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import Decimal from 'decimal.js'
import { db } from '@/db'
import { trustFundContributions } from '@/db/schema'
import { getTotalEarnings } from '@/server/loans'
import { listClients } from '@/server/clients'
import { distributeMoney } from '@/lib/loan-engine'

const recordTrustFundContributionSchema = z.object({
  clientId: z.number(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'bank_transfer', 'card', 'other']).default('cash'),
})

export const listTrustFundContributions = createServerFn({ method: 'GET' }).handler(async () => {
  return db.query.trustFundContributions.findMany({
    with: { client: true },
    orderBy: (t, { desc }) => [desc(t.contributedAt)],
  })
})

export const recordTrustFundContribution = createServerFn({ method: 'POST' })
  .validator(recordTrustFundContributionSchema)
  .handler(async ({ data }) => {
    const [contribution] = await db.insert(trustFundContributions).values(data).returning()
    return contribution
  })

export const distributeEarnings = createServerFn({ method: 'POST' }).handler(async () => {
  const [totalEarnings, clients] = await Promise.all([getTotalEarnings(), listClients()])

  const activeClients = clients.filter((c) => c.status === 'active')
  if (activeClients.length === 0) {
    throw new Error('No active clients to distribute earnings to.')
  }

  // The undistributed-earnings check and the dividend inserts must happen in
  // the same synchronous transaction: reading it beforehand would let two
  // overlapping requests both see the same pre-distribution state and both
  // insert a full round of dividends, double-crediting every active client.
  return db.transaction((tx) => {
    const existingDividends = tx
      .select({ amount: trustFundContributions.amount })
      .from(trustFundContributions)
      .where(eq(trustFundContributions.type, 'dividend'))
      .all()

    const alreadyDistributed = existingDividends.reduce((sum, d) => sum + d.amount, 0)
    const undistributed = new Decimal(totalEarnings).minus(alreadyDistributed)
    if (undistributed.lessThanOrEqualTo(0)) {
      throw new Error('No earnings to distribute.')
    }

    const shares = distributeMoney(undistributed, activeClients.length)

    return activeClients.map((client, index) =>
      tx
        .insert(trustFundContributions)
        .values({
          clientId: client.id,
          amount: shares[index].toNumber(),
          type: 'dividend',
        })
        .returning()
        .get(),
    )
  })
})
