export type MonthSummaryRow = { type: string; amount_pen: number | string | null }

export function summarizeMonth(rows: MonthSummaryRow[]) {
  let income = 0
  let expense = 0
  let incomeComplete = true
  let expenseComplete = true
  for (const row of rows) {
    if (row.type !== 'INCOME' && row.type !== 'EXPENSE') continue
    const amount = row.amount_pen === null ? NaN : Number(row.amount_pen)
    if (!Number.isFinite(amount)) {
      if (row.type === 'INCOME') incomeComplete = false
      else expenseComplete = false
    } else if (row.type === 'INCOME') income += amount
    else expense += amount
  }
  return {
    ingresos_mes: incomeComplete ? income : null,
    egresos_mes: expenseComplete ? expense : null,
    resultado_mensual: incomeComplete && expenseComplete ? income - expense : null,
  }
}

export function monthBounds(month: string) {
  if (!/^(?:\d{4})-(?:0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')) return null
  const year = Number(month.slice(0, 4))
  const number = Number(month.slice(5, 7))
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const end = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][number - 1]!
  return { start: `${month}-01`, end: `${month}-${String(end).padStart(2, '0')}` }
}
