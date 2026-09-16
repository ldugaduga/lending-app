import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '@/db'
import { trustFundContributions } from '@/db/schema'

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
