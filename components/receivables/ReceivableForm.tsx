'use client'

// =============================================================================
// components/receivables/ReceivableForm.tsx
// PRD v3 — Módulo 7: Formulario crear/editar cuenta por cobrar
// Tipo = EXPENSE (egreso de portafolio). Campos PRD exactos:
//   Portafolio, Fecha, Deudor, Descripción, Moneda (auto), Monto + equivalencia,
//   Notas, Adjuntar, Botón "guardar como recurrente"
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button }                           from '@/components/ui/Button'
import { NumericInput }                     from '@/components/ui/NumericInput'
import { AppSelect }                        from '@/components/ui/AppSelect'
import { CheckboxToggle }                   from '@/components/forms/TransactionForm/FormFields'
import { IncomeDatePicker } from '@/components/forms/TransactionForm/IncomeDatePicker'
import { CreditInfoHint } from '@/components/credits/CreditInfoHint'
import { FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import { getApiErrorMessage }               from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { formatCurrency }                   from '@/lib/contracts/ui.contracts'
import { useToast }                         from '@/lib/toast/toast'
import {
  ATTACHMENT_LEGACY_REFERENCE_NOTICE,
  ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE,
} from '@/modules/attachments/attachment-integrity'
import type { DebtorRow }                   from './DebtorForm'
import styles from './ReceivableForm.module.css'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type AccountOption = {
  id:       string
  name:     string
  currency: string
  type:     string
  is_active: boolean
}

export type ReceivableRow = {
  id:              string
  debtor_id:       string | null
  debtor_name:     string
  concept:         string | null
  amount:          number
  collected_amount: number
  currency:        string
  issue_date:      string
  due_date:        string | null
  notes:           string | null
  attachment_url:  string | null
  status:          string
  source_account?: { id: string; name: string } | null
}

type FormState = {
  account_id:    string
  issue_date:    string
  due_date:      string
  debtor_id:     string
  concept:       string
  currency:      string
  amount:        string
  notes:         string
  save_recurring: boolean
  recurring_name: string
}

type ReceivableFormProps = {
  receivable?:  ReceivableRow | null
  debtors:      DebtorRow[]
  exchangeRate: number | null
  onSuccess:    () => void
  defaultDebtorId?: string
  /** Llamado para refrescar lista de deudores tras crear uno nuevo */
  onAddDebtor?: () => void
  disabled?:    boolean
  onDirtyChange?: (dirty: boolean) => void
  onFormStateChange?: (state: { disabled: boolean; saving: boolean; editing: boolean }) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM: FormState = {
  account_id:     '',
  issue_date:     isoToday(),
  due_date:       '',
  debtor_id:      '',
  concept:        '',
  currency:       'PEN',
  amount:         '0.00',
  notes:          '',
  save_recurring:  false,
  recurring_name:  '',
}

function fromReceivable(r: ReceivableRow): FormState {
  return {
    account_id:     '',           // no está en la row, no editable en este campo
    issue_date:     r.issue_date,
    due_date:       r.due_date ?? '',
    debtor_id:      r.debtor_id ?? '',
    concept:        r.concept ?? '',
    currency:       r.currency,
    amount:         Number(r.amount ?? 0).toFixed(2),
    notes:          r.notes ?? '',
    save_recurring:  false,
    recurring_name:  '',
  }
}

function sameFormValues(left: FormState, right: FormState) {
  return left.account_id === right.account_id
    && left.issue_date === right.issue_date
    && left.due_date === right.due_date
    && left.debtor_id === right.debtor_id
    && left.concept.trim() === right.concept.trim()
    && left.currency === right.currency
    && roundToDecimals(parseNumericInput(left.amount, 0), 2) === roundToDecimals(parseNumericInput(right.amount, 0), 2)
    && left.notes.trim() === right.notes.trim()
    && left.save_recurring === right.save_recurring
    && left.recurring_name.trim() === right.recurring_name.trim()
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ReceivableForm({
  receivable,
  debtors,
  exchangeRate,
  onSuccess,
  defaultDebtorId,
  disabled = false,
  onDirtyChange,
  onFormStateChange,
}: ReceivableFormProps) {
  const { toast } = useToast()
  const isEdit    = !!receivable

  const initialForm = useMemo(() => receivable
    ? fromReceivable(receivable)
    : { ...EMPTY_FORM, debtor_id: defaultDebtorId ?? EMPTY_FORM.debtor_id }, [defaultDebtorId, receivable])
  const [form, setForm] = useState<FormState>(initialForm)
  const formRef = useRef(form)
  const initialFormRef = useRef(initialForm)
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [accountsLoading, setAccountsLoading] = useState(!isEdit)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)

  const patch = useCallback((updates: Partial<FormState>) => {
    const nextForm = { ...formRef.current, ...updates }
    formRef.current = nextForm
    setForm(nextForm)
    setError(null)
    onDirtyChange?.(!sameFormValues(nextForm, initialFormRef.current))
  }, [onDirtyChange])

  useEffect(() => {
    formRef.current = initialForm
    initialFormRef.current = initialForm
    setForm(initialForm)
    setError(null)
    setDateError(null)
    onDirtyChange?.(false)
    setAdvancedOpen(Boolean(
      receivable?.notes?.trim() ||
      receivable?.attachment_url ||
      initialForm.save_recurring ||
      initialForm.recurring_name.trim(),
    ))
  }, [initialForm, onDirtyChange, receivable?.attachment_url, receivable?.notes])

  // Cargar portafolios activos. Las tarjetas se permiten como origen:
  // el backend las registra como consumo de línea disponible.
  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const response = await fetch('/api/accounts?is_active=true', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok || !Array.isArray(json.data)) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los portafolios.'))
      }
      setAccounts((json.data as AccountOption[]).filter(account => account.is_active))
    } catch (caught) {
      setAccountsError(caught instanceof Error ? caught.message : 'No se pudieron cargar los portafolios.')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  // Auto-moneda desde portafolio seleccionado
  useEffect(() => {
    if (!form.account_id) return
    const account = accounts.find(a => a.id === form.account_id)
    if (account) patch({ currency: account.currency })
  }, [form.account_id, accounts, patch])

  // ── Equivalencia ────────────────────────────────────────────────────────────
  const amount     = parseNumericInput(form.amount, 0)
  const isPen      = form.currency === 'PEN'
  const equivLabel = exchangeRate === null || !Number.isFinite(exchangeRate) || exchangeRate <= 0
    ? 'Equivalencia no disponible'
    : isPen
      ? `≈ ${formatCurrency(amount / exchangeRate, 'USD')}`
      : `≈ ${formatCurrency(amount * exchangeRate, 'PEN')}`

  // ── Subir adjunto ────────────────────────────────────────────────────────────
  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validaciones
    const debtorRow = debtors.find(d => d.id === form.debtor_id)
    if (!form.debtor_id || !debtorRow) {
      const msg = 'Selecciona un deudor.'
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
        debtor_id:      form.debtor_id,
        debtor_name:    debtorRow.name,
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

      const url    = isEdit ? `/api/receivables/${receivable!.id}` : '/api/receivables'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la cuenta por cobrar'))
      }

      toast.success(
        isEdit ? 'Cuenta por cobrar actualizada' : 'Cuenta por cobrar creada',
        `${debtorRow.name} — ${formatCurrency(amount, form.currency)}.`,
        { persist: false },
      )
      onDirtyChange?.(false)
      onSuccess()
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No se pudo guardar la cuenta por cobrar'
      setError(msg)
      toast.error('No se pudo guardar', msg)
    } finally {
      setSaving(false)
    }
  }, [debtors, form, isEdit, onDirtyChange, onSuccess, receivable, toast])

  const isDisabled = disabled || saving || (!isEdit && (accountsLoading || Boolean(accountsError) || accounts.length === 0))

  useEffect(() => {
    onFormStateChange?.({ disabled: isDisabled, saving, editing: isEdit })
  }, [isDisabled, isEdit, onFormStateChange, saving])

  // ── Opciones de select ───────────────────────────────────────────────────────
  const accountOptions = [
    { value: '', label: accountsLoading ? 'Cargando portafolios…' : accountsError ? 'Portafolios no disponibles' : accounts.length === 0 ? 'Sin portafolios activos' : 'Selecciona portafolio…' },
    ...accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` })),
  ]

  const debtorOptions = [
    { value: '', label: 'Selecciona deudor...' },
    ...debtors.map(d => ({ value: d.id, label: d.name })),
  ]

  const sourceAccountName = receivable?.source_account?.name ?? null
  const optionalSummary = useMemo(() => {
    const summary = ['Notas', 'Comprobante', 'Recurrencia']
    if (form.notes.trim()) summary[0] = 'Notas cargadas'
    if (receivable?.attachment_url) summary[1] = 'Referencia anterior preservada'
    if (form.save_recurring) summary[2] = 'Recurrente'
    return summary
  }, [form.notes, form.save_recurring, receivable?.attachment_url])

  return (
    <form
      id="receivable-form"
      onSubmit={handleSubmit}
      data-testid="receivable-form"
      className={`${styles.formRoot} space-y-5`}
    >
      <div className={styles.formGrid}>
        <div className={styles.formSectionContainer}>
        <FormSection
          title="Contexto"
          className="space-y-4"
        >
          <FormField label="Deudor">
            <AppSelect
              value={form.debtor_id}
              onChange={v => patch({ debtor_id: v })}
              options={debtorOptions}
              disabled={isDisabled}
              searchable
              matchTriggerWidth
              searchPlaceholder="Buscar deudor..."
              className="w-full"
              testId="receivable-debtor-select"
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
                matchTriggerWidth
                searchPlaceholder="Buscar portafolio..."
                className="w-full"
                testId="receivable-account-select"
              />
                  {accountsError ? (
                    <p className="mt-2 flex items-center gap-2 text-[11px] text-[var(--ft-danger)]" role="alert">
                      {accountsError}
                      <Button type="button" variant="ghost" size="sm" onClick={() => void loadAccounts()}>Reintentar</Button>
                    </p>
                  ) : accounts.length === 0 && !accountsLoading ? (
                    <p className="mt-2 text-[11px] text-[var(--ft-text-muted)]" role="status">No hay portafolios activos disponibles.</p>
                  ) : null}
            </FormField>
          ) : (
            <FormField
              label="Portafolio asociado"
              description={sourceAccountName
                ? 'Se conserva el portafolio original porque forma parte del registro ya emitido.'
                : 'El portafolio asociado se mantiene sin cambios durante la edición.'}
            >
              <div
                className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3 text-sm text-[var(--ft-text-strong)]"
                data-testid="receivable-account-context"
              >
                <span className="font-medium">{sourceAccountName ?? 'Portafolio original'}</span>
              </div>
            </FormField>
          )}
        </FormSection>
        </div>

        <div className={styles.formSectionContainer}>
        <FormSection
          title="Registro"
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
              data-testid="receivable-amount-input"
            />
          </FormField>

          <div className={styles.currencyGrid}>
            <div
              className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3"
              data-testid="receivable-currency-display"
            >
              <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--ft-form-muted)]">Moneda <CreditInfoHint label="Ayuda sobre la moneda">La moneda procede del portafolio asociado y se conserva al editar.</CreditInfoHint></p>
              <p className="mt-1 text-sm font-semibold text-[var(--ft-text-strong)]">{form.currency || '—'}</p>
            </div>
            <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Equivalencia</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ft-text-strong)]">{equivLabel}</p>
            </div>
          </div>

          <div className={styles.dateGrid}>
            <FormField label="Fecha de emisión">
              <IncomeDatePicker
                value={form.issue_date}
                onChange={value => patch({ issue_date: value })}
                onInvalidInput={setDateError}
                error={dateError ?? undefined}
                disabled={isDisabled}
                inputLabel="Fecha de emisión"
                inputTestId="receivable-date-input"
              />
            </FormField>

            <FormField
              label="Fecha de vencimiento"
              optional
              labelAdornment={<CreditInfoHint label="Ayuda sobre la fecha de vencimiento">Es opcional. Se usa para mostrar la fecha registrada y priorizar el seguimiento; no significa que el cobro ya ocurrió.</CreditInfoHint>}
            >
              <IncomeDatePicker
                value={form.due_date}
                onChange={value => patch({ due_date: value })}
                onInvalidInput={setDateError}
                error={dateError ?? undefined}
                disabled={isDisabled}
                inputLabel="Fecha de vencimiento"
                inputTestId="receivable-due-date-input"
              />
            </FormField>
          </div>
        </FormSection>
        </div>

        <div className={styles.formWide}>
          <FormField label="Descripción" optional>
            <input
              value={form.concept}
              onChange={e => patch({ concept: e.target.value })}
              disabled={isDisabled}
              className="field-base ft-form-input w-full"
              placeholder="Ej: Factura F001-184"
              data-testid="receivable-concept-input"
              maxLength={300}
            />
          </FormField>
        </div>

        <div className={styles.formWide}>
          <OptionalSection
            title="Información adicional"
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
                  data-testid="receivable-notes-input"
                  maxLength={1000}
                />
              </FormField>

              <div
                className="rounded-[var(--ft-form-radius)] border border-dashed border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-4 py-3"
                data-testid="receivable-attachment-unavailable"
              >
                <p className="text-[13px] font-semibold text-[var(--ft-text-strong)]">Comprobante</p>
                <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  {receivable?.attachment_url
                    ? ATTACHMENT_LEGACY_REFERENCE_NOTICE
                    : ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE}
                </p>
              </div>

              {!isEdit ? (
                <div className="space-y-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] px-4 py-4">
                  <CheckboxToggle
                    label="Guardar como transacción recurrente"
                    description="Úsalo solo si este cobro se repetirá con la misma estructura."
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
                        placeholder="Ej: Cobro mensual soporte"
                        maxLength={150}
                        data-testid="receivable-recurring-name"
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

    </form>
  )
}
