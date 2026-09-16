import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

// Today's date as YYYY-MM-DD in Asia/Manila time (fixed UTC+8, no DST),
// independent of the server or browser's own local timezone.
export function todayInManila(): string {
  const manilaNow = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const year = manilaNow.getUTCFullYear()
  const month = String(manilaNow.getUTCMonth() + 1).padStart(2, '0')
  const day = String(manilaNow.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Formats a Date using its own local Y/M/D fields, never toISOString(),
// which would translate through UTC and can shift the date by a day.
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Per-client trust fund balances. Sorted by current balance, highest first.
// Shared by the Funds page (all clients) and the create-loan form (the single
// selected client).
//
// - initial: sum of deposit-type amounts only (manual contributions and
//   loan-drawdown returns) - what has ever flowed in as a deposit.
// - current: today's spendable balance - deposits and dividends minus
//   drawdowns.
// - total: initial + this client's own distributed dividends, independent of
//   any loan currently drawing down their fund.
export function computeTrustFundBalances(
  contributions: Array<{
    amount: number
    type: 'deposit' | 'drawdown' | 'dividend'
    client: { id: number; name: string }
  }>,
): Array<{ id: number; name: string; initial: number; current: number; total: number }> {
  type Accumulated = { id: number; name: string; initial: number; current: number; dividends: number }

  const balances = contributions.reduce((map, c) => {
    const existing = map.get(c.client.id)
    map.set(c.client.id, {
      id: c.client.id,
      name: c.client.name,
      initial: (existing?.initial ?? 0) + (c.type === 'deposit' ? c.amount : 0),
      current: (existing?.current ?? 0) + (c.type === 'drawdown' ? -c.amount : c.amount),
      dividends: (existing?.dividends ?? 0) + (c.type === 'dividend' ? c.amount : 0),
    })
    return map
  }, new Map<number, Accumulated>())

  return Array.from(balances.values())
    .map((b) => ({ id: b.id, name: b.name, initial: b.initial, current: b.current, total: b.initial + b.dividends }))
    .sort((a, b) => b.current - a.current)
}
