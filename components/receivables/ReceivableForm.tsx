'use client'

// =============================================================================
// components/receivables/ReceivableForm.tsx
// PRD v3 — Módulo 7: Formulario crear/editar cuenta por cobrar
// Tipo = EXPENSE (egreso de portafolio). Campos PRD exactos:
//   Portafolio, Fecha, Deudor, Descripción, Moneda (auto), Monto + equivalencia,
//   Notas, Adjuntar, Botón "guardar como recurrente"
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button }                           from '@/components/ui/Button'
import { NumericInput }                     from '@/components/ui/NumericInput'
import { AppSelect }                        from '@/components/ui/AppSelect'
import { FileUpload }                       from '@/components/ui/FileUpload'
import { CheckboxToggle }                   from '@/components/forms/TransactionForm/FormFields'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import { RecordModalFooter }                from '@/components/ui/RecordModal'
import { getApiErrorMessage }               from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { formatCurrency }                   from '@/lib/contracts/ui.contracts'
import { useToast }                         from '@/lib/toast/toast'
import type { DebtorRow }                   from './DebtorForm'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type AccountOption = {
  id:       string
  name:     string
  currency: string
  type:     string
  is_active: boolean
}

type ReceivableRow = {
  id:              string
  debtor_id:       string | null
  debtor_name:     string
  concept:         string | null
  amount:          number
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
  exchangeRate: number
  onSuccess:    () => void
  onCancel:     () => void
  defaultDebtorId?: string
  /** Llamado para refrescar lista de deudores tras crear uno nuevo */
  onAddDebtor?: () => void
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

// ─── Componente ───────────────────────────────────────────────────────────────

export function ReceivableForm({
  receivable,
  debtors,
  exchangeRate,
  onSuccess,
  onCancel,
  defaultDebtorId,
  disabled = false,
}: ReceivableFormProps) {
  const { toast } = useToast()
  const isEdit    = !!receivable

  const [form, setForm]         = useState<FormState>(
    receivable
      ? fromReceivable(receivable)
      : { ...EMPTY_FORM, debtor_id: defaultDebtorId ?? EMPTY_FORM.debtor_id }
  )
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [existingUrl, setExistingUrl] = useState<string | null>(receivable?.attachment_url ?? null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const patch = useCallback((updates: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    const nextForm = receivable
      ? fromReceivable(receivable)
      : { ...EMPTY_FORM, debtor_id: defaultDebtorId ?? EMPTY_FORM.debtor_id }

    setForm(nextForm)
    setExistingUrl(receivable?.attachment_url ?? null)
    setAttachment(null)
    setError(null)
    setAdvancedOpen(Boolean(
      receivable?.notes?.trim() ||
      receivable?.attachment_url ||
      nextForm.save_recurring ||
      nextForm.recurring_name.trim(),
    ))
  }, [defaultDebtorId, receivable])

  // Cargar portafolios activos. Las tarjetas se permiten como origen:
  // el backend las registra como consumo de línea disponible.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res  = await fetch('/api/accounts?is_active=true', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!cancelled && res.ok && json?.ok) {
          const list = (json.data as AccountOption[]).filter(account => account.is_active)
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
  async function uploadAttachment(file: File): Promise<string | null> {
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/attachments/upload', { method: 'POST', body: fd })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.ok) return json.url as string
    } catch { /* silencioso */ }
    return null
  }

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
      // Subir adjunto si hay uno nuevo
      let attachmentUrl: string | null = existingUrl
      if (attachment) {
        attachmentUrl = await uploadAttachment(attachment)
      }

      const payload: Record<string, unknown> = {
        debtor_id:      form.debtor_id,
        debtor_name:    debtorRow.name,
        concept:        form.concept.trim() || null,
        amount,
        currency:       form.currency,
        issue_date:     form.issue_date,
        due_date:       form.due_date || null,
        notes:          form.notes.trim() || null,
        attachment_url: attachmentUrl,
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
      onSuccess()
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No se pudo guardar la cuenta por cobrar'
      setError(msg)
      toast.error('No se pudo guardar', msg)
    } finally {
      setSaving(false)
    }
  }, [attachment, debtors, existingUrl, form, isEdit, onSuccess, receivable, toast])

  const isDisabled = disabled || saving

  // ── Opciones de select ───────────────────────────────────────────────────────
  const accountOptions = [
    { value: '', label: 'Selecciona portafolio...' },
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
    if (attachment || existingUrl) summary[1] = 'Comprobante adjunto'
    if (form.save_recurring) summary[2] = 'Recurrente'
    return summary
  }, [attachment, existingUrl, form.notes, form.save_recurring])

  return (
    <form
      id="receivable-form"
      onSubmit={handleSubmit}
      data-testid="receivable-form"
      className="space-y-[var(--ft-form-section-gap)]"
    >
      <div className="grid grid-cols-1 gap-5 min-[860px]:grid-cols-[minmax(0,1.04fr)_minmax(300px,0.96fr)] min-[860px]:items-start">
        <FormSection
          title="Contexto"
          description="Define quién te debe y desde qué portafolio estás registrando el cobro esperado."
          className="space-y-4"
        >
          <FormField label="Deudor">
            <AppSelect
              value={form.debtor_id}
              onChange={v => patch({ debtor_id: v })}
              options={debtorOptions}
              disabled={isDisabled}
              searchable
              searchPlaceholder="Buscar deudor..."
              className="w-full"
              data-testid="receivable-debtor-select"
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
                data-testid="receivable-account-select"
              />
            </FormField>
          ) : (
            <FormField
              label="Portafolio asociado"
              description={sourceAccountName
                ? 'Se conserva el portafolio original porque forma parte del registro ya emitido.'
                : 'El portafolio asociado se mantiene sin cambios durante la edición.'}
            >
              <div
                className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--c-surface-2)] px-3.5 py-3 text-sm text-[var(--c-text)]"
                data-testid="receivable-account-context"
              >
                <span className="font-medium">{sourceAccountName ?? 'Portafolio original'}</span>
              </div>
            </FormField>
          )}
        </FormSection>

        <FormSection
          title="Registro"
          description="Confirma importe, moneda y fechas para dejar el seguimiento listo."
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--c-surface-2)] px-3.5 py-3"
              data-testid="receivable-currency-display"
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
                data-testid="receivable-date-input"
              />
            </FormField>

            <FormField
              label="Fecha de vencimiento"
              optional
              description="Mantenla visible para operar cobros, alertas y priorización."
            >
              <input
                type="date"
                value={form.due_date}
                onChange={e => patch({ due_date: e.target.value })}
                disabled={isDisabled}
                className="field-base ft-form-input w-full"
                data-testid="receivable-due-date-input"
              />
            </FormField>
          </div>
        </FormSection>

        <div className="min-[860px]:col-span-2">
          <FormField label="Descripción" optional description="Usa una referencia reconocible para el seguimiento del cobro.">
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
                  data-testid="receivable-notes-input"
                  maxLength={1000}
                />
              </FormField>

              <div>
                <FileUpload
                  value={attachment}
                  existingUrl={existingUrl}
                  onChange={setAttachment}
                  onRemoveExisting={() => setExistingUrl(null)}
                  disabled={isDisabled}
                  id="receivable-attachment"
                  label="Comprobante opcional"
                />
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
              testId="receivable-save-btn"
            >
              {isEdit ? 'Actualizar cuenta por cobrar' : 'Crear cuenta por cobrar'}
            </Button>
          )}
        />
      </RecordModalFooter>
    </form>
  )
}
