'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import { useToast } from '@/lib/toast/toast'
import { FocusTrap } from '@/components/ui/accessibility'
import { formatNumber } from '@/lib/contracts/ui.contracts'
import type { AccountType, CurrencyCode } from '@/types/database.types'

type CreditMode = 'CARD' | 'BANK'

type AccountOption = {
  id: string
  name: string
  type: AccountType
  currency: CurrencyCode
  is_active: boolean
}

type CategoryOption = {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE' | 'BOTH'
}

type CardForm = {
  name: string
  account_id: string
  currency: CurrencyCode
  credit_limit: string
  used_amount: string
  annual_tea: string
  closing_day: string
  payment_day: string
  notes: string
}

type BankForm = {
  name: string
  creditor_name: string
  account_id: string
  category_id: string
  currency: CurrencyCode
  principal_amount: string
  annual_tea: string
  total_installments: string
  start_date: string
  end_date: string
  transaction_date: string
  exchange_rate: string
  generate_schedule: boolean
  notes: string
}

type ScheduleMode = 'AUTO' | 'MANUAL'
const MAX_BANK_ATTACHMENT_BYTES = 8 * 1024 * 1024
const ALLOWED_BANK_ATTACHMENT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt']

type ManualInstallmentForm = {
  installment_number: number
  due_date: string
  principal_amount: string
  interest_amount: string
  insurance_amount: string
}

interface ApiErrorShape {
  ok: false
  error?: { message?: string }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'ok' in payload &&
    (payload as ApiErrorShape).ok === false &&
    (payload as ApiErrorShape).error?.message
  ) {
    return (payload as ApiErrorShape).error?.message ?? fallback
  }
  return fallback
}

function isoDateToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function addMonths(isoDate: string, months: number): string {
  const base = new Date(`${isoDate}T12:00:00`)
  base.setMonth(base.getMonth() + months)
  return base.toISOString().slice(0, 10)
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function teaToMonthlyPercent(annualTeaPercent: number): number {
  if (annualTeaPercent <= 0) return 0
  const monthlyRate = Math.pow(1 + annualTeaPercent / 100, 1 / 12) - 1
  return round4(monthlyRate * 100)
}

function buildManualInstallments(totalInstallments: number, startDate: string): ManualInstallmentForm[] {
  if (!Number.isFinite(totalInstallments) || totalInstallments < 1) return []

  return Array.from({ length: totalInstallments }, (_, index) => ({
    installment_number: index + 1,
    due_date: addMonths(startDate, index),
    principal_amount: '0',
    interest_amount: '0',
    insurance_amount: '0',
  }))
}

const EMPTY_CARD_FORM: CardForm = {
  name: '',
  account_id: '',
  currency: 'PEN',
  credit_limit: '',
  used_amount: '0',
  annual_tea: '0',
  closing_day: '',
  payment_day: '',
  notes: '',
}

const initialBankDate = isoDateToday()
const EMPTY_BANK_FORM: BankForm = {
  name: '',
  creditor_name: '',
  account_id: '',
  category_id: '',
  currency: 'PEN',
  principal_amount: '',
  annual_tea: '0',
  total_installments: '12',
  start_date: initialBankDate,
  end_date: addMonths(initialBankDate, 12),
  transaction_date: initialBankDate,
  exchange_rate: '',
  generate_schedule: true,
  notes: '',
}

export function CreditsManager() {
  const router = useRouter()
  const { toast } = useToast()

  const [mode, setMode] = useState<CreditMode>('CARD')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [incomeCategories, setIncomeCategories] = useState<CategoryOption[]>([])
  const [cardForm, setCardForm] = useState<CardForm>(EMPTY_CARD_FORM)
  const [bankForm, setBankForm] = useState<BankForm>(EMPTY_BANK_FORM)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('AUTO')
  const [manualInstallments, setManualInstallments] = useState<ManualInstallmentForm[]>([])
  const [bankAttachment, setBankAttachment] = useState<File | null>(null)
  const [bankAttachmentError, setBankAttachmentError] = useState<string | null>(null)

  const cardAccounts = useMemo(
    () => accounts.filter(account => account.is_active && account.type === 'CREDIT_CARD'),
    [accounts]
  )
  const destinationAccounts = useMemo(
    () => accounts.filter(account => account.is_active),
    [accounts]
  )

  const openModal = useCallback((nextMode: CreditMode) => {
    setMode(nextMode)
    setError(null)
    setBankAttachmentError(null)
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    if (saving) return
    setIsModalOpen(false)
    setError(null)
    setBankAttachmentError(null)
  }, [saving])

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true)
    setError(null)
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/categories?include_system=true', { cache: 'no-store' }),
      ])

      const accountsJson = await accountsRes.json().catch(() => null)
      if (!accountsRes.ok || !accountsJson?.ok) {
        throw new Error(getApiErrorMessage(accountsJson, 'No se pudieron cargar las cuentas'))
      }

      const categoriesJson = await categoriesRes.json().catch(() => null)
      if (!categoriesRes.ok || !categoriesJson?.ok) {
        throw new Error(getApiErrorMessage(categoriesJson, 'No se pudieron cargar las categorías'))
      }

      const loadedAccounts = (accountsJson.data as AccountOption[]) ?? []
      const loadedIncomeCategories = ((categoriesJson.data as CategoryOption[]) ?? [])
        .filter(category => category.scope === 'INCOME' || category.scope === 'BOTH')

      setAccounts(loadedAccounts)
      setIncomeCategories(loadedIncomeCategories)

      setCardForm(prev => ({
        ...prev,
        account_id: prev.account_id || loadedAccounts.find(account => account.type === 'CREDIT_CARD')?.id || '',
      }))

      setBankForm(prev => ({
        ...prev,
        account_id: prev.account_id || loadedAccounts[0]?.id || '',
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las opciones de crédito')
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  const resetCardForm = useCallback(() => {
    setCardForm(prev => ({
      ...EMPTY_CARD_FORM,
      account_id: cardAccounts[0]?.id ?? '',
      currency: prev.currency,
    }))
  }, [cardAccounts])

  const resetBankForm = useCallback(() => {
    const today = isoDateToday()
    setBankForm(prev => ({
      ...EMPTY_BANK_FORM,
      account_id: destinationAccounts[0]?.id ?? '',
      category_id: '',
      currency: prev.currency,
      start_date: today,
      transaction_date: today,
      end_date: addMonths(today, 12),
      generate_schedule: true,
    }))
    setScheduleMode('AUTO')
    setManualInstallments([])
    setBankAttachment(null)
    setBankAttachmentError(null)
  }, [destinationAccounts])

  useEffect(() => {
    if (scheduleMode !== 'MANUAL') return

    const totalInstallments = Number(bankForm.total_installments)
    if (!Number.isFinite(totalInstallments) || totalInstallments < 1) {
      setManualInstallments([])
      return
    }

    setManualInstallments(prev => {
      const next = Array.from({ length: totalInstallments }, (_, index) => {
        const existing = prev[index]
        return {
          installment_number: index + 1,
          due_date: existing?.due_date || addMonths(bankForm.start_date, index),
          principal_amount: existing?.principal_amount ?? '0',
          interest_amount: existing?.interest_amount ?? '0',
          insurance_amount: existing?.insurance_amount ?? '0',
        }
      })

      const unchanged = prev.length === next.length && prev.every((row, index) => {
        const current = next[index]
        if (!current) return false
        return (
          row.installment_number === current.installment_number &&
          row.due_date === current.due_date &&
          row.principal_amount === current.principal_amount &&
          row.interest_amount === current.interest_amount &&
          row.insurance_amount === current.insurance_amount
        )
      })

      return unchanged ? prev : next
    })
  }, [bankForm.start_date, bankForm.total_installments, scheduleMode])

  const refreshCreditsViews = useCallback(async () => {
    await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
    router.refresh()
  }, [router])

  const setAttachmentFromInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setBankAttachment(null)
      setBankAttachmentError(null)
      return
    }

    if (file.size <= 0) {
      setBankAttachment(null)
      setBankAttachmentError('El archivo no puede estar vacío.')
      return
    }

    if (file.size > MAX_BANK_ATTACHMENT_BYTES) {
      setBankAttachment(null)
      setBankAttachmentError('El archivo supera el límite de 8 MB.')
      return
    }

    const extension = file.name.toLowerCase().split('.').pop() ?? ''
    if (!ALLOWED_BANK_ATTACHMENT_EXTENSIONS.includes(extension)) {
      setBankAttachment(null)
      setBankAttachmentError('Formato no permitido. Usa PDF, imagen o documento.')
      return
    }

    setBankAttachment(file)
    setBankAttachmentError(null)
  }, [])

  const uploadBankAttachment = useCallback(async (creditId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/credits/${creditId}/attachment`, {
      method: 'POST',
      body: formData,
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.ok) {
      throw new Error(getApiErrorMessage(json, 'No se pudo adjuntar el documento del crédito'))
    }
  }, [])

  const submitCard = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedName = cardForm.name.trim()
    if (trimmedName.length < 2) {
      const msg = 'El nombre de la tarjeta debe tener al menos 2 caracteres.'
      setError(msg)
      toast.error('No se pudo crear la tarjeta', msg)
      return
    }

    const limit = Number(cardForm.credit_limit)
    const used = Number(cardForm.used_amount || '0')
    const annualTea = Number(cardForm.annual_tea || '0')
    const monthlyRate = teaToMonthlyPercent(annualTea)
    const closingDay = cardForm.closing_day ? Number(cardForm.closing_day) : undefined
    const paymentDay = cardForm.payment_day ? Number(cardForm.payment_day) : undefined

    if (!cardForm.account_id) {
      const msg = 'Selecciona la cuenta de tarjeta en Portafolio.'
      setError(msg)
      toast.error('No se pudo crear la tarjeta', msg)
      return
    }

    if (!Number.isFinite(limit) || limit <= 0) {
      const msg = 'Ingresa un límite de crédito válido.'
      setError(msg)
      toast.error('No se pudo crear la tarjeta', msg)
      return
    }

    if (!Number.isFinite(used) || used < 0 || used > limit) {
      const msg = 'El consumo inicial debe ser válido y menor o igual al límite.'
      setError(msg)
      toast.error('No se pudo crear la tarjeta', msg)
      return
    }

    if (!Number.isFinite(annualTea) || annualTea < 0 || annualTea > 1000) {
      const msg = 'La TEA anual debe estar entre 0 y 1000.'
      setError(msg)
      toast.error('No se pudo crear la tarjeta', msg)
      return
    }

    if (monthlyRate > 9.9999) {
      const msg = 'La TEA ingresada genera una tasa mensual fuera del rango permitido.'
      setError(msg)
      toast.error('No se pudo crear la tarjeta', msg)
      return
    }

    setSaving(true)
    setError(null)
    setBankAttachmentError(null)

    try {
      const response = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'CARD',
          name: trimmedName,
          account_id: cardForm.account_id,
          currency: cardForm.currency,
          credit_limit: limit,
          used_amount: used,
          interest_rate: monthlyRate,
          closing_day: closingDay,
          payment_day: paymentDay,
          notes: cardForm.notes.trim() || null,
        }),
      })

      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo crear la tarjeta de crédito'))
      }

      resetCardForm()
      await refreshCreditsViews()
      setIsModalOpen(false)
      toast.success('Tarjeta registrada', 'Ya puedes usarla en egresos con pago a crédito.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo crear la tarjeta de crédito'
      setError(message)
      toast.error('No se pudo crear la tarjeta', message)
    } finally {
      setSaving(false)
    }
  }, [cardForm, refreshCreditsViews, resetCardForm, saving, toast])

  const submitBank = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedName = bankForm.name.trim()
    const trimmedCreditor = bankForm.creditor_name.trim()
    const principal = Number(bankForm.principal_amount)
    const annualTea = Number(bankForm.annual_tea || '0')
    const monthlyRate = teaToMonthlyPercent(annualTea)
    const installments = Number(bankForm.total_installments)
    const exchangeRate = bankForm.exchange_rate ? Number(bankForm.exchange_rate) : undefined

    if (trimmedName.length < 2 || trimmedCreditor.length < 2) {
      const msg = 'Completa el nombre del crédito y de la entidad financiera.'
      setError(msg)
      toast.error('No se pudo registrar el crédito', msg)
      return
    }

    if (!bankForm.account_id) {
      const msg = 'Selecciona la cuenta destino donde ingresará el desembolso.'
      setError(msg)
      toast.error('No se pudo registrar el crédito', msg)
      return
    }

    if (!Number.isFinite(principal) || principal <= 0) {
      const msg = 'El capital desembolsado debe ser mayor a cero.'
      setError(msg)
      toast.error('No se pudo registrar el crédito', msg)
      return
    }

    if (!Number.isFinite(annualTea) || annualTea < 0 || annualTea > 1000) {
      const msg = 'La TEA anual debe estar entre 0 y 1000.'
      setError(msg)
      toast.error('No se pudo registrar el crédito', msg)
      return
    }

    if (monthlyRate > 9.9999) {
      const msg = 'La TEA ingresada genera una tasa mensual fuera del rango permitido.'
      setError(msg)
      toast.error('No se pudo registrar el crédito', msg)
      return
    }

    if (!Number.isFinite(installments) || installments < 1) {
      const msg = 'Las cuotas deben ser un número entero mayor a cero.'
      setError(msg)
      toast.error('No se pudo registrar el crédito', msg)
      return
    }

    if (bankForm.currency === 'USD' && (!exchangeRate || exchangeRate <= 0)) {
      const msg = 'Para créditos en USD debes ingresar el tipo de cambio.'
      setError(msg)
      toast.error('No se pudo registrar el crédito', msg)
      return
    }

    const usingManualSchedule = scheduleMode === 'MANUAL'
    const parsedInstallments = usingManualSchedule
      ? manualInstallments.map((row, index) => {
        const principalAmount = Number(row.principal_amount || '0')
        const interestAmount = Number(row.interest_amount || '0')
        const insuranceAmount = Number(row.insurance_amount || '0')

        return {
          installment_number: index + 1,
          due_date: row.due_date,
          principal_amount: principalAmount,
          interest_amount: interestAmount,
          insurance_amount: insuranceAmount,
        }
      })
      : undefined

    if (usingManualSchedule) {
      if (manualInstallments.length !== installments) {
        const msg = 'En cronograma manual debes completar una fila por cada cuota.'
        setError(msg)
        toast.error('No se pudo registrar el crédito', msg)
        return
      }

      const invalidInstallment = parsedInstallments?.find(item => (
        !item.due_date ||
        !Number.isFinite(item.principal_amount) ||
        !Number.isFinite(item.interest_amount) ||
        !Number.isFinite(item.insurance_amount) ||
        item.principal_amount < 0 ||
        item.interest_amount < 0 ||
        item.insurance_amount < 0
      ))

      if (invalidInstallment) {
        const msg = 'Revisa las cuotas manuales: fecha y montos deben ser válidos.'
        setError(msg)
        toast.error('No se pudo registrar el crédito', msg)
        return
      }

      const principalFromSchedule = parsedInstallments?.reduce((sum, item) => sum + item.principal_amount, 0) ?? 0
      if (Math.abs(principalFromSchedule - principal) > 0.01) {
        const msg = 'La suma del capital en las cuotas debe ser igual al capital prestado.'
        setError(msg)
        toast.error('No se pudo registrar el crédito', msg)
        return
      }
    }

    setSaving(true)
    setError(null)
    setBankAttachmentError(null)

    try {
      const response = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'BANK',
          name: trimmedName,
          creditor_name: trimmedCreditor,
          account_id: bankForm.account_id,
          category_id: bankForm.category_id || undefined,
          currency: bankForm.currency,
          principal_amount: principal,
          interest_rate: monthlyRate,
          total_installments: installments,
          start_date: bankForm.start_date,
          end_date: bankForm.end_date,
          transaction_date: bankForm.transaction_date,
          exchange_rate: exchangeRate,
          description: `Desembolso de crédito: ${trimmedName}`,
          generate_schedule: !usingManualSchedule,
          installments: usingManualSchedule ? parsedInstallments : undefined,
          notes: bankForm.notes.trim() || null,
        }),
      })

      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo registrar el crédito bancario'))
      }

      let attachmentUploadFailedMessage: string | null = null
      const createdCreditId = json?.data?.credit?.id as string | undefined
      if (bankAttachment && createdCreditId) {
        try {
          await uploadBankAttachment(createdCreditId, bankAttachment)
        } catch (attachmentCaught) {
          attachmentUploadFailedMessage = attachmentCaught instanceof Error
            ? attachmentCaught.message
            : 'No se pudo adjuntar el documento del crédito'
        }
      }

      resetBankForm()
      await refreshCreditsViews()
      setIsModalOpen(false)
      if (attachmentUploadFailedMessage) {
        toast.error('Crédito registrado con observación', attachmentUploadFailedMessage)
      } else {
        toast.success('Crédito bancario registrado', 'Se creó el ingreso automático por desembolso.')
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo registrar el crédito bancario'
      setError(message)
      toast.error('No se pudo registrar el crédito', message)
    } finally {
      setSaving(false)
    }
  }, [bankAttachment, bankForm, manualInstallments, refreshCreditsViews, resetBankForm, saving, scheduleMode, toast, uploadBankAttachment])

  return (
    <div id="nuevo-credito" className="space-y-6">
      <section className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--color-text-muted)]">Registro de créditos</p>
            <p className="text-sm text-[var(--color-text)] mt-1">
              Usa ventana rápida para crear tarjeta o crédito bancario sin salir del listado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openModal(mode)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-[var(--color-on-accent)] hover:bg-emerald-400 transition-colors"
            >
              + Nuevo registro
            </button>
          </div>
        </div>
      </section>

      {!loadingOptions && !destinationAccounts.length && (
        <section className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
          <p className="text-[12px] text-amber-300/90">
            No tienes cuentas activas. Crea una en <Link href="/portfolio" className="underline">Portafolio</Link> antes de registrar créditos.
          </p>
        </section>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[color:var(--color-overlay)] px-3 py-3 sm:px-4 sm:py-4"
          onClick={closeModal}
          data-testid="credits-create-overlay"
        >
          <FocusTrap active={isModalOpen} onEscape={closeModal}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="credits-modal-title"
              className="flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-[min(97vw,1480px)] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-modal-bg)] shadow-2xl shadow-[color:var(--color-shadow)]"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-5 py-4">
                <div>
                  <h3 id="credits-modal-title" className="text-base font-bold text-[var(--color-text)]">
                    {mode === 'CARD' ? 'Nueva tarjeta de crédito' : 'Nuevo crédito bancario'}
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {mode === 'CARD'
                      ? 'Registra línea de tarjeta para consumos y pagos.'
                      : 'Registra préstamo y crea ingreso automático por desembolso.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  Cerrar
                </button>
              </div>

              <div className="border-b border-[color:var(--color-border)] px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('CARD')}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      mode === 'CARD'
                        ? 'border-sky-400/35 bg-sky-500/15 text-sky-300'
                        : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    Tarjeta de crédito
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('BANK')}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      mode === 'BANK'
                        ? 'border-amber-400/35 bg-amber-500/15 text-amber-300'
                        : 'border-[color:var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    Crédito bancario
                  </button>
                </div>
              </div>

              <div className="credits-modal-body min-h-0 flex-1 overflow-hidden px-5 py-4">
                {loadingOptions ? (
                  <p className="text-sm text-[var(--color-text-muted)]">Cargando opciones...</p>
                ) : mode === 'CARD' ? (
                  <form onSubmit={submitCard} className="grid h-full grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2" data-testid="credits-card-form">
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nombre de la tarjeta *</span>
                      <input
                        value={cardForm.name}
                        onChange={event => setCardForm(prev => ({ ...prev, name: event.target.value }))}
                        className="field-base"
                        placeholder="Ej. Visa BCP Platinum"
                        required
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Cuenta tarjeta en portafolio *</span>
                      <select
                        value={cardForm.account_id}
                        onChange={event => setCardForm(prev => ({ ...prev, account_id: event.target.value }))}
                        className="field-base"
                        required
                      >
                        {!cardAccounts.length && <option value="">No hay cuentas tipo tarjeta</option>}
                        {cardAccounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                      {!cardAccounts.length && (
                        <p className="text-[11px] text-amber-300/90">
                          Crea una cuenta tipo Tarjeta en <Link href="/portfolio" className="underline">Portafolio</Link>.
                        </p>
                      )}
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Moneda</span>
                      <select
                        value={cardForm.currency}
                        onChange={event => setCardForm(prev => ({ ...prev, currency: event.target.value as CurrencyCode }))}
                        className="field-base"
                      >
                        <option value="PEN">PEN</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Límite de crédito *</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cardForm.credit_limit}
                        onChange={event => setCardForm(prev => ({ ...prev, credit_limit: event.target.value }))}
                        className="field-base"
                        required
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Consumo actual</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cardForm.used_amount}
                        onChange={event => setCardForm(prev => ({ ...prev, used_amount: event.target.value }))}
                        className="field-base"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">TEA anual (%)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cardForm.annual_tea}
                        onChange={event => setCardForm(prev => ({ ...prev, annual_tea: event.target.value }))}
                        className="field-base"
                        placeholder="Ej. 95"
                      />
                      <p className="text-[10px] text-[var(--color-text-faint)]">
                        Se convertirá automáticamente a tasa mensual para el cálculo interno.
                      </p>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Día de corte</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={cardForm.closing_day}
                        onChange={event => setCardForm(prev => ({ ...prev, closing_day: event.target.value }))}
                        className="field-base"
                        placeholder="Ej. 20"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Día de pago</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={cardForm.payment_day}
                        onChange={event => setCardForm(prev => ({ ...prev, payment_day: event.target.value }))}
                        className="field-base"
                        placeholder="Ej. 5"
                      />
                    </label>

                    <label className="space-y-1.5 md:col-span-2">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Notas</span>
                      <textarea
                        rows={2}
                        value={cardForm.notes}
                        onChange={event => setCardForm(prev => ({ ...prev, notes: event.target.value }))}
                        className="field-base"
                        placeholder="Opcional"
                      />
                    </label>

                    {error && <p className="md:col-span-2 text-[12px] text-red-400">{error}</p>}

                    <div className="md:col-span-2 flex gap-2 pt-1">
                      <button type="submit" disabled={saving || !cardAccounts.length} className="btn-primary">
                        {saving ? 'Guardando...' : 'Guardar tarjeta'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary disabled:opacity-60"
                        onClick={resetCardForm}
                        disabled={saving}
                      >
                        Limpiar
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={submitBank} className="flex h-full min-h-0 flex-col gap-2.5" data-testid="credits-bank-form">
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                      <section className="min-h-0 space-y-2.5 overflow-y-auto pr-1">
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Datos del préstamo</p>
                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                            Registra condiciones del desembolso, destino y fechas clave del crédito.
                          </p>
                        </div>

                        <label className="space-y-1.5">
                          <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nombre del crédito *</span>
                          <input
                            value={bankForm.name}
                            onChange={event => setBankForm(prev => ({ ...prev, name: event.target.value }))}
                            className="field-base"
                            placeholder="Ej. Crédito vehicular BBVA"
                            required
                          />
                        </label>

                        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
                          <label className="space-y-1.5 md:col-span-6">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Entidad financiera *</span>
                            <input
                              value={bankForm.creditor_name}
                              onChange={event => setBankForm(prev => ({ ...prev, creditor_name: event.target.value }))}
                              className="field-base"
                              placeholder="Ej. BBVA"
                              required
                            />
                          </label>

                          <label className="space-y-1.5 md:col-span-6">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Cuenta destino del desembolso *</span>
                            <select
                              value={bankForm.account_id}
                              onChange={event => setBankForm(prev => ({ ...prev, account_id: event.target.value }))}
                              className="field-base"
                              required
                            >
                              {!destinationAccounts.length && <option value="">No hay cuentas activas</option>}
                              {destinationAccounts.map(account => (
                                <option key={account.id} value={account.id}>
                                  {account.name} · {account.currency}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-1.5 md:col-span-3">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Moneda</span>
                            <select
                              value={bankForm.currency}
                              onChange={event => setBankForm(prev => ({ ...prev, currency: event.target.value as CurrencyCode }))}
                              className="field-base"
                            >
                              <option value="PEN">PEN</option>
                              <option value="USD">USD</option>
                            </select>
                          </label>

                          <label className="space-y-1.5 md:col-span-9">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Capital prestado *</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bankForm.principal_amount}
                              onChange={event => setBankForm(prev => ({ ...prev, principal_amount: event.target.value }))}
                              className="field-base"
                              required
                            />
                          </label>

                          <label className="space-y-1.5 md:col-span-4">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">TEA anual (%)</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bankForm.annual_tea}
                              onChange={event => setBankForm(prev => ({ ...prev, annual_tea: event.target.value }))}
                              className="field-base"
                              placeholder="Ej. 45"
                            />
                          </label>

                          <label className="space-y-1.5 md:col-span-4">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Número de cuotas *</span>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={bankForm.total_installments}
                              onChange={event => setBankForm(prev => ({ ...prev, total_installments: event.target.value }))}
                              className="field-base"
                              required
                            />
                          </label>

                          <label className="space-y-1.5 md:col-span-4">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Fecha desembolso</span>
                            <input
                              type="date"
                              value={bankForm.transaction_date}
                              onChange={event => setBankForm(prev => ({ ...prev, transaction_date: event.target.value }))}
                              className="field-base"
                            />
                          </label>

                          <label className="space-y-1.5 md:col-span-4">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Inicio de cuotas</span>
                            <input
                              type="date"
                              value={bankForm.start_date}
                              onChange={event => setBankForm(prev => ({ ...prev, start_date: event.target.value }))}
                              className="field-base"
                              required
                            />
                          </label>

                          <label className="space-y-1.5 md:col-span-4">
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Fecha final</span>
                            <input
                              type="date"
                              value={bankForm.end_date}
                              onChange={event => setBankForm(prev => ({ ...prev, end_date: event.target.value }))}
                              className="field-base"
                              required
                            />
                          </label>

                          {bankForm.currency === 'USD' && (
                            <label className="space-y-1.5 md:col-span-4">
                              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Tipo de cambio *</span>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={bankForm.exchange_rate}
                                onChange={event => setBankForm(prev => ({ ...prev, exchange_rate: event.target.value }))}
                                className="field-base"
                                placeholder="Ej. 3.700"
                                required
                              />
                            </label>
                          )}

                          <label className={`space-y-1.5 ${bankForm.currency === 'USD' ? 'md:col-span-8' : 'md:col-span-12'}`}>
                            <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Categoría de ingreso (opcional)</span>
                            <select
                              value={bankForm.category_id}
                              onChange={event => setBankForm(prev => ({ ...prev, category_id: event.target.value }))}
                              className="field-base"
                            >
                              <option value="">Sin categoría</option>
                              {incomeCategories.map(category => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="space-y-1.5">
                          <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Notas</span>
                          <textarea
                            rows={2}
                            value={bankForm.notes}
                            onChange={event => setBankForm(prev => ({ ...prev, notes: event.target.value }))}
                            className="field-base"
                            placeholder="Opcional"
                          />
                        </label>

                        <div className="rounded-xl border border-dashed border-[color:var(--color-border-hover)] bg-[var(--color-surface-2)] p-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                              Documento (opcional)
                            </p>
                            <label className="inline-flex cursor-pointer items-center rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors">
                              Subir archivo
                              <input
                                type="file"
                                className="sr-only"
                                onChange={setAttachmentFromInput}
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                              />
                            </label>
                            <span className="text-[11px] text-[var(--color-text-muted)]">PDF/imagen/documento hasta 8 MB.</span>
                            {bankAttachment && (
                              <>
                                <span className="text-[12px] text-[var(--color-text)] truncate max-w-[280px]">
                                  {bankAttachment.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setBankAttachment(null)}
                                  className="rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                >
                                  Quitar
                                </button>
                              </>
                            )}
                          </div>
                          {bankAttachmentError && (
                            <p className="mt-2 text-[12px] text-red-400">{bankAttachmentError}</p>
                          )}
                        </div>
                      </section>

                      <aside className="min-h-0 space-y-2.5 overflow-y-auto pr-1">
                        <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                              Cronograma de cuotas
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setScheduleMode('AUTO')}
                                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                  scheduleMode === 'AUTO'
                                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
                                    : 'border-[color:var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                }`}
                              >
                                Automático
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setScheduleMode('MANUAL')
                                  const count = Number(bankForm.total_installments)
                                  if (Number.isFinite(count) && count > 0) {
                                    setManualInstallments(prev => (
                                      prev.length ? prev : buildManualInstallments(count, bankForm.start_date)
                                    ))
                                  }
                                }}
                                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                  scheduleMode === 'MANUAL'
                                    ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-300'
                                    : 'border-[color:var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                }`}
                              >
                                Manual
                              </button>
                            </div>
                          </div>

                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                            {scheduleMode === 'AUTO'
                              ? 'Se calculará automáticamente según capital, tasa y número de cuotas.'
                              : 'Completa cuota por cuota: fecha, capital, interés y seguro.'}
                          </p>
                        </div>

                        {scheduleMode === 'MANUAL' ? (
                          <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] text-[var(--color-text-muted)]">
                                Cuotas configuradas: <strong className="text-[var(--color-text)]">{manualInstallments.length}</strong>
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const count = Number(bankForm.total_installments)
                                  if (!Number.isFinite(count) || count < 1) return
                                  setManualInstallments(buildManualInstallments(count, bankForm.start_date))
                                }}
                                className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                              >
                                Recalcular
                              </button>
                            </div>

                            <div className="max-h-[min(50dvh,560px)] overflow-auto rounded-lg border border-[color:var(--color-border)]">
                              <table className="w-full min-w-[640px] text-[11px]">
                                <thead className="bg-[var(--color-surface-2)] sticky top-0 z-[1]">
                                  <tr className="text-[var(--color-text-muted)]">
                                    <th className="px-2 py-2 text-left font-semibold">#</th>
                                    <th className="px-2 py-2 text-left font-semibold">Vencimiento</th>
                                    <th className="px-2 py-2 text-left font-semibold">Capital</th>
                                    <th className="px-2 py-2 text-left font-semibold">Interés</th>
                                    <th className="px-2 py-2 text-left font-semibold">Seguro</th>
                                    <th className="px-2 py-2 text-left font-semibold">Cuota</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {manualInstallments.map((row, index) => {
                                    const principalValue = Number(row.principal_amount || '0')
                                    const interestValue = Number(row.interest_amount || '0')
                                    const insuranceValue = Number(row.insurance_amount || '0')
                                    const rowTotal = (Number.isFinite(principalValue) ? principalValue : 0)
                                      + (Number.isFinite(interestValue) ? interestValue : 0)
                                      + (Number.isFinite(insuranceValue) ? insuranceValue : 0)

                                    return (
                                      <tr key={row.installment_number} className="border-t border-[color:var(--color-border)]">
                                        <td className="px-2 py-1.5 font-semibold text-[var(--color-text)]">#{row.installment_number}</td>
                                        <td className="px-2 py-1.5">
                                          <input
                                            type="date"
                                            value={row.due_date}
                                            onChange={event => setManualInstallments(prev => prev.map((item, itemIndex) => (
                                              itemIndex === index
                                                ? { ...item, due_date: event.target.value }
                                                : item
                                            )))}
                                            className="field-base py-1.5"
                                            required
                                          />
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={row.principal_amount}
                                            onChange={event => setManualInstallments(prev => prev.map((item, itemIndex) => (
                                              itemIndex === index
                                                ? { ...item, principal_amount: event.target.value }
                                                : item
                                            )))}
                                            className="field-base py-1.5"
                                            required
                                          />
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={row.interest_amount}
                                            onChange={event => setManualInstallments(prev => prev.map((item, itemIndex) => (
                                              itemIndex === index
                                                ? { ...item, interest_amount: event.target.value }
                                                : item
                                            )))}
                                            className="field-base py-1.5"
                                            required
                                          />
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={row.insurance_amount}
                                            onChange={event => setManualInstallments(prev => prev.map((item, itemIndex) => (
                                              itemIndex === index
                                                ? { ...item, insurance_amount: event.target.value }
                                                : item
                                            )))}
                                            className="field-base py-1.5"
                                            required
                                          />
                                        </td>
                                        <td className="px-2 py-1.5 font-semibold text-[var(--color-text)] tabular-nums">
                                          {formatNumber(rowTotal)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3">
                            <p className="text-[12px] text-[var(--color-text-muted)]">
                              Modo automático activo: el sistema generará el cronograma en base al número de cuotas.
                            </p>
                          </div>
                        )}
                      </aside>
                    </div>

                    <div className="sticky bottom-0 z-[2] shrink-0 border-t border-[color:var(--color-border)] bg-[var(--color-modal-bg)] pt-2.5">
                      {(error || bankAttachmentError) && (
                        <p className="text-[12px] text-red-400">{error ?? bankAttachmentError}</p>
                      )}

                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[11px] text-emerald-300/85">
                          Se creará automáticamente un ingreso por desembolso en la cuenta destino.
                        </p>

                        <div className="flex gap-2 pt-1 sm:pt-0">
                          <button type="submit" disabled={saving || !destinationAccounts.length} className="btn-primary">
                            {saving ? 'Guardando...' : 'Guardar crédito bancario'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary disabled:opacity-60"
                            onClick={resetBankForm}
                            disabled={saving}
                          >
                            Limpiar
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  )
}
