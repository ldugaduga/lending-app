import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '@/db'
import { clients, loans } from '@/db/schema'
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

export const updateClient = createServerFn({ method: 'POST' })
  .validator(createClientSchema.extend({ id: z.number() }))
  .handler(async ({ data }) => {
    const { id, ...rest } = data
    const [client] = await db.update(clients).set(rest).where(eq(clients.id, id)).returning()
    return client
  })

export const deleteClient = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const existingLoans = await db.select({ id: loans.id }).from(loans).where(eq(loans.clientId, data.id))
    if (existingLoans.length > 0) {
      throw new Error('Cannot delete a client with existing loans')
    }
    await db.delete(clients).where(eq(clients.id, data.id))
    return { id: data.id }
  })
