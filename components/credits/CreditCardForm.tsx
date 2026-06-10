'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { RecordModalFooter } from '@/components/ui/RecordModal'
import { CreditCardScheduleModal } from '@/components/credits/CreditCardScheduleModal'
import {
  formatBillingCycleLabel,
  formatDuplicateCycleMessage,
  formatScheduleDateLabel,
} from '@/components/credits/credits-schedule.constants'
import { getBillingCycleYearOptions } from '@/lib/credits/billing-cycle-years'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { formatNumber } from '@/lib/contracts/ui.contracts'

type AccountOption = {
  id: string
  name: string
  type: string
  currency: string
  is_active: boolean
  bank_entity_id: string | null
  bank_entity?: { id: string; name: string; short_name: string | null } | null
}

type BillingCycleRow = {
  id: string
  billing_month: string
  billing_year: string
  consumption_from: string
  consumption_to: string
  payment_date: string
  total_to_pay: string
  statement_file: File | null
}

type CardFormState = {
  name: string
  account_id: string
  credit_limit: string
  used_amount: string
}

interface CreditCardFormProps {
  onSuccess: (creditName: string) => void
  onCancel: () => void
  onLayoutPreferenceChange?: (nextSize: 'lg' | 'xl' | 'full-form') => void
  onNestedModalOpenChange?: (open: boolean) => void
}

const YEARS = getBillingCycleYearOptions()
const MAX_FILE_BYTES = 8 * 1024 * 1024
const ALLOWED_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx']

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function newCycleRow(): BillingCycleRow {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String(now.getFullYear())

  return {
    id: crypto.randomUUID(),
    billing_month: month,
    billing_year: year,
    consumption_from: todayIso(),
    consumption_to: todayIso(),
    payment_date: todayIso(),
    total_to_pay: '0.00',
    statement_file: null,
  }
}

function SummaryStat({
  label,
  value,
  numeric = false,
}: {
  label: string
  value: string | number
  numeric?: boolean
}) {
  return (
    <div className="min-h-[76px] rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
      <p className="text-[11px] font-medium leading-[1.35] text-[var(--ft-form-muted)]">
        {label}
      </p>
      <p
        className={`
          mt-2 text-[15px] font-semibold leading-[1.35] text-[var(--ft-text)]
          ${numeric ? 'tabular-nums' : 'text-pretty'}
        `}
      >
        {value}
      </p>
    </div>
  )
}

export function CreditCardForm({
  onSuccess,
  onCancel,
  onLayoutPreferenceChange,
  onNestedModalOpenChange,
}: CreditCardFormProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<CardFormState>({
    name: '',
    account_id: '',
    credit_limit: '',
    used_amount: '0.00',
  })

  const [cycles, setCycles] = useState<BillingCycleRow[]>([newCycleRow()])
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)

  const cardAccounts = useMemo(
    () => accounts.filter(account => account.is_active && account.type === 'CREDIT_CARD'),
    [accounts],
  )

  const selectedAccount = useMemo(
    () => cardAccounts.find(account => account.id === form.account_id) ?? null,
    [cardAccounts, form.account_id],
  )

  const bankEntityLabel = selectedAccount?.bank_entity?.short_name
    ?? selectedAccount?.bank_entity?.name
    ?? (selectedAccount?.bank_entity_id ? '—' : 'Sin entidad bancaria vinculada')

  const creditLimitValue = roundToDecimals(parseNumericInput(form.credit_limit, 0) || 0, 2)
  const usedAmountValue = roundToDecimals(parseNumericInput(form.used_amount || '0', 0) || 0, 2)
  const availableAmountValue = Math.max(creditLimitValue - usedAmountValue, 0)
  const utilizationPct = creditLimitValue > 0 ? Math.min((usedAmountValue / creditLimitValue) * 100, 100) : 0

  const cycleKeys = useMemo(
    () => cycles.map(cycle => `${cycle.billing_year}-${cycle.billing_month}`),
    [cycles],
  )

  const duplicateCycleKeys = useMemo(() => {
    const counts: Record<string, number> = {}
    cycleKeys.forEach(key => {
      counts[key] = (counts[key] ?? 0) + 1
    })

    return new Set(
      Object.entries(counts)
        .filter(([, count]) => count > 1)
        .map(([key]) => key),
    )
  }, [cycleKeys])

  const duplicateCycleLabels = useMemo(
    () =>
      cycles
        .filter(cycle => duplicateCycleKeys.has(`${cycle.billing_year}-${cycle.billing_month}`))
        .map(cycle => formatBillingCycleLabel(cycle.billing_month, cycle.billing_year)),
    [cycles, duplicateCycleKeys],
  )
  const registeredTotal = useMemo(
    () => roundToDecimals(cycles.reduce((sum, cycle) => sum + (parseNumericInput(cycle.total_to_pay, 0) || 0), 0), 2),
    [cycles],
  )
  const firstPaymentDate = formatScheduleDateLabel(cycles[0]?.payment_date)
  const lastPaymentDate = formatScheduleDateLabel(cycles[cycles.length - 1]?.payment_date)
  const duplicateCyclesMessage = formatDuplicateCycleMessage(duplicateCycleLabels)

  useEffect(() => {
    onLayoutPreferenceChange?.('xl')
  }, [onLayoutPreferenceChange])

  useEffect(() => {
    onNestedModalOpenChange?.(isScheduleModalOpen)

    return () => {
      onNestedModalOpenChange?.(false)
    }
  }, [isScheduleModalOpen, onNestedModalOpenChange])

  useEffect(() => {
    const loadAccounts = async () => {
      setLoadingAccounts(true)
      try {
        const res = await fetch('/api/accounts', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las cuentas'))
        }

        const loaded = (json.data as AccountOption[]) ?? []
        setAccounts(loaded)

        const firstCard = loaded.find(account => account.is_active && account.type === 'CREDIT_CARD')
        if (firstCard) {
          setForm(prev => ({ ...prev, account_id: firstCard.id }))
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Error cargando cuentas')
      } finally {
        setLoadingAccounts(false)
      }
    }

    void loadAccounts()
  }, [])

  const addCycle = useCallback(() => {
    setCycles(prev => [...prev, newCycleRow()])
  }, [])

  const removeCycle = useCallback((id: string) => {
    setCycles(prev => prev.filter(cycle => cycle.id !== id))
  }, [])

  const updateCycle = useCallback((id: string, patch: Partial<BillingCycleRow>) => {
    setCycles(prev => prev.map(cycle => (cycle.id === id ? { ...cycle, ...patch } : cycle)))
  }, [])

  const handleFileChange = useCallback((id: string, file: File | null) => {
    if (!file) {
      updateCycle(id, { statement_file: null })
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setError('El archivo supera 8 MB.')
      return
    }

    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!ALLOWED_EXTS.includes(ext)) {
      setError('Formato no permitido.')
      return
    }

    setError(null)
    updateCycle(id, { statement_file: file })
  }, [updateCycle])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }

    if (!form.account_id) {
      setError('Selecciona el portafolio de tarjeta.')
      return
    }

    const limit = roundToDecimals(parseNumericInput(form.credit_limit, Number.NaN), 2)
    if (!Number.isFinite(limit) || limit <= 0) {
      setError('La línea de crédito debe ser mayor a 0.')
      return
    }

    const used = roundToDecimals(parseNumericInput(form.used_amount || '0', 0), 2)
    if (!Number.isFinite(used) || used < 0 || used > limit) {
      setError('El monto usado actual debe ser válido y no superar la línea de crédito.')
      return
    }

    setError(null)

    const usedKeys = new Set<string>()
    for (const cycle of cycles) {
      const key = `${cycle.billing_year}-${cycle.billing_month}`
      if (usedKeys.has(key)) {
        return
      }

      usedKeys.add(key)

      if (!cycle.consumption_from || !cycle.consumption_to || !cycle.payment_date) {
        setError('Completa todas las fechas en los ciclos de facturación.')
        return
      }
    }

    setSaving(true)

    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'CARD',
          name: trimmedName,
          account_id: form.account_id,
          currency: selectedAccount?.currency ?? 'PEN',
          credit_limit: limit,
          used_amount: used,
          interest_rate: 0,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear la tarjeta'))
      }

      const creditId = json.data?.credit?.id as string

      for (const cycle of cycles) {
        const totalToPay = roundToDecimals(parseNumericInput(cycle.total_to_pay || '0', 0), 2)
        await fetch(`/api/credits/${creditId}/billing-cycles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billing_month: Number(cycle.billing_month),
            billing_year: Number(cycle.billing_year),
            consumption_from: cycle.consumption_from,
            consumption_to: cycle.consumption_to,
            payment_date: cycle.payment_date,
            total_to_pay: totalToPay,
          }),
        })

        if (cycle.statement_file) {
          const formData = new FormData()
          formData.append('file', cycle.statement_file)
          await fetch(`/api/credits/${creditId}/attachment`, { method: 'POST', body: formData })
        }
      }

      onSuccess(trimmedName)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la tarjeta de crédito')
    } finally {
      setSaving(false)
    }
  }, [cycles, form, onSuccess, saving, selectedAccount])

  const isDisabled = saving
  const closeScheduleModal = useCallback(() => {
    setIsScheduleModalOpen(false)
    requestAnimationFrame(() => {
      document.getElementById('card-schedule-trigger')?.focus()
    })
  }, [])

  return (
    <form
      id="card-credit-form"
      onSubmit={handleSubmit}
      data-testid="credit-card-form"
      className="flex h-full min-h-0 flex-1 flex-col gap-4"
    >
      {error ? (
        <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
          <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:overflow-visible xl:pr-0">
        <FormSection
          title="Datos esenciales"
          description="Define primero la tarjeta y el portafolio que la representa dentro de FinTrack."
          columns="2"
          className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
        >
          <FormField
            label="Portafolio de tarjeta"
            description="Usa un portafolio tipo Tarjeta de crédito para heredar la entidad y la moneda."
            className="md:col-span-2"
          >
            {loadingAccounts ? (
              <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                Cargando portafolios...
              </div>
            ) : (
              <AppSelect
                value={form.account_id}
                onChange={value => setForm(prev => ({ ...prev, account_id: value }))}
                testId="credit-card-account-select"
                options={cardAccounts.length === 0
                  ? [{ value: '', label: 'Sin cuentas tipo Tarjeta activas', disabled: true }]
                  : cardAccounts.map(account => ({
                      value: account.id,
                      label: `${account.name} · ${account.currency}`,
                    }))}
                searchPlaceholder="Buscar portafolio..."
              />
            )}
          </FormField>

          {!loadingAccounts && cardAccounts.length === 0 ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-warning)]/20 bg-[var(--ft-warning-soft)] px-3.5 py-3 md:col-span-2">
              <p className="text-[12px] font-medium text-[var(--ft-warning)]">
                Crea primero una cuenta tipo Tarjeta de crédito en Portafolio para poder registrar esta línea.
              </p>
            </div>
          ) : null}

          <FormField label="Nombre de la tarjeta" className="md:col-span-2">
            <input
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              required
              disabled={isDisabled}
              data-testid="credit-card-name-input"
              className="field-base ft-form-input w-full"
              placeholder="Ej: Visa Signature BCP"
              maxLength={150}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2">
            <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Entidad bancaria</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ft-text)]">
                {selectedAccount ? bankEntityLabel : 'Selecciona un portafolio'}
              </p>
            </div>
            <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Moneda del portafolio</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ft-text)]">
                {selectedAccount?.currency ?? '—'}
              </p>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Saldo inicial"
          description="Separa el límite de la tarjeta del consumo que ya existe para que la capacidad disponible quede clara desde el inicio."
          columns="2"
          className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
        >
          <FormField label="Límite de crédito">
            <NumericInput
              step="0.01"
              decimals={2}
              min={0}
              value={form.credit_limit}
              onValueChange={value => setForm(prev => ({ ...prev, credit_limit: value }))}
              disabled={isDisabled}
              data-testid="credit-card-limit-input"
              className="field-base ft-form-input w-full"
              placeholder="Ej: 12000"
              required
            />
          </FormField>

          <FormField
            label="Monto usado actual"
            optional
            description="Úsalo solo si la tarjeta ya tiene consumo pendiente fuera de FinTrack."
          >
            <NumericInput
              step="0.01"
              decimals={2}
              min={0}
              value={form.used_amount}
              onValueChange={value => setForm(prev => ({ ...prev, used_amount: value }))}
              disabled={isDisabled}
              data-testid="credit-card-used-amount-input"
              className="field-base ft-form-input w-full"
              placeholder="Ej: 850.50"
            />
          </FormField>

          <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-4 py-4 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Disponible inicial</p>
                <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--ft-text)] tabular-nums">
                  {formatNumber(availableAmountValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Uso actual</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ft-text)] tabular-nums">
                  {formatNumber(utilizationPct)}%
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ft-border)]/70">
              <div
                className="h-full rounded-full bg-[var(--ft-primary)]"
                style={{ width: `${Math.max(0, Math.min(utilizationPct, 100))}%` }}
              />
            </div>
            <p className="mt-3 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
              Consumo actual: {formatNumber(usedAmountValue)} de {formatNumber(creditLimitValue || 0)}.
            </p>
          </div>
        </FormSection>

        <FormSection
          title="Cronograma"
          description="Revisa el alcance registrado del cronograma y abre el editor completo solo cuando necesites ajustar ciclos, fechas o adjuntos."
          className="flex min-h-0 flex-col rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-section-gap:12px] xl:col-span-2"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.25fr_0.7fr_1fr_1fr_auto]">
            <SummaryStat label="Total registrado" value={formatNumber(registeredTotal)} numeric />
            <SummaryStat label="Ciclos" value={cycles.length} numeric />
            <SummaryStat label="Primer pago" value={firstPaymentDate} />
            <SummaryStat label="Último pago" value={lastPaymentDate} />
            <Button
              id="card-schedule-trigger"
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsScheduleModalOpen(true)}
              disabled={isDisabled}
              className="h-full min-h-[76px] w-full lg:w-auto"
            >
              Ver/editar →
            </Button>
          </div>

          {duplicateCyclesMessage ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">
                {duplicateCyclesMessage}
              </p>
            </div>
          ) : null}
        </FormSection>
      </div>

      <CreditCardScheduleModal
        open={isScheduleModalOpen}
        onClose={closeScheduleModal}
        cycles={cycles}
        duplicateCycleKeys={duplicateCycleKeys}
        duplicateCycleLabels={duplicateCycleLabels}
        registeredTotal={registeredTotal}
        yearOptions={YEARS}
        disabled={isDisabled}
        onAddCycle={addCycle}
        onRemoveCycle={removeCycle}
        onUpdateCycle={updateCycle}
        onFileChange={handleFileChange}
      />

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
              disabled={isDisabled || !form.account_id}
              loading={saving}
              testId="credit-card-submit-button"
            >
              Crear tarjeta
            </Button>
          )}
        />
      </RecordModalFooter>
    </form>
  )
}
