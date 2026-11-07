// =============================================================================
// app/api/debtors/route.ts
// PRD v3 — Módulo 7: Cuentas por Cobrar — CRUD de Deudores
// GET devuelve deudores con datos agregados de sus cuentas por cobrar.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase.server'
import { getSessionUserId }          from '@/lib/api/response'
import { projectLegacyReceivableLinks, type ReceivableReadDocument } from '@/lib/server/receivable-read-model'
import { summarizeObligationCurrencies } from '@/modules/obligations/obligation-currency-presentation'
import { getReceivablePersonState } from '@/modules/receivables/receivables-list-presentation'
import { readAllPages } from '@/modules/receivables/paged-read'
import type { Database } from '@/types/database.types'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  let debtorsList: Database['public']['Tables']['debtors']['Row'][]
  let receivables: ReceivableReadDocument[]
  let transactions: Array<Pick<Database['public']['Tables']['transactions']['Row'], 'id' | 'debtor_id' | 'description' | 'amount' | 'currency' | 'transaction_date' | 'notes'>>
  try {
    [debtorsList, receivables, transactions] = await Promise.all([
      readAllPages((from, to) => supabase
        .from('debtors')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)),
      readAllPages((from, to) => supabase
        .from('accounts_receivable')
        .select('id, transaction_id, debtor_id, debtor_name, amount, collected_amount, currency, status')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(from, to)),
      readAllPages((from, to) => supabase
        .from('transactions')
        .select('id, debtor_id, description, amount, currency, transaction_date, notes')
        .eq('user_id', userId)
        .eq('type', 'EXPENSE')
        .not('debtor_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)),
    ])
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: 'No se pudo leer la cobertura completa de cuentas por cobrar.' } }, { status: 500 })
  }

  const projection = projectLegacyReceivableLinks(
    debtorsList.map(debtor => ({ id: debtor.id, name: debtor.name })),
    receivables,
    transactions,
  )

  // Agregar datos por deudor
  const aggregated = debtorsList.map(debtor => {
    const related         = projection.byDebtor.get(debtor.id) ?? []
    const ambiguous       = related.filter(receivable => receivable.is_ambiguous_projection)
    const verifiedRelated = related.filter(receivable => !receivable.is_ambiguous_projection)
    const initial_debt    = Number(debtor.initial_debt ?? 0)
    const ar_total        = verifiedRelated.reduce((s, r) => s + Number(r.amount), 0)
    const total_collected = verifiedRelated.reduce((s, r) => s + Number(r.collected_amount), 0)
    // El saldo inicial cuenta como deuda prestada aunque no tenga documento asociado
    const total_lent      = ar_total + initial_debt
    const pending_amount  = total_lent - total_collected
    const progress_pct    = total_lent > 0 ? Math.min(100, (total_collected / total_lent) * 100) : 0
    const count_pending   = verifiedRelated.filter(r => ['PENDING', 'PARTIAL'].includes(r.status)).length || (initial_debt > 0 ? 1 : 0)
    const baseState = getReceivablePersonState(verifiedRelated, debtor.id, false)
    const hasReadCoverageIssue = projection.coverage.ambiguousDebtorIds.has(debtor.id)
    const effective_state = hasReadCoverageIssue || initial_debt > 0
      ? (baseState === 'OPEN' || baseState === 'PARTIAL' ? baseState : 'UNVERIFIED')
      : baseState
    const currencyBreakdown = summarizeObligationCurrencies([
      ...verifiedRelated.map(receivable => ({
        amount: receivable.amount,
        settledAmount: receivable.collected_amount,
        currency: receivable.currency,
        isOpen: receivable.status !== 'COLLECTED',
      })),
      ...ambiguous.map(receivable => ({
        amount: receivable.amount,
        settledAmount: receivable.collected_amount,
        currency: null,
        isOpen: receivable.status !== 'COLLECTED',
      })),
    ])

    return {
      ...debtor,
      total_lent: Math.round(total_lent * 100) / 100,
      total_collected: Math.round(total_collected * 100) / 100,
      pending_amount: Math.round(pending_amount * 100) / 100,
      progress_pct: Math.round(progress_pct * 10) / 10,
      all_collected: effective_state === 'SETTLED',
      count_pending,
      receivables_count: related.length,
      effective_state,
      has_incomplete_legacy_coverage: hasReadCoverageIssue,
      currency_summaries: currencyBreakdown.summaries,
      unverified_currency_records: currencyBreakdown.unverifiedRecordCount,
      unverified_open_currency_records: currencyBreakdown.unverifiedOpenRecordCount,
      has_unverified_initial_debt: initial_debt > 0,
      unlinked_legacy_receivable_count: related.filter(receivable => receivable.is_legacy_projection).length,
    }
  })

  return NextResponse.json({
    ok: true,
    data: aggregated,
    coverage: {
      ambiguous_legacy_documents: projection.coverage.ambiguousOrphanDocumentCount,
      unmatched_legacy_documents: projection.coverage.unmatchedOrphanDocumentCount,
      duplicate_transaction_links: projection.coverage.duplicateTransactionLinkCount,
    },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido' } }, { status: 400 })

  const name         = typeof body.name === 'string' ? body.name.trim() : ''
  const initial_debt = typeof body.initial_debt === 'number' ? body.initial_debt : 0
  const relationship = typeof body.relationship === 'string' ? body.relationship.trim() || null : null

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'El nombre del deudor es obligatorio (mínimo 2 caracteres).' } }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('debtors')
    .insert({ user_id: userId, name, initial_debt, relationship })
    .select()
    .single()

  if (error) {
    const msg = error.message.includes('idx_debtors_user_name')
      ? `Ya existe un deudor con el nombre "${name}".`
      : error.message
    return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: msg } }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data }, { status: 201 })
}
