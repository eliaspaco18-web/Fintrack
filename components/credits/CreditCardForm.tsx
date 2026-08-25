'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { RecordModalFooter } from '@/components/ui/RecordModal'
import { CreditCardScheduleEditor } from '@/components/credits/CreditCardScheduleModal'
import {
  formatBillingCycleLabel,
} from '@/components/credits/credits-schedule.constants'
import { getBillingCycleYearOptions } from '@/lib/credits/billing-cycle-years'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { CreditListItem } from '@/lib/credits/display-type'
import { ATTACHMENT_UPDATE_BLOCKED_MESSAGE } from '@/modules/attachments/attachment-integrity'

type BankEntityOption = {
  id: string
  name: string
  short_name: string | null
  is_active: boolean
}

type BillingCycleRow = {
  id: string
  billing_month: string
  billing_year: string
  consumption_from: string
  consumption_to: string
  payment_date: string
  total_to_pay: string
  total_to_pay_pen?: number
  total_to_pay_usd?: number
  movement_summary?: BillingCycleMovementSummary | null
  can_delete?: boolean
  statement_url: string | null
}

type BillingCycleMovement = {
  id: string
  type: string
  description: string
  amount: number
  currency: string
  transaction_date: string
  payment_method: string | null
  source_account_id: string | null
  destination_account_id: string | null
}

type BillingCycleMovementSummary = {
  initial_pen: number
  initial_usd: number
  consumption_pen: number
  consumption_usd: number
  payment_pen: number
  payment_usd: number
  total_pen: number
  total_usd: number
  movement_count: number
  consumptions: BillingCycleMovement[]
  payments: BillingCycleMovement[]
  movements: BillingCycleMovement[]
}

type CardFormState = {
  name: string
  bank_entity_id: string
  currency: 'PEN' | 'USD'
  credit_limit: string
  used_amount_pen: string
  used_amount_usd: string
}

interface CreditCardFormProps {
  mode?: 'create' | 'edit'
  credit?: CreditListItem | null
  onSuccess: (creditName: string) => void
  onCancel: () => void
  onLayoutPreferenceChange?: (nextSize: 'lg' | 'xl' | 'full-form') => void
  onNestedModalOpenChange?: (open: boolean) => void
}

const YEARS = getBillingCycleYearOptions()
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
    total_to_pay_pen: 0,
    total_to_pay_usd: 0,
    movement_summary: null,
    can_delete: true,
    statement_url: null,
  }
}

function moneyString(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2)
}

export function CreditCardForm({
  mode = 'create',
  credit = null,
  onSuccess,
  onCancel,
  onLayoutPreferenceChange,
  onNestedModalOpenChange,
}: CreditCardFormProps) {
  const [bankEntities, setBankEntities] = useState<BankEntityOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<CardFormState>({
    name: '',
    bank_entity_id: '',
    currency: 'PEN',
    credit_limit: '',
    used_amount_pen: '0.00',
    used_amount_usd: '0.00',
  })

  const [cycles, setCycles] = useState<BillingCycleRow[]>([newCycleRow()])
  const [cyclesDirty, setCyclesDirty] = useState(false)

  const selectedBankEntity = useMemo(
    () => bankEntities.find(entity => entity.id === form.bank_entity_id) ?? null,
    [bankEntities, form.bank_entity_id],
  )
  const currencyLabel = form.currency === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'

  const creditLimitValue = roundToDecimals(parseNumericInput(form.credit_limit, 0) || 0, 2)
  const usedAmountPenValue = roundToDecimals(parseNumericInput(form.used_amount_pen || '0', 0) || 0, 2)
  const usedAmountUsdValue = roundToDecimals(parseNumericInput(form.used_amount_usd || '0', 0) || 0, 2)
  const primaryUsedAmountValue = form.currency === 'PEN' ? usedAmountPenValue : usedAmountUsdValue
  const availableAmountValue = Math.max(creditLimitValue - primaryUsedAmountValue, 0)
  const utilizationPct = creditLimitValue > 0 ? Math.min((primaryUsedAmountValue / creditLimitValue) * 100, 100) : 0

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
  useEffect(() => {
    onLayoutPreferenceChange?.('full-form')
  }, [onLayoutPreferenceChange])

  useEffect(() => {
    if (mode !== 'edit' || !credit) return

    const currency = credit.currency === 'USD' ? 'USD' : 'PEN'
    setForm({
      name: credit.name,
      bank_entity_id: credit.bank_entity_id ?? '',
      currency,
      credit_limit: moneyString(credit.credit_limit),
      used_amount_pen: moneyString(credit.initial_used_amount_pen ?? credit.used_amount_pen ?? (currency === 'PEN' ? credit.used_amount : 0)),
      used_amount_usd: moneyString(credit.initial_used_amount_usd ?? credit.used_amount_usd ?? (currency === 'USD' ? credit.used_amount : 0)),
    })
  }, [credit, mode])

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true)
      try {
        const res = await fetch('/api/bank-entities', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las entidades bancarias'))
        }

        const loaded = ((json.data as BankEntityOption[]) ?? []).filter(entity => entity.is_active)
        setBankEntities(loaded)

        const firstEntity = loaded[0]
        if (firstEntity) {
          setForm(prev => ({
            ...prev,
            bank_entity_id: prev.bank_entity_id || firstEntity.id,
          }))
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Error cargando entidades bancarias')
      } finally {
        setLoadingOptions(false)
      }
    }

    void loadOptions()
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !credit?.id) return

    const loadCycles = async () => {
      try {
        const res = await fetch(`/api/credits/${credit.id}/billing-cycles`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los ciclos de facturación'))
        }

        const loaded = ((json.data ?? []) as Array<{
          id: string
          billing_month: number
          billing_year: number
          consumption_from: string
          consumption_to: string
          payment_date: string
          total_to_pay: number
          total_to_pay_pen?: number
          total_to_pay_usd?: number
          movement_summary?: BillingCycleMovementSummary | null
          can_delete?: boolean
          statement_url?: string | null
        }>).map(cycle => ({
          id: cycle.id,
          billing_month: String(cycle.billing_month).padStart(2, '0'),
          billing_year: String(cycle.billing_year),
          consumption_from: cycle.consumption_from,
          consumption_to: cycle.consumption_to,
          payment_date: cycle.payment_date,
          total_to_pay: moneyString(cycle.total_to_pay),
          total_to_pay_pen: Number(cycle.total_to_pay_pen ?? cycle.total_to_pay ?? 0),
          total_to_pay_usd: Number(cycle.total_to_pay_usd ?? 0),
          movement_summary: cycle.movement_summary ?? null,
          can_delete: cycle.can_delete ?? true,
          statement_url: cycle.statement_url ?? null,
        }))

        setCycles(loaded.length > 0 ? loaded : [newCycleRow()])
        setCyclesDirty(false)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Error cargando ciclos de facturación')
      }
    }

    void loadCycles()
  }, [credit?.id, mode])

  const addCycle = useCallback(() => {
    setCyclesDirty(true)
    setCycles(prev => [...prev, newCycleRow()])
  }, [])

  const removeCycle = useCallback((id: string) => {
    setCyclesDirty(true)
    setCycles(prev => prev.filter(cycle => cycle.id !== id))
  }, [])

  const updateCycle = useCallback((id: string, patch: Partial<BillingCycleRow>) => {
    setCyclesDirty(true)
    setCycles(prev => prev.map(cycle => (cycle.id === id ? { ...cycle, ...patch } : cycle)))
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }

    if (!form.bank_entity_id) {
      setError('Selecciona la entidad bancaria emisora.')
      return
    }

    if (cyclesDirty && cycles.some(cycle => Boolean(cycle.statement_url?.trim()))) {
      setError(ATTACHMENT_UPDATE_BLOCKED_MESSAGE)
      return
    }

    const limit = roundToDecimals(parseNumericInput(form.credit_limit, Number.NaN), 2)
    if (!Number.isFinite(limit) || limit <= 0) {
      setError('La línea de crédito debe ser mayor a 0.')
      return
    }

    const usedPen = roundToDecimals(parseNumericInput(form.used_amount_pen || '0', 0), 2)
    const usedUsd = roundToDecimals(parseNumericInput(form.used_amount_usd || '0', 0), 2)
    const primaryUsed = form.currency === 'PEN' ? usedPen : usedUsd
    if (!Number.isFinite(usedPen) || !Number.isFinite(usedUsd) || usedPen < 0 || usedUsd < 0 || primaryUsed > limit) {
      setError('Los consumos iniciales deben ser válidos. El consumo en la moneda de la línea no puede superar el límite.')
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
      const payload = {
        name: trimmedName,
        bank_entity_id: form.bank_entity_id,
        currency: form.currency,
        credit_limit: limit,
        credit_limit_pen: form.currency === 'PEN' ? limit : 0,
        credit_limit_usd: form.currency === 'USD' ? limit : 0,
        used_amount: primaryUsed,
        used_amount_pen: usedPen,
        used_amount_usd: usedUsd,
      }
      const endpoint = mode === 'edit' && credit?.id ? `/api/credits/${credit.id}` : '/api/credits'
      const res = await fetch(endpoint, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'edit' ? payload : { kind: 'CARD', ...payload, interest_rate: 0 }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, mode === 'edit' ? 'No se pudo actualizar la tarjeta' : 'No se pudo crear la tarjeta'))
      }

      const creditId = (mode === 'edit' ? credit?.id : json.data?.credit?.id) as string
      if (mode === 'edit' && cyclesDirty) {
        const cycleRes = await fetch(`/api/credits/${creditId}/billing-cycles`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cycles: cycles.map(cycle => ({
              billing_month: Number(cycle.billing_month),
              billing_year: Number(cycle.billing_year),
              consumption_from: cycle.consumption_from,
              consumption_to: cycle.consumption_to,
              payment_date: cycle.payment_date,
              total_to_pay: roundToDecimals(parseNumericInput(cycle.total_to_pay || '0', 0), 2),
            })),
          }),
        })
        const cycleJson = await cycleRes.json().catch(() => null)
        if (!cycleRes.ok || !cycleJson?.ok) {
          throw new Error(getApiErrorMessage(cycleJson, 'No se pudieron actualizar los ciclos de facturación'))
        }
      } else if (mode === 'create') {
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
        }
      }

      onSuccess(trimmedName)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la tarjeta de crédito')
    } finally {
      setSaving(false)
    }
  }, [credit?.id, cycles, cyclesDirty, form, mode, onSuccess, saving])

  const isDisabled = saving

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

      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-4 overflow-y-auto pr-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:overflow-visible xl:pr-0">
        <FormSection
          title="Datos esenciales"
          description="Define la tarjeta por su banco emisor. FinTrack creará internamente la cuenta técnica necesaria para registrar consumos."
          columns="2"
          className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
        >
          <FormField
            label="Entidad bancaria emisora"
            description="Banco o entidad que emitió la tarjeta."
            className="md:col-span-2"
          >
            {loadingOptions ? (
              <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                Cargando entidades...
              </div>
            ) : (
              <AppSelect
                value={form.bank_entity_id}
                onChange={value => setForm(prev => ({ ...prev, bank_entity_id: value }))}
                testId="credit-card-bank-entity-select"
                options={bankEntities.length === 0
                  ? [{ value: '', label: 'Sin entidades bancarias activas', disabled: true }]
                  : bankEntities.map(entity => ({
                      value: entity.id,
                      label: entity.name,
                    }))}
                searchPlaceholder="Buscar entidad..."
              />
            )}
          </FormField>

          {!loadingOptions && bankEntities.length === 0 ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-warning)]/20 bg-[var(--ft-warning-soft)] px-3.5 py-3 md:col-span-2">
              <p className="text-[12px] font-medium text-[var(--ft-warning)]">
                Registra primero una entidad bancaria en Administración para poder crear la tarjeta.
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
                {selectedBankEntity ? selectedBankEntity.name : 'Selecciona una entidad'}
              </p>
            </div>
            <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Moneda de la línea</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(['PEN', 'USD'] as const).map(currency => (
                  <button
                    key={currency}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setForm(prev => ({ ...prev, currency }))}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      form.currency === currency
                        ? 'border-[var(--ft-primary)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]'
                        : 'border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] text-[var(--ft-form-muted)] hover:text-[var(--ft-text)]'
                    }`}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FormSection>

        <section className="space-y-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                Saldo inicial
              </h3>
              <p className="text-[12px] leading-5 text-[var(--ft-form-muted)]">
                Línea aprobada y deuda pendiente al registrar la tarjeta.
              </p>
            </div>
            <span className="mt-0.5 inline-flex h-7 items-center rounded-[var(--ft-radius-control)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-2.5 text-[11px] font-semibold text-[var(--ft-form-muted)]">
              {form.currency}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Línea de crédito">
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

            <FormField label="Inicial PEN" optional>
              <NumericInput
                step="0.01"
                decimals={2}
                min={0}
                value={form.used_amount_pen}
                onValueChange={value => setForm(prev => ({ ...prev, used_amount_pen: value }))}
                disabled={isDisabled}
                data-testid="credit-card-used-amount-pen-input"
                className="field-base ft-form-input w-full"
                placeholder="Ej: 850.50"
              />
            </FormField>

            <FormField label="Inicial USD" optional>
              <NumericInput
                step="0.01"
                decimals={2}
                min={0}
                value={form.used_amount_usd}
                onValueChange={value => setForm(prev => ({ ...prev, used_amount_usd: value }))}
                disabled={isDisabled}
                data-testid="credit-card-used-amount-usd-input"
                className="field-base ft-form-input w-full"
                placeholder="Ej: 13.67"
              />
            </FormField>
          </div>

          <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="grid grid-cols-2 gap-3 sm:max-w-[360px]">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">Disponible</p>
                  <p className="mt-1 text-[15px] font-semibold text-[var(--ft-text)] tabular-nums">
                    {formatNumber(availableAmountValue)} {form.currency}
                  </p>
                </div>
                <div className="text-right sm:text-left">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ft-form-muted)]">Uso</p>
                  <p className="mt-1 text-[15px] font-semibold text-[var(--ft-text)] tabular-nums">
                    {formatNumber(utilizationPct)}%
                  </p>
                </div>
              </div>
              <p className="text-[12px] leading-[1.45] text-[var(--ft-form-muted)] sm:text-right">
                Actual: {formatNumber(usedAmountPenValue)} PEN · {formatNumber(usedAmountUsdValue)} USD
                <span className="hidden lg:inline"> de {formatNumber(creditLimitValue || 0)} {currencyLabel}</span>
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--ft-border)]/70">
              <div
                className="h-full rounded-full bg-[var(--ft-primary)]"
                style={{ width: `${Math.max(0, Math.min(utilizationPct, 100))}%` }}
              />
            </div>
          </div>
        </section>

        <div className="min-h-0 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 xl:col-span-2">
          <CreditCardScheduleEditor
            cycles={cycles}
            duplicateCycleKeys={duplicateCycleKeys}
            duplicateCycleLabels={duplicateCycleLabels}
            yearOptions={YEARS}
            disabled={isDisabled}
            compact
            onAddCycle={addCycle}
            onRemoveCycle={removeCycle}
            onUpdateCycle={updateCycle}
            onMovementModalOpenChange={onNestedModalOpenChange}
          />
        </div>
      </div>

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
              disabled={isDisabled || !form.bank_entity_id}
              loading={saving}
              testId="credit-card-submit-button"
            >
              {mode === 'edit' ? 'Guardar cambios' : 'Crear tarjeta'}
            </Button>
          )}
        />
      </RecordModalFooter>
    </form>
  )
}
