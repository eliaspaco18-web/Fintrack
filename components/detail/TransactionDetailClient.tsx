'use client'

// =============================================================================
// components/detail/TransactionDetailClient.tsx
// Vista de detalle completa de una transacción.
//
// RESTRICCIONES DE EDICIÓN (reflejan TransactionService.updateTransaction):
//   Editable:  descripción, categoría, notas, fecha (mismo mes)
//   No editable: monto, tipo, cuentas — se comunicará con mensaje claro
//
// Los módulos derivados se muestran como badges vinculados a sus propias páginas.
// =============================================================================

import { useState, useCallback }     from 'react'
import { useRouter }                 from 'next/navigation'
import { useCurrency }               from '@/lib/hooks/useDashboard'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import type { TransactionFormOptions } from '@/lib/contracts/ui.contracts'
import { deleteTransactionAction }   from '@/app/actions/transaction.actions'
import { TransactionEditModal }      from '@/components/forms/TransactionEditModal'
import {
  CanonicalDetailActionButton,
  CanonicalDetailBackLink,
  CanonicalDetailBadge,
  CanonicalDetailFact,
  CanonicalDetailFacts,
  CanonicalDetailLayout,
  CanonicalDetailRailSection,
  CanonicalDetailSummary,
  CanonicalInlineError,
  CanonicalRelatedRecordLink,
  ConfirmDialog,
  type CanonicalDetailTone,
}                                    from './primitives'
import type { TransactionWithRelations } from '@/types/database.types'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface LinkedModules {
  asset?:      { id: string; name: string; asset_type: string; current_value: number; status: string } | null
  credit?:     { id: string; name: string; credit_type: string; available_amount: number | null; status: string } | null
  loan?:       { id: string; creditor_name: string; total_installments: number; paid_installments: number; status: string } | null
  receivable?: { id: string; debtor_name: string; amount: number; status: string } | null
  payable?:    { id: string; creditor_name: string; amount: number; status: string } | null
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  INCOME:   { label: 'Ingreso',       tone: 'primary', prefix: '+' },
  EXPENSE:  { label: 'Egreso',        tone: 'danger',  prefix: '−' },
  TRANSFER: { label: 'Transferencia', tone: 'info',    prefix: '⇄' },
} satisfies Record<TransactionWithRelations['type'], {
  label: string
  tone: CanonicalDetailTone
  prefix: string
}>

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface TransactionDetailClientProps {
  transaction:   TransactionWithRelations
  linkedModules: LinkedModules
  options: TransactionFormOptions
}

export function TransactionDetailClient({
  transaction: tx,
  linkedModules: mods,
  options,
}: TransactionDetailClientProps) {
  const router   = useRouter()
  const { preferred, format } = useCurrency()

  const [editing,         setEditing]         = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading,   setDeleteLoading]   = useState(false)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)
  const [showForceDelete, setShowForceDelete] = useState(false)

  const typeConfig = TYPE_LABELS[tx.type]
  const amountPen  = tx.amount_pen ?? tx.amount

  const handleDelete = useCallback(async (force = false) => {
    setDeleteLoading(true)
    setDeleteError(null)
    const result = await deleteTransactionAction(tx.id, force)
    setDeleteLoading(false)

    if (result.ok) {
      router.push('/transactions')
      return
    }

    // Si el error es por módulos bloqueados, ofrecer force
    if (result.error.code === 'BUSINESS_RULE_ERROR') {
      setShowDeleteConfirm(false)
      setShowForceDelete(true)
    } else {
      setDeleteError(result.error.message)
    }
  }, [tx.id, router])

  const handleEditSave = useCallback(() => {
    setEditing(false)
    router.refresh()
  }, [router])

  const hasLinkedModules = !!(
    mods.asset || mods.credit || mods.loan || mods.receivable || mods.payable
  )

  return (
    <>
      <CanonicalDetailLayout
        back={<CanonicalDetailBackLink href="/transactions" label="Transacciones"/>}
        summary={
          <CanonicalDetailSummary
            marker={typeConfig.prefix}
            tone={typeConfig.tone}
            badges={
              <>
                <CanonicalDetailBadge tone={typeConfig.tone}>
                  {typeConfig.label}
                </CanonicalDetailBadge>
                {tx.category && (
                  <CanonicalDetailBadge>{tx.category.name}</CanonicalDetailBadge>
                )}
              </>
            }
            title={tx.description}
            subtitle={formatDate(tx.transaction_date)}
            amount={<>{typeConfig.prefix}{formatCurrency(format(amountPen), preferred)}</>}
            amountMeta={(tx.currency !== 'PEN' || !tx.affects_reports) ? (
              <>
                {tx.currency !== 'PEN' && (
                  <span className="text-[11px] text-[var(--ft-text-subtle)] tabular-nums">
                    {formatCurrency(tx.amount, tx.currency as 'PEN' | 'USD')}
                  </span>
                )}
                {!tx.affects_reports && (
                  <span className="inline-flex min-h-6 items-center rounded-full border border-[color-mix(in_srgb,var(--ft-info)_20%,transparent)] bg-[var(--ft-info-soft)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--ft-info)]">
                    Excluida de reportes
                  </span>
                )}
              </>
            ) : undefined}
          />
        }
        actions={
          <CanonicalDetailRailSection title="Acciones">
            <div className="space-y-2">
              <CanonicalDetailActionButton
                label="Editar transacción"
                variant="secondary"
                onClick={() => setEditing(true)}
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
              />
              <CanonicalDetailActionButton
                label="Eliminar transacción"
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                testId="transaction-detail-delete-button"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
              />
            </div>
            {deleteError && (
              <div className="mt-3">
                <CanonicalInlineError message={deleteError}/>
              </div>
            )}
          </CanonicalDetailRailSection>
        }
        aside={hasLinkedModules ? (
          <CanonicalDetailRailSection title="Módulos generados">
            <div className="space-y-1">
              {mods.asset && (
                <CanonicalRelatedRecordLink
                  label={mods.asset.name}
                  href={`/assets/${mods.asset.id}`}
                />
              )}
              {mods.credit && (
                <CanonicalRelatedRecordLink
                  label={mods.credit.name}
                  href={`/credits/${mods.credit.id}`}
                />
              )}
              {mods.loan && (
                <CanonicalRelatedRecordLink
                  label={`${mods.loan.creditor_name} · ${mods.loan.paid_installments}/${mods.loan.total_installments} cuotas`}
                  href={`/credits`}
                />
              )}
              {mods.receivable && (
                <CanonicalRelatedRecordLink
                  label={`Por cobrar · ${mods.receivable.debtor_name}`}
                  href={`/receivables/${mods.receivable.id}`}
                />
              )}
              {mods.payable && (
                <CanonicalRelatedRecordLink
                  label={`Por pagar · ${mods.payable.creditor_name}`}
                  href={`/payables/${mods.payable.id}`}
                />
              )}
            </div>
          </CanonicalDetailRailSection>
        ) : undefined}
      >
        <CanonicalDetailFacts>
          <CanonicalDetailFact label="Cuenta">
            <div className="flex items-center gap-2">
              {tx.source_account && (
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: tx.source_account.color }}
                />
              )}
              {tx.source_account?.name ?? '—'}
            </div>
          </CanonicalDetailFact>

          {tx.destination_account && (
            <CanonicalDetailFact label="Cuenta destino">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: tx.destination_account.color }}
                />
                {tx.destination_account.name}
              </div>
            </CanonicalDetailFact>
          )}

          <CanonicalDetailFact label="Moneda" mono>
            {tx.currency}
            {tx.currency === 'USD' && (
              <span className="ml-2 text-[11px] text-[var(--ft-text-muted)]">
                · TC {formatNumber(Number(tx.exchange_rate ?? 0), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN
              </span>
            )}
          </CanonicalDetailFact>

          <CanonicalDetailFact label="Equivalente en PEN" mono>
            {formatCurrency(amountPen, 'PEN')}
          </CanonicalDetailFact>

          {tx.notes && (
            <CanonicalDetailFact label="Notas" full>
              <p className="text-sm leading-relaxed text-[var(--ft-text-muted)]">{tx.notes}</p>
            </CanonicalDetailFact>
          )}

          <CanonicalDetailFact label="Registrado" mono>
            {new Date(tx.created_at).toLocaleDateString('es-PE', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </CanonicalDetailFact>

          <CanonicalDetailFact label="ID" mono>
            <span className="break-all font-mono text-[11px] text-[var(--ft-text-subtle)]">{tx.id}</span>
          </CanonicalDetailFact>
        </CanonicalDetailFacts>
      </CanonicalDetailLayout>

      <TransactionEditModal
        open={editing}
        transactionId={tx.id}
        options={options}
        initialTransaction={tx}
        onClose={() => setEditing(false)}
        onUpdated={handleEditSave}
      />

      {/* Confirm eliminar */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eliminar transacción"
        message="Esta acción revertirá el saldo de la cuenta. Los módulos derivados (activos, créditos, etc.) serán desvinculados pero no eliminados."
        onConfirm={() => handleDelete(false)}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteLoading}
        danger
        testId="transaction-detail-delete-modal"
        cancelTestId="transaction-detail-delete-cancel-button"
        confirmTestId="transaction-detail-delete-confirm-button"
      />

      {/* Confirm forzar eliminación */}
      <ConfirmDialog
        open={showForceDelete}
        title="Forzar eliminación"
        message="Esta transacción tiene cuotas pagadas vinculadas. Al forzar la eliminación, esos registros quedarán desvinculados. ¿Continuar?"
        onConfirm={() => handleDelete(true)}
        onCancel={() => setShowForceDelete(false)}
        loading={deleteLoading}
        danger
        testId="transaction-detail-force-delete-modal"
        cancelTestId="transaction-detail-force-delete-cancel-button"
        confirmTestId="transaction-detail-force-delete-confirm-button"
      />
    </>
  )
}
