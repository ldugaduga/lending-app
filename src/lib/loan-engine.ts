import Decimal from 'decimal.js'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

export type InterestType = 'fixed' | 'declining'
export type RepaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

const FREQUENCIES: RepaymentFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly']

function money(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

function validateTerms(principal: number, rate: number, termMonths: number) {
  const principalValue = new Decimal(principal)
  const rateValue = new Decimal(rate)

  if (!Number.isInteger(termMonths)) {
    throw new Error('Loan term must be a whole number of months.')
  }
  if (principalValue.lte(0)) {
    throw new Error('Principal must be greater than zero.')
  }
  if (rateValue.lt(0)) {
    throw new Error('Interest rate cannot be negative.')
  }
  if (termMonths < 1) {
    throw new Error('Loan term must be at least 1 month.')
  }

  return { principalValue: money(principalValue), rateValue, termValue: termMonths }
}

/**
 * Distribute a money amount into exact cent values whose sum equals `total`.
 * Mirrors the Python `_distribute_decimal`: remainder cents go to the first N parts.
 */
export function distributeMoney(total: Decimal, count: number): Decimal[] {
  if (count < 1) throw new Error('Distribution count must be at least 1.')
  const totalCents = money(total).mul(100).toDecimalPlaces(0).toNumber()
  const sign = totalCents < 0 ? -1 : 1
  const absCents = Math.abs(totalCents)
  const base = Math.floor(absCents / count)
  const remainder = absCents % count

  return Array.from({ length: count }, (_, index) => {
    const cents = sign * (base + (index < remainder ? 1 : 0))
    return new Decimal(cents).div(100)
  })
}

const PERIODS_PER_YEAR: Record<RepaymentFrequency, number> = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
}

export function getInstallmentCount(termMonths: number, repaymentFrequency: RepaymentFrequency = 'monthly'): number {
  validateTerms(1, 0, termMonths)
  if (!FREQUENCIES.includes(repaymentFrequency)) {
    throw new Error('Repayment frequency must be daily, weekly, biweekly or monthly.')
  }
  const periodsPerYear = PERIODS_PER_YEAR[repaymentFrequency]
  const raw = new Decimal(termMonths).mul(periodsPerYear).div(12)
  return Math.max(1, raw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber())
}

function fixedAmounts(principal: number, rate: number, termMonths: number, installmentCount?: number) {
  const { principalValue, rateValue, termValue } = validateTerms(principal, rate, termMonths)
  const totalInterest = money(principalValue.mul(rateValue).div(100))
  const count = installmentCount ?? termValue
  const principalParts = distributeMoney(principalValue, count)
  const interestParts = distributeMoney(totalInterest, count)
  return { principalValue, totalInterest, principalParts, interestParts }
}

function decliningAmounts(principal: number, rate: number, termMonths: number, installmentCount?: number) {
  const { principalValue, rateValue, termValue } = validateTerms(principal, rate, termMonths)
  const count = installmentCount ?? termValue
  const principalParts = distributeMoney(principalValue, count)
  const periodicRate = rateValue.div(100).div(count)

  let balance = principalValue
  const interestParts: Decimal[] = []
  for (const principalPart of principalParts) {
    interestParts.push(money(balance.mul(periodicRate)))
    balance = money(balance.sub(principalPart))
  }
  const totalInterest = money(interestParts.reduce((sum, v) => sum.add(v), new Decimal(0)))
  return { principalValue, totalInterest, principalParts, interestParts }
}

export interface LoanSummary {
  totalInterest: number
  totalAmount: number
  installmentAmount: number
  installmentCount: number
  firstPayment?: number
  lastPayment?: number
}

export function calculateFixedInterest(
  principal: number,
  rate: number,
  termMonths: number,
  repaymentFrequency: RepaymentFrequency = 'monthly',
): LoanSummary {
  const count = getInstallmentCount(termMonths, repaymentFrequency)
  const { principalValue, totalInterest, principalParts, interestParts } = fixedAmounts(
    principal, rate, termMonths, count,
  )
  const firstPayment = principalParts[0].add(interestParts[0])
  return {
    totalInterest: totalInterest.toNumber(),
    installmentAmount: firstPayment.toNumber(),
    installmentCount: count,
    totalAmount: money(principalValue.add(totalInterest)).toNumber(),
  }
}

export function calculateDecliningInterest(
  principal: number,
  rate: number,
  termMonths: number,
  repaymentFrequency: RepaymentFrequency = 'monthly',
): LoanSummary {
  const count = getInstallmentCount(termMonths, repaymentFrequency)
  const { principalValue, totalInterest, principalParts, interestParts } = decliningAmounts(
    principal, rate, termMonths, count,
  )
  const firstPayment = principalParts[0].add(interestParts[0])
  const lastPayment = principalParts[count - 1].add(interestParts[count - 1])
  return {
    totalInterest: totalInterest.toNumber(),
    installmentAmount: firstPayment.toNumber(),
    firstPayment: firstPayment.toNumber(),
    lastPayment: lastPayment.toNumber(),
    installmentCount: count,
    totalAmount: money(principalValue.add(totalInterest)).toNumber(),
  }
}

export interface ScheduleRow {
  installmentNumber: number
  dueDate: string // YYYY-MM-DD
  principalPortion: number
  interestPortion: number
  totalDue: number
  balanceRemaining: number
}

function advanceDueDate(start: Date, index: number, frequency: RepaymentFrequency): Date {
  const d = new Date(start)
  if (frequency === 'daily') {
    d.setUTCDate(d.getUTCDate() + index)
  } else if (frequency === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7 * index)
  } else if (frequency === 'biweekly') {
    d.setUTCDate(d.getUTCDate() + 14 * index)
  } else {
    d.setUTCMonth(d.getUTCMonth() + index)
  }
  return d
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function generateAmortizationSchedule(
  principal: number,
  rate: number,
  interestType: InterestType,
  termMonths: number,
  startDateStr: string,
  repaymentFrequency: RepaymentFrequency = 'monthly',
  interestDeductedUpfront = false,
): ScheduleRow[] {
  const count = getInstallmentCount(termMonths, repaymentFrequency)

  let principalValue: Decimal
  let principalParts: Decimal[]
  let interestParts: Decimal[]

  if (interestType === 'fixed') {
    ;({ principalValue, principalParts, interestParts } = fixedAmounts(principal, rate, termMonths, count))
  } else if (interestType === 'declining') {
    ;({ principalValue, principalParts, interestParts } = decliningAmounts(principal, rate, termMonths, count))
  } else {
    throw new Error('Interest type must be fixed or declining.')
  }

  const startDate = new Date(startDateStr + 'T00:00:00Z')
  if (isNaN(startDate.getTime())) {
    throw new Error('Start date must use YYYY-MM-DD format.')
  }

  if (interestDeductedUpfront) {
    interestParts = principalParts.map(() => new Decimal(0))
  }

  let balance = principalValue
  const schedule: ScheduleRow[] = []
  for (let i = 0; i < principalParts.length; i++) {
    const principalPart = principalParts[i]
    const interestPart = interestParts[i]
    balance = money(balance.sub(principalPart))
    const totalDue = money(principalPart.add(interestPart))
    schedule.push({
      installmentNumber: i + 1,
      dueDate: toISODate(advanceDueDate(startDate, i + 1, repaymentFrequency)),
      principalPortion: principalPart.toNumber(),
      interestPortion: interestPart.toNumber(),
      totalDue: totalDue.toNumber(),
      balanceRemaining: Decimal.max(balance, 0).toNumber(),
    })
  }
  return schedule
}

/**
 * Effective annual rate (XIRR-style) solved by bisection against dated cash flows.
 */
function effectiveAnnualRate(disbursedAmount: number, schedule: ScheduleRow[], startDateStr: string): number {
  if (disbursedAmount <= 0 || schedule.length === 0) {
    throw new Error('Net disbursed amount must be greater than zero.')
  }
  const startDate = new Date(startDateStr + 'T00:00:00Z')

  const npv = (rate: number): number => {
    let value = disbursedAmount
    for (const row of schedule) {
      const due = new Date(row.dueDate + 'T00:00:00Z')
      const years = Math.max(0, (due.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / 365.0
      value -= row.totalDue / Math.pow(1 + rate, years)
    }
    return value
  }

  let low = -0.9999
  let high = 1.0
  let lowValue = npv(low)
  let highValue = npv(high)
  while (lowValue * highValue > 0 && high < 1_000_000) {
    high *= 2
    highValue = npv(high)
  }
  if (lowValue * highValue > 0) return 0.0

  for (let i = 0; i < 120; i++) {
    const mid = (low + high) / 2
    const midValue = npv(mid)
    if (Math.abs(midValue) < 0.000001) {
      return Math.round(mid * 100 * 10000) / 10000
    }
    if (lowValue * midValue <= 0) {
      high = mid
    } else {
      low = mid
      lowValue = midValue
    }
  }
  return Math.round(((low + high) / 2) * 100 * 10000) / 10000
}

export interface LoanSummaryFull extends LoanSummary {
  repaymentFrequency: RepaymentFrequency
  processingFee: number
  insuranceFee: number
  interestDeductedUpfront: boolean
  disbursedAmount: number
  totalRepayment: number
  apr: number
}

export function getLoanSummary(params: {
  principal: number
  rate: number
  interestType: InterestType
  termMonths: number
  repaymentFrequency?: RepaymentFrequency
  processingFee?: number
  insuranceFee?: number
  interestDeductedUpfront?: boolean
  startDateStr?: string
}): LoanSummaryFull {
  const {
    principal, rate, interestType, termMonths,
    repaymentFrequency = 'monthly',
    processingFee = 0,
    insuranceFee = 0,
    interestDeductedUpfront = false,
    startDateStr,
  } = params

  const base = interestType === 'fixed'
    ? calculateFixedInterest(principal, rate, termMonths, repaymentFrequency)
    : calculateDecliningInterest(principal, rate, termMonths, repaymentFrequency)

  const principalValue = new Decimal(principal)
  const processing = new Decimal(processingFee)
  const insurance = new Decimal(insuranceFee)
  if (processing.lt(0) || insurance.lt(0)) {
    throw new Error('Loan fees cannot be negative.')
  }
  const upfrontInterest = interestDeductedUpfront ? new Decimal(base.totalInterest) : new Decimal(0)
  const disbursed = money(principalValue.sub(processing).sub(insurance).sub(upfrontInterest))
  if (disbursed.lte(0)) {
    throw new Error('Fees and upfront interest must be lower than the principal.')
  }

  const totalRepayment = money(
    principalValue.add(interestDeductedUpfront ? new Decimal(0) : new Decimal(base.totalInterest)),
  )

  let installmentAmount = base.installmentAmount
  let installmentCount = base.installmentCount
  let apr = 0

  if (startDateStr) {
    const schedule = generateAmortizationSchedule(
      principal, rate, interestType, termMonths, startDateStr,
      repaymentFrequency, interestDeductedUpfront,
    )
    installmentAmount = schedule[0].totalDue
    installmentCount = schedule.length
    apr = effectiveAnnualRate(disbursed.toNumber(), schedule, startDateStr)
  }

  return {
    ...base,
    installmentAmount,
    installmentCount,
    repaymentFrequency,
    processingFee: money(processing).toNumber(),
    insuranceFee: money(insurance).toNumber(),
    interestDeductedUpfront,
    disbursedAmount: disbursed.toNumber(),
    totalRepayment: totalRepayment.toNumber(),
    totalAmount: totalRepayment.toNumber(),
    apr,
  }
}
