'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AccountType, CurrencyCode } from '@/types/database.types'
import { useToast } from '@/lib/toast/toast'
import { FormActions, FormField, FormSection, OptionalSection } from '@/components/forms/primitives'
import { FinancialIcon } from '@/components/ui/FinancialIcon'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { ACCOUNT_COLOR_OPTIONS, ACCOUNT_ICON_OPTIONS } from '@/lib/constants/visual-options'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { listCurrenciesAction } from '@/app/actions/admin.actions'
import {
  AmountCell,
  ConfirmDialog,
  ControlsBar,
  DataErrorBanner,
  DataFilterPreset,
  DataSearchField,
  DataTable,
  EmptyState,
  FilterBar,
  ModuleHeader,
  PageLayout,
  StatCard,
  StatGrid,
  StatusBadge,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import {
  crossesTechnicalAccountBoundary,
  getAccountIdentityViolation,
} from '@/modules/portfolio/account-identity'
import { requestPortfolioMutation } from '@/modules/portfolio/account-mutation-timeout'
import {
  getPortfolioPositionFacts,
  PORTFOLIO_POSITION_COMPARISON_DISCLOSURE,
  PORTFOLIO_POSITION_COMPARISON_TITLE,
} from '@/modules/portfolio/account-position'
import {
  formatPortfolioAmount,
  getPortfolioCurrencyPresentation,
  groupPortfolioBalancesByCurrency,
} from '@/modules/portfolio/currency-display'
import {
  getIdentifiedPortfolioInstitution,
  getPortfolioBankDisplayName,
  getPortfolioReferenceDataState,
} from '@/modules/portfolio/reference-data-state'

type BankEntityRef = {
  id: string
  name: string
  short_name: string | null
  color: string
  icon: string
  is_active: boolean
}

type AccountItem = {
  id: string
  name: string
  institution: string | null
  bank_entity_id: string | null
  bank_entity?: BankEntityRef | null
  type: AccountType
  currency: CurrencyCode
  balance: number
  initial_balance: number
  initial_balance_date: string
  color: string
  icon: string
  include_in_net_worth: boolean
  is_active: boolean
  notes: string | null
  created_at: string
}

type BankEntityItem = {
  id: string
  name: string
  short_name: string | null
  color: string
  icon: string
  is_active: boolean
}

type UserCurrencyItem = {
  id: string
  code: string
  name: string
  symbol: string
  is_default: boolean
  is_system: boolean
  is_active: boolean
}

type AccountForm = {
  name: string
  institution: string
  bank_entity_id: string
  type: AccountType
  currency: CurrencyCode
  initial_balance: string
  initial_balance_date: string
  color: string
  icon: string
  include_in_net_worth: boolean
  notes: string
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'CHECKING', label: 'Cuenta corriente' },
  { value: 'SAVINGS', label: 'Cuenta ahorros' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'INVESTMENT', label: 'Inversion' },
  { value: 'CREDIT_CARD', label: 'Tarjeta' },
  { value: 'STOCKS', label: 'Acciones' },
  { value: 'ETF', label: 'ETF' },
  { value: 'CRYPTO', label: 'Cripto-activos' },
  { value: 'OTHER', label: 'Otra' },
]

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: 'Cuenta corriente',
  SAVINGS: 'Cuenta ahorros',
  CASH: 'Efectivo',
  INVESTMENT: 'Inversion',
  CREDIT_CARD: 'Tarjeta',
  STOCKS: 'Acciones',
  ETF: 'ETF',
  CRYPTO: 'Cripto-activos',
  OTHER: 'Otra',
}

const ACCOUNT_TYPE_TONE: Record<
  AccountType,
  'neutral' | 'primary' | 'warning' | 'info'
> = {
  CHECKING: 'neutral',
  SAVINGS: 'neutral',
  CASH: 'neutral',
  INVESTMENT: 'info',
  CREDIT_CARD: 'warning',
  STOCKS: 'primary',
  ETF: 'primary',
  CRYPTO: 'info',
  OTHER: 'neutral',
}

type StatusFilter = 'all' | 'active' | 'inactive'
type CurrencyFilter = 'all' | CurrencyCode
type TypeFilter = 'all' | AccountType

const CLIENT_FETCH_TIMEOUT_MS = 10_000
const ACCOUNTS_LOAD_ERROR_MESSAGE =
  'No se pudieron cargar las cuentas. Reintenta para recuperar la información del portafolio.'
const BANKS_LOAD_ERROR_MESSAGE =
  'No se pudo cargar el catálogo de bancos.'
const CURRENCIES_LOAD_ERROR_MESSAGE =
  'No se pudo cargar el catálogo de monedas.'

async function fetchPortfolioData<T>(url: string, fallbackMessage: string): Promise<T> {
  const res = await fetchWithTimeout(url, {
    cache: 'no-store',
    timeoutMs: CLIENT_FETCH_TIMEOUT_MS,
    timeoutMessage: `${fallbackMessage}. La solicitud tardo demasiado.`,
  })
  const json = await res.json().catch(() => null)

  if (!res.ok || !json?.ok) {
    throw new Error(getApiErrorMessage(json, fallbackMessage))
  }

  return json.data as T
}

async function withPortfolioTimeout<T>(
  promise: Promise<T>,
  fallbackMessage: string,
): Promise<T> {
  let timeoutId: number | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`${fallbackMessage}. La solicitud tardo demasiado.`))
        }, CLIENT_FETCH_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
  }
}

function isTechnicalAccount(account: Pick<AccountItem, 'type'>): boolean {
  return account.type === 'CREDIT_CARD'
}

const EMPTY_FORM: AccountForm = {
  name: '',
  institution: '',
  bank_entity_id: '',
  type: 'CHECKING',
  currency: 'PEN',
  initial_balance: '0.00',
  initial_balance_date: '',
  color: '#0d6b5e',
  icon: 'wallet',
  include_in_net_worth: true,
  notes: '',
}

function getIconLabel(icon: string): string {
  return ACCOUNT_ICON_OPTIONS.find(option => option.value === icon)?.label ?? icon
}

function withAlpha(color: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color
}

function stackIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7.5 12 4l8 3.5L12 11 4 7.5Z" />
      <path d="M4 12.5 12 16l8-3.5" />
      <path d="M4 17 12 20l8-3" />
    </svg>
  )
}

function balanceTone(balance: number): 'neutral' | 'danger' {
  return balance < 0 ? 'danger' : 'neutral'
}

function formatStoredPortfolioDate(value: string | null) {
  if (!value) return 'Fecha no disponible'

  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

  return date
    .toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '')
}

function PortfolioPositionComparison({
  account,
  currencies,
}: {
  account: AccountItem
  currencies: readonly UserCurrencyItem[]
}) {
  const facts = getPortfolioPositionFacts(account)

  return (
    <section
      aria-label={`Comparación entre saldo de apertura y saldo actual de ${account.name}`}
      data-testid={`portfolio-position-comparison-${account.id}`}
      className="mt-5 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
            {PORTFOLIO_POSITION_COMPARISON_TITLE}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--c-text-muted)]">
            {PORTFOLIO_POSITION_COMPARISON_DISCLOSURE}
          </p>
        </div>
        <StatusBadge tone="muted" dot={false} className="shrink-0">
          2 valores
        </StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-[var(--c-text-faint)]">Saldo de apertura</p>
          <p className="mt-1 truncate font-mono text-[13px] font-semibold tabular-nums text-[var(--c-text)]">
            {formatPortfolioAmount(facts.opening.amount, facts.currency, currencies)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--c-text-muted)]">
            {formatStoredPortfolioDate(facts.opening.recordedDate)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-medium text-[var(--c-text-faint)]">Saldo actual</p>
          <p className={`mt-1 truncate font-mono text-[13px] font-semibold tabular-nums ${
            facts.current.amount < 0 ? 'text-[var(--c-danger)]' : 'text-[var(--c-text)]'
          }`}>
            {formatPortfolioAmount(facts.current.amount, facts.currency, currencies)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--c-text-muted)]">Posición registrada ahora</p>
        </div>
      </div>

      <div aria-hidden="true" className="mt-3 flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full border-2 border-[var(--c-primary)] bg-[var(--c-surface)]" />
        <span className="h-px flex-1 border-t border-dashed border-[var(--c-border-hover)]" />
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--c-primary)]" />
      </div>
    </section>
  )
}

type PortfolioManagerProps = {
  initialAccounts?: AccountItem[]
  initialBanks?: BankEntityItem[]
  initialCurrencies?: UserCurrencyItem[]
  preloaded?: boolean
  preloadError?: string | null
}

export function PortfolioManager({
  initialAccounts = [],
  initialBanks = [],
  initialCurrencies = [],
  preloaded = false,
  preloadError = null,
}: PortfolioManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts)
  const [banks, setBanks] = useState<BankEntityItem[]>(initialBanks)
  const [currencies, setCurrencies] = useState<UserCurrencyItem[]>(initialCurrencies)
  const [loading, setLoading] = useState(!preloaded)
  const [banksLoading, setBanksLoading] = useState(!preloaded)
  const [currenciesLoading, setCurrenciesLoading] = useState(!preloaded && initialCurrencies.length === 0)
  const [saving, setSaving] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(preloadError)
  const [banksError, setBanksError] = useState<string | null>(null)
  const [currenciesError, setCurrenciesError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [bankFilter, setBankFilter] = useState<string>('all')
  const [showTechnicalAccounts, setShowTechnicalAccounts] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDeactivateAccount, setPendingDeactivateAccount] = useState<AccountItem | null>(null)
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<AccountItem | null>(null)

  const handledQueryOpenRef = useRef(false)
  const openFromHeroQuery = searchParams.get('new') === 'portfolio'

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setAccountsError(null)
    setError(null)

    try {
      const data = await fetchPortfolioData<AccountItem[]>(
        '/api/accounts?include_inactive=true',
        'No se pudieron cargar las cuentas',
      )
      setAccounts(data)
    } catch {
      setAccountsError(ACCOUNTS_LOAD_ERROR_MESSAGE)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBanks = useCallback(async () => {
    setBanksLoading(true)
    setBanksError(null)

    try {
      const data = await fetchPortfolioData<BankEntityItem[]>(
        '/api/bank-entities?include_inactive=false',
        'No se pudieron cargar los bancos',
      )
      setBanks(data)
    } catch {
      setBanks([])
      setBankFilter('all')
      setBanksError(BANKS_LOAD_ERROR_MESSAGE)
    } finally {
      setBanksLoading(false)
    }
  }, [])

  const loadCurrencies = useCallback(async () => {
    setCurrenciesLoading(true)
    setCurrenciesError(null)

    try {
      const result = await withPortfolioTimeout(
        listCurrenciesAction(),
        'No se pudieron cargar las monedas',
      )

      if (!result.ok) {
        throw new Error(result.error.message)
      }

      setCurrencies(result.data as UserCurrencyItem[])
    } catch {
      setCurrencies([])
      setCurrencyFilter('all')
      setCurrenciesError(CURRENCIES_LOAD_ERROR_MESSAGE)
    } finally {
      setCurrenciesLoading(false)
    }
  }, [])

  const reloadPortfolioData = useCallback(async () => {
    await Promise.all([loadAccounts(), loadBanks(), loadCurrencies()])
  }, [loadAccounts, loadBanks, loadCurrencies])

  const reloadFailedReferenceData = useCallback(async () => {
    const requests: Array<Promise<void>> = []
    if (banksError) requests.push(loadBanks())
    if (currenciesError) requests.push(loadCurrencies())
    await Promise.all(requests)
  }, [banksError, currenciesError, loadBanks, loadCurrencies])

  useEffect(() => {
    if (preloaded) return
    void reloadPortfolioData()
  }, [preloaded, reloadPortfolioData])

  useEffect(() => {
    if (initialCurrencies.length === 0) return
    setCurrencies(initialCurrencies)
  }, [initialCurrencies])

  const resetForm = useCallback(() => {
    setForm({
      ...EMPTY_FORM,
      initial_balance_date: isoToday(),
    })
    setEditingId(null)
  }, [])

  const clearCreateQueryParam = useCallback(() => {
    if (searchParams.get('new') !== 'portfolio') return

    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    const nextUrl = params.toString().length > 0 ? `${pathname}?${params}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  const closeModal = useCallback(() => {
    if (saving) return
    setModalOpen(false)
    resetForm()
    clearCreateQueryParam()
  }, [clearCreateQueryParam, resetForm, saving])

  const activeAccounts = useMemo(
    () => accounts.filter(account => account.is_active),
    [accounts],
  )

  const operationalAccounts = useMemo(
    () => accounts.filter(account => !isTechnicalAccount(account)),
    [accounts],
  )

  const activeOperationalAccounts = useMemo(
    () => activeAccounts.filter(account => !isTechnicalAccount(account)),
    [activeAccounts],
  )

  const technicalAccounts = useMemo(
    () => accounts.filter(account => isTechnicalAccount(account)),
    [accounts],
  )

  const visibleBaseAccounts = useMemo(
    () => showTechnicalAccounts || typeFilter === 'CREDIT_CARD'
      ? accounts
      : operationalAccounts,
    [accounts, operationalAccounts, showTechnicalAccounts, typeFilter],
  )

  const activeCount = activeOperationalAccounts.length
  const inactiveCount = operationalAccounts.length - activeCount
  const technicalCount = technicalAccounts.length

  const totalBalanceByCurrency = useMemo(() => {
    return groupPortfolioBalancesByCurrency(activeOperationalAccounts)
  }, [activeOperationalAccounts])

  const totalPen = totalBalanceByCurrency.get('PEN') ?? 0
  const totalUsd = totalBalanceByCurrency.get('USD') ?? 0

  const accountsInNetWorth = useMemo(
    () => activeOperationalAccounts.filter(account => account.include_in_net_worth).length,
    [activeOperationalAccounts],
  )

  const accountsWithoutBank = useMemo(
    () => activeOperationalAccounts.filter(account => !account.bank_entity_id && !account.institution).length,
    [activeOperationalAccounts],
  )

  const activeInstitutions = useMemo(() => {
    const names = new Set<string>()
    for (const account of activeOperationalAccounts) {
      const institutionName = getIdentifiedPortfolioInstitution(account)
      if (institutionName) names.add(institutionName)
    }
    return names.size
  }, [activeOperationalAccounts])

  const currencyOptions = useMemo(() => {
    const activeCurrencies = currencies
      .filter(currency => currency.is_active)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1
        if (!a.is_default && b.is_default) return 1
        return a.code.localeCompare(b.code)
      })

    return activeCurrencies.map(currency => ({
      value: currency.code,
      label: `${currency.code} · ${currency.name}${currency.is_system ? '' : ' · Personalizada'}`,
    }))
  }, [currencies])

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase()

    return visibleBaseAccounts.filter(account => {
      if (currencyFilter !== 'all' && account.currency !== currencyFilter) return false
      if (typeFilter !== 'all' && account.type !== typeFilter) return false
      if (statusFilter === 'active' && !account.is_active) return false
      if (statusFilter === 'inactive' && account.is_active) return false

      if (bankFilter !== 'all') {
        if (bankFilter === 'none' && account.bank_entity_id) return false
        if (bankFilter !== 'none' && account.bank_entity_id !== bankFilter) return false
      }

      if (!q) return true

      const bankName = getPortfolioBankDisplayName(account).toLowerCase()
      return (
        account.name.toLowerCase().includes(q) ||
        bankName.includes(q) ||
        ACCOUNT_TYPE_LABEL[account.type].toLowerCase().includes(q) ||
        account.currency.toLowerCase().includes(q)
      )
    })
  }, [bankFilter, currencyFilter, query, statusFilter, typeFilter, visibleBaseAccounts])

  const openCreateModal = useCallback(() => {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      currency: (currencyOptions[0]?.value ?? '') as CurrencyCode,
      initial_balance_date: isoToday(),
    })
    setModalOpen(true)
  }, [currencyOptions])

  const handleSelectAccountType = useCallback((value: string) => {
    const nextType = value as AccountType
    setForm(prev => {
      if (nextType !== 'CREDIT_CARD') {
        return { ...prev, type: nextType }
      }

      return {
        ...prev,
        type: nextType,
        initial_balance: '0.00',
        include_in_net_worth: false,
        icon: prev.icon === 'wallet' ? 'credit-card' : prev.icon,
      }
    })
  }, [])

  useEffect(() => {
    if (openFromHeroQuery) {
      if (handledQueryOpenRef.current) return
      handledQueryOpenRef.current = true
      openCreateModal()
      return
    }

    handledQueryOpenRef.current = false
  }, [openCreateModal, openFromHeroQuery])

  const startEdit = useCallback((account: AccountItem) => {
    setEditingId(account.id)
    setForm({
      name: account.name,
      institution: account.institution ?? '',
      bank_entity_id: account.bank_entity_id ?? '',
      type: account.type,
      currency: account.currency,
      initial_balance: Number(account.initial_balance ?? 0).toFixed(2),
      initial_balance_date: account.initial_balance_date || String(account.created_at ?? '').slice(0, 10) || isoToday(),
      color: account.color,
      icon: account.icon,
      include_in_net_worth: isTechnicalAccount(account) ? false : account.include_in_net_worth,
      notes: account.notes ?? '',
    })
    setModalOpen(true)
  }, [])

  const handleSelectBank = useCallback((bankId: string) => {
    const selected = banks.find(bank => bank.id === bankId)

    setForm(prev => ({
      ...prev,
      bank_entity_id: bankId,
      institution: selected ? (selected.name ?? selected.short_name ?? prev.institution) : prev.institution,
      color: selected ? selected.color : prev.color,
      icon: selected ? selected.icon : prev.icon,
    }))
  }, [banks])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    if (trimmedName.length < 2) {
      const message = 'El nombre debe tener al menos 2 caracteres.'
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
      return
    }

    if (!editingId && (
      currenciesError
      || !currencyOptions.some(option => option.value === form.currency)
    )) {
      const message = 'No se pudo verificar una moneda disponible. Reintenta la carga antes de crear la cuenta.'
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
      return
    }

    if (banksError && form.bank_entity_id) {
      const message = 'No se pudo verificar la entidad bancaria. Reintenta la carga antes de guardar cambios en esta cuenta.'
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
      return
    }

    const currentAccount = editingId
      ? accounts.find(account => account.id === editingId) ?? null
      : null
    const identityViolation = currentAccount
      ? getAccountIdentityViolation(currentAccount, {
          currency: form.currency,
          type: form.type,
        })
      : null

    if (identityViolation) {
      const message = `${identityViolation.message} ${identityViolation.detail}`
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
      return
    }

    const formIsTechnicalAccount = form.type === 'CREDIT_CARD'
    const parsedInitialBalance = formIsTechnicalAccount
      ? 0
      : roundToDecimals(
          parseNumericInput(form.initial_balance, Number.NaN),
          2,
        )

    if (!Number.isFinite(parsedInitialBalance)) {
      const message = 'El saldo inicial debe ser un numero valido.'
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
      return
    }

    const trimmedInitialBalanceDate = form.initial_balance_date.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedInitialBalanceDate)) {
      const message = 'Indica una fecha valida para el saldo inicial.'
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
      return
    }

    if (form.bank_entity_id) {
      const selectedBank = banks.find(bank => bank.id === form.bank_entity_id)
      if (!selectedBank || !selectedBank.is_active) {
        const message = 'Selecciona una entidad bancaria activa para continuar.'
        setError(message)
        toast.error('No se pudo guardar la cuenta', message)
        return
      }
    }

    const normalizedCurrency = form.currency.trim().toUpperCase() as CurrencyCode

    setSaving(true)
    setError(null)

    const payload = editingId
      ? {
          name: trimmedName,
          institution: form.institution.trim() || null,
          bank_entity_id: form.bank_entity_id || null,
          type: form.type,
          currency: normalizedCurrency,
          initial_balance: parsedInitialBalance,
          initial_balance_date: trimmedInitialBalanceDate,
          color: form.color.trim() || '#0d6b5e',
          icon: form.icon.trim() || 'wallet',
          include_in_net_worth: formIsTechnicalAccount ? false : form.include_in_net_worth,
          notes: form.notes.trim() || null,
        }
      : {
          name: trimmedName,
          institution: form.institution.trim() || null,
          bank_entity_id: form.bank_entity_id || null,
          type: form.type,
          currency: normalizedCurrency,
          initial_balance: parsedInitialBalance,
          initial_balance_date: trimmedInitialBalanceDate,
          color: form.color.trim() || '#0d6b5e',
          icon: form.icon.trim() || 'wallet',
          include_in_net_worth: formIsTechnicalAccount ? false : form.include_in_net_worth,
          notes: form.notes.trim() || null,
        }

    try {
      const endpoint = editingId ? `/api/accounts/${editingId}` : '/api/accounts'
      const method = editingId ? 'PATCH' : 'POST'
      const { response: res, payload: json } = await requestPortfolioMutation(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, loadAccounts)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo guardar la cuenta'))
      }

      await loadAccounts()
      setModalOpen(false)
      resetForm()
      clearCreateQueryParam()
      toast.success(
        editingId ? 'Portafolio actualizado' : 'Portafolio registrado',
        `${trimmedName} se guardo correctamente.`,
        { persist: false },
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo guardar la cuenta'
      setError(message)
      toast.error('No se pudo guardar la cuenta', message)
    } finally {
      setSaving(false)
    }
  }, [
    accounts,
    banks,
    banksError,
    clearCreateQueryParam,
    currenciesError,
    currencyOptions,
    editingId,
    form,
    loadAccounts,
    resetForm,
    toast,
  ])

  const openDeactivateModal = useCallback((account: AccountItem) => {
    if (!account.is_active || saving || loading || rowActionId !== null) return
    setPendingDeactivateAccount(account)
  }, [loading, rowActionId, saving])

  const openDeleteModal = useCallback((account: AccountItem) => {
    if (saving || loading || rowActionId !== null) return
    setPendingDeleteAccount(account)
  }, [loading, rowActionId, saving])

  const deactivate = useCallback(async (id: string) => {
    setRowActionId(id)
    setError(null)

    try {
      const { response: res, payload: json } = await requestPortfolioMutation(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      }, loadAccounts)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo desactivar la cuenta'))
      }

      await loadAccounts()
      toast.success('Portafolio desactivado', undefined, { persist: false })
      setPendingDeactivateAccount(null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo desactivar la cuenta'
      setError(message)
      toast.error('No se pudo desactivar la cuenta', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadAccounts, toast])

  const reactivate = useCallback(async (id: string) => {
    setRowActionId(id)
    setError(null)

    try {
      const { response: res, payload: json } = await requestPortfolioMutation(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      }, loadAccounts)

      if (!res.ok || !json?.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudo reactivar la cuenta'))
      }

      await loadAccounts()
      toast.success('Portafolio reactivado', undefined, { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo reactivar la cuenta'
      setError(message)
      toast.error('No se pudo reactivar la cuenta', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadAccounts, toast])

  const deleteAccount = useCallback(async (account: AccountItem) => {
    if (saving || loading || rowActionId) return

    setRowActionId(account.id)
    setError(null)

    try {
      const { response: res, payload: json } = await requestPortfolioMutation(
        `/api/accounts/${account.id}`,
        { method: 'DELETE' },
        loadAccounts,
      )

      if (!res.ok && res.status !== 204) {
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el portafolio'))
      }

      await loadAccounts()
      setPendingDeleteAccount(null)
      toast.success('Portafolio eliminado', undefined, { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo eliminar el portafolio'
      setError(message)
      toast.error('No se pudo eliminar', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadAccounts, loading, rowActionId, saving, toast])

  const exposureSummary = useMemo(() => {
    return [...totalBalanceByCurrency.entries()]
      .filter(([currency]) => currency !== 'PEN' && currency !== 'USD')
      .slice(0, 2)
      .map(([currency, total]) => {
        const presentation = getPortfolioCurrencyPresentation(currency, currencies)
        const qualifier = presentation.kind === 'custom'
          ? ' · personalizada'
          : presentation.kind === 'unavailable'
            ? ' · código registrado'
            : ''

        return `${formatPortfolioAmount(total, currency, currencies)}${qualifier}`
      })
      .join(' · ')
  }, [currencies, totalBalanceByCurrency])

  const selectedBankLabel = useMemo(() => {
    if (!form.bank_entity_id) return 'Sin banco asignado'
    const selected = banks.find(bank => bank.id === form.bank_entity_id)
    return selected ? (selected.name ?? selected.short_name ?? form.institution) : form.institution || 'Entidad seleccionada'
  }, [banks, form.bank_entity_id, form.institution])

  const formInitialBalanceValue = useMemo(() => {
    const parsed = roundToDecimals(parseNumericInput(form.initial_balance, Number.NaN), 2)
    if (!Number.isFinite(parsed)) return '--'
    return formatPortfolioAmount(parsed, form.currency, currencies)
  }, [currencies, form.currency, form.initial_balance])

  const formIsTechnicalAccount = form.type === 'CREDIT_CARD'

  const editingAccount = useMemo(
    () => (editingId ? accounts.find(account => account.id === editingId) ?? null : null),
    [accounts, editingId],
  )
  const dataState = useMemo(() => getPortfolioReferenceDataState({
    accountCount: accounts.length,
    accountsLoading: loading,
    accountsError,
    banksLoading,
    banksError,
    currenciesLoading,
    currenciesError,
  }), [
    accounts.length,
    accountsError,
    banksError,
    banksLoading,
    currenciesError,
    currenciesLoading,
    loading,
  ])
  const accountsSummaryAvailable = !loading && !accountsError
  const summaryUnavailableDetail = loading ? 'Cargando...' : 'No disponible'
  const summaryUnavailableCaption = loading
    ? 'El resumen se mostrará cuando finalice la carga de cuentas.'
    : 'No se presenta un total hasta recuperar las cuentas.'
  const canCreateWithAvailableCurrency = Boolean(currencyOptions.length) && dataState.currenciesAvailable

  return (
    <>
      <PageLayout
        className="max-w-[1320px] gap-5"
        header={
          <ModuleHeader
            eyebrow="Registro financiero"
            title="Portafolio"
            description={
              accountsSummaryAvailable && exposureSummary
                ? `Cuentas, efectivo e instrumentos patrimoniales con lectura inmediata por entidad, moneda y saldo. Otras exposiciones: ${exposureSummary}.`
                : 'Cuentas, efectivo e instrumentos patrimoniales con lectura inmediata por entidad, moneda y saldo.'
            }
            mode="content"
            actions={(
              <CreateModuleButton
                onClick={openCreateModal}
                label="Nuevo portafolio"
                testId="portfolio-create-button"
              />
            )}
          />
        }
        stats={(
          <StatGrid>
            <StatCard
              label="Saldo PEN"
              value={accountsSummaryAvailable ? formatPortfolioAmount(totalPen, 'PEN', currencies) : '—'}
              detail={accountsSummaryAvailable ? `${activeCount} activa${activeCount === 1 ? '' : 's'}` : summaryUnavailableDetail}
              caption={accountsSummaryAvailable ? 'Liquidez propia consolidada en soles peruanos.' : summaryUnavailableCaption}
            />
            <StatCard
              label="Saldo USD"
              value={accountsSummaryAvailable ? formatPortfolioAmount(totalUsd, 'USD', currencies) : '—'}
              detail={accountsSummaryAvailable ? (totalUsd === 0 ? 'Sin exposicion' : 'Caja dolarizada') : summaryUnavailableDetail}
              caption={accountsSummaryAvailable ? 'Fondos disponibles en cuentas dolarizadas.' : summaryUnavailableCaption}
            />
            <StatCard
              label="Cuentas operativas"
              value={accountsSummaryAvailable ? String(activeCount) : '—'}
              detail={accountsSummaryAvailable ? (inactiveCount > 0 ? `${inactiveCount} inactiva${inactiveCount === 1 ? '' : 's'}` : 'Sin rezagos') : summaryUnavailableDetail}
              caption={accountsSummaryAvailable ? 'Cuentas patrimoniales disponibles para nuevos registros.' : summaryUnavailableCaption}
            />
            <StatCard
              label="Técnicas y patrimonio"
              value={accountsSummaryAvailable ? String(accountsInNetWorth) : '—'}
              detail={accountsSummaryAvailable
                ? (technicalCount > 0 ? `${technicalCount} técnica${technicalCount === 1 ? '' : 's'}` : `${activeInstitutions} entidad${activeInstitutions === 1 ? '' : 'es'}`)
                : summaryUnavailableDetail}
              caption={
                !accountsSummaryAvailable
                  ? summaryUnavailableCaption
                  : technicalCount > 0
                  ? 'Las tarjetas se gestionan en Créditos y no suman patrimonio.'
                  : accountsWithoutBank > 0
                  ? `${accountsWithoutBank} cuenta${accountsWithoutBank === 1 ? '' : 's'} sin banco asociado.`
                  : 'Todas las cuentas activas tienen contraparte identificada.'
              }
              icon={stackIcon()}
            />
          </StatGrid>
        )}
        controls={(
          <ControlsBar
            presets={(
              <>
                <DataFilterPreset
                  label="Todas"
                  active={statusFilter === 'all'}
                  count={operationalAccounts.length}
                  onClick={() => setStatusFilter('all')}
                />
                <DataFilterPreset
                  label="Activas"
                  active={statusFilter === 'active'}
                  count={activeCount}
                  onClick={() => setStatusFilter('active')}
                />
                <DataFilterPreset
                  label="Inactivas"
                  active={statusFilter === 'inactive'}
                  count={inactiveCount}
                  onClick={() => setStatusFilter('inactive')}
                />
                <DataFilterPreset
                  label="Técnicas"
                  active={showTechnicalAccounts}
                  count={technicalCount}
                  onClick={() => setShowTechnicalAccounts(prev => !prev)}
                />
              </>
            )}
            search={(
              <DataSearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar cuenta, banco, tipo o moneda"
              />
            )}
            filters={(
              <FilterBar>
                <AppSelect
                  value={currencyFilter}
                  onChange={value => setCurrencyFilter(value as CurrencyFilter)}
                  className="filters-control sm:w-[120px]"
                  compact
                  disabled={!dataState.currenciesAvailable}
                  searchable={false}
                  options={[
                    {
                      value: 'all',
                      label: currenciesLoading
                        ? 'Cargando...'
                        : currenciesError
                          ? 'Monedas no disponibles'
                          : 'Moneda',
                    },
                    ...currencyOptions.map(option => ({
                      value: option.value,
                      label: option.value,
                    })),
                  ]}
                />
                <AppSelect
                  value={typeFilter}
                  onChange={value => setTypeFilter(value as TypeFilter)}
                  className="filters-control sm:w-[190px]"
                  compact
                  searchPlaceholder="Buscar tipo..."
                  options={[
                    { value: 'all', label: 'Tipo' },
                    ...ACCOUNT_TYPE_OPTIONS.map(option => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
                <AppSelect
                  value={bankFilter}
                  onChange={setBankFilter}
                  className="filters-control sm:w-[220px]"
                  disabled={!dataState.banksAvailable}
                  compact
                  searchPlaceholder="Buscar banco..."
                  options={[
                    {
                      value: 'all',
                      label: banksLoading
                        ? 'Cargando...'
                        : banksError
                          ? 'Bancos no disponibles'
                          : 'Banco',
                    },
                    { value: 'none', label: 'Sin banco' },
                    ...banks.map(bank => ({
                      value: bank.id,
                      label: bank.name ?? bank.short_name ?? 'Entidad sin nombre',
                    })),
                  ]}
                />
              </FilterBar>
            )}
            viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="portfolio-view-toggle" />}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                {filteredAccounts.length} cuenta{filteredAccounts.length === 1 ? '' : 's'}
                {technicalCount > 0 && !showTechnicalAccounts && typeFilter !== 'CREDIT_CARD'
                  ? ` · ${technicalCount} técnica${technicalCount === 1 ? '' : 's'} oculta${technicalCount === 1 ? '' : 's'}`
                  : ''}
              </StatusBadge>
            )}
          />
        )}
      >
        {accountsError ? (
          <div data-testid="portfolio-accounts-error">
            <DataErrorBanner message={accountsError} onRetry={loadAccounts} />
          </div>
        ) : null}

        {dataState.referenceNotice ? (
          <div data-testid="portfolio-reference-data-warning">
            <DataErrorBanner
              message={dataState.referenceNotice}
              onRetry={reloadFailedReferenceData}
            />
          </div>
        ) : null}

        {error ? <DataErrorBanner message={error} onRetry={reloadPortfolioData} /> : null}

        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map(item => (
              <div
                key={item}
                className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4"
              >
                <div className="flex animate-pulse items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded-full bg-[var(--c-surface-2)]" />
                    <div className="h-5 w-48 rounded-full bg-[var(--c-surface-2)]" />
                  </div>
                  <div className="h-10 w-32 rounded-full bg-[var(--c-surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        ) : dataState.hasBlockingAccountsError ? null : filteredAccounts.length === 0 ? (
          <div data-testid={dataState.showEmptyState ? 'portfolio-empty-state' : 'portfolio-filtered-empty-state'}>
            <EmptyState
              icon={stackIcon()}
              title={
                query.trim() || currencyFilter !== 'all' || typeFilter !== 'all' || bankFilter !== 'all' || statusFilter !== 'all' || showTechnicalAccounts
                  ? 'No encontramos cuentas para esa combinacion.'
                  : 'Todavia no tienes portafolios registrados.'
              }
              description={
                query.trim() || currencyFilter !== 'all' || typeFilter !== 'all' || bankFilter !== 'all' || statusFilter !== 'all' || showTechnicalAccounts
                  ? 'Ajusta los filtros o amplia la busqueda para recuperar cuentas, custodios o monedas.'
                  : 'Crea tu primera cuenta operativa para empezar a ordenar liquidez, bancos y patrimonio.'
              }
              action={
                query.trim() || currencyFilter !== 'all' || typeFilter !== 'all' || bankFilter !== 'all' || statusFilter !== 'all' || showTechnicalAccounts
                  ? {
                      label: 'Limpiar filtros',
                      onClick: () => {
                        setQuery('')
                        setCurrencyFilter('all')
                        setTypeFilter('all')
                        setBankFilter('all')
                        setStatusFilter('all')
                        setShowTechnicalAccounts(false)
                      },
                    }
                  : {
                      label: 'Nuevo portafolio',
                      onClick: openCreateModal,
                    }
              }
            />
          </div>
        ) : viewMode === 'list' ? (
          <DataTable className="overflow-hidden">
            <div className="hidden border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 md:grid md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.15fr)_minmax(170px,0.9fr)_auto] md:items-center md:gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                Cuenta
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                Banco y tipo
              </p>
              <p className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                Saldo
              </p>
              <p className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                Acciones
              </p>
            </div>

            <div className="divide-y divide-[var(--c-border)]">
              {filteredAccounts.map(account => {
                const technical = isTechnicalAccount(account)
                const currencyPresentation = getPortfolioCurrencyPresentation(account.currency, currencies)

                return (
                <article
                  key={account.id}
                  data-testid={`portfolio-row-${account.id}`}
                  className="group px-4 py-4 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--c-surface-2)]"
                >
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.15fr)_minmax(170px,0.9fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border"
                          style={{
                            borderColor: withAlpha(account.color, '24'),
                            backgroundColor: withAlpha(account.color, '12'),
                            color: account.color,
                          }}
                        >
                          <FinancialIcon name={account.icon} size={16} />
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                              {account.name}
                            </p>
                            <p className="mt-1 truncate text-[12px] text-[var(--c-text-muted)]">
                              {technical
                                ? 'Cuenta técnica para consumos de tarjeta'
                                : getIconLabel(account.icon)}
                              {account.notes && !technical ? ` · ${account.notes}` : ''}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={account.is_active ? 'success' : 'muted'}>
                              {account.is_active ? 'Activa' : 'Inactiva'}
                            </StatusBadge>
                            <StatusBadge tone={ACCOUNT_TYPE_TONE[account.type]} dot={false}>
                              {ACCOUNT_TYPE_LABEL[account.type]}
                            </StatusBadge>
                            <StatusBadge tone="muted" dot={false}>
                              {currencyPresentation.code}
                              {currencyPresentation.kind === 'custom'
                                ? ' · Personalizada'
                                : currencyPresentation.kind === 'unavailable'
                                  ? ' · Código registrado'
                                  : ''}
                            </StatusBadge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--c-text)]">
                        {getPortfolioBankDisplayName(account)}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
                        {technical
                          ? 'Excluida del patrimonio. Línea y disponible en Créditos.'
                          : account.include_in_net_worth
                            ? 'Incluida en patrimonio neto'
                            : 'Excluida del patrimonio neto'}
                      </p>
                    </div>

                    <AmountCell
                      label={technical ? 'Cuenta técnica' : 'Saldo actual'}
                      value={technical ? 'No patrimonial' : formatPortfolioAmount(account.balance, account.currency, currencies)}
                      meta={
                        technical
                          ? (
                              <Link href="/credits" className="font-medium text-[var(--c-primary)] hover:text-[var(--c-primary-hover)]">
                                Gestionar en Créditos
                              </Link>
                            )
                          : editingId === account.id
                          ? 'En edicion'
                          : account.is_active
                            ? 'Disponible para operar'
                            : 'Archivada para nuevos registros'
                      }
                      tone={balanceTone(account.balance)}
                      className="md:justify-self-end"
                    />

                    <div className="flex shrink-0 items-center gap-1.5 md:justify-self-end">
                      <ActionIconButton
                        onClick={() => startEdit(account)}
                        disabled={saving || loading || rowActionId !== null}
                        testId={`portfolio-edit-${account.id}`}
                        icon="edit"
                        label="Editar portafolio"
                      />
                      {account.is_active ? (
                        <ActionIconButton
                          onClick={() => openDeactivateModal(account)}
                          disabled={saving || loading || rowActionId !== null}
                          testId={`portfolio-deactivate-${account.id}`}
                          icon="deactivate"
                          label="Desactivar portafolio"
                          variant="danger"
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void reactivate(account.id)}
                          disabled={saving || loading || rowActionId !== null}
                          testId={`portfolio-reactivate-${account.id}`}
                          icon="reactivate"
                          label="Reactivar portafolio"
                          variant="success"
                        />
                      )}
                      <ActionIconButton
                        onClick={() => openDeleteModal(account)}
                        disabled={saving || loading || rowActionId !== null}
                        testId={`portfolio-delete-${account.id}`}
                        icon="delete"
                        label="Eliminar portafolio"
                        variant="danger"
                      />
                    </div>
                  </div>
                </article>
                )
              })}
            </div>
          </DataTable>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAccounts.map(account => {
              const technical = isTechnicalAccount(account)
              const currencyPresentation = getPortfolioCurrencyPresentation(account.currency, currencies)

              return (
              <article
                key={account.id}
                data-testid={`portfolio-card-${account.id}`}
                className="group overflow-hidden rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[0_18px_44px_color-mix(in_srgb,var(--c-shadow)_7%,transparent)] transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[var(--c-border-hover)] hover:shadow-[0_22px_54px_color-mix(in_srgb,var(--c-shadow)_12%,transparent)]"
              >
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: withAlpha(account.color, '80') }}
                />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                        style={{
                          borderColor: withAlpha(account.color, '28'),
                          backgroundColor: withAlpha(account.color, '12'),
                          color: account.color,
                        }}
                      >
                        <FinancialIcon name={account.icon} size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                          {account.name}
                        </p>
                        <p className="mt-1 truncate text-[12px] text-[var(--c-text-muted)]">
                          {getPortfolioBankDisplayName(account)}
                        </p>
                      </div>
                    </div>

                    <StatusBadge tone={account.is_active ? 'success' : 'muted'} className="shrink-0">
                      {account.is_active ? 'Activa' : 'Inactiva'}
                    </StatusBadge>
                  </div>

                  <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                        {technical ? 'Cuenta técnica' : 'Saldo actual'}
                      </p>
                      <p className={`mt-2 truncate font-mono text-[1.45rem] font-semibold tracking-[-0.03em] tabular-nums ${
                        account.balance < 0 && !technical ? 'text-[var(--c-danger)]' : 'text-[var(--c-text)]'
                      }`}>
                        {technical ? 'No patrimonial' : formatPortfolioAmount(account.balance, account.currency, currencies)}
                      </p>
                      {technical ? (
                        <Link href="/credits" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--c-primary)] hover:text-[var(--c-primary-hover)]">
                          Gestionar en Créditos
                        </Link>
                      ) : null}
                    </div>
                    <div className="rounded-[12px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-2.5 py-2 text-right">
                      <p className="text-[10px] font-medium text-[var(--c-text-faint)]">Moneda</p>
                      <p className="mt-1 text-[12px] font-semibold text-[var(--c-text)]">{currencyPresentation.code}</p>
                      {currencyPresentation.kind !== 'standard' ? (
                        <p className="mt-0.5 text-[9px] font-medium text-[var(--c-text-muted)]">
                          {currencyPresentation.kind === 'custom' ? 'Personalizada' : 'Código registrado'}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {technical ? (
                    <div className="mt-4 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
                      <p className="text-[11px] leading-5 text-[var(--c-text-muted)]">
                        La línea, el cupo usado y el crédito disponible se controlan desde el módulo Créditos.
                      </p>
                    </div>
                  ) : (
                    <PortfolioPositionComparison account={account} currencies={currencies} />
                  )}
                </div>

                <div className="border-t border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[11px] text-[var(--c-text-muted)]">
                      {technical
                        ? 'Cuenta técnica, fuera del patrimonio'
                        : account.include_in_net_worth
                          ? 'Incluida en patrimonio neto'
                          : 'Fuera del patrimonio neto'}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ActionIconButton
                        onClick={() => startEdit(account)}
                        disabled={saving || loading || rowActionId !== null}
                        testId={`portfolio-edit-card-${account.id}`}
                        icon="edit"
                        label="Editar portafolio"
                      />
                      {account.is_active ? (
                        <ActionIconButton
                          onClick={() => openDeactivateModal(account)}
                          disabled={saving || loading || rowActionId !== null}
                          testId={`portfolio-deactivate-card-${account.id}`}
                          icon="deactivate"
                          label="Desactivar portafolio"
                          variant="danger"
                        />
                      ) : (
                        <ActionIconButton
                          onClick={() => void reactivate(account.id)}
                          disabled={saving || loading || rowActionId !== null}
                          testId={`portfolio-reactivate-card-${account.id}`}
                          icon="reactivate"
                          label="Reactivar portafolio"
                          variant="success"
                        />
                      )}
                      <ActionIconButton
                        onClick={() => openDeleteModal(account)}
                        disabled={saving || loading || rowActionId !== null}
                        testId={`portfolio-delete-card-${account.id}`}
                        icon="delete"
                        label="Eliminar portafolio"
                        variant="danger"
                      />
                    </div>
                  </div>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </PageLayout>

      <RecordModal
        open={modalOpen}
        onClose={closeModal}
        eyebrow="Portafolio"
        title={editingId ? 'Editar cuenta del portafolio' : 'Nueva cuenta del portafolio'}
        subtitle="Registra cuentas, custodios y productos financieros desde una sola capa de edicion."
        widthClassName={editingId
          ? 'w-[calc(100vw-32px)] max-w-[680px]'
          : 'w-[calc(100vw-32px)] max-w-[640px]'}
      >
        <form
          onSubmit={handleSubmit}
          data-testid="portfolio-form"
          className="flex flex-col gap-4"
        >
          {error ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
            </div>
          ) : null}

          <FormSection
            title="Cuenta principal"
            description="Primero define el nombre y el tipo de cuenta para que FinTrack la ubique correctamente en tu portafolio."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre de la cuenta">
              <input
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                required
                data-testid="portfolio-name-input"
                className="field-base ft-form-input w-full"
                placeholder="Ej: Cuenta corriente BCP"
              />
            </FormField>

            <FormField
              label="Tipo"
              description={
                editingAccount?.type === 'CREDIT_CARD'
                  ? 'La tarjeta conserva su identidad técnica. Para otro uso, crea una cuenta nueva.'
                  : editingAccount
                    ? 'Puedes ajustar el tipo operativo, pero no convertir esta cuenta en tarjeta.'
                    : undefined
              }
            >
              <AppSelect
                value={form.type}
                onChange={handleSelectAccountType}
                testId="portfolio-type-select"
                options={ACCOUNT_TYPE_OPTIONS.map(option => ({
                  value: option.value,
                  label: option.label,
                  disabled: editingAccount
                    ? crossesTechnicalAccountBoundary(editingAccount.type, option.value)
                    : false,
                }))}
              />
            </FormField>

            <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border"
                  style={{
                    borderColor: withAlpha(form.color, '24'),
                    backgroundColor: withAlpha(form.color, '12'),
                    color: form.color,
                  }}
                >
                  <FinancialIcon name={form.icon} size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
                    {form.name.trim() || 'Nueva cuenta del portafolio'}
                  </p>
                  <p className="mt-1 truncate text-[12px] text-[var(--ft-form-muted)]">
                    {selectedBankLabel} · {ACCOUNT_TYPE_LABEL[form.type]} · {form.currency}
                  </p>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Contexto financiero"
            description="Asocia la entidad, fija la moneda y define el saldo base con su fecha de corte para mantener la trazabilidad financiera."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField
              label="Entidad financiera"
              optional
              description={
                banksError
                  ? 'El catálogo bancario no está disponible. No se puede cambiar ni verificar esta asociación hasta reintentar la carga.'
                  : undefined
              }
            >
              <AppSelect
                value={form.bank_entity_id}
                onChange={handleSelectBank}
                className="w-full"
                disabled={!dataState.banksAvailable}
                testId="portfolio-bank-entity-select"
                searchPlaceholder="Buscar entidad..."
                options={[
                  { value: '', label: 'Sin banco' },
                  ...banks.map(bank => ({
                    value: bank.id,
                    label: bank.name ?? bank.short_name ?? 'Entidad sin nombre',
                  })),
                ]}
              />
            </FormField>

            <FormField
              label="Moneda"
              description={
                currenciesError
                  ? 'El catálogo de monedas no está disponible. Los códigos existentes se conservan, pero no se puede elegir una moneda nueva.'
                  : !editingAccount && !currenciesLoading && currencyOptions.length === 0
                    ? 'No hay monedas disponibles para registrar una cuenta.'
                    : editingAccount
                  ? 'La moneda se fijó al crear la cuenta. Crea otra cuenta para usar una moneda distinta.'
                  : undefined
              }
            >
              <AppSelect
                value={form.currency}
                onChange={value => setForm(prev => ({ ...prev, currency: value as CurrencyCode }))}
                testId="portfolio-currency-select"
                disabled={!dataState.currenciesAvailable || Boolean(editingAccount) || currencyOptions.length === 0}
                searchable={false}
                options={[
                  ...currencyOptions,
                  ...(
                    !editingAccount || currencyOptions.some(option => option.value === form.currency)
                      ? []
                      : [{ value: form.currency, label: form.currency }]
                  ),
                ]}
              />
            </FormField>

            <FormField
              label={formIsTechnicalAccount ? 'Saldo técnico' : 'Saldo inicial'}
              description={
                formIsTechnicalAccount
                  ? 'Las tarjetas no tienen saldo patrimonial en Portafolio. El cupo, uso y disponible se gestionan en Créditos.'
                  : editingId
                  ? 'Corrige el saldo de apertura y la fecha desde la que ese valor representa el punto de partida de la cuenta.'
                  : 'Usalo para reflejar el punto de partida exacto antes de comenzar a registrar movimientos.'
              }
            >
              <NumericInput
                step="0.01"
                decimals={2}
                value={formIsTechnicalAccount ? '0.00' : form.initial_balance}
                onValueChange={value => setForm(prev => ({ ...prev, initial_balance: value }))}
                disabled={formIsTechnicalAccount}
                data-testid="portfolio-initial-balance-input"
                className="field-base ft-form-amount-input w-full"
              />
            </FormField>

            <FormField
              label="Fecha del saldo inicial"
              description={
                editingId
                  ? 'Debe ser igual o anterior al primer movimiento registrado en esta cuenta.'
                  : 'Usaremos esta fecha como corte del saldo base para reconstruir el historial correctamente.'
              }
            >
              <input
                type="date"
                value={form.initial_balance_date}
                onChange={event => setForm(prev => ({ ...prev, initial_balance_date: event.target.value }))}
                data-testid="portfolio-initial-balance-date-input"
                className="field-base ft-form-input w-full"
              />
            </FormField>

            {editingId ? (
              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">
                  {formIsTechnicalAccount ? 'Lectura técnica' : 'Saldo actual'}
                </p>
                <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-text)] tabular-nums">
                  {formIsTechnicalAccount
                    ? 'No patrimonial'
                    : editingAccount
                      ? formatPortfolioAmount(editingAccount.balance, editingAccount.currency, currencies)
                      : '--'}
                </p>
                <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  {formIsTechnicalAccount
                    ? 'Esta cuenta solo permite registrar consumos de tarjeta. La línea disponible vive en Créditos.'
                    : 'El saldo operativo vigente se recalculará usando la nueva base de apertura, sin perder la referencia del valor actual.'}
                </p>
              </div>
            ) : null}

            {!editingId ? (
              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Lectura inicial</p>
                <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-text)] tabular-nums">
                  {formInitialBalanceValue}
                </p>
                <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  {form.include_in_net_worth
                    ? 'Esta cuenta entrará al patrimonio neto desde su saldo de apertura.'
                    : formIsTechnicalAccount
                      ? 'Esta tarjeta se registrará como cuenta técnica fuera del patrimonio.'
                      : 'Esta cuenta se registrará fuera del patrimonio neto inicial.'}
                </p>
              </div>
            ) : null}
          </FormSection>

          <OptionalSection
            title="Más opciones"
            summary={[
              formIsTechnicalAccount
                ? 'Cuenta técnica'
                : form.include_in_net_worth ? 'Incluida en patrimonio' : 'Fuera de patrimonio',
              form.notes.trim() ? 'Notas' : '',
            ]}
          >
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={formIsTechnicalAccount ? false : form.include_in_net_worth}
                  disabled={formIsTechnicalAccount}
                  onChange={event => setForm(prev => ({ ...prev, include_in_net_worth: event.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--c-border)] text-[var(--c-primary)] focus:ring-[var(--c-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="space-y-1">
                  <span className="block text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
                    Incluir en patrimonio neto
                  </span>
                  <span className="block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                    {formIsTechnicalAccount
                      ? 'Las tarjetas se excluyen del patrimonio. Su cupo disponible se muestra en Créditos.'
                      : 'Actívalo si esta cuenta debe formar parte de la lectura patrimonial consolidada.'}
                  </span>
                </span>
              </label>

              <FormField label="Notas" optional>
                <textarea
                  value={form.notes}
                  onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                  className="field-base ft-form-textarea w-full resize-y"
                  placeholder="Ej: Cuenta para gastos operativos"
                />
              </FormField>
            </div>
          </OptionalSection>

          <OptionalSection title="Apariencia" summary={['Color', 'Icono']}>
            <div className="space-y-4">
              <FormField label="Color" optional>
                <ColorSwatchPicker
                  value={form.color}
                  onChange={color => setForm(prev => ({ ...prev, color }))}
                  palette={ACCOUNT_COLOR_OPTIONS}
                  wrapperTestId="portfolio-color-options"
                  swatchTestIdPrefix="portfolio-color"
                  customInputTestId="portfolio-color-picker"
                />
              </FormField>

              <FormField label="Icono" optional>
                <IconGridPicker
                  value={form.icon}
                  onChange={icon => setForm(prev => ({ ...prev, icon }))}
                  options={ACCOUNT_ICON_OPTIONS}
                  wrapperTestId="portfolio-icon-input"
                  optionTestIdPrefix="portfolio-icon-option"
                />
              </FormField>
            </div>
          </OptionalSection>

          <RecordModalFooter>
            <FormActions
              secondaryAction={(
                <Button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  variant="secondary"
                  size="lg"
                >
                  Cancelar
                </Button>
              )}
              primaryAction={(
                <Button
                  type="submit"
                  disabled={
                    saving
                    || loading
                    || banksLoading
                    || currenciesLoading
                    || (!editingAccount && !canCreateWithAvailableCurrency)
                    || (Boolean(banksError) && Boolean(form.bank_entity_id))
                  }
                  loading={saving}
                  testId="portfolio-submit-button"
                  variant="primary"
                  size="lg"
                >
                  {editingId ? 'Guardar cambios' : 'Crear portafolio'}
                </Button>
              )}
            />
          </RecordModalFooter>
        </form>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDeactivateAccount)}
        title="Desactivar portafolio"
        message={(
          <>
            El portafolio{' '}
            <span className="font-semibold text-[var(--c-text)]">
              {pendingDeactivateAccount?.name}
            </span>{' '}
            dejara de aparecer para nuevos registros operativos.
          </>
        )}
        onCancel={() => {
          if (rowActionId !== null) return
          setPendingDeactivateAccount(null)
        }}
        onConfirm={() => {
          if (!pendingDeactivateAccount) return
          void deactivate(pendingDeactivateAccount.id)
        }}
        loading={pendingDeactivateAccount ? rowActionId === pendingDeactivateAccount.id : false}
        danger
        confirmLabel="Desactivar"
        testId="portfolio-deactivate-modal"
        cancelTestId="portfolio-deactivate-cancel-button"
        confirmTestId="portfolio-deactivate-confirm-button"
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteAccount)}
        title="Eliminar portafolio"
        message={(
          <>
            Se eliminara{' '}
            <span className="font-semibold text-[var(--c-text)]">
              {pendingDeleteAccount?.name}
            </span>
            . Si tiene transacciones asociadas, la operacion sera bloqueada.
          </>
        )}
        onCancel={() => {
          if (rowActionId !== null) return
          setPendingDeleteAccount(null)
        }}
        onConfirm={() => {
          if (!pendingDeleteAccount) return
          void deleteAccount(pendingDeleteAccount)
        }}
        loading={pendingDeleteAccount ? rowActionId === pendingDeleteAccount.id : false}
        danger
        confirmLabel="Eliminar"
        testId="portfolio-delete-modal"
        cancelTestId="portfolio-delete-cancel-button"
        confirmTestId="portfolio-delete-confirm-button"
      />
    </>
  )
}
