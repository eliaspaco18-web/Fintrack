// =============================================================================
// app/actions/dashboard.actions.ts
// Server Actions para el dashboard — se llaman desde Server Components
// directamente. Sin round-trip HTTP, sin cliente Fetch.
// =============================================================================

'use server'

import { createClient }          from '@/lib/supabase.server'
import { DashboardService }      from '@/modules/dashboard/dashboard.service'
import { type Result, Errors }   from '@/modules/shared/result.types'
import type {
  DashboardSummary,
  MonthlyComparison,
  CashFlowPoint,
  ExpenseCategoryItem,
}                                from '@/modules/dashboard/dashboard.types'

// ─── HELPER ───────────────────────────────────────────────────────────────────

async function getDashboardService() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { service: null, userId: null }
  return { service: new DashboardService(supabase), userId: user.id }
}

// ─── SUMMARY COMPLETO ─────────────────────────────────────────────────────────

/**
 * Carga todos los datos del dashboard en una llamada.
 * Llamar directamente desde el Server Component de la página /dashboard.
 *
 * Ejemplo de uso:
 *   // app/(dashboard)/dashboard/page.tsx
 *   const result = await getDashboardSummaryAction()
 *   if (!result.ok) redirect('/error')
 *   const { data } = result
 */
export async function getDashboardSummaryAction(): Promise<Result<DashboardSummary>> {
  const { service, userId } = await getDashboardService()
  if (!service || !userId) return Errors.unauthorized()
  return service.getSummary(userId)
}

// ─── FLUJO DE CAJA ────────────────────────────────────────────────────────────

export async function getCashFlowAction(
  months = 12
): Promise<Result<CashFlowPoint[]>> {
  const { service, userId } = await getDashboardService()
  if (!service || !userId) return Errors.unauthorized()
  return service.getCashFlow(userId, months)
}

// ─── COMPARATIVA MENSUAL ──────────────────────────────────────────────────────

export async function getMonthComparisonAction(): Promise<Result<MonthlyComparison>> {
  const { service, userId } = await getDashboardService()
  if (!service || !userId) return Errors.unauthorized()
  return service.getMonthComparison(userId)
}

// ─── EGRESOS POR CATEGORÍA ────────────────────────────────────────────────────

export async function getExpensesByCategoryAction(): Promise<Result<ExpenseCategoryItem[]>> {
  const { service, userId } = await getDashboardService()
  if (!service || !userId) return Errors.unauthorized()
  return service.getExpensesByCategory(userId)
}

// ─── PATRIMONIO NETO ──────────────────────────────────────────────────────────

export async function getNetWorthAction(): Promise<Result<{
  netWorthPen:  number
  netWorthUsd:  number
  exchangeRate: number
}>> {
  const { service, userId } = await getDashboardService()
  if (!service || !userId) return Errors.unauthorized()
  return service.getNetWorth(userId)
}
