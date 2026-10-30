import type { DashboardCategoryBreakdownItem } from './types'

export interface ReportCategoryTransaction {
  category_id: string | null
  amount_pen: number | null
  type: 'INCOME' | 'EXPENSE'
}

export interface ReportCategoryDescriptor {
  name: string
  color: string
}

function normalize(rows: Array<DashboardCategoryBreakdownItem>): DashboardCategoryBreakdownItem[] {
  const total = rows.reduce((sum, row) => sum + row.monto, 0)
  return rows.sort((a, b) => b.monto - a.monto).map((row) => ({
    ...row,
    monto: Math.round(row.monto * 100) / 100,
    pct: total > 0 ? Math.round((row.monto / total) * 1000) / 10 : 0,
  }))
}

/** Aggregate every report transaction; display components may group rows, but the API must not truncate totals. */
export function categoryBreakdown(
  transactions: readonly ReportCategoryTransaction[],
  categories: ReadonlyMap<string, ReportCategoryDescriptor>,
): { income: DashboardCategoryBreakdownItem[]; expense: DashboardCategoryBreakdownItem[] } {
  const income = new Map<string, DashboardCategoryBreakdownItem>()
  const expense = new Map<string, DashboardCategoryBreakdownItem>()

  for (const row of transactions) {
    const key = row.category_id ?? 'uncategorized'
    const descriptor = row.category_id ? categories.get(row.category_id) : null
    const target = row.type === 'INCOME' ? income : expense
    const previous = target.get(key)
    target.set(key, {
      category_id: row.category_id,
      name: descriptor?.name ?? 'Sin categoría',
      color: descriptor?.color ?? '#8f8a80',
      monto: (previous?.monto ?? 0) + Number(row.amount_pen ?? 0),
      pct: 0,
    })
  }

  return { income: normalize([...income.values()]), expense: normalize([...expense.values()]) }
}
