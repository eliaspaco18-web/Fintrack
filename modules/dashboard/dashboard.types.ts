// =============================================================================
// modules/dashboard/dashboard.types.ts
// Tipos de salida del DashboardService — desacoplados del schema de BD.
// Son los tipos que consume la capa de presentación directamente.
// =============================================================================

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export interface NetWorth {
  pen: number
  usd: number
}

export interface MonthMetrics {
  incomePen:  number
  expensePen: number
  netPen:     number
  incomeUsd:  number
  expenseUsd: number
}

// ─── CUENTAS ──────────────────────────────────────────────────────────────────

export interface AccountBalance {
  id:         string
  name:       string
  type:       string
  currency:   string
  balance:    number   // en moneda original
  balancePen: number   // consolidado en PEN
  balanceUsd: number   // consolidado en USD
  color:      string
  icon:       string
}

// ─── FLUJO DE CAJA ────────────────────────────────────────────────────────────

export interface CashFlowPoint {
  month:      string   // 'YYYY-MM-DD'
  monthLabel: string   // 'Ene 2025'
  incomePen:  number
  expensePen: number
  netPen:     number
}

export interface DailyFlowPoint {
  date:      string   // 'YYYY-MM-DD'
  label:     string   // '05 abr'
  incomePen: number
  expensePen:number
  netPen:    number
  balancePen:number   // acumulado dentro del rango diario consultado
}

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────

export interface ExpenseCategoryItem {
  categoryId:    string | null
  categoryName:  string
  categoryIcon:  string
  categoryColor: string
  totalPen:      number
  count:         number
  percentage:    number
}

// ─── CRÉDITOS ─────────────────────────────────────────────────────────────────

export interface CreditSummaryItem {
  id:              string
  name:            string
  creditType:      string
  currency:        string
  creditLimit:     number
  usedAmount:      number
  availableAmount: number
  utilizationPct:  number
  nextClosingDate: string | null
}

// ─── CUOTAS ───────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING'

export interface UpcomingInstallment {
  id:                string
  creditorName:      string
  totalAmount:       number
  currency:          string
  dueDate:           string
  daysUntilDue:      number
  urgency:           UrgencyLevel
  installmentNumber: number
  totalInstallments: number
}

// ─── CUENTAS POR COBRAR / PAGAR ───────────────────────────────────────────────

export interface PendingItem {
  id:            string
  pendingAmount: number
  currency:      string
  dueDate:       string | null
  urgency:       UrgencyLevel | null
}

export interface ReceivableItem extends PendingItem {
  debtorName: string
}

export interface PayableItem extends PendingItem {
  creditorName: string
}

export interface ReceivablesSummary {
  totalPendingPen: number
  totalPendingUsd: number
  count:           number
  items:           ReceivableItem[]
}

export interface PayablesSummary {
  totalPendingPen: number
  totalPendingUsd: number
  count:           number
  items:           PayableItem[]
}

// ─── ACTIVOS ──────────────────────────────────────────────────────────────────

export interface AssetsByType {
  assetType: string
  totalPen:  number
  count:     number
}

export interface AssetsSummary {
  totalValuePen: number
  totalValueUsd: number
  count:         number
  byType:        AssetsByType[]
}

// ─── META ─────────────────────────────────────────────────────────────────────

export interface DashboardMeta {
  exchangeRateUsdPen: number
  calculatedAt:       string
  currentMonth:       string
}

// ─── COMPARATIVA MENSUAL ──────────────────────────────────────────────────────

export interface MonthSnapshot {
  label:      string
  incomePen:  number
  expensePen: number
  netPen:     number
}

export interface MonthlyComparison {
  currentMonth:  MonthSnapshot
  previousMonth: MonthSnapshot
  changes: {
    incomePctChange:  number | null
    expensePctChange: number | null
    netPctChange:     number | null
  }
}

// ─── SUMMARY COMPLETO (respuesta de getSummary) ───────────────────────────────

export interface DashboardSummary {
  netWorth:               NetWorth
  currentMonth:           MonthMetrics
  accounts:               AccountBalance[]
  cashFlow6m:             CashFlowPoint[]
  dailyFlow?:             DailyFlowPoint[]
  topExpenseCategories:   ExpenseCategoryItem[]
  credits:                CreditSummaryItem[]
  upcomingInstallments:   UpcomingInstallment[]
  receivables:            ReceivablesSummary
  payables:               PayablesSummary
  assets:                 AssetsSummary
  meta:                   DashboardMeta
}
