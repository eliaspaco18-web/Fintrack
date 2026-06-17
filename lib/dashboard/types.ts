// =============================================================================
// lib/dashboard/types.ts
// Contratos API del Dashboard (Fase 11.1)
// =============================================================================

export interface MoneyAmount {
  pen: number
  usd: number
}

export interface DashboardMonthlyBalanceVariation {
  amount_pen: number
  percent: number | null
  previous_balance_pen: number
  trend: 'up' | 'down' | 'flat'
}

export interface DashboardCategoryBreakdownItem {
  category_id: string | null
  name: string
  color: string
  monto: number
  pct: number
}

export interface DashboardCounterpartyPreview {
  id: string
  name: string
  pending_amount_pen: number
  href: string
}

export interface DashboardSummary {
  balance_consolidado: MoneyAmount
  monthly_balance_variation: DashboardMonthlyBalanceVariation
  resultado_mensual: number
  ingresos_mes: number
  ingresos_mes_usd?: number
  egresos_mes: number
  egresos_mes_usd?: number
  alertas_pendientes: number
  patrimonio_neto: MoneyAmount
  balance_mes: number
  balance_mes_usd?: number
}

export type MoneyFlowMode = 'acumulado' | 'mensual'

export interface MoneyFlowPoint {
  month: string
  ingresos: number
  egresos: number
  saldo_acumulado: number
  saldo_mensual: number
  valor: number
}

export type SaldoDiaPeriod = '5D' | '1M' | '3M' | '6M' | '1A'

export interface SaldoDiaPoint {
  date: string
  saldo: number
  ingresos_acumulados: number
  egresos_acumulados: number
}

export interface ModulesSummary {
  cuentas: number
  cuentas_total_consolidado?: number
  creditos: number
  creditos_uso_total?: number
  creditos_limite_total?: number
  activos: {
    count: number
    total_soles: number
  }
  por_cobrar: {
    count: number
    total_adeudado: number
  }
  por_pagar: {
    count: number
    total_por_pagar: number
  }
  creditos_uso_pct: number
  posicion_neta?: number
}

export interface DashboardSidebar {
  saldos_bancarios: {
    total_consolidado: number
    items: Array<{
      portfolio_id: string
      name: string
      saldo: number
      pct_of_total: number
    }>
  }
  flujo_pendiente: {
    por_cobrar_total: number
    por_cobrar_count: number
    por_pagar_total: number
    por_pagar_count: number
    neto: number
    nota: 'favorece' | 'desfavorece' | 'equilibrado'
    top_deudores: DashboardCounterpartyPreview[]
    top_acreedores: DashboardCounterpartyPreview[]
  }
  egresos_categoria: DashboardCategoryBreakdownItem[]
  ingresos_categoria: DashboardCategoryBreakdownItem[]
  vencimientos_proximos: Array<{
    id: string
    tipo: 'credito_bancario' | 'ciclo_tarjeta' | 'cuenta_por_pagar'
    name: string
    due_date: string
    monto: number
  }>
}

export type ProjectionHorizon = '30D' | '60D' | '90D'

export type ProjectionEventType =
  | 'recurring_income'
  | 'recurring_expense'
  | 'receivable'
  | 'payable'
  | 'installment'
  | 'billing_cycle'

export interface CashFlowProjectionEvent {
  id: string
  label: string
  amount: number
  amountPen: number
  currency: 'PEN' | 'USD'
  date: string
  type: ProjectionEventType
}

export interface CashFlowProjectionPoint {
  date: string
  horizon: ProjectionHorizon
  projectedBalance: number
  inflows: number
  outflows: number
  confidence: number
  events: CashFlowProjectionEvent[]
}

export interface CashFlowProjectionResponse {
  currentBalance: number
  recurringMonthlyExpense: number
  recurringMonthlyIncome: number
  projectionPoints: CashFlowProjectionPoint[]
}

export type DashboardAlertType =
  | 'installment'
  | 'receivable'
  | 'payable'
  | 'budget_exceeded'

export type DashboardAlertUrgency = 'OVERDUE' | 'DUE_SOON'

export interface DashboardAlertItem {
  id: string
  type: DashboardAlertType
  label: string
  amount: number
  amountPen: number
  currency: 'PEN' | 'USD'
  dueDate: string | null
  urgency: DashboardAlertUrgency
  href: string
}

export interface DashboardAlertsResponse {
  criticalCount: number
  totalAmountPen: number
  alerts: DashboardAlertItem[]
}
