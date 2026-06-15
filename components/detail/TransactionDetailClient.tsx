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
import { useForm }                   from 'react-hook-form'
import { useCurrency }               from '@/lib/hooks/useDashboard'
import { formatCurrency, formatNumber } from '@/lib/contracts/ui.contracts'
import {
  updateTransactionAction,
  deleteTransactionAction,
}                                    from '@/app/actions/transaction.actions'
import {
  BackLink,
  DetailShell,
  DetailCard,
  DetailSection,
  DetailField,
  FieldGrid,
  ActionBar,
  ActionButton,
  ConfirmDialog,
  LinkedModuleBadge,
  InlineError,
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

interface EditFormValues {
  description:      string
  category_id?:     string
  notes?:           string
  transaction_date: string
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  INCOME:   { label: 'Ingreso',       color: 'var(--c-primary)', prefix: '+' },
  EXPENSE:  { label: 'Egreso',        color: '#ef4444', prefix: '−' },
  TRANSFER: { label: 'Transferencia', color: '#3b82f6', prefix: '⇄' },
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── INLINE EDIT FORM ─────────────────────────────────────────────────────────

interface InlineEditFormProps {
  tx:       TransactionWithRelations
  onSave:   () => void
  onCancel: () => void
}

function InlineEditForm({ tx, onSave, onCancel }: InlineEditFormProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<EditFormValues>({
    defaultValues: {
      description:      tx.description,
      category_id:      tx.category_id ?? undefined,
      notes:            tx.notes ?? '',
      transaction_date: tx.transaction_date,
    },
  })

  const fieldClass = `
    w-full px-3 py-2 rounded-lg text-sm bg-white/[0.05] border
    border-white/[0.09] text-white/80 placeholder:text-white/20
    focus:outline-none focus:ring-1 focus:ring-[rgba(14,79,70,0.25)]
    focus:border-[var(--c-primary-border)] transition-all
  `

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true)
    setError(null)
    const result = await updateTransactionAction(tx.id, values)
    setLoading(false)
    if (result.ok) {
      onSave()
    } else {
      setError(result.error.message)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Aviso de restricción */}
      <div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/20 px-4 py-3">
        <p className="text-[11px] text-amber-400/80">
          El monto, tipo y cuentas no pueden modificarse. Para cambiarlos,
          elimina esta transacción y créala de nuevo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/30 mb-1">
            Descripción *
          </label>
          <input
            {...register('description', { required: true, maxLength: 255 })}
            className={fieldClass}
            placeholder="Descripción"
          />
          {errors.description && (
            <p className="text-[11px] text-red-400 mt-1">Requerida, máx. 255 caracteres</p>
          )}
        </div>

        <div className="col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/30 mb-1">
            Fecha
          </label>
          <input
            type="date"
            {...register('transaction_date')}
            className={fieldClass}
          />
          <p className="text-[10px] text-white/20 mt-1">
            Solo se puede cambiar dentro del mismo mes
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/30 mb-1">
            Notas
          </label>
          <textarea
            {...register('notes')}
            rows={2}
            className={`${fieldClass} resize-none`}
            placeholder="Observaciones opcionales…"
          />
        </div>
      </div>

      {error && <InlineError message={error}/>}

      <div className="flex gap-3 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/65
            bg-white/[0.04] hover:bg-white/[0.07] transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold
            bg-[var(--c-primary)] hover:bg-[var(--c-primary-hover)] text-black
            disabled:opacity-40 transition-all"
        >
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface TransactionDetailClientProps {
  transaction:   TransactionWithRelations
  linkedModules: LinkedModules
}

export function TransactionDetailClient({
  transaction: tx,
  linkedModules: mods,
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
      <BackLink href="/transactions" label="Transacciones"/>

      <DetailShell
        twoColumn
        aside={
          <div className="space-y-4">
            {/* Acciones */}
            <DetailCard className="p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.1em]
                text-white/25 mb-4">
                Acciones
              </h3>
              <div className="space-y-2">
                {!editing && (
                  <ActionButton
                    label="Editar transacción"
                    variant="secondary"
                    onClick={() => setEditing(true)}
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                  />
                )}
                <ActionButton
                  label="Eliminar transacción"
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  testId="transaction-detail-delete-button"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
                />
              </div>
              {deleteError && (
                <div className="mt-3">
                  <InlineError message={deleteError}/>
                </div>
              )}
            </DetailCard>

            {/* Módulos derivados */}
            {hasLinkedModules && (
              <DetailCard className="p-5">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em]
                  text-white/25 mb-4">
                  Módulos generados
                </h3>
                <div className="space-y-2">
                  {mods.asset && (
                    <LinkedModuleBadge
                      label={mods.asset.name}
                      href={`/assets/${mods.asset.id}`}
                      color="#8b5cf6"
                    />
                  )}
                  {mods.credit && (
                    <LinkedModuleBadge
                      label={mods.credit.name}
                      href={`/credits/${mods.credit.id}`}
                      color="#f59e0b"
                    />
                  )}
                  {mods.loan && (
                    <LinkedModuleBadge
                      label={`${mods.loan.creditor_name} · ${mods.loan.paid_installments}/${mods.loan.total_installments} cuotas`}
                      href={`/credits`}
                      color="#f59e0b"
                    />
                  )}
                  {mods.receivable && (
                    <LinkedModuleBadge
                      label={`Por cobrar · ${mods.receivable.debtor_name}`}
                      href={`/receivables/${mods.receivable.id}`}
                      color="#06b6d4"
                    />
                  )}
                  {mods.payable && (
                    <LinkedModuleBadge
                      label={`Por pagar · ${mods.payable.creditor_name}`}
                      href={`/payables/${mods.payable.id}`}
                      color="#f97316"
                    />
                  )}
                </div>
              </DetailCard>
            )}
          </div>
        }
      >
        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <DetailCard>
          <div className="p-6 border-b border-white/[0.05]">
            <div className="flex items-start gap-4">
              {/* Icono tipo */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center
                  text-lg flex-shrink-0"
                style={{
                  backgroundColor: typeConfig.color + '18',
                  border:          `1px solid ${typeConfig.color}25`,
                  color:           typeConfig.color,
                }}
              >
                {typeConfig.prefix}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: typeConfig.color + '18',
                      color:           typeConfig.color,
                    }}
                  >
                    {typeConfig.label}
                  </span>
                  {tx.category && (
                    <span className="text-[10px] text-white/30 bg-white/[0.05]
                      px-2 py-0.5 rounded-full">
                      {tx.category.name}
                    </span>
                  )}
                </div>
                <h1 className="text-lg font-bold text-white/85 leading-tight">
                  {tx.description}
                </h1>
                <p className="text-sm text-white/35 mt-0.5">
                  {formatDate(tx.transaction_date)}
                </p>
              </div>

              {/* Monto */}
              <div className="text-right flex-shrink-0">
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: typeConfig.color }}
                >
                  {typeConfig.prefix}{formatCurrency(format(amountPen), preferred)}
                </p>
                {tx.currency !== 'PEN' && (
                  <p className="text-[11px] text-white/25 mt-0.5 tabular-nums">
                    {formatCurrency(tx.amount, tx.currency as 'PEN' | 'USD')}
                  </p>
                )}
                {!tx.affects_reports && (
                  <span className="text-[10px] text-blue-400/60 bg-blue-500/10
                    px-2 py-0.5 rounded-full mt-1 inline-block">
                    Excluida de reportes
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── CAMPOS DE DETALLE ──────────────────────────────────────── */}
          <div className="p-6">
            {editing ? (
              <InlineEditForm
                tx={tx}
                onSave={handleEditSave}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <FieldGrid>
                <DetailField label="Cuenta">
                  <div className="flex items-center gap-2">
                    {tx.source_account && (
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tx.source_account.color }}
                      />
                    )}
                    {tx.source_account?.name ?? '—'}
                  </div>
                </DetailField>

                {tx.destination_account && (
                  <DetailField label="Cuenta destino">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tx.destination_account.color }}
                      />
                      {tx.destination_account.name}
                    </div>
                  </DetailField>
                )}

                <DetailField label="Moneda" mono>
                  {tx.currency}
                  {tx.currency === 'USD' && (
                    <span className="text-white/30 text-[11px] ml-2">
                      · TC {formatNumber(Number(tx.exchange_rate ?? 0), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} PEN
                    </span>
                  )}
                </DetailField>

                <DetailField label="Equivalente en PEN" mono>
                  {formatCurrency(amountPen, 'PEN')}
                </DetailField>

                {tx.notes && (
                  <DetailField label="Notas" full>
                    <p className="text-white/50 text-sm leading-relaxed">{tx.notes}</p>
                  </DetailField>
                )}

                <DetailField label="Registrado" mono>
                  {new Date(tx.created_at).toLocaleDateString('es-PE', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </DetailField>

                <DetailField label="ID" mono>
                  <span className="text-[11px] text-white/25 font-mono">{tx.id}</span>
                </DetailField>
              </FieldGrid>
            )}
          </div>
        </DetailCard>
      </DetailShell>

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
