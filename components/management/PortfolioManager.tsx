'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AccountType, CurrencyCode } from '@/types/database.types'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
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
import { parseNumericInput, roundToDecimals } from '@/lib/utils/numeric-input'

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
  color: string
  icon: string
  include_in_net_worth: boolean
  is_active: boolean
  notes: string | null
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
  color: string
  icon: string
  include_in_net_worth: boolean
  notes: string
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

const EMPTY_FORM: AccountForm = {
  name: '',
  institution: '',
  bank_entity_id: '',
  type: 'CHECKING',
  currency: 'PEN',
  initial_balance: '0.00',
  color: '#0d6b5e',
  icon: 'wallet',
  include_in_net_worth: true,
  notes: '',
}

function getIconLabel(icon: string): string {
  return ACCOUNT_ICON_OPTIONS.find(option => option.value === icon)?.label ?? icon
}

function displayBankName(account: AccountItem): string {
  if (account.bank_entity?.short_name) return account.bank_entity.short_name
  if (account.bank_entity?.name) return account.bank_entity.name
  if (account.institution) return account.institution
  return 'Sin banco'
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

type PortfolioManagerProps = {
  initialAccounts?: AccountItem[]
  initialBanks?: BankEntityItem[]
  initialCurrencies?: UserCurrencyItem[]
  preloaded?: boolean
}

export function PortfolioManager({
  initialAccounts = [],
  initialBanks = [],
  initialCurrencies = [],
  preloaded = false,
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [bankFilter, setBankFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [pendingDeactivateAccount, setPendingDeactivateAccount] = useState<AccountItem | null>(null)
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<AccountItem | null>(null)

  const handledQueryOpenRef = useRef(false)
  const openFromHeroQuery = searchParams.get('new') === 'portfolio'

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/accounts?include_inactive=true', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las cuentas'))
      }

      setAccounts(json.data as AccountItem[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las cuentas')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBanks = useCallback(async () => {
    setBanksLoading(true)

    try {
      const res = await fetch('/api/bank-entities?include_inactive=false', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar los bancos'))
      }

      setBanks(json.data as BankEntityItem[])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudieron cargar los bancos'
      setError(prev => prev ?? message)
    } finally {
      setBanksLoading(false)
    }
  }, [])

  useEffect(() => {
    if (preloaded) return
    void Promise.all([loadAccounts(), loadBanks()])
  }, [loadAccounts, loadBanks, preloaded])

  useEffect(() => {
    if (initialCurrencies.length === 0) return
    setCurrencies(initialCurrencies)
  }, [initialCurrencies])

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
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

  const activeCount = activeAccounts.length
  const inactiveCount = accounts.length - activeCount

  const totalBalanceByCurrency = useMemo(() => {
    const totals = new Map<string, number>()

    for (const account of activeAccounts) {
      const current = totals.get(account.currency) ?? 0
      totals.set(account.currency, current + account.balance)
    }

    return totals
  }, [activeAccounts])

  const totalPen = totalBalanceByCurrency.get('PEN') ?? 0
  const totalUsd = totalBalanceByCurrency.get('USD') ?? 0

  const accountsInNetWorth = useMemo(
    () => activeAccounts.filter(account => account.include_in_net_worth).length,
    [activeAccounts],
  )

  const accountsWithoutBank = useMemo(
    () => activeAccounts.filter(account => !account.bank_entity_id && !account.institution).length,
    [activeAccounts],
  )

  const activeInstitutions = useMemo(() => {
    const names = new Set<string>()
    for (const account of activeAccounts) {
      names.add(displayBankName(account))
    }
    return names.size
  }, [activeAccounts])

  const currencyOptions = useMemo(() => {
    const activeCurrencies = currencies
      .filter(currency => currency.is_active)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1
        if (!a.is_default && b.is_default) return 1
        return a.code.localeCompare(b.code)
      })

    if (activeCurrencies.length > 0) {
      return activeCurrencies.map(currency => ({
        value: currency.code,
        label: `${currency.code} · ${currency.name}`,
      }))
    }

    return [
      { value: 'PEN', label: 'PEN · Sol peruano' },
      { value: 'USD', label: 'USD · Dolar americano' },
    ]
  }, [currencies])

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase()

    return accounts.filter(account => {
      if (currencyFilter !== 'all' && account.currency !== currencyFilter) return false
      if (typeFilter !== 'all' && account.type !== typeFilter) return false
      if (statusFilter === 'active' && !account.is_active) return false
      if (statusFilter === 'inactive' && account.is_active) return false

      if (bankFilter !== 'all') {
        if (bankFilter === 'none' && account.bank_entity_id) return false
        if (bankFilter !== 'none' && account.bank_entity_id !== bankFilter) return false
      }

      if (!q) return true

      const bankName = displayBankName(account).toLowerCase()
      return (
        account.name.toLowerCase().includes(q) ||
        bankName.includes(q) ||
        ACCOUNT_TYPE_LABEL[account.type].toLowerCase().includes(q) ||
        account.currency.toLowerCase().includes(q)
      )
    })
  }, [accounts, bankFilter, currencyFilter, query, statusFilter, typeFilter])

  const openCreateModal = useCallback(() => {
    resetForm()
    setForm(prev => ({
      ...prev,
      currency: (currencyOptions[0]?.value ?? 'PEN') as CurrencyCode,
    }))
    setModalOpen(true)
  }, [currencyOptions, resetForm])

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
      color: account.color,
      icon: account.icon,
      include_in_net_worth: account.include_in_net_worth,
      notes: account.notes ?? '',
    })
    setModalOpen(true)
  }, [])

  const handleSelectBank = useCallback((bankId: string) => {
    const selected = banks.find(bank => bank.id === bankId)

    setForm(prev => ({
      ...prev,
      bank_entity_id: bankId,
      institution: selected ? (selected.short_name ?? selected.name) : prev.institution,
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

    const parsedInitialBalance = roundToDecimals(
      parseNumericInput(form.initial_balance, Number.NaN),
      2,
    )

    if (!editingId && !Number.isFinite(parsedInitialBalance)) {
      const message = 'El saldo inicial debe ser un numero valido.'
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
          color: form.color.trim() || '#0d6b5e',
          icon: form.icon.trim() || 'wallet',
          include_in_net_worth: form.include_in_net_worth,
          notes: form.notes.trim() || null,
        }
      : {
          name: trimmedName,
          institution: form.institution.trim() || null,
          bank_entity_id: form.bank_entity_id || null,
          type: form.type,
          currency: normalizedCurrency,
          initial_balance: parsedInitialBalance,
          color: form.color.trim() || '#0d6b5e',
          icon: form.icon.trim() || 'wallet',
          include_in_net_worth: form.include_in_net_worth,
          notes: form.notes.trim() || null,
        }

    try {
      const endpoint = editingId ? `/api/accounts/${editingId}` : '/api/accounts'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
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
  }, [banks, clearCreateQueryParam, editingId, form, loadAccounts, resetForm, toast])

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
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
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
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
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
      const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const json = await res.json()
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
      .map(([currency, total]) => `${currency} ${formatCurrency(total, currency as CurrencyCode)}`)
      .join(' · ')
  }, [totalBalanceByCurrency])

  const selectedBankLabel = useMemo(() => {
    if (!form.bank_entity_id) return 'Sin banco asignado'
    const selected = banks.find(bank => bank.id === form.bank_entity_id)
    return selected ? (selected.short_name ?? selected.name) : form.institution || 'Entidad seleccionada'
  }, [banks, form.bank_entity_id, form.institution])

  const formInitialBalanceValue = useMemo(() => {
    const parsed = roundToDecimals(parseNumericInput(form.initial_balance, Number.NaN), 2)
    if (!Number.isFinite(parsed)) return '--'
    return formatCurrency(parsed, form.currency)
  }, [form.currency, form.initial_balance])

  const editingAccount = useMemo(
    () => (editingId ? accounts.find(account => account.id === editingId) ?? null : null),
    [accounts, editingId],
  )

  return (
    <>
      <PageLayout
        className="max-w-[1320px] gap-5"
        header={
          <ModuleHeader
            eyebrow="Registro financiero"
            title="Portafolio"
            description={
              exposureSummary
                ? `Cuentas, efectivo e instrumentos activos con lectura inmediata por entidad, moneda y saldo. Otras exposiciones: ${exposureSummary}.`
                : 'Cuentas, efectivo e instrumentos activos con lectura inmediata por entidad, moneda y saldo.'
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
              value={formatCurrency(totalPen, 'PEN')}
              detail={`${activeCount} activa${activeCount === 1 ? '' : 's'}`}
              caption="Liquidez consolidada en soles peruanos."
            />
            <StatCard
              label="Saldo USD"
              value={formatCurrency(totalUsd, 'USD')}
              detail={totalUsd === 0 ? 'Sin exposicion' : 'Caja dolarizada'}
              caption="Fondos disponibles en cuentas dolarizadas."
            />
            <StatCard
              label="Cuentas activas"
              value={String(activeCount)}
              detail={inactiveCount > 0 ? `${inactiveCount} inactiva${inactiveCount === 1 ? '' : 's'}` : 'Sin rezagos'}
              caption="El portafolio operativo visible para nuevos registros."
            />
            <StatCard
              label="Patrimonio y bancos"
              value={String(accountsInNetWorth)}
              detail={`${activeInstitutions} entidad${activeInstitutions === 1 ? '' : 'es'}`}
              caption={
                accountsWithoutBank > 0
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
                  count={accounts.length}
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
                  searchable={false}
                  options={[
                    { value: 'all', label: 'Moneda' },
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
                  disabled={banksLoading}
                  compact
                  searchPlaceholder="Buscar banco..."
                  options={[
                    { value: 'all', label: 'Banco' },
                    { value: 'none', label: 'Sin banco' },
                    ...banks.map(bank => ({
                      value: bank.id,
                      label: bank.short_name ?? bank.name,
                    })),
                  ]}
                />
              </FilterBar>
            )}
            viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} id="portfolio-view-toggle" />}
            actions={(
              <StatusBadge tone="muted" dot={false}>
                {filteredAccounts.length} cuenta{filteredAccounts.length === 1 ? '' : 's'}
              </StatusBadge>
            )}
          />
        )}
      >
        {error ? <DataErrorBanner message={error} onRetry={loadAccounts} /> : null}

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
        ) : filteredAccounts.length === 0 ? (
          <EmptyState
            icon={stackIcon()}
            title={
              query.trim() || currencyFilter !== 'all' || typeFilter !== 'all' || bankFilter !== 'all' || statusFilter !== 'all'
                ? 'No encontramos cuentas para esa combinacion.'
                : 'Todavia no tienes portafolios registrados.'
            }
            description={
              query.trim() || currencyFilter !== 'all' || typeFilter !== 'all' || bankFilter !== 'all' || statusFilter !== 'all'
                ? 'Ajusta los filtros o amplia la busqueda para recuperar cuentas, custodios o monedas.'
                : 'Crea tu primera cuenta operativa para empezar a ordenar liquidez, bancos y patrimonio.'
            }
            action={
              query.trim() || currencyFilter !== 'all' || typeFilter !== 'all' || bankFilter !== 'all' || statusFilter !== 'all'
                ? {
                    label: 'Limpiar filtros',
                    onClick: () => {
                      setQuery('')
                      setCurrencyFilter('all')
                      setTypeFilter('all')
                      setBankFilter('all')
                      setStatusFilter('all')
                    },
                  }
                : {
                    label: 'Nuevo portafolio',
                    onClick: openCreateModal,
                  }
            }
          />
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
              {filteredAccounts.map(account => (
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
                              {getIconLabel(account.icon)}
                              {account.notes ? ` · ${account.notes}` : ''}
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
                              {account.currency}
                            </StatusBadge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--c-text)]">
                        {displayBankName(account)}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--c-text-muted)]">
                        {account.include_in_net_worth ? 'Incluida en patrimonio neto' : 'Excluida del patrimonio neto'}
                      </p>
                    </div>

                    <AmountCell
                      label="Saldo actual"
                      value={formatCurrency(account.balance, account.currency)}
                      meta={
                        editingId === account.id
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
              ))}
            </div>
          </DataTable>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredAccounts.map(account => (
              <article
                key={account.id}
                className="rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1"
              >
                <div className="rounded-[12px] bg-[var(--c-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
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
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--c-text)]">
                            {account.name}
                          </p>
                          <p className="mt-1 truncate text-[12px] text-[var(--c-text-muted)]">
                            {displayBankName(account)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <StatusBadge tone={account.is_active ? 'success' : 'muted'}>
                      {account.is_active ? 'Activa' : 'Inactiva'}
                    </StatusBadge>
                  </div>

                  <div className="mt-5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                      Saldo actual
                    </p>
                    <p className="mt-2 font-mono text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--c-text)]">
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={ACCOUNT_TYPE_TONE[account.type]} dot={false}>
                      {ACCOUNT_TYPE_LABEL[account.type]}
                    </StatusBadge>
                    <StatusBadge tone="muted" dot={false}>
                      {account.currency}
                    </StatusBadge>
                    <StatusBadge tone={account.include_in_net_worth ? 'primary' : 'muted'} dot={false}>
                      {account.include_in_net_worth ? 'Patrimonio' : 'Excluida'}
                    </StatusBadge>
                  </div>

                  <div className="mt-4 border-t border-[var(--c-border)] pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] text-[var(--c-text-muted)]">
                        {getIconLabel(account.icon)}
                      </p>
                      <div className="flex items-center gap-1.5">
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
                </div>
              </article>
            ))}
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

            <FormField label="Tipo">
              <AppSelect
                value={form.type}
                onChange={value => setForm(prev => ({ ...prev, type: value as AccountType }))}
                testId="portfolio-type-select"
                options={ACCOUNT_TYPE_OPTIONS.map(option => ({
                  value: option.value,
                  label: option.label,
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
            description="Asocia la entidad, fija la moneda y registra el saldo inicial solo cuando la cuenta nace en FinTrack."
            columns="1"
            className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]"
          >
            <FormField label="Entidad financiera" optional>
              <AppSelect
                value={form.bank_entity_id}
                onChange={handleSelectBank}
                className="w-full"
                disabled={banksLoading}
                testId="portfolio-bank-entity-select"
                searchPlaceholder="Buscar entidad..."
                options={[
                  { value: '', label: 'Sin banco' },
                  ...banks.map(bank => ({
                    value: bank.id,
                    label: bank.short_name ?? bank.name,
                  })),
                ]}
              />
            </FormField>

            <FormField label="Moneda">
              <AppSelect
                value={form.currency}
                onChange={value => setForm(prev => ({ ...prev, currency: value as CurrencyCode }))}
                testId="portfolio-currency-select"
                searchable={false}
                options={[
                  ...currencyOptions,
                  ...(
                    currencyOptions.some(option => option.value === form.currency)
                      ? []
                      : [{ value: form.currency, label: form.currency }]
                  ),
                ]}
              />
            </FormField>

            {editingId ? (
              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Saldo actual</p>
                <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-text)] tabular-nums">
                  {editingAccount ? formatCurrency(editingAccount.balance, editingAccount.currency) : '--'}
                </p>
                <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  El saldo inicial ya quedó registrado. Desde esta edición solo mostramos el valor operativo vigente.
                </p>
              </div>
            ) : (
              <FormField
                label="Saldo inicial"
                description="Úsalo para reflejar el punto de partida exacto antes de comenzar a registrar movimientos."
              >
                <NumericInput
                  step="0.01"
                  decimals={2}
                  value={form.initial_balance}
                  onValueChange={value => setForm(prev => ({ ...prev, initial_balance: value }))}
                  data-testid="portfolio-initial-balance-input"
                  className="field-base ft-form-amount-input w-full"
                />
              </FormField>
            )}

            {!editingId ? (
              <div className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <p className="text-[11px] font-medium text-[var(--ft-form-muted)]">Lectura inicial</p>
                <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-text)] tabular-nums">
                  {formInitialBalanceValue}
                </p>
                <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                  {form.include_in_net_worth
                    ? 'Esta cuenta entrará al patrimonio neto desde su saldo de apertura.'
                    : 'Esta cuenta se registrará fuera del patrimonio neto inicial.'}
                </p>
              </div>
            ) : null}
          </FormSection>

          <OptionalSection
            title="Más opciones"
            summary={[
              form.include_in_net_worth ? 'Incluida en patrimonio' : 'Fuera de patrimonio',
              form.notes.trim() ? 'Notas' : '',
            ]}
          >
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-surface-muted)] px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={form.include_in_net_worth}
                  onChange={event => setForm(prev => ({ ...prev, include_in_net_worth: event.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--c-border)] text-[var(--c-primary)] focus:ring-[var(--c-primary-soft)]"
                />
                <span className="space-y-1">
                  <span className="block text-[13px] font-semibold tracking-[-0.01em] text-[var(--c-text)]">
                    Incluir en patrimonio neto
                  </span>
                  <span className="block text-[12px] leading-[1.45] text-[var(--ft-form-muted)]">
                    Actívalo si esta cuenta debe formar parte de la lectura patrimonial consolidada.
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
                  disabled={saving}
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
