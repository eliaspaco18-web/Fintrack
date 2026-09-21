export type LoanRateVerdict = 'ECONOMICAL' | 'MARKET' | 'EXPENSIVE'

type SchedulePayment = Readonly<{ dueDate: string; totalAmount: number }>

function toUtcDay(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const timestamp = Date.parse(`${isoDate}T00:00:00Z`)
  return Number.isFinite(timestamp) ? timestamp / 86_400_000 : null
}

export function calculateScheduleTceaPercent(params: {
  principalAmount: number
  disbursementDate: string
  payments: readonly SchedulePayment[]
}): number | null {
  if (!Number.isFinite(params.principalAmount) || params.principalAmount <= 0) return null
  const disbursementDay = toUtcDay(params.disbursementDate)
  if (disbursementDay === null || params.payments.length === 0) return null

  const cashflows = params.payments.map(payment => {
    const dueDay = toUtcDay(payment.dueDate)
    return {
      days: dueDay === null ? Number.NaN : dueDay - disbursementDay,
      amount: payment.totalAmount,
    }
  })

  if (cashflows.some(flow => !Number.isFinite(flow.amount) || flow.amount < 0 || flow.days <= 0)) return null
  if (cashflows.reduce((sum, flow) => sum + flow.amount, 0) <= params.principalAmount) return null

  const netPresentValue = (annualRate: number) => cashflows.reduce(
    (sum, flow) => sum + flow.amount / Math.pow(1 + annualRate, flow.days / 365),
    -params.principalAmount,
  )

  let low = 0
  let high = 10
  if (netPresentValue(high) > 0) return null

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2
    if (netPresentValue(middle) > 0) low = middle
    else high = middle
  }

  return Math.round(((low + high) / 2) * 10_000) / 100
}

export function getLoanRateVerdict(
  tceaPercent: number,
  marketRatePercent: number,
): LoanRateVerdict | null {
  if (!Number.isFinite(tceaPercent) || !Number.isFinite(marketRatePercent)) return null
  const difference = tceaPercent - marketRatePercent
  if (difference < -2) return 'ECONOMICAL'
  if (difference > 2) return 'EXPENSIVE'
  return 'MARKET'
}
