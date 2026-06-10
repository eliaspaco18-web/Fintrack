'use client'

// =============================================================================
// components/payables/CreditorForm.tsx
// PRD v3 — Módulo 8: Formulario crear/editar acreedor
// Campos: Acreedor (nombre), Deuda inicial (numérico), Relación (texto libre)
// Espejo de components/receivables/DebtorForm.tsx
// =============================================================================

import { useCallback, useState } from 'react'
import { Button }                from '@/components/ui/Button'
import { NumericInput }          from '@/components/ui/NumericInput'
import { FormActions, FormField } from '@/components/forms/primitives'
import { RecordModalFooter }     from '@/components/ui/RecordModal'
import { getApiErrorMessage }    from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { useToast }              from '@/lib/toast/toast'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CreditorRow = {
  id:           string
  name:         string
  initial_debt: number
  relationship: string | null
  is_active:    boolean
}

type CreditorFormProps = {
  /** Si se pasa, es modo edición */
  creditor?: CreditorRow | null
  onSuccess: (creditor: CreditorRow) => void
  onCancel:  () => void
  disabled?: boolean
}

type FormState = {
  name:         string
  initial_debt: string
  relationship: string
}

const EMPTY: FormState = { name: '', initial_debt: '0.00', relationship: '' }

function fromCreditor(c: CreditorRow): FormState {
  return {
    name:         c.name,
    initial_debt: Number(c.initial_debt ?? 0).toFixed(2),
    relationship: c.relationship ?? '',
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CreditorForm({ creditor, onSuccess, onCancel, disabled = false }: CreditorFormProps) {
  const { toast } = useToast()
  const [form, setForm]     = useState<FormState>(creditor ? fromCreditor(creditor) : EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const patch = useCallback((updates: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const name = form.name.trim()
    if (name.length < 2) {
      const msg = 'El nombre del acreedor debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('Error de validación', msg)
      return
    }

    const initial_debt = roundToDecimals(parseNumericInput(form.initial_debt, 0), 2)
    if (!Number.isFinite(initial_debt) || initial_debt < 0) {
      const msg = 'La deuda inicial debe ser 0 o mayor.'
      setError(msg)
      toast.error('Error de validación', msg)
      return
    }

    const payload = {
      name,
      initial_debt,
      relationship: form.relationship.trim() || null,
    }

    setSaving(true)
    try {
      const url    = creditor ? `/api/creditors/${creditor.id}` : '/api/creditors'
      const method = creditor ? 'PATCH' : 'POST'
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar el acreedor'))
      }
      toast.success(
        creditor ? 'Acreedor actualizado' : 'Acreedor creado',
        `${name} se guardó correctamente.`,
        { persist: false },
      )
      onSuccess(json.data as CreditorRow)
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No se pudo guardar el acreedor'
      setError(msg)
      toast.error('No se pudo guardar el acreedor', msg)
    } finally {
      setSaving(false)
    }
  }, [creditor, form, onSuccess, toast])

  const isDisabled = disabled || saving

  return (
    <form
      id="creditor-form"
      onSubmit={handleSubmit}
      data-testid="creditor-form"
      className="space-y-[var(--ft-form-section-gap)]"
    >
      <FormField label="Nombre del acreedor">
        <input
          value={form.name}
          onChange={e => patch({ name: e.target.value })}
          required
          disabled={isDisabled}
          className="field-base ft-form-input w-full"
          placeholder="Ej: Proveedor Lima SAC"
          data-testid="creditor-name-input"
          maxLength={150}
        />
      </FormField>

      <FormField label="Relación" optional>
        <input
          value={form.relationship}
          onChange={e => patch({ relationship: e.target.value })}
          disabled={isDisabled}
          className="field-base ft-form-input w-full"
          placeholder="Ej: Proveedor de internet"
          data-testid="creditor-relationship-input"
          maxLength={200}
        />
      </FormField>

      <FormField
        label="Saldo inicial"
        optional
        description="Para deudas previas sin comprobante registrado."
      >
        <NumericInput
          value={form.initial_debt}
          onChange={e => patch({ initial_debt: e.target.value })}
          disabled={isDisabled}
          className="field-base ft-form-input w-full"
          placeholder="Ej: 1500"
          decimals={2}
          data-testid="creditor-initial-debt-input"
        />
      </FormField>

      {error && (
        <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
          <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
        </div>
      )}

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
              testId="creditor-save-btn"
            >
              {creditor ? 'Actualizar acreedor' : 'Crear acreedor'}
            </Button>
          )}
        />
      </RecordModalFooter>
    </form>
  )
}
