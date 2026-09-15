import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '@/db'
import { clients } from '@/db/schema'
import { eq } from 'drizzle-orm'

const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export const listClients = createServerFn({ method: 'GET' }).handler(async () => {
  return db.select().from(clients).orderBy(clients.createdAt)
})

export const createClient = createServerFn({ method: 'POST' })
  .validator(createClientSchema)
  .handler(async ({ data }) => {
    const [client] = await db.insert(clients).values(data).returning()
    return client
  })

export const updateClientStatus = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number(), status: z.enum(['active', 'suspended']) }))
  .handler(async ({ data }) => {
    const [client] = await db
      .update(clients)
      .set({ status: data.status })
      .where(eq(clients.id, data.id))
      .returning()
    return client
  })
