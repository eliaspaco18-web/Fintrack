'use client'

// =============================================================================
// components/receivables/DebtorForm.tsx
// PRD v3 — Módulo 7: Formulario crear/editar deudor
// Campos: Deudor (nombre), Deuda inicial (numérico), Relación (texto libre)
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

export type DebtorRow = {
  id:           string
  name:         string
  initial_debt: number
  relationship: string | null
  is_active:    boolean
}

type DebtorFormProps = {
  /** Si se pasa, es modo edición */
  debtor?:   DebtorRow | null
  onSuccess: (debtor: DebtorRow) => void
  onCancel:  () => void
  disabled?: boolean
}

type FormState = {
  name:         string
  initial_debt: string
  relationship: string
}

const EMPTY: FormState = { name: '', initial_debt: '0.00', relationship: '' }

function fromDebtor(d: DebtorRow): FormState {
  return {
    name:         d.name,
    initial_debt: Number(d.initial_debt ?? 0).toFixed(2),
    relationship: d.relationship ?? '',
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function DebtorForm({ debtor, onSuccess, onCancel, disabled = false }: DebtorFormProps) {
  const { toast } = useToast()
  const [form, setForm]   = useState<FormState>(debtor ? fromDebtor(debtor) : EMPTY)
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
      const msg = 'El nombre del deudor debe tener al menos 2 caracteres.'
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
      const url    = debtor ? `/api/debtors/${debtor.id}` : '/api/debtors'
      const method = debtor ? 'PATCH' : 'POST'
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar el deudor'))
      }
      toast.success(
        debtor ? 'Deudor actualizado' : 'Deudor creado',
        `${name} se guardó correctamente.`,
        { persist: false },
      )
      onSuccess(json.data as DebtorRow)
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : 'No se pudo guardar el deudor'
      setError(msg)
      toast.error('No se pudo guardar el deudor', msg)
    } finally {
      setSaving(false)
    }
  }, [debtor, form, onSuccess, toast])

  const isDisabled = disabled || saving

  return (
    <form
      id="debtor-form"
      onSubmit={handleSubmit}
      data-testid="debtor-form"
      className="space-y-[var(--ft-form-section-gap)]"
    >
      <FormField label="Nombre del deudor">
        <input
          value={form.name}
          onChange={e => patch({ name: e.target.value })}
          required
          disabled={isDisabled}
          className="field-base ft-form-input w-full"
          placeholder="Ej: Cliente Rivera"
          data-testid="debtor-name-input"
          maxLength={150}
        />
      </FormField>

      <FormField label="Relación" optional>
        <input
          value={form.relationship}
          onChange={e => patch({ relationship: e.target.value })}
          disabled={isDisabled}
          className="field-base ft-form-input w-full"
          placeholder="Ej: Cliente frecuente"
          data-testid="debtor-relationship-input"
          maxLength={200}
        />
      </FormField>

      <FormField
        label="Saldo inicial"
        optional
        description="Usalo solo si ya existe una deuda previa sin documento asociado."
      >
        <NumericInput
          value={form.initial_debt}
          onChange={e => patch({ initial_debt: e.target.value })}
          disabled={isDisabled}
          className="field-base ft-form-input w-full"
          placeholder="Ej: 1500"
          decimals={2}
          data-testid="debtor-initial-debt-input"
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
              testId="debtor-save-btn"
            >
              {debtor ? 'Actualizar deudor' : 'Crear deudor'}
            </Button>
          )}
        />
      </RecordModalFooter>
    </form>
  )
}
