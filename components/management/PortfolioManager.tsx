'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AccountType, CurrencyCode } from '@/types/database.types'
import { useToast } from '@/lib/toast/toast'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { FieldWrapper, Textarea } from '@/components/forms/TransactionForm/FormFields'
import { IncomeDatePicker } from '@/components/forms/TransactionForm/IncomeDatePicker'
import incomeStyles from '@/components/forms/TransactionForm/IncomeTransactionForm.module.css'
import { FinancialIcon } from '@/components/ui/FinancialIcon'
import { ColorSwatchPicker, IconGridPicker } from '@/components/ui/VisualPickers'
import { ACCOUNT_COLOR_OPTIONS, ACCOUNT_ICON_OPTIONS } from '@/lib/constants/visual-options'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { AnchoredActionMenu, type AnchoredAction } from '@/components/ui/AnchoredActionMenu'
import { AppSelect } from '@/components/ui/AppSelect'
import { NumericInput } from '@/components/ui/NumericInput'
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { AccountBalanceSparkline } from '@/components/management/AccountBalanceSparkline'
import styles from '@/components/tables/TransactionsRound07.module.css'
import formStyles from './PortfolioAccountForm.module.css'
import { listCurrenciesAction } from '@/app/actions/admin.actions'
import {
  ConfirmDialog,
  DataErrorBanner,
  DataSearchField,
  DataTable,
  EmptyState,
  PageLayout,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'
import {
  crossesTechnicalAccountBoundary,
  getAccountIdentityViolation,
} from '@/modules/portfolio/account-identity'
import { requestPortfolioMutation } from '@/modules/portfolio/account-mutation-timeout'
import { filterPortfolioAccounts } from '@/modules/portfolio/account-view-filters'
import {
  formatPortfolioAmount,
  getPortfolioCurrencyPresentation,
  groupPortfolioBalancesByCurrency,
} from '@/modules/portfolio/currency-display'
import {
  getPortfolioBankDisplayName,
  getPortfolioReferenceDataState,
  resolveCreateAccountCurrency,
} from '@/modules/portfolio/reference-data-state'
import type { AccountMonthlyHistory } from '@/modules/portfolio/account-monthly-history'

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
  'No se pudieron cargar las cuentas. Reintenta para recuperar la información.'
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

function AccountInfoHint({ label, children }: { label: string; children: string }) {
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const lastInputRef = useRef<'mouse' | 'touch' | 'keyboard'>('mouse')
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const margin = 12
    const gap = 8
    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const left = Math.min(
      Math.max(margin, window.innerWidth - tooltipRect.width - margin),
      Math.max(margin, triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2),
    )
    const spaceAbove = triggerRect.top - margin
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin
    const placeAbove = spaceAbove >= tooltipRect.height + gap || spaceAbove > spaceBelow
    const top = placeAbove
      ? Math.max(margin, triggerRect.top - tooltipRect.height - gap)
      : Math.min(window.innerHeight - tooltipRect.height - margin, triggerRect.bottom + gap)

    setPosition(previous => previous?.left === left && previous.top === top ? previous : { left, top })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open])

  const triggerIsV3 = Boolean(triggerRef.current?.closest('[data-ft-v3], [data-ft-v3-shell]'))

  return (
    <span className={formStyles.infoHint}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        className={formStyles.infoHintTrigger}
        onPointerDown={event => {
          lastInputRef.current = event.pointerType === 'touch' ? 'touch' : 'mouse'
        }}
        onPointerEnter={event => {
          if (event.pointerType !== 'mouse') return
          lastInputRef.current = 'mouse'
          setOpen(true)
        }}
        onPointerLeave={event => {
          if (event.pointerType === 'mouse' && lastInputRef.current === 'mouse') setOpen(false)
        }}
        onFocus={event => {
          if (lastInputRef.current === 'touch') return
          lastInputRef.current = event.currentTarget.matches(':focus-visible') ? 'keyboard' : 'mouse'
          setOpen(true)
        }}
        onBlur={() => {
          if (lastInputRef.current === 'keyboard') setOpen(false)
        }}
        onKeyDown={event => {
          if (event.key !== 'Escape') lastInputRef.current = 'keyboard'
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          }
        }}
        onClick={event => {
          if (event.detail > 0 && lastInputRef.current === 'touch') setOpen(value => !value)
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 7.1v3.7M8 5.2h.01" />
        </svg>
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={formStyles.infoTooltip}
          data-ft-v3={triggerIsV3 ? '' : undefined}
          style={{
            left: position?.left ?? 12,
            top: position?.top ?? 12,
            visibility: position ? 'visible' : 'hidden',
          }}
        >
          {children}
        </span>,
        document.body,
      ) : null}
    </span>
  )
}

function AccountFormField({
  label,
  help,
  note,
  optional = false,
  className = '',
  children,
}: {
  label: string
  help?: string
  note?: string
  optional?: boolean
  className?: string
  children: (labelId: string) => ReactNode
}) {
  const labelId = useId()

  return (
    <div className={`flex min-w-0 flex-col gap-[var(--ft-form-label-gap)] ${className}`.trim()}>
      <div className="flex min-h-6 items-center gap-1.5">
        <span id={labelId} className="text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--ft-text-strong)]">
          {label}
          {optional ? <span className="ml-2 text-[12px] font-medium text-[var(--ft-form-muted)]">Opcional</span> : null}
        </span>
        {help ? <AccountInfoHint label={`Ayuda sobre ${label.toLowerCase()}`}>{help}</AccountInfoHint> : null}
      </div>
      <div className="min-w-0">{children(labelId)}</div>
      {note ? <p role="status" className="text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">{note}</p> : null}
    </div>
  )
}

function withAlpha(color: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color
}

function getPortfolioInstitutionMark(account: AccountItem): string {
  const shortName = account.bank_entity?.short_name?.trim()
  const source = shortName || getPortfolioBankDisplayName(account)
  if (source === 'Sin banco') {
    return account.type === 'CASH' ? 'EF' : account.name.trim().slice(0, 2).toUpperCase()
  }

  return source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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

function formatStoredPortfolioDate(value: string | null) {
  if (!value) return 'Fecha no disponible'

  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

  return date
    .toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '')
}

function PortfolioOpeningFact({
  account,
  currencies,
}: {
  account: AccountItem
  currencies: readonly UserCurrencyItem[]
}) {
  return (
    <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
      <p className="text-[11px] leading-4 text-[var(--ft-text-muted)]">Saldo de apertura</p>
      <p className="text-right text-[11px] leading-4 text-[var(--ft-text-muted)]">{formatStoredPortfolioDate(account.initial_balance_date)}</p>
      <p className="min-w-0 break-words text-[13px] font-semibold leading-5 tabular-nums text-[var(--ft-text-strong)] [overflow-wrap:anywhere]">
        {formatPortfolioAmount(account.initial_balance, account.currency, currencies)}
      </p>
      <p className="self-end whitespace-nowrap text-right text-[10px] leading-4 text-[var(--ft-text-faint)]">
        {account.include_in_net_worth ? 'Incluida en cuentas' : 'Fuera del cálculo'}
      </p>
    </div>
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
  const [dateInputError, setDateInputError] = useState<string | null>(null)
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const accountAdditionalOptionsId = useId()
  const [accountAdditionalOptionsOpen, setAccountAdditionalOptionsOpen] = useState({
    notes: false,
    color: false,
    icon: false,
  })
  const [query, setQuery] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [bankFilter, setBankFilter] = useState<string>('all')
  const [showTechnicalAccounts, setShowTechnicalAccounts] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [monthlyHistories, setMonthlyHistories] = useState<Record<string, AccountMonthlyHistory>>({})
  const [monthlyHistoriesLoading, setMonthlyHistoriesLoading] = useState(false)
  const [monthlyHistoriesUnavailable, setMonthlyHistoriesUnavailable] = useState(false)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDeactivateAccount, setPendingDeactivateAccount] = useState<AccountItem | null>(null)
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<AccountItem | null>(null)
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(null)

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

  useEffect(() => {
    if (viewMode !== 'cards' || loading || accountsError || accounts.length === 0) {
      setMonthlyHistoriesLoading(false)
      return
    }

    const controller = new AbortController()
    setMonthlyHistoriesLoading(true)
    setMonthlyHistoriesUnavailable(false)

    void (async () => {
      try {
        const response = await fetchWithTimeout('/api/accounts/monthly-history', {
          cache: 'no-store',
          signal: controller.signal,
          timeoutMs: CLIENT_FETCH_TIMEOUT_MS,
          timeoutMessage: 'No se pudieron cargar los cierres mensuales.',
        })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.ok || !json.data?.histories) {
          throw new Error('No se pudieron verificar los cierres mensuales.')
        }
        setMonthlyHistories(json.data.histories as Record<string, AccountMonthlyHistory>)
      } catch {
        if (!controller.signal.aborted) {
          setMonthlyHistories({})
          setMonthlyHistoriesUnavailable(true)
        }
      } finally {
        if (!controller.signal.aborted) setMonthlyHistoriesLoading(false)
      }
    })()

    return () => controller.abort()
  }, [accounts, accountsError, loading, viewMode])

  const resetForm = useCallback(() => {
    setForm({
      ...EMPTY_FORM,
      initial_balance_date: isoToday(),
    })
    setDateInputError(null)
    setAccountAdditionalOptionsOpen({ notes: false, color: false, icon: false })
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

  const activeCount = activeOperationalAccounts.length
  const allOperationalCount = operationalAccounts.length
  const inactiveCount = operationalAccounts.length - activeCount
  const technicalCount = technicalAccounts.length

  const totalBalanceByCurrency = useMemo(() => {
    return groupPortfolioBalancesByCurrency(activeOperationalAccounts)
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

  const otherCurrencyTotals = useMemo(
    () => [...totalBalanceByCurrency.entries()]
      .filter(([currency]) => currency !== 'PEN' && currency !== 'USD')
      .sort(([a], [b]) => a.localeCompare(b)),
    [totalBalanceByCurrency],
  )

  const filteredAccounts = useMemo(() => {
    return filterPortfolioAccounts(accounts, {
      query,
      currency: currencyFilter,
      type: typeFilter,
      status: statusFilter,
      bank: bankFilter,
      technical: showTechnicalAccounts,
    }, ACCOUNT_TYPE_LABEL)
  }, [accounts, bankFilter, currencyFilter, query, showTechnicalAccounts, statusFilter, typeFilter])

  const openCreateModal = useCallback(() => {
    setEditingId(null)
    setDateInputError(null)
    setAccountAdditionalOptionsOpen({ notes: false, color: false, icon: false })
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

  useEffect(() => {
    if (!modalOpen || editingId !== null || currencyOptions.length === 0) return
    setForm(previous => {
      const currency = resolveCreateAccountCurrency(previous.currency, currencyOptions)
      return currency === previous.currency ? previous : { ...previous, currency }
    })
  }, [currencyOptions, editingId, modalOpen])

  const startEdit = useCallback((account: AccountItem) => {
    setEditingId(account.id)
    setDateInputError(null)
    setAccountAdditionalOptionsOpen({ notes: false, color: false, icon: false })
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
      setDateInputError(message)
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
        editingId ? 'Cuenta actualizada' : 'Cuenta registrada',
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
      toast.success('Cuenta desactivada', undefined, { persist: false })
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
      toast.success('Cuenta reactivada', undefined, { persist: false })
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
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar la cuenta'))
      }

      await loadAccounts()
      setPendingDeleteAccount(null)
      toast.success('Cuenta eliminada', undefined, { persist: false })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo eliminar la cuenta'
      setError(message)
      toast.error('No se pudo eliminar', message)
    } finally {
      setRowActionId(null)
    }
  }, [loadAccounts, loading, rowActionId, saving, toast])

  const formIsTechnicalAccount = form.type === 'CREDIT_CARD'

  const editingAccount = useMemo(
    () => (editingId ? accounts.find(account => account.id === editingId) ?? null : null),
    [accounts, editingId],
  )
  const accountAdditionalOptions = [
    { key: 'notes' as const, label: 'Notas', hasValue: Boolean(form.notes.trim()), hasError: false },
    {
      key: 'color' as const,
      label: 'Color',
      hasValue: Boolean(editingAccount?.color) || form.color !== EMPTY_FORM.color,
      hasError: false,
    },
    {
      key: 'icon' as const,
      label: 'Icono',
      hasValue: Boolean(editingAccount?.icon) || form.icon !== EMPTY_FORM.icon,
      hasError: false,
    },
  ]
  const viewingAccount = useMemo(
    () => (viewingAccountId ? accounts.find(account => account.id === viewingAccountId) ?? null : null),
    [accounts, viewingAccountId],
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
  const canCreateWithAvailableCurrency = Boolean(currencyOptions.length) && dataState.currenciesAvailable
  const createFormCurrencyIsAvailable = currencyOptions.some(option => option.value === form.currency)

  return (
    <>
      <PageLayout
        className="max-w-none !gap-0"
        header={
          <div className={styles.pageOverview} data-testid="portfolio-page-overview">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">
                  Cuentas
                </h1>
                <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">
                  Cada saldo en su moneda. Cada cuenta con su propósito.
                </p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                <CreateModuleButton
                  onClick={openCreateModal}
                  label="Añadir cuenta"
                  className={`${styles.v3ModulePrimaryAction} w-full sm:w-auto`}
                  testId="portfolio-create-button"
                />
              </div>
            </header>
            <section
              aria-label="Saldos por moneda"
              className={styles.summary}
            >
              <div className={styles.summaryItem}>
                <p>Saldos en soles</p>
                <div className={`${styles.summaryValue} tabular-nums`}>
                  {!accountsSummaryAvailable ? loading ? 'Cargando…' : 'No disponible' : totalBalanceByCurrency.has('PEN') ? formatPortfolioAmount(totalBalanceByCurrency.get('PEN')!, 'PEN', currencies) : '—'}
                </div>
                <span className={styles.summaryDetail}>
                  {accountsSummaryAvailable
                    ? `${activeOperationalAccounts.filter(account => account.currency === 'PEN').length} cuenta${activeOperationalAccounts.filter(account => account.currency === 'PEN').length === 1 ? '' : 's'} activa${activeOperationalAccounts.filter(account => account.currency === 'PEN').length === 1 ? '' : 's'}`
                    : loading ? 'Cargando cuentas…' : 'Totales no disponibles'}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <p>Saldos en dólares</p>
                <div className={`${styles.summaryValue} tabular-nums`}>
                  {!accountsSummaryAvailable ? loading ? 'Cargando…' : 'No disponible' : totalBalanceByCurrency.has('USD') ? formatPortfolioAmount(totalBalanceByCurrency.get('USD')!, 'USD', currencies) : '—'}
                </div>
                <span className={styles.summaryDetail}>
                  {accountsSummaryAvailable
                    ? `${activeOperationalAccounts.filter(account => account.currency === 'USD').length} cuenta${activeOperationalAccounts.filter(account => account.currency === 'USD').length === 1 ? '' : 's'} activa${activeOperationalAccounts.filter(account => account.currency === 'USD').length === 1 ? '' : 's'}`
                    : loading ? 'Cargando cuentas…' : 'Totales no disponibles'}
                </span>
              </div>
              <div className={`${styles.summaryItem} ${styles.summaryQualitative}`}>
                <p>Registro separado</p>
                <div className={styles.summaryValue}>Sin consolidar monedas</div>
                <span className={styles.summaryDetail}>El crédito disponible no es un saldo propio</span>
                {accountsSummaryAvailable && otherCurrencyTotals.length > 0 ? (
                  <span className={styles.summaryDetailList}>
                    {otherCurrencyTotals.map(([currency, total]) => (
                      <span key={currency} className="tabular-nums">{formatPortfolioAmount(total, currency, currencies)}</span>
                    ))}
                  </span>
                ) : null}
              </div>
            </section>
          </div>
        }
        controls={(
          <div className={`${styles.portfolioControls} min-w-0`}>
            <div role="group" aria-label="Tipo de cuenta" className={`${styles.tabs} flex min-w-0 items-center overflow-x-auto`}>
              <button type="button" aria-pressed={!showTechnicalAccounts && statusFilter === 'all'} onClick={() => { setShowTechnicalAccounts(false); setStatusFilter('all') }} className={`shrink-0 border-b-2 px-0 text-[12px] font-semibold transition-colors ${!showTechnicalAccounts && statusFilter === 'all' ? 'border-[var(--ft-primary)] text-[var(--ft-primary)]' : 'border-transparent text-[var(--ft-text-muted)] hover:text-[var(--ft-text-strong)]'}`}>
                Todas <span className="ml-1.5 text-[10px] font-medium text-[var(--ft-text-faint)]">{allOperationalCount}</span>
              </button>
              <button type="button" aria-pressed={!showTechnicalAccounts && statusFilter === 'active'} onClick={() => { setShowTechnicalAccounts(false); setStatusFilter('active') }} className={`shrink-0 border-b-2 px-0 text-[12px] font-semibold transition-colors ${!showTechnicalAccounts && statusFilter === 'active' ? 'border-[var(--ft-primary)] text-[var(--ft-primary)]' : 'border-transparent text-[var(--ft-text-muted)] hover:text-[var(--ft-text-strong)]'}`}>
                Activas <span className="ml-1.5 text-[10px] font-medium text-[var(--ft-text-faint)]">{activeCount}</span>
              </button>
              <button type="button" aria-pressed={!showTechnicalAccounts && statusFilter === 'inactive'} onClick={() => { setShowTechnicalAccounts(false); setStatusFilter('inactive') }} className={`shrink-0 border-b-2 px-0 text-[12px] font-semibold transition-colors ${!showTechnicalAccounts && statusFilter === 'inactive' ? 'border-[var(--ft-primary)] text-[var(--ft-primary)]' : 'border-transparent text-[var(--ft-text-muted)] hover:text-[var(--ft-text-strong)]'}`}>
                Inactivas <span className="ml-1.5 text-[10px] font-medium text-[var(--ft-text-faint)]">{inactiveCount}</span>
              </button>
              <button type="button" aria-pressed={showTechnicalAccounts} onClick={() => { setShowTechnicalAccounts(true); setStatusFilter('all') }} className={`shrink-0 border-b-2 px-0 text-[12px] font-semibold transition-colors ${showTechnicalAccounts ? 'border-[var(--ft-primary)] text-[var(--ft-primary)]' : 'border-transparent text-[var(--ft-text-muted)] hover:text-[var(--ft-text-strong)]'}`}>
                Cuentas técnicas <span className="ml-1.5 text-[10px] font-medium text-[var(--ft-text-faint)]">{technicalCount}</span>
              </button>
            </div>

            <div className={`${styles.controls} ${styles.portfolioFilterBar} min-w-0`}>
              <DataSearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar por cuenta o entidad"
                aria-label="Buscar por cuenta o entidad"
                data-testid="portfolio-search-input"
                className={`${styles.searchControl} min-w-0 flex-[1_1_230px]`}
              />
                <AppSelect
                  ariaLabel="Filtrar cuentas por moneda"
                  value={currencyFilter}
                  onChange={value => setCurrencyFilter(value as CurrencyFilter)}
                  className={`${styles.portfolioFilter} ${styles.portfolioFilterCurrency} filters-control`}
                  compact
                  matchTriggerWidth
                  disabled={!dataState.currenciesAvailable}
                  options={[
                    { value: 'all', label: currenciesLoading ? 'Cargando…' : currenciesError ? 'No disponible' : 'Todas' },
                    ...currencyOptions.map(option => ({ value: option.value, label: option.value })),
                  ]}
                  testId="portfolio-currency-filter"
                />
                <AppSelect
                  ariaLabel="Filtrar cuentas por tipo"
                  value={typeFilter}
                  onChange={value => setTypeFilter(value as TypeFilter)}
                  className={`${styles.portfolioFilter} ${styles.portfolioFilterType} filters-control`}
                  compact
                  matchTriggerWidth
                  searchPlaceholder="Buscar tipo…"
                  options={[
                    { value: 'all', label: 'Todos' },
                    ...ACCOUNT_TYPE_OPTIONS.map(option => ({ value: option.value, label: option.label })),
                  ]}
                  testId="portfolio-type-filter"
                />
                <AppSelect
                  ariaLabel="Filtrar cuentas por institución"
                  value={bankFilter}
                  onChange={setBankFilter}
                  className={`${styles.portfolioFilter} ${styles.portfolioFilterInstitution} filters-control col-span-2 lg:col-span-1`}
                  disabled={!dataState.banksAvailable}
                  compact
                  matchTriggerWidth
                  searchPlaceholder="Buscar institución…"
                  options={[
                    { value: 'all', label: banksLoading ? 'Cargando…' : banksError ? 'No disponible' : 'Todas' },
                    { value: 'none', label: 'Sin institución' },
                    ...banks.map(bank => ({ value: bank.id, label: bank.name ?? bank.short_name ?? 'Entidad sin nombre' })),
                  ]}
                  testId="portfolio-institution-filter"
                />
              <div className={styles.controlsActions}>
                <span title="Cambiar vista de las cuentas">
                  <ViewToggle value={viewMode} onChange={setViewMode} id="portfolio-view-toggle" />
                </span>
              </div>
            </div>
          </div>
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
                  : 'Todavía no tienes cuentas registradas.'
              }
              description={
                query.trim() || currencyFilter !== 'all' || typeFilter !== 'all' || bankFilter !== 'all' || statusFilter !== 'all' || showTechnicalAccounts
              ? 'Ajusta los filtros o amplía la búsqueda para encontrar cuentas por institución, tipo o moneda.'
              : 'Añade una cuenta para consultar sus saldos y organizarlos por institución y moneda.'
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
                      label: 'Añadir cuenta',
                      onClick: openCreateModal,
                    }
              }
            />
          </div>
        ) : viewMode === 'list' ? (
          <DataTable className="overflow-hidden rounded-[10px] shadow-none">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-[12px]">
                <colgroup>
                  <col className="w-[27%]" />
                  <col className="w-[15%]" />
                  <col className="w-[9%]" />
                  <col className="w-[19%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="h-[38px] border-b border-[var(--ft-border)] bg-[var(--ft-surface-muted)]">
                    {['Cuenta', 'Tipo', 'Moneda', 'Saldo de apertura', 'Saldo actual', 'Acciones'].map((label, index) => (
                      <th
                        key={label}
                        scope="col"
                        className={`whitespace-nowrap px-3.5 py-2.5 text-[10px] font-semibold text-[var(--ft-text-muted)] ${index === 3 || index === 4 ? 'text-right' : ''} ${index === 5 ? 'text-right' : ''}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ft-border)]">
              {filteredAccounts.map(account => {
                const technical = isTechnicalAccount(account)
                const accountActions: AnchoredAction[] = [
                  ...(account.is_active
                    ? [{ id: 'deactivate', label: 'Desactivar cuenta', destructive: true, onSelect: () => openDeactivateModal(account) }]
                    : [{ id: 'reactivate', label: 'Reactivar cuenta', onSelect: () => void reactivate(account.id) }]),
                  { id: 'delete', label: 'Eliminar cuenta', destructive: true, onSelect: () => openDeleteModal(account) },
                ]

                return (
                <tr
                  key={account.id}
                  data-testid={`portfolio-row-${account.id}`}
                  className="h-[62px] transition-colors hover:bg-[var(--ft-surface-hover)]"
                >
                  <td className="px-3.5 py-2.5">
                    <button
                      type="button"
                      data-testid={`portfolio-detail-${account.id}`}
                      onClick={() => setViewingAccountId(account.id)}
                      className="flex min-w-0 items-center gap-3 text-left"
                      title={account.name}
                    >
                      <span aria-hidden="true" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[7px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[10px] font-bold text-[var(--ft-text-muted)]">
                        {getPortfolioInstitutionMark(account)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold leading-[19px] text-[var(--ft-text-strong)]">{account.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] leading-4 text-[var(--ft-text-muted)]">{getPortfolioBankDisplayName(account)}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3.5 py-2.5 text-[12px] text-[var(--ft-text-strong)]">{ACCOUNT_TYPE_LABEL[account.type]}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="inline-flex rounded-[4px] bg-[var(--ft-surface-muted)] px-[7px] py-[3px] text-[10px] font-semibold leading-4 text-[var(--ft-text-muted)]">{account.currency}</span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">
                    <span className="block whitespace-nowrap text-[12px] leading-[18px] text-[var(--ft-text-muted)]">{technical ? '—' : formatPortfolioAmount(account.initial_balance, account.currency, currencies)}</span>
                    <span className="mt-0.5 block whitespace-nowrap text-[11px] leading-4 text-[var(--ft-text-muted)]">{technical ? 'No aplica' : formatStoredPortfolioDate(account.initial_balance_date)}</span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">
                    {technical ? (
                      <>
                        <span className="block whitespace-nowrap text-[12px] font-semibold leading-[18px] text-[var(--ft-text-muted)]">No patrimonial</span>
                        <Link href="/credits" className="mt-0.5 inline-block text-[11px] leading-4 text-[var(--ft-primary)] hover:underline">Gestionar en Créditos</Link>
                      </>
                    ) : (
                      <span className={`block whitespace-nowrap text-[13px] font-semibold leading-[19px] ${account.balance < 0 ? 'text-[var(--c-danger)]' : 'text-[var(--ft-text-strong)]'}`}>
                        {formatPortfolioAmount(account.balance, account.currency, currencies)}
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(account)}
                        disabled={saving || loading || rowActionId !== null}
                        data-testid={`portfolio-edit-${account.id}`}
                        className="min-h-9 rounded-control px-2.5 text-[11px] font-semibold text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-muted)] hover:text-[var(--ft-text-strong)] disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <div data-testid={`portfolio-actions-${account.id}`}>
                        <AnchoredActionMenu
                          label={`Más acciones para ${account.name}`}
                          disabled={saving || loading || rowActionId !== null}
                          actions={accountActions}
                          align="end"
                          triggerContent={(
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
                            </svg>
                          )}
                          className="grid h-9 w-9 place-items-center rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-muted)] hover:text-[var(--ft-text-strong)]"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                )
              })}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[var(--ft-border)] md:hidden">
              {filteredAccounts.map(account => {
                const technical = isTechnicalAccount(account)
                const accountActions: AnchoredAction[] = [
                  ...(account.is_active
                    ? [{ id: 'deactivate', label: 'Desactivar cuenta', destructive: true, onSelect: () => openDeactivateModal(account) }]
                    : [{ id: 'reactivate', label: 'Reactivar cuenta', onSelect: () => void reactivate(account.id) }]),
                  { id: 'delete', label: 'Eliminar cuenta', destructive: true, onSelect: () => openDeleteModal(account) },
                ]

                return (
                  <article key={account.id} data-testid={`portfolio-mobile-row-${account.id}`} className="px-3.5 py-3.5">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <button type="button" data-testid={`portfolio-detail-mobile-${account.id}`} onClick={() => setViewingAccountId(account.id)} className="flex min-w-0 items-center gap-2.5 text-left">
                        <span aria-hidden="true" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[7px] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] text-[10px] font-bold text-[var(--ft-text-muted)]">{getPortfolioInstitutionMark(account)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold leading-[18px] text-[var(--ft-text-strong)]">{account.name}</span>
                          <span className="mt-0.5 block truncate text-[11px] leading-4 text-[var(--ft-text-muted)]">{getPortfolioBankDisplayName(account)} · {account.currency}</span>
                        </span>
                      </button>
                      <span className="max-w-[44%] shrink-0 whitespace-nowrap pt-1 text-right text-[12px] font-semibold tabular-nums text-[var(--ft-text-strong)]">
                        {technical ? 'No patrimonial' : formatPortfolioAmount(account.balance, account.currency, currencies)}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--ft-border)] pt-2.5">
                      <span className="min-w-0 truncate text-[11px] leading-4 text-[var(--ft-text-muted)]">
                        {ACCOUNT_TYPE_LABEL[account.type]} · {technical ? 'Sin saldo de apertura' : `Apertura ${formatPortfolioAmount(account.initial_balance, account.currency, currencies)} · ${formatStoredPortfolioDate(account.initial_balance_date)}`}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => startEdit(account)} disabled={saving || loading || rowActionId !== null} data-testid={`portfolio-mobile-edit-${account.id}`} className="min-h-9 rounded-control px-2.5 text-[11px] font-semibold text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-muted)] disabled:opacity-50">Editar</button>
                        <div data-testid={`portfolio-actions-${account.id}`}>
                          <AnchoredActionMenu
                            label={`Más acciones para ${account.name}`}
                            disabled={saving || loading || rowActionId !== null}
                            actions={accountActions}
                            align="end"
                            triggerContent={<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>}
                            className="grid h-9 w-9 place-items-center rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-muted)]"
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="flex min-h-[42px] items-center justify-between border-t border-[var(--ft-border)] px-3.5 py-2.5 text-[11px] leading-4 text-[var(--ft-text-muted)]">
              <span>{filteredAccounts.length} cuenta{filteredAccounts.length === 1 ? '' : 's'} visible{filteredAccounts.length === 1 ? '' : 's'}</span>
              <span>Importes sin conversión</span>
            </div>
          </DataTable>
        ) : (
          <div data-testid="portfolio-card-grid" className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredAccounts.map(account => {
              const technical = isTechnicalAccount(account)
              const currencyPresentation = getPortfolioCurrencyPresentation(account.currency, currencies)
              const accountActions: AnchoredAction[] = [
                ...(account.is_active
                  ? [{ id: 'deactivate', label: 'Desactivar cuenta', destructive: true, onSelect: () => openDeactivateModal(account) }]
                  : [{ id: 'reactivate', label: 'Reactivar cuenta', onSelect: () => void reactivate(account.id) }]),
                { id: 'delete', label: 'Eliminar cuenta', destructive: true, onSelect: () => openDeleteModal(account) },
              ]

              return (
                <article
                  key={account.id}
                  data-testid={`portfolio-card-${account.id}`}
                  className="flex min-w-0 flex-col rounded-[10px] border border-[var(--ft-border)] bg-[var(--ft-surface)] shadow-none transition-colors hover:border-[var(--ft-border-strong)]"
                >
                  <div className="min-w-0 p-4 pb-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-control border text-[var(--ft-text-strong)]"
                          style={{
                            borderColor: withAlpha(account.color, '38'),
                            backgroundColor: withAlpha(account.color, '12'),
                            color: account.color,
                          }}
                        >
                          <FinancialIcon name={account.icon} size={16} />
                        </span>
                        <div className="min-w-0">
                          <p title={account.name} className="break-words text-[13px] font-semibold leading-[18px] text-[var(--ft-text-strong)] [overflow-wrap:anywhere]">
                            {account.name}
                          </p>
                          <p title={getPortfolioBankDisplayName(account)} className="mt-0.5 truncate text-[11px] leading-4 text-[var(--ft-text-muted)]">
                            {getPortfolioBankDisplayName(account)}
                          </p>
                          <p className="mt-1 truncate text-[11px] leading-4 text-[var(--ft-text-muted)]">
                            {ACCOUNT_TYPE_LABEL[account.type]} · {currencyPresentation.code}{currencyPresentation.kind === 'custom' ? ' personalizada' : currencyPresentation.kind === 'unavailable' ? ' · código registrado' : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`mt-1 inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium leading-4 ${account.is_active ? 'text-[var(--ft-text-muted)]' : 'text-[var(--ft-text-faint)]'}`}>
                        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${account.is_active ? 'bg-[var(--ft-success)]' : 'bg-[var(--ft-text-faint)]'}`} />
                        {account.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] font-semibold leading-4 text-[var(--ft-text-muted)]">
                        {technical ? 'Cuenta técnica' : 'Saldo actual'}
                      </p>
                      {technical ? (
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="text-[16px] font-semibold leading-6 text-[var(--ft-text-strong)]">No patrimonial</p>
                          <Link href="/credits" className="text-[11px] font-semibold text-[var(--ft-primary)] hover:underline">
                            Gestionar en Créditos
                          </Link>
                        </div>
                      ) : (
                        <p className={`mt-0.5 min-w-0 break-words text-[20px] font-semibold leading-[27px] tabular-nums [overflow-wrap:anywhere] ${
                          account.balance < 0 ? 'text-[var(--ft-danger)]' : 'text-[var(--ft-text-strong)]'
                        }`}>
                          {formatPortfolioAmount(account.balance, account.currency, currencies)}
                        </p>
                      )}
                    </div>

                    {technical ? (
                      <p className="mt-2.5 text-[11px] leading-4 text-[var(--ft-text-muted)]">
                        El crédito disponible se consulta en Créditos, no es dinero propio.
                      </p>
                    ) : (
                      <PortfolioOpeningFact account={account} currencies={currencies} />
                    )}
                    {!technical && (
                      <AccountBalanceSparkline
                        history={monthlyHistories[account.id]}
                        currency={account.currency}
                        currencies={currencies}
                        loading={monthlyHistoriesLoading}
                        unavailable={monthlyHistoriesUnavailable}
                      />
                    )}
                  </div>

                  <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-[var(--ft-border)] px-3.5 py-2">
                    <button
                      type="button"
                      data-testid={`portfolio-card-detail-${account.id}`}
                      onClick={() => setViewingAccountId(account.id)}
                      className="min-h-9 rounded-control px-2.5 text-[11px] font-semibold text-[var(--ft-primary)] hover:bg-[var(--ft-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ft-primary)]"
                    >
                      Ver detalle
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(account)}
                        disabled={saving || loading || rowActionId !== null}
                        data-testid={`portfolio-edit-card-${account.id}`}
                        className="min-h-9 rounded-control px-2.5 text-[11px] font-semibold text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-muted)] hover:text-[var(--ft-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ft-primary)] disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <div data-testid={`portfolio-actions-card-${account.id}`}>
                        <AnchoredActionMenu
                          label={`Más acciones para ${account.name}`}
                          disabled={saving || loading || rowActionId !== null}
                          actions={accountActions}
                          align="end"
                          triggerContent={(
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
                            </svg>
                          )}
                          className="grid h-9 w-9 place-items-center rounded-control text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ft-primary)]"
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
        open={Boolean(viewingAccount)}
        onClose={() => setViewingAccountId(null)}
        eyebrow="Detalle de cuenta"
        title={viewingAccount?.name ?? 'Cuenta'}
        subtitle={viewingAccount ? `${getPortfolioBankDisplayName(viewingAccount)} · ${ACCOUNT_TYPE_LABEL[viewingAccount.type]} · ${viewingAccount.currency}` : undefined}
        widthClassName="w-[calc(100vw-32px)] max-w-[580px]"
        presentation="workbench"
        testId="portfolio-account-detail"
      >
        {viewingAccount ? (
          <div className="space-y-6">
            <section className="border-b border-[var(--ft-border)] pb-5" aria-label="Saldo actual registrado">
              <p className="text-[12px] text-[var(--ft-text-muted)]">{isTechnicalAccount(viewingAccount) ? 'Cuenta técnica de tarjeta' : 'Saldo actual registrado'}</p>
              <p className="mt-1 text-[32px] font-semibold leading-[42px] tracking-[-0.04em] tabular-nums text-[var(--ft-text-strong)]">
                {isTechnicalAccount(viewingAccount)
                  ? 'No patrimonial'
                  : formatPortfolioAmount(viewingAccount.balance, viewingAccount.currency, currencies)}
              </p>
              {isTechnicalAccount(viewingAccount) ? (
                <Link href="/credits" className="mt-1 inline-flex text-[12px] font-semibold text-[var(--ft-primary)] hover:underline">Gestionar en Créditos</Link>
              ) : null}
            </section>

            <dl className="divide-y divide-[var(--ft-border)]">
              <div className="flex items-start justify-between gap-5 py-3 text-[12px]">
                <dt className="text-[var(--ft-text-muted)]">Saldo de apertura</dt>
                <dd className="text-right font-semibold tabular-nums text-[var(--ft-text-strong)]">
                  {isTechnicalAccount(viewingAccount) ? 'No aplica' : formatPortfolioAmount(viewingAccount.initial_balance, viewingAccount.currency, currencies)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-5 py-3 text-[12px]">
                <dt className="text-[var(--ft-text-muted)]">Fecha de apertura</dt>
                <dd className="text-right font-semibold text-[var(--ft-text-strong)]">
                  {isTechnicalAccount(viewingAccount) ? 'No aplica' : formatStoredPortfolioDate(viewingAccount.initial_balance_date)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-5 py-3 text-[12px]">
                <dt className="text-[var(--ft-text-muted)]">Tipo y estado</dt>
                <dd className="text-right font-semibold text-[var(--ft-text-strong)]">{ACCOUNT_TYPE_LABEL[viewingAccount.type]} · {viewingAccount.is_active ? 'Activa' : 'Inactiva'}</dd>
              </div>
              <div className="flex items-start justify-between gap-5 py-3 text-[12px]">
                <dt className="max-w-[58%] text-[var(--ft-text-muted)]">Incluida en el cálculo actual de cuentas</dt>
                <dd className="text-right font-semibold text-[var(--ft-text-strong)]">
                  {isTechnicalAccount(viewingAccount) ? 'No aplica a una cuenta técnica' : viewingAccount.include_in_net_worth ? 'Sí' : 'No'}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] leading-[18px] text-[var(--ft-text-muted)]">
              La apertura y el saldo actual son valores registrados, no un historial ni una rentabilidad. La inclusión conserva la configuración actual de esta cuenta.
            </p>
            {viewingAccount.notes?.trim() ? (
              <section className="border-t border-[var(--ft-border)] pt-4">
                <h3 className="text-[12px] font-semibold text-[var(--ft-text-strong)]">Notas</h3>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[var(--ft-text-muted)]">{viewingAccount.notes}</p>
              </section>
            ) : null}
          </div>
        ) : null}
        <RecordModalFooter>
          <div className="flex w-full flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
            <Button type="button" onClick={() => setViewingAccountId(null)} variant="secondary" size="lg">Cerrar</Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!viewingAccount || saving || loading || rowActionId !== null}
              onClick={() => {
                if (!viewingAccount) return
                const account = viewingAccount
                setViewingAccountId(null)
                startEdit(account)
              }}
            >
              Editar cuenta
            </Button>
          </div>
        </RecordModalFooter>
      </RecordModal>

      <RecordModal
        open={modalOpen}
        onClose={closeModal}
        eyebrow="Cuentas"
        title={editingId ? 'Editar cuenta' : 'Añadir cuenta'}
        subtitle={editingId ? 'Actualiza los datos permitidos de la cuenta.' : 'Define la cuenta y su saldo de apertura.'}
        widthClassName="w-[calc(100vw-32px)] max-w-[580px]"
        presentation="workbench"
      >
        <form
          onSubmit={handleSubmit}
          data-testid="portfolio-form"
          className="flex flex-col gap-3"
        >
          {error ? (
            <div className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3">
              <p className="text-[12px] font-medium text-[var(--ft-form-error)]">{error}</p>
            </div>
          ) : null}

          <FormSection
            title="Identidad de la cuenta"
            columns="2"
            className="[--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Nombre" className="md:col-span-2">
              <input
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                required
                data-testid="portfolio-name-input"
                className="field-base ft-form-input w-full"
                placeholder="Ej.: Cuenta principal"
              />
            </FormField>
            <AccountFormField
              label="Tipo"
              help={editingAccount?.type === 'CREDIT_CARD'
                ? 'Las tarjetas conservan su tipo técnico. Para otro uso, crea una cuenta operativa.'
                : editingAccount
                  ? 'Puedes cambiar el tipo operativo, pero no convertir una cuenta en tarjeta.'
                  : 'Define cómo se clasifica esta cuenta en Cuentas.'}
            >
              {labelId => (
                <AppSelect
                  value={form.type}
                  onChange={handleSelectAccountType}
                  ariaLabelledBy={labelId}
                  matchTriggerWidth
                  testId="portfolio-type-select"
                  options={ACCOUNT_TYPE_OPTIONS.map(option => ({
                    value: option.value,
                    label: option.label,
                    disabled: editingAccount
                      ? crossesTechnicalAccountBoundary(editingAccount.type, option.value)
                      : false,
                  }))}
                />
              )}
            </AccountFormField>
            <AccountFormField
              label="Institución financiera"
              optional
              help="Vincula la cuenta con una entidad registrada. También puedes dejarla sin institución."
              note={banksError ? 'Catálogo no disponible. Reintenta para cambiar esta asociación.' : undefined}
              className="min-w-0"
            >
              {labelId => (
                <AppSelect
                  value={form.bank_entity_id}
                  onChange={handleSelectBank}
                  ariaLabelledBy={labelId}
                  matchTriggerWidth
                  className="w-full"
                  disabled={!dataState.banksAvailable}
                  testId="portfolio-bank-entity-select"
                  searchPlaceholder="Buscar entidad..."
                  options={[
                    { value: '', label: 'Sin institución' },
                    ...banks.map(bank => ({
                      value: bank.id,
                      label: bank.name ?? bank.short_name ?? 'Entidad sin nombre',
                    })),
                  ]}
                />
              )}
            </AccountFormField>
          </FormSection>

          <FormSection
            title="Saldo de apertura"
            columns="2"
            className="[--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <AccountFormField
              label="Moneda"
              help={editingAccount
                ? 'La moneda se fija al crear la cuenta. Para usar otra, crea una cuenta nueva.'
                : 'El saldo y los movimientos de esta cuenta se registran en esta moneda.'}
              note={currenciesError
                ? 'Catálogo de monedas no disponible. Reintenta antes de elegir una moneda nueva.'
                : !editingAccount && !currenciesLoading && currencyOptions.length === 0
                  ? 'No hay monedas disponibles para crear una cuenta.'
                  : undefined}
            >
              {labelId => (
                <AppSelect
                  value={form.currency}
                  onChange={value => setForm(prev => ({ ...prev, currency: value as CurrencyCode }))}
                  ariaLabelledBy={labelId}
                  matchTriggerWidth
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
              )}
            </AccountFormField>

            <AccountFormField
              label={formIsTechnicalAccount ? 'Saldo técnico' : 'Saldo inicial'}
              help={formIsTechnicalAccount
                ? 'Las tarjetas son cuentas técnicas. El cupo, uso y disponible se gestionan en Créditos.'
                : editingId
                  ? 'Es el punto de partida de la cuenta. Su ajuste conserva las restricciones del historial.'
                  : 'Es el punto de partida antes de los movimientos registrados; no representa el saldo actual.'}
              className="md:col-span-1"
            >
              {labelId => (
                <NumericInput
                  aria-labelledby={labelId}
                  step="0.01"
                  decimals={2}
                  value={formIsTechnicalAccount ? '0.00' : form.initial_balance}
                  onValueChange={value => setForm(prev => ({ ...prev, initial_balance: value }))}
                  disabled={formIsTechnicalAccount}
                  data-testid="portfolio-initial-balance-input"
                  className="field-base ft-form-amount-input w-full"
                />
              )}
            </AccountFormField>

            <AccountFormField
              label="Fecha del saldo inicial"
              help={editingId
                ? 'Debe ser igual o anterior al primer movimiento registrado en esta cuenta.'
                : 'Indica la fecha a la que corresponde el saldo de apertura.'}
              className="md:col-span-1"
            >
              {() => (
                <IncomeDatePicker
                  value={form.initial_balance_date}
                  onChange={value => setForm(prev => ({ ...prev, initial_balance_date: value }))}
                  onInvalidInput={setDateInputError}
                  error={dateInputError ?? undefined}
                  inputLabel="Fecha del saldo inicial, día, mes y año"
                  inputTestId="portfolio-initial-balance-date-input"
                />
              )}
            </AccountFormField>

            {editingId ? (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--ft-form-border)] pt-3 md:col-span-2">
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--ft-form-muted)]">
                  {formIsTechnicalAccount ? 'Lectura técnica' : 'Saldo actual'}
                  <AccountInfoHint label="Ayuda sobre el saldo actual">
                    {formIsTechnicalAccount
                      ? 'El saldo técnico no es dinero propio. La línea disponible se consulta en Créditos.'
                      : 'Al guardar un cambio de apertura, el saldo operativo se recalcula con esa base y los movimientos registrados.'}
                  </AccountInfoHint>
                </span>
                <strong className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ft-text-strong)] tabular-nums">
                  {formIsTechnicalAccount
                    ? 'No patrimonial'
                    : editingAccount
                      ? formatPortfolioAmount(editingAccount.balance, editingAccount.currency, currencies)
                      : '--'}
                </strong>
              </div>
            ) : null}

          </FormSection>

          <div className="flex items-start justify-between gap-2 border-t border-[var(--ft-form-border)] pt-3">
            <label className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                checked={formIsTechnicalAccount ? false : form.include_in_net_worth}
                disabled={formIsTechnicalAccount}
                onChange={event => setForm(prev => ({ ...prev, include_in_net_worth: event.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--c-border)] text-[var(--c-primary)] focus:ring-[var(--c-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="pt-px text-[12px] font-semibold text-[var(--c-text)]">
                Incluir en el cálculo actual de cuentas
              </span>
            </label>
            <AccountInfoHint label="Ayuda sobre la inclusión en el cálculo de cuentas">
              {formIsTechnicalAccount
                ? 'Las cuentas técnicas de tarjeta no representan dinero propio y no se incluyen en este cálculo.'
                : 'Define si esta cuenta operativa participa en los totales actuales.'}
            </AccountInfoHint>
          </div>

          <section className={incomeStyles.incomeOptionalSection} aria-label="Información adicional">
            <div className={incomeStyles.incomeOptionsHeader}>
              <div>
                <h3 className={incomeStyles.incomeSectionHeading}>Información adicional</h3>
                <p className={incomeStyles.incomeOptionsDescription}>Opcional · agrega detalles cuando los necesites</p>
              </div>
            </div>

            <div className={incomeStyles.incomeOptionControls} role="group" aria-label="Opciones de cuenta">
              {accountAdditionalOptions.map(option => {
                const isOpen = accountAdditionalOptionsOpen[option.key] || option.hasError
                const panelId = `${accountAdditionalOptionsId}-${option.key}`
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    data-active={isOpen ? 'true' : 'false'}
                    data-has-value={option.hasValue ? 'true' : 'false'}
                    data-has-error={option.hasError ? 'true' : 'false'}
                    className={incomeStyles.incomeOptionButton}
                    onClick={() => setAccountAdditionalOptionsOpen(current => ({
                      ...current,
                      [option.key]: !current[option.key],
                    }))}
                  >
                    <span aria-hidden="true" className={incomeStyles.incomeOptionMark}>{isOpen ? '−' : '+'}</span>
                    <span>{option.label}</span>
                    {option.hasError ? <span className={incomeStyles.incomeOptionError}>Revisar</span> : null}
                  </button>
                )
              })}
            </div>

            <div
              className={incomeStyles.incomeOptionPanels}
              style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
            >
              <div
                id={`${accountAdditionalOptionsId}-notes`}
                data-income-option="notes"
                hidden={!accountAdditionalOptionsOpen.notes}
                className={incomeStyles.incomeOptionPanel}
              >
                <FieldWrapper label="Notas" optional>
                  <Textarea
                    rows={2}
                    value={form.notes}
                    onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                    placeholder="Ej: Cuenta para gastos operativos"
                  />
                </FieldWrapper>
              </div>

              <div
                id={`${accountAdditionalOptionsId}-color`}
                data-income-option="color"
                hidden={!accountAdditionalOptionsOpen.color}
                className={incomeStyles.incomeOptionPanel}
              >
                <FieldWrapper label="Color" optional>
                  <ColorSwatchPicker
                    value={form.color}
                    onChange={color => setForm(prev => ({ ...prev, color }))}
                    palette={ACCOUNT_COLOR_OPTIONS}
                    wrapperTestId="portfolio-color-options"
                    swatchTestIdPrefix="portfolio-color"
                    customInputTestId="portfolio-color-picker"
                  />
                </FieldWrapper>
              </div>

              <div
                id={`${accountAdditionalOptionsId}-icon`}
                data-income-option="icon"
                hidden={!accountAdditionalOptionsOpen.icon}
                className={incomeStyles.incomeOptionPanel}
              >
                <FieldWrapper label="Icono" optional>
                  <IconGridPicker
                    value={form.icon}
                    onChange={icon => setForm(prev => ({ ...prev, icon }))}
                    options={ACCOUNT_ICON_OPTIONS}
                    wrapperTestId="portfolio-icon-input"
                    optionTestIdPrefix="portfolio-icon-option"
                  />
                </FieldWrapper>
              </div>
            </div>
          </section>

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
                    || (!editingAccount && (!canCreateWithAvailableCurrency || !createFormCurrencyIsAvailable))
                    || (Boolean(banksError) && Boolean(form.bank_entity_id))
                  }
                  loading={saving}
                  testId="portfolio-submit-button"
                  variant="primary"
                  size="lg"
                >
                  {editingId ? 'Guardar cambios' : 'Crear cuenta'}
                </Button>
              )}
            />
          </RecordModalFooter>
        </form>
      </RecordModal>

      <ConfirmDialog
        open={Boolean(pendingDeactivateAccount)}
        title="Desactivar cuenta"
        message={(
          <>
            La cuenta{' '}
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
        title="Eliminar cuenta"
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
