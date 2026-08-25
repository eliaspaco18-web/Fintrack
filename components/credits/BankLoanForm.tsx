'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { RecordModalFooter } from '@/components/ui/RecordModal'
import { BankLoanScheduleModal } from '@/components/credits/BankLoanScheduleModal'
import { formatScheduleDateLabel } from '@/components/credits/credits-schedule.constants'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import { resolveCreditExchangeRateInput } from '@/modules/credits/exchange-rate-integrity'

type BankEntityOption = {
  id: string
  name: string
  short_name: string | null
  is_active: boolean
}

type AccountOption = {
  id: string
  name: string
  type: string
  currency: string
  is_active: boolean
}

const ALLOWED_DEST_TYPES = ['CHECKING', 'SAVINGS', 'CASH']

type InstallmentRow = {
  id: string
  due_date: string
  principal_amount: string
  interest_amount: string
  insurance_amount: string
  other_charges: string
}

type LoanFormState = {
  name: string
  bank_entity_id: string
  account_id: string
  disbursement_date: string
  start_date: string
  total_installments: string
  principal_amount: string
  exchange_rate: string
  description: string
}

interface BankLoanFormProps {
  onSuccess: (creditName: string) => void
  onCancel: () => void
  onLayoutPreferenceChange?: (nextSize: 'lg' | 'xl' | 'full-form') => void
  onNestedModalOpenChange?: (open: boolean) => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addMonths(isoDate: string, months: number): string {
  const base = new Date(`${isoDate}T12:00:00`)
  base.setMonth(base.getMonth() + months)
  return base.toISOString().slice(0, 10)
}

function buildSchedule(installments: number, startDate: string): InstallmentRow[] {
  if (!Number.isFinite(installments) || installments < 1) return []

  return Array.from({ length: installments }, (_, index) => ({
    id: crypto.randomUUID(),
    due_date: addMonths(startDate, index),
    principal_amount: '0.00',
    interest_amount: '0.00',
    insurance_amount: '0.00',
    other_charges: '0.00',
  }))
}

function SummaryStat({
  label,
  value,
  numeric = false,
  emphasized = false,
}: {
  label: string
  value: string | number
  numeric?: boolean
  emphasized?: boolean
}) {
  return (
    <div
      className={`
        min-h-[76px] rounded-[var(--ft-form-radius-sm)] border border-[var(--ft-form-border)] px-3.5 py-3
        ${emphasized ? 'bg-[var(--ft-form-surface)]' : 'bg-[var(--ft-surface-muted)]'}
      `}
    >
      <p className="text-[11px] font-medium leading-[1.35] text-[var(--ft-form-muted)]">
        {label}
      </p>
      <p
        className={`
          mt-2 text-[15px] font-semibold leading-[1.35] text-[var(--ft-text)]
          ${numeric ? 'tabular-nums' : 'text-pretty'}
          ${emphasized ? 'text-[16px] tracking-[-0.01em]' : ''}
        `}
      >
        {value}
      </p>
    </div>
  )
}

export function BankLoanForm({
  onSuccess,
  onCancel,
  onLayoutPreferenceChange,
  onNestedModalOpenChange,
}: BankLoanFormProps) {
  const today = todayIso()

  const [bankEntities, setBankEntities] = useState<BankEntityOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<LoanFormState>({
    name: '',
    bank_entity_id: '',
    account_id: '',
    disbursement_date: today,
    start_date: today,
    total_installments: '12',
    principal_amount: '',
    exchange_rate: '',
    description: '',
  })

  const [installments, setInstallments] = useState<InstallmentRow[]>(() => buildSchedule(12, today))
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)

  const destAccounts = useMemo(
    () => accounts.filter(account => account.is_active && ALLOWED_DEST_TYPES.includes(account.type)),
    [accounts],
  )

  const selectedAccount = useMemo(
    () => destAccounts.find(account => account.id === form.account_id) ?? null,
    [destAccounts, form.account_id],
  )

  const currency = selectedAccount?.currency ?? '—'

  const totalInstallmentsNum = useMemo(() => {
    const parsed = Number(form.total_installments)
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 0
  }, [form.total_installments])

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
    if (totalInstallmentsNum < 1) {
      setInstallments([])
      return
    }

    setInstallments(prev => {
      if (prev.length === totalInstallmentsNum) return prev
      return buildSchedule(totalInstallmentsNum, form.start_date)
    })
  }, [form.start_date, totalInstallmentsNum])

  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true)
      try {
        const [bankEntitiesResponse, accountsResponse] = await Promise.all([
          fetch('/api/bank-entities', { cache: 'no-store' }),
          fetch('/api/accounts', { cache: 'no-store' }),
        ])

        const bankEntitiesJson = await bankEntitiesResponse.json().catch(() => null)
        const accountsJson = await accountsResponse.json().catch(() => null)

        if (!bankEntitiesResponse.ok || !bankEntitiesJson?.ok) {
          throw new Error(getApiErrorMessage(bankEntitiesJson, 'Error cargando entidades'))
        }

        if (!accountsResponse.ok || !accountsJson?.ok) {
          throw new Error(getApiErrorMessage(accountsJson, 'Error cargando cuentas'))
        }

        const loadedEntities = ((bankEntitiesJson.data as BankEntityOption[]) ?? []).filter(entity => entity.is_active)
        const loadedAccounts = (accountsJson.data as AccountOption[]) ?? []

        setBankEntities(loadedEntities)
        setAccounts(loadedAccounts)

        const firstEntity = loadedEntities[0]
        if (firstEntity) {
          setForm(prev => ({ ...prev, bank_entity_id: firstEntity.id }))
        }

        const firstDestination = loadedAccounts.find(
          account => account.is_active && ALLOWED_DEST_TYPES.includes(account.type),
        )
        if (firstDestination) {
          setForm(prev => ({ ...prev, account_id: firstDestination.id }))
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Error cargando opciones')
      } finally {
        setLoading(false)
      }
    }

    void loadOptions()
  }, [])

  const updateInstallment = useCallback((id: string, patch: Partial<InstallmentRow>) => {
    setInstallments(prev => prev.map(row => (row.id === id ? { ...row, ...patch } : row)))
  }, [])

  const scheduleTotal = useMemo(() => {
    let principal = 0
    let interest = 0
    let insurance = 0
    let others = 0
    let installmentTotal = 0

    for (const row of installments) {
      const parsedPrincipal = parseNumericInput(row.principal_amount, 0) ?? 0
      const parsedInterest = parseNumericInput(row.interest_amount, 0) ?? 0
      const parsedInsurance = parseNumericInput(row.insurance_amount, 0) ?? 0
      const parsedOthers = parseNumericInput(row.other_charges, 0) ?? 0

      principal += parsedPrincipal
      interest += parsedInterest
      insurance += parsedInsurance
      others += parsedOthers
      installmentTotal += parsedPrincipal + parsedInterest + parsedInsurance + parsedOthers
    }

    return { principal, interest, insurance, others, installmentTotal }
  }, [installments])

  const firstInstallmentDate = formatScheduleDateLabel(installments[0]?.due_date ?? form.start_date)
  const lastInstallmentDate = formatScheduleDateLabel(installments[installments.length - 1]?.due_date ?? form.start_date)

  const validateDetailsStep = useCallback(() => {
    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return null
    }

    if (!form.bank_entity_id) {
      setError('Selecciona la entidad bancaria.')
      return null
    }

    if (!form.account_id) {
      setError('Selecciona la cuenta destino del desembolso.')
      return null
    }

    if (!form.disbursement_date) {
      setError('Selecciona la fecha de desembolso.')
      return null
    }

    if (!form.start_date) {
      setError('Selecciona la fecha de la primera cuota.')
      return null
    }

    if (totalInstallmentsNum < 1) {
      setError('El número de cuotas debe ser al menos 1.')
      return null
    }

    const principalAmount = roundToDecimals(parseNumericInput(form.principal_amount, Number.NaN), 2)
    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      setError('El capital prestado debe ser mayor a 0.')
      return null
    }

    const exchangeRateResult = resolveCreditExchangeRateInput(currency, form.exchange_rate)
    if (!exchangeRateResult.ok) {
      setError(exchangeRateResult.message)
      return null
    }

    setError(null)

    return {
      trimmedName,
      principalAmount,
      exchangeRate: exchangeRateResult.exchangeRate,
    }
  }, [currency, form, totalInstallmentsNum])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const valid = validateDetailsStep()
    if (!valid) return

    setSaving(true)
    setError(null)

    try {
      const parsedInstallments = installments.map((row, index) => ({
        installment_number: index + 1,
        due_date: row.due_date,
        principal_amount: roundToDecimals(parseNumericInput(row.principal_amount, 0) ?? 0, 2),
        interest_amount: roundToDecimals(parseNumericInput(row.interest_amount, 0) ?? 0, 2),
        insurance_amount: roundToDecimals(parseNumericInput(row.insurance_amount, 0) ?? 0, 2),
      }))

      const endDate = addMonths(form.start_date, totalInstallmentsNum)

      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'BANK',
          name: valid.trimmedName,
          creditor_name: bankEntities.find(entity => entity.id === form.bank_entity_id)?.name
            ?? 'Banco',
          bank_entity_id: form.bank_entity_id,
          account_id: form.account_id,
          currency: selectedAccount?.currency ?? 'PEN',
          exchange_rate: valid.exchangeRate,
          principal_amount: valid.principalAmount,
          interest_rate: 0,
          total_installments: totalInstallmentsNum,
          start_date: form.start_date,
          end_date: endDate,
          transaction_date: form.disbursement_date,
          description: form.description.trim() || `Desembolso de crédito: ${valid.trimmedName}`,
          generate_schedule: false,
          installments: parsedInstallments,
          notes: null,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear el crédito bancario'))
      }

      onSuccess(valid.trimmedName)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear el crédito bancario')
    } finally {
      setSaving(false)
    }
  }, [bankEntities, form, installments, onSuccess, saving, selectedAccount, totalInstallmentsNum, validateDetailsStep])

  const isDisabled = saving
  const closeScheduleModal = useCallback(() => {
    setIsScheduleModalOpen(false)
    requestAnimationFrame(() => {
      document.getElementById('bank-loan-schedule-trigger')?.focus()
    })
  }, [])

  return (
    <form
      id="bank-loan-form"
      onSubmit={handleSubmit}
      data-testid="bank-loan-form"
      className="flex h-full min-h-0 flex-1 flex-col gap-4"
    >
      {error ? (
        <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
          <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 xl:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] xl:overflow-visible xl:pr-0">
        <FormSection
          title="Datos del préstamo"
          description="Primero registra la entidad, el destino del desembolso y el nombre operativo del crédito."
          columns="2"
          className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
        >
          <FormField label="Entidad bancaria">
            {loading ? (
              <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                Cargando entidades...
              </div>
            ) : (
              <AppSelect
                value={form.bank_entity_id}
                onChange={value => setForm(prev => ({ ...prev, bank_entity_id: value }))}
                testId="bank-loan-bank-entity-select"
                options={bankEntities.length === 0
                  ? [{ value: '', label: 'Sin entidades registradas', disabled: true }]
                  : bankEntities.map(entity => ({
                      value: entity.id,
                      label: entity.name,
                    }))}
                searchPlaceholder="Buscar entidad..."
              />
            )}
          </FormField>

          <FormField label="Cuenta destino del desembolso">
            {loading ? (
              <div className="field-base ft-form-input flex w-full items-center text-[var(--ft-form-muted)]">
                Cargando cuentas...
              </div>
            ) : (
              <AppSelect
                value={form.account_id}
                onChange={value => setForm(prev => ({ ...prev, account_id: value }))}
                testId="bank-loan-account-select"
                options={destAccounts.length === 0
                  ? [{ value: '', label: 'Sin cuentas corriente/ahorros/efectivo', disabled: true }]
                  : destAccounts.map(account => ({
                      value: account.id,
                      label: `${account.name} · ${account.currency}`,
                    }))}
                searchPlaceholder="Buscar cuenta..."
              />
            )}
          </FormField>

          <FormField label="Nombre del préstamo" className="md:col-span-2">
            <input
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              required
              disabled={isDisabled}
              data-testid="bank-loan-name-input"
              className="field-base ft-form-input w-full"
              placeholder="Ej: Crédito vehicular BBVA"
              maxLength={150}
            />
          </FormField>

          <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3 md:col-span-2">
            <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Moneda del desembolso</p>
            <p className="mt-1 text-sm font-semibold text-[var(--ft-text)]">{currency}</p>
          </div>
        </FormSection>

        <FormSection
          title="Condiciones iniciales"
          description="Separa el monto principal, el número de cuotas y las fechas clave antes de revisar el cronograma."
          columns="2"
          className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
        >
          <FormField label="Capital prestado">
            <NumericInput
              step="0.01"
              decimals={2}
              min={0}
              value={form.principal_amount}
              onValueChange={value => setForm(prev => ({ ...prev, principal_amount: value }))}
              disabled={isDisabled}
              data-testid="bank-loan-principal-input"
              className="field-base ft-form-input w-full"
              placeholder="Ej: 45000"
              required
            />
          </FormField>

          {currency === 'USD' ? (
            <FormField label="Tipo de cambio USD → PEN">
              <NumericInput
                step="0.001"
                decimals={3}
                min={0.01}
                max={100}
                value={form.exchange_rate}
                onValueChange={value => setForm(prev => ({ ...prev, exchange_rate: value }))}
                disabled={isDisabled}
                data-testid="bank-loan-exchange-rate-input"
                className="field-base ft-form-input w-full"
                placeholder="Ej: 3.750"
                required
              />
              <p className="mt-1.5 text-[11px] leading-[1.4] text-[var(--ft-form-muted)]">
                Indica cuántos soles equivalen a 1 USD para registrar el desembolso.
              </p>
            </FormField>
          ) : null}

          <FormField label="Número de cuotas">
            <NumericInput
              step="1"
              decimals={0}
              min={1}
              value={form.total_installments}
              onValueChange={value => setForm(prev => ({ ...prev, total_installments: value }))}
              disabled={isDisabled}
              data-testid="bank-loan-installments-input"
              className="field-base ft-form-input w-full"
              required
            />
          </FormField>

          <FormField label="Fecha de desembolso">
            <input
              type="date"
              value={form.disbursement_date}
              onChange={event => setForm(prev => ({ ...prev, disbursement_date: event.target.value }))}
              required
              disabled={isDisabled}
              className="field-base ft-form-input w-full"
            />
          </FormField>

          <FormField label="Fecha de primera cuota">
            <input
              type="date"
              value={form.start_date}
              onChange={event => setForm(prev => ({ ...prev, start_date: event.target.value }))}
              required
              disabled={isDisabled}
              className="field-base ft-form-input w-full"
            />
          </FormField>

          <FormField label="Descripción" optional className="md:col-span-2">
            <input
              value={form.description}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
              disabled={isDisabled}
              className="field-base ft-form-input w-full"
              placeholder="Ej: Crédito para compra de vehículo"
              maxLength={300}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Cronograma"
          description="Revisa el alcance registrado del cronograma y abre el editor completo solo cuando quieras ajustar cada cuota."
          className="flex min-h-0 flex-col rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-section-gap:12px] xl:col-span-2"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_0.7fr_1fr_1fr_1.1fr_1fr_auto]">
            <SummaryStat label="Capital total" value={formatNumber(scheduleTotal.principal)} numeric />
            <SummaryStat label="Cuotas" value={installments.length} numeric />
            <SummaryStat label="Primera cuota" value={firstInstallmentDate} />
            <SummaryStat label="Última cuota" value={lastInstallmentDate} />
            <SummaryStat label="Total estimado" value={formatNumber(scheduleTotal.installmentTotal)} numeric emphasized />
            <SummaryStat label="Seguro + otros" value={formatNumber(scheduleTotal.insurance + scheduleTotal.others)} numeric />
            <Button
              id="bank-loan-schedule-trigger"
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

          <p className="text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
            Los comprobantes se adjuntan al registrar pagos de cuotas.
          </p>
        </FormSection>
      </div>

      <BankLoanScheduleModal
        open={isScheduleModalOpen}
        onClose={closeScheduleModal}
        installments={installments}
        totalInstallmentsNum={totalInstallmentsNum}
        scheduleTotal={scheduleTotal}
        disabled={isDisabled}
        onUpdateInstallment={updateInstallment}
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
              disabled={isDisabled || !form.account_id || !form.bank_entity_id}
              loading={saving}
              testId="bank-loan-submit-button"
            >
              Crear prestamo
            </Button>
          )}
        />
      </RecordModalFooter>
    </form>
  )
}
