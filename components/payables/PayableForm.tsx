'use client'

// =============================================================================
// components/payables/PayableForm.tsx
// PRD v3 — Módulo 8: Formulario crear/editar cuenta por pagar
// Tipo = EXPENSE (egreso del portafolio). Campos PRD exactos:
//   Portafolio, Fecha, Acreedor, Descripción, Moneda (auto), Monto + equivalencia,
//   Notas, Adjuntar, Botón "guardar como recurrente"
// Espejo de components/receivables/ReceivableForm.tsx
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button }                           from '@/components/ui/Button'
import { NumericInput }                     from '@/components/ui/NumericInput'
import { AppSelect }                        from '@/components/ui/AppSelect'
import { CheckboxToggle }                   from '@/components/forms/TransactionForm/FormFields'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import { RecordModalFooter }                from '@/components/ui/RecordModal'
import { getApiErrorMessage }               from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { formatCurrency }                   from '@/lib/contracts/ui.contracts'
import { useToast }                         from '@/lib/toast/toast'
import {
  ATTACHMENT_LEGACY_REFERENCE_NOTICE,
  ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
} from '@/modules/attachments/attachment-integrity'
import type { CreditorRow }                 from './CreditorForm'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type AccountOption = {
  id:       string
  name:     string
  currency: string
  type:     string
  is_active: boolean
}

export type PayableRow = {
  id:             string
  creditor_id:    string | null
  creditor_name:  string
  concept:        string | null
  amount:         number
  paid_amount:    number
  currency:       string
  issue_date:     string
  due_date:       string | null
  notes:          string | null
  attachment_url: string | null
  status:         string
  source_account?: { id: string; name: string } | null
}

type FormState = {
  account_id:     string
  issue_date:     string
  due_date:       string
  creditor_id:    string
  concept:        string
  currency:       string
  amount:         string
  notes:          string
  save_recurring:  boolean
  recurring_name:  string
}

type PayableFormProps = {
  payable?:     PayableRow | null
  creditors:    CreditorRow[]
  exchangeRate: number
  onSuccess:    () => void
  onCancel:     () => void
  defaultCreditorId?: string
  disabled?:    boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM: FormState = {
  account_id:     '',
  issue_date:     isoToday(),
  due_date:       '',
  creditor_id:    '',
  concept:        '',
  currency:       'PEN',
  amount:         '0.00',
  notes:          '',
  save_recurring:  false,
  recurring_name:  '',
}

function fromPayable(p: PayableRow): FormState {
  return {
    account_id:     '',
    issue_date:     p.issue_date,
    due_date:       p.due_date ?? '',
    creditor_id:    p.creditor_id ?? '',
    concept:        p.concept ?? '',
    currency:       p.currency,
    amount:         Number(p.amount ?? 0).toFixed(2),
    notes:          p.notes ?? '',
    save_recurring:  false,
    recurring_name:  '',
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PayableForm({
  payable,
  creditors,
  exchangeRate,
  onSuccess,
  onCancel,
  defaultCreditorId,
  disabled = false,
}: PayableFormProps) {
  const { toast } = useToast()
  const isEdit    = !!payable

  const [form, setForm]         = useState<FormState>(
    payable
      ? fromPayable(payable)
      : { ...EMPTY_FORM, creditor_id: defaultCreditorId ?? EMPTY_FORM.creditor_id }
  )
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const patch = useCallback((updates: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    const nextForm = payable
      ? fromPayable(payable)
      : { ...EMPTY_FORM, creditor_id: defaultCreditorId ?? EMPTY_FORM.creditor_id }

    setForm(nextForm)
    setError(null)
    setAdvancedOpen(Boolean(
      payable?.notes?.trim() ||
      payable?.attachment_url ||
      nextForm.save_recurring ||
      nextForm.recurring_name.trim(),
    ))
  }, [defaultCreditorId, payable])

  // Cargar portafolios activos (excluye tarjetas de crédito)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res  = await fetch('/api/accounts?is_active=true', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!cancelled && res.ok && json?.ok) {
          const list = (json.data as AccountOption[]).filter(
            a => a.type !== 'CREDIT_CARD' && a.is_active
          )
          setAccounts(list)
        }
      } catch { /* silencioso */ }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // Auto-moneda desde portafolio seleccionado
  useEffect(() => {
    if (!form.account_id) return
    const account = accounts.find(a => a.id === form.account_id)
    if (account) patch({ currency: account.currency })
  }, [form.account_id, accounts, patch])

  // ── Equivalencia ────────────────────────────────────────────────────────────
  const amount     = parseNumericInput(form.amount, 0)
  const isPen      = form.currency === 'PEN'
  const equivLabel = isPen
    ? `≈ ${formatCurrency(amount / (exchangeRate || 1), 'USD')}`
    : `≈ ${formatCurrency(amount * (exchangeRate || 1), 'PEN')}`

  // ── Subir adjunto ────────────────────────────────────────────────────────────
  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validaciones
    const creditorRow = creditors.find(c => c.id === form.creditor_id)
    if (!form.creditor_id || !creditorRow) {
      const msg = 'Selecciona un acreedor.'
      setError(msg)
      toast.error('Error de validación', msg)
      return
    }

    const amount = roundToDecimals(parseNumericInput(form.amount, 0), 2)
    if (!Number.isFinite(amount) || amount <= 0) {
      const msg = 'El monto debe ser mayor a 0.'
      setError(msg)
      toast.error('Error de validación', msg)
      return
    }

    if (!isEdit && !form.account_id) {
      const msg = 'Selecciona un portafolio.'
      setError(msg)
      toast.error('Error de validación', msg)
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        creditor_id:    form.creditor_id,
        creditor_name:  creditorRow.name,
        concept:        form.concept.trim() || null,
        amount,
        currency:       form.currency,
        issue_date:     form.issue_date,
        due_date:       form.due_date || null,
        notes:          form.notes.trim() || null,
        status:         'PENDING',
      }

      // En creación también enviamos el portafolio para crear la transacción
      if (!isEdit) {
        payload.source_account_id = form.account_id
        payload.save_recurring    = form.save_recurring
        payload.recurring_name    = form.save_recurring ? form.recurring_name.trim() : null
      }

      const url    = isEdit ? `/api/payables/${payable!.id}` : '/api/payables'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la cuenta por pagar'))
      }

      toast.success(
        isEdit ? 'Cuenta por pagar actualizada' : 'Cuenta por pagar creada',
        `${creditorRow.name} — ${formatCurrency(amount, form.currency)}.`,
        { persist: false },
      )

      const recurringWarning = json.data?.recurring_template?.warning
      if (typeof recurringWarning === 'string' && recurringWarning.trim().length > 0) {
        toast.warning(
          'La cuenta se guardó, pero no se pudo crear la plantilla recurrente',
          recurringWarning,
        )
      }

      onSuccess()
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No se pudo guardar la cuenta por pagar'
      setError(msg)
      toast.error('No se pudo guardar', msg)
    } finally {
      setSaving(false)
    }
  }, [creditors, form, isEdit, onSuccess, payable, toast])

  const isDisabled = disabled || saving

  // ── Opciones de select ───────────────────────────────────────────────────────
  const accountOptions = [
    { value: '', label: 'Selecciona portafolio...' },
    ...accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` })),
  ]

  const creditorOptions = [
    { value: '', label: 'Selecciona acreedor...' },
    ...creditors.map(c => ({ value: c.id, label: c.name })),
  ]

  const sourceAccountName = payable?.source_account?.name ?? null
  const optionalSummary = useMemo(() => {
    const summary = ['Notas', 'Comprobante', 'Recurrencia']
    if (form.notes.trim()) summary[0] = 'Notas cargadas'
    if (payable?.attachment_url) summary[1] = 'Referencia anterior preservada'
    if (form.save_recurring) summary[2] = 'Recurrente'
    return summary
  }, [form.notes, form.save_recurring, payable?.attachment_url])

  return (
    <form
      id="payable-form"
      onSubmit={handleSubmit}
      data-testid="payable-form"
      className="space-y-[var(--ft-form-section-gap)]"
    >
      <div className="grid grid-cols-1 gap-5 min-[860px]:grid-cols-[minmax(0,1.04fr)_minmax(300px,0.96fr)] min-[860px]:items-start">
        <FormSection
          title="Contexto"
          description="Define la contraparte y el portafolio que sostienen esta obligación."
          className="space-y-4"
        >
          <FormField label="Acreedor">
            <AppSelect
              value={form.creditor_id}
              onChange={v => patch({ creditor_id: v })}
              options={creditorOptions}
              disabled={isDisabled}
              searchable
              searchPlaceholder="Buscar acreedor..."
              className="w-full"
              data-testid="payable-creditor-select"
            />
          </FormField>

          {!isEdit ? (
            <FormField label="Portafolio asociado">
              <AppSelect
                value={form.account_id}
                onChange={v => patch({ account_id: v })}
                options={accountOptions}
                disabled={isDisabled}
                searchable
                searchPlaceholder="Buscar portafolio..."
                className="w-full"
                data-testid="payable-account-select"
              />
            </FormField>
          ) : (
            <FormField
              label="Portafolio asociado"
              description={sourceAccountName
                ? 'Se conserva el portafolio original porque afecta el ledger ya registrado.'
                : 'El portafolio asociado se mantiene sin cambios durante la edición.'}
            >
              <div
                className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--c-surface-2)] px-3.5 py-3 text-sm text-[var(--c-text)]"
                data-testid="payable-account-context"
              >
                <span className="font-medium">{sourceAccountName ?? 'Portafolio original'}</span>
              </div>
            </FormField>
          )}
        </FormSection>

        <FormSection
          title="Registro"
          description="Confirma importe, moneda y fechas antes de guardar."
          className="space-y-4"
        >
          <FormField label="Monto">
            <NumericInput
              value={form.amount}
              onChange={e => patch({ amount: e.target.value })}
              required
              disabled={isDisabled}
              className="field-base ft-form-amount-input w-full px-3.5 py-3 text-base font-semibold"
              placeholder="0.00"
              decimals={2}
              data-testid="payable-amount-input"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--c-surface-2)] px-3.5 py-3"
              data-testid="payable-currency-display"
            >
              <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Moneda</p>
              <p className="mt-1 text-sm font-semibold text-[var(--c-text)]">{form.currency || '—'}</p>
            </div>
            <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--c-surface-2)] px-3.5 py-3">
              <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Equivalencia</p>
              <p className="mt-1 text-sm font-semibold text-[var(--c-text)]">{equivLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[var(--ft-form-field-gap)] sm:grid-cols-2">
            <FormField label="Fecha de emisión">
              <input
                type="date"
                value={form.issue_date}
                onChange={e => patch({ issue_date: e.target.value })}
                required
                disabled={isDisabled}
                className="field-base ft-form-input w-full"
                data-testid="payable-date-input"
              />
            </FormField>

            <FormField
              label="Fecha de vencimiento"
              optional
              description="Visible por defecto para activar alertas y seguimiento operativo."
            >
              <input
                type="date"
                value={form.due_date}
                onChange={e => patch({ due_date: e.target.value })}
                disabled={isDisabled}
                className="field-base ft-form-input w-full"
                data-testid="payable-due-date-input"
              />
            </FormField>
          </div>
        </FormSection>

        <div className="min-[860px]:col-span-2">
          <FormField label="Descripción" optional description="Usa una referencia corta y reconocible dentro del ledger.">
            <input
              value={form.concept}
              onChange={e => patch({ concept: e.target.value })}
              disabled={isDisabled}
              className="field-base ft-form-input w-full"
              placeholder="Ej: Factura de internet mayo"
              data-testid="payable-concept-input"
              maxLength={300}
            />
          </FormField>
        </div>

        <div className="min-[860px]:col-span-2">
          <OptionalSection
            title="Mas opciones"
            summary={optionalSummary}
            open={advancedOpen}
            onOpenChange={setAdvancedOpen}
          >
            <FormSection columns="1">
              <FormField label="Notas" optional>
                <textarea
                  value={form.notes}
                  onChange={e => patch({ notes: e.target.value })}
                  disabled={isDisabled}
                  rows={3}
                  className="field-base ft-form-textarea w-full resize-none"
                  placeholder="Observaciones adicionales..."
                  data-testid="payable-notes-input"
                  maxLength={1000}
                />
              </FormField>

              <div
                className="rounded-[var(--ft-form-radius)] border border-dashed border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-4 py-3"
                data-testid="payable-attachment-unavailable"
              >
                <p className="text-[13px] font-semibold text-[var(--ft-text-strong)]">Comprobante</p>
                <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  {payable?.attachment_url
                    ? ATTACHMENT_LEGACY_REFERENCE_NOTICE
                    : ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE}
                </p>
              </div>

              {!isEdit ? (
                <div className="space-y-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-4 py-4">
                  <CheckboxToggle
                    label="Guardar como transacción recurrente"
                    description="Úsalo solo si este compromiso se repetirá con la misma estructura."
                    checked={form.save_recurring}
                    onChange={checked => patch({ save_recurring: checked })}
                    disabled={isDisabled}
                  />

                  {form.save_recurring ? (
                    <FormField label="Nombre de recurrencia">
                      <input
                        value={form.recurring_name}
                        onChange={e => patch({ recurring_name: e.target.value })}
                        disabled={isDisabled}
                        className="field-base ft-form-input w-full"
                        placeholder="Ej: Internet mensual oficina"
                        maxLength={150}
                        data-testid="payable-recurring-name"
                      />
                    </FormField>
                  ) : null}
                </div>
              ) : null}
            </FormSection>
          </OptionalSection>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
          <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
        </div>
      ) : null}

      <RecordModalFooter>
        <FormActions
          secondaryAction={(
            <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
          )}
          primaryAction={(
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isDisabled}
              loading={saving}
              testId="payable-save-btn"
            >
              {isEdit ? 'Actualizar cuenta por pagar' : 'Crear cuenta por pagar'}
            </Button>
          )}
        />
      </RecordModalFooter>
    </form>
  )
}
