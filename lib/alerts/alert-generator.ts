// =============================================================================
// lib/alerts/alert-generator.ts
// PRD v3 — Módulo 9: Generador de Alertas
// Reglas PRD exactas:
//   Críticas:    cuota bancaria ≤7d | ciclo tarjeta ≤7d | cuenta por pagar vencida
//   Operativas:  presupuesto ≥80% | presupuesto excedido | CxC pendiente >30d
//   Sugerencias: transacción recurrente no usada en período actual
// Deduplicación: no crea alerta si ya existe una activa (is_read=false)
//                para el mismo source_module + source_record_id + alert_type
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js'
import {
  buildBudgetMetrics,
  resolveBudgetWindowAtDate,
  type BudgetMetricTransaction,
} from '@/lib/budgets/budget-metrics'
import {
  buildBudgetPeriodMetrics,
  type BudgetPeriodMetricTransaction,
} from '@/lib/budgets/budget-periods'
import type { CurrencyCode } from '@/types/database.types'

// ─── TIPOS INTERNOS ──────────────────────────────────────────────────────────

interface AlertCandidate {
  alert_type:       'CRITICAL' | 'OPERATIONAL' | 'SUGGESTION'
  source_module:    'credits' | 'budgets' | 'receivables' | 'payables' | 'recurring'
  source_record_id: string
  title:            string
  message:          string
  href:             string
  event:            string
}

interface GeneratorResult {
  created: number
  skipped: number
  errors:  string[]
}

type AlertBudgetRow = {
  id: string
  name: string
  amount: number
  currency: CurrencyCode
  start_date: string
  end_date: string | null
  period_type: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
}

type AlertBudgetPeriodRow = {
  id: string
  legacy_budget_id: string | null
  period_start: string
  period_end: string
  amount: number
  status: string
  budget: {
    id: string
    name: string
    currency: CurrencyCode
  } | {
    id: string
    name: string
    currency: CurrencyCode
  }[] | null
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * Genera alertas para el usuario dado según las 7 reglas del PRD.
 * Inserta solo las candidatas que no tienen ya una alerta activa (is_read=false)
 * para el mismo (source_module, source_record_id, alert_type).
 */
export async function generateAlertsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GeneratorResult> {
  const result: GeneratorResult = { created: 0, skipped: 0, errors: [] }
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const candidates: AlertCandidate[] = []

  // ─── 1. CRÍTICAS: Cuotas de préstamos bancarios vencen en ≤7 días ─────────
  try {
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    const { data: installments, error } = await supabase
      .from('installments')
      .select(`
        id, due_date, total_amount, installment_number,
        loan:loans!inner(id, name, user_id, status, currency)
      `)
      .eq('loan.user_id', userId)
      .eq('loan.status', 'ACTIVE')
      .in('status', ['PENDING', 'PARTIAL'])
      .gte('due_date', today.toISOString().slice(0, 10))
      .lte('due_date', in7Days.toISOString().slice(0, 10))

    if (error) {
      result.errors.push(`installments: ${error.message}`)
    } else {
      for (const inst of installments ?? []) {
        const loan = Array.isArray(inst.loan) ? inst.loan[0] : inst.loan
        if (!loan) continue
        const daysLeft = Math.ceil(
          (new Date(inst.due_date).getTime() - today.getTime()) / 86400000
        )
        candidates.push({
          alert_type:       'CRITICAL',
          source_module:    'credits',
          source_record_id: inst.id,
          title:            `Cuota de préstamo vence pronto`,
          message:          `La cuota #${inst.installment_number} de "${loan.name}" vence en ${daysLeft === 0 ? 'hoy' : `${daysLeft} día(s)`}.`,
          href:             `/credits`,
          event:            'LOAN_INSTALLMENT_DUE_SOON',
        })
      }
    }
  } catch (e) {
    result.errors.push(`installments exception: ${String(e)}`)
  }

  // ─── 2. CRÍTICAS: Ciclos de tarjeta de crédito vencen en ≤7 días ──────────
  try {
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)

    const { data: cycles, error } = await supabase
      .from('billing_cycles')
      .select(`
        id, payment_date, total_to_pay, billing_month, billing_year,
        credit:credits!inner(id, name, user_id, status)
      `)
      .eq('credit.user_id', userId)
      .eq('credit.status', 'ACTIVE')
      .gte('payment_date', today.toISOString().slice(0, 10))
      .lte('payment_date', in7Days.toISOString().slice(0, 10))

    if (error) {
      result.errors.push(`billing_cycles: ${error.message}`)
    } else {
      for (const cycle of cycles ?? []) {
        const credit = Array.isArray(cycle.credit) ? cycle.credit[0] : cycle.credit
        if (!credit) continue
        const daysLeft = Math.ceil(
          (new Date(cycle.payment_date).getTime() - today.getTime()) / 86400000
        )
        candidates.push({
          alert_type:       'CRITICAL',
          source_module:    'credits',
          source_record_id: cycle.id,
          title:            `Fecha de pago de tarjeta próxima`,
          message:          `El ciclo ${cycle.billing_month}/${cycle.billing_year} de "${credit.name}" vence ${daysLeft === 0 ? 'hoy' : `en ${daysLeft} día(s)`}.`,
          href:             `/credits`,
          event:            'CREDIT_CARD_PAYMENT_DUE_SOON',
        })
      }
    }
  } catch (e) {
    result.errors.push(`billing_cycles exception: ${String(e)}`)
  }

  // ─── 3. CRÍTICAS: Cuentas por pagar vencidas ──────────────────────────────
  try {
    const { data: payables, error } = await supabase
      .from('accounts_payable')
      .select('id, creditor_name, concept, due_date, amount, currency')
      .eq('user_id', userId)
      .in('status', ['PENDING', 'PARTIAL'])
      .lt('due_date', today.toISOString().slice(0, 10))
      .not('due_date', 'is', null)

    if (error) {
      result.errors.push(`accounts_payable overdue: ${error.message}`)
    } else {
      for (const ap of payables ?? []) {
        const daysOverdue = Math.ceil(
          (today.getTime() - new Date(ap.due_date).getTime()) / 86400000
        )
        candidates.push({
          alert_type:       'CRITICAL',
          source_module:    'payables',
          source_record_id: ap.id,
          title:            `Cuenta por pagar vencida`,
          message:          `"${ap.concept ?? ap.creditor_name}" lleva ${daysOverdue} día(s) vencida.`,
          href:             `/payables`,
          event:            'PAYABLE_OVERDUE',
        })
      }
    }
  } catch (e) {
    result.errors.push(`accounts_payable exception: ${String(e)}`)
  }

  // ─── 4. OPERATIVAS: Presupuesto ≥80% del monto ────────────────────────────
  try {
    const todayIso = today.toISOString().slice(0, 10)
    let usedExplicitPeriods = false

    const { data: periods, error: periodsError } = await supabase
      .from('budget_periods')
      .select(`
        id,
        legacy_budget_id,
        period_start,
        period_end,
        amount,
        status,
        budget:budget_series!inner(id,name,currency,user_id,is_active)
      `)
      .lte('period_start', todayIso)
      .gte('period_end', todayIso)
      .in('status', ['ACTIVE', 'PLANNED'])
      .eq('budget.user_id', userId)
      .eq('budget.is_active', true)

    if (!periodsError) {
      usedExplicitPeriods = true

      for (const period of (periods ?? []) as AlertBudgetPeriodRow[]) {
        const budget = pickSingle(period.budget)
        if (!budget) continue

        const { data: txs, error: txErr } = await supabase
          .from('transactions')
          .select('amount, currency, exchange_rate, budget_id, budget_period_id, transaction_date')
          .eq('user_id', userId)
          .eq('type', 'EXPENSE')
          .gte('transaction_date', period.period_start)
          .lte('transaction_date', period.period_end)
          .or([
            `budget_period_id.eq.${period.id}`,
            period.legacy_budget_id ? `budget_id.eq.${period.legacy_budget_id}` : '',
          ].filter(Boolean).join(','))

        if (txErr) { result.errors.push(`budget period txs ${period.id}: ${txErr.message}`); continue }

        const metrics = buildBudgetPeriodMetrics(
          { currency: budget.currency },
          period,
          (txs ?? []) as BudgetPeriodMetricTransaction[],
        )
        const pct = metrics.progress_percent

        if (pct >= 100) {
          candidates.push({
            alert_type:       'OPERATIONAL',
            source_module:    'budgets',
            source_record_id: period.id,
            title:            `Presupuesto excedido`,
            message:          `El presupuesto "${budget.name}" ha sido superado (${pct.toFixed(0)}%).`,
            href:             `/budgets`,
            event:            'BUDGET_EXCEEDED',
          })
        } else if (pct >= 80) {
          candidates.push({
            alert_type:       'OPERATIONAL',
            source_module:    'budgets',
            source_record_id: period.id,
            title:            `Presupuesto al ${pct.toFixed(0)}%`,
            message:          `El presupuesto "${budget.name}" ha alcanzado el ${pct.toFixed(0)}% de su límite.`,
            href:             `/budgets`,
            event:            'BUDGET_80_PCT',
          })
        }
      }
    }

    if (!usedExplicitPeriods) {
      const { data: budgets, error } = await supabase
        .from('budgets')
        .select('id, name, amount, currency, start_date, end_date, period_type')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        result.errors.push(`budgets: ${error.message}`)
      } else {
        for (const budget of (budgets ?? []) as AlertBudgetRow[]) {
          const activeWindow = resolveBudgetWindowAtDate(budget, todayIso)
          if (!activeWindow) continue

          const { data: txs, error: txErr } = await supabase
            .from('transactions')
            .select('amount, currency, exchange_rate, budget_id, transaction_date')
            .eq('user_id', userId)
            .eq('type', 'EXPENSE')
            .eq('budget_id', budget.id)
            .gte('transaction_date', activeWindow.start)
            .lte('transaction_date', activeWindow.end)

          if (txErr) { result.errors.push(`budget txs ${budget.id}: ${txErr.message}`); continue }

          const metrics = buildBudgetMetrics(
            budget,
            (txs ?? []) as BudgetMetricTransaction[],
            activeWindow,
          )
          const pct = metrics.progress_percent

          if (pct >= 100) {
            candidates.push({
              alert_type:       'OPERATIONAL',
              source_module:    'budgets',
              source_record_id: budget.id,
              title:            `Presupuesto excedido`,
              message:          `El presupuesto "${budget.name}" ha sido superado (${pct.toFixed(0)}%).`,
              href:             `/budgets`,
              event:            'BUDGET_EXCEEDED',
            })
          } else if (pct >= 80) {
            candidates.push({
              alert_type:       'OPERATIONAL',
              source_module:    'budgets',
              source_record_id: budget.id,
              title:            `Presupuesto al ${pct.toFixed(0)}%`,
              message:          `El presupuesto "${budget.name}" ha alcanzado el ${pct.toFixed(0)}% de su límite.`,
              href:             `/budgets`,
              event:            'BUDGET_80_PCT',
            })
          }
        }
      }
    }
  } catch (e) {
    result.errors.push(`budgets exception: ${String(e)}`)
  }

  // ─── 5. OPERATIVAS: Cuentas por cobrar pendientes >30 días ───────────────
  try {
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: receivables, error } = await supabase
      .from('accounts_receivable')
      .select('id, debtor_name, concept, issue_date, amount, currency')
      .eq('user_id', userId)
      .in('status', ['PENDING', 'PARTIAL'])
      .lte('issue_date', thirtyDaysAgo.toISOString().slice(0, 10))

    if (error) {
      result.errors.push(`accounts_receivable: ${error.message}`)
    } else {
      for (const ar of receivables ?? []) {
        const daysPending = Math.ceil(
          (today.getTime() - new Date(ar.issue_date).getTime()) / 86400000
        )
        candidates.push({
          alert_type:       'OPERATIONAL',
          source_module:    'receivables',
          source_record_id: ar.id,
          title:            `Cuenta por cobrar pendiente`,
          message:          `"${ar.concept ?? ar.debtor_name}" lleva ${daysPending} días pendiente de cobro.`,
          href:             `/receivables`,
          event:            'RECEIVABLE_PENDING_30_DAYS',
        })
      }
    }
  } catch (e) {
    result.errors.push(`accounts_receivable exception: ${String(e)}`)
  }

  // ─── 6. SUGERENCIAS: Transacciones recurrentes no usadas en período actual ─
  try {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().slice(0, 10)

    const { data: recurrings, error } = await supabase
      .from('recurring_transactions')
      .select('id, name, type')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) {
      result.errors.push(`recurring_transactions: ${error.message}`)
    } else {
      for (const rt of recurrings ?? []) {
        // Verificar si tiene al menos 1 transacción en el mes actual
        const { count, error: cntErr } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('recurring_transaction_id', rt.id)
          .gte('transaction_date', firstOfMonth)

        if (cntErr) { result.errors.push(`rt count ${rt.id}: ${cntErr.message}`); continue }

        if ((count ?? 0) === 0) {
          candidates.push({
            alert_type:       'SUGGESTION',
            source_module:    'recurring',
            source_record_id: rt.id,
            title:            `Transacción recurrente sin usar`,
            message:          `"${rt.name}" no ha sido usada en el período actual.`,
            href:             `/recurring`,
            event:            'RECURRING_NOT_USED_THIS_PERIOD',
          })
        }
      }
    }
  } catch (e) {
    result.errors.push(`recurring exception: ${String(e)}`)
  }

  // ─── DEDUPLICACIÓN E INSERCIÓN ─────────────────────────────────────────────

  if (candidates.length === 0) return result

  // Obtener alertas activas (is_read=false) existentes
  const { data: existingAlerts, error: existErr } = await supabase
    .from('app_notifications')
    .select('alert_type, source_module, source_record_id')
    .eq('user_id', userId)
    .eq('is_read', false)
    .in('source_module', ['credits', 'budgets', 'receivables', 'payables', 'recurring'])

  if (existErr) {
    result.errors.push(`existing alerts: ${existErr.message}`)
    return result
  }

  const existingSet = new Set(
    (existingAlerts ?? []).map(
      a => `${a.source_module}__${a.source_record_id}__${a.alert_type}`
    )
  )

  const toInsert = candidates.filter(c => {
    const key = `${c.source_module}__${c.source_record_id}__${c.alert_type}`
    if (existingSet.has(key)) {
      result.skipped++
      return false
    }
    return true
  })

  if (toInsert.length === 0) return result

  const rows = toInsert.map(c => ({
    user_id:          userId,
    alert_type:       c.alert_type,
    source_module:    c.source_module,
    source_record_id: c.source_record_id,
    title:            c.title,
    message:          c.message,
    href:             c.href,
    event:            c.event,
    category:         'ALERT',
    is_read:          false,
  }))

  const { error: insErr } = await supabase
    .from('app_notifications')
    .insert(rows)

  if (insErr) {
    result.errors.push(`insert: ${insErr.message}`)
  } else {
    result.created += toInsert.length
  }

  return result
}
