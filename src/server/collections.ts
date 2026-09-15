import { createServerFn } from '@tanstack/react-start'
import { db } from '@/db'
import { installments } from '@/db/schema'
import { ne } from 'drizzle-orm'
import { todayInManila } from '@/lib/utils'

/**
 * Returns all outstanding installments (not fully paid) across every loan,
 * with their client/loan context, so the Collections view can group them
 * into overdue / due today / due this week / upcoming.
 */
export const listOutstandingInstallments = createServerFn({ method: 'GET' }).handler(async () => {
  const rows = await db.query.installments.findMany({
    where: ne(installments.status, 'paid'),
    with: {
      loan: { with: { client: true } },
    },
    orderBy: (i, { asc }) => [asc(i.dueDate)],
  })

  const today = new Date(todayInManila())

  return rows.map((row) => {
    const due = new Date(row.dueDate)
    due.setUTCHours(0, 0, 0, 0)
    const daysDiff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    let bucket: 'overdue' | 'today' | 'this_week' | 'upcoming'
    if (daysDiff < 0) bucket = 'overdue'
    else if (daysDiff === 0) bucket = 'today'
    else if (daysDiff <= 7) bucket = 'this_week'
    else bucket = 'upcoming'

    return {
      ...row,
      clientName: row.loan.client.name,
      clientPhone: row.loan.client.phone,
      bucket,
      daysDiff,
    }
  })
})
