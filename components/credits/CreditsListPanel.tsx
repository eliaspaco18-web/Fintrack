'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import {
  getCreditDisplayLabel,
  getCreditDisplayTone,
  type CreditDisplayType,
  type CreditListItem,
} from '@/lib/credits/display-type'
import { useToast } from '@/lib/toast/toast'
import { useCredits } from '@/lib/hooks/useModules'
import { formatCurrency } from '@/lib/contracts/ui.contracts'
import { ActionIconButton } from '@/components/ui/ActionIconButton'
import { AnchoredActionMenu, type AnchoredAction } from '@/components/ui/AnchoredActionMenu'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { RecordModal, RecordModalFooter } from '@/components/ui/RecordModal'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { FormActions, FormField, FormSection } from '@/components/forms/primitives'
import { CreditCardForm } from '@/components/credits/CreditCardForm'
import { BankLoanForm } from '@/components/credits/BankLoanForm'
import { LoanDetailsModal } from '@/components/credits/LoanDetailsModal'
import {
  AmountCell,
  ConfirmDialog,
  DataErrorBanner,
  DataSearchField,
  DataTable,
  EmptyState,
  StatusBadge,
} from '@/components/finance'
import { getApiErrorMessage } from '@/lib/api/error-message'
import { summarizeCredits } from '@/lib/credits/overview'
import type { Credit } from '@/types/database.types'
import pageStyles from '@/components/tables/TransactionsRound07.module.css'
import styles from './CreditsListPanel.module.css'
import workbenchStyles from './CreditsWorkbench.module.css'

type ViewMode = 'list' | 'cards'
type StatusFilter = 'all' | 'ACTIVE' | 'CLOSED' | 'BLOCKED'
type BankEntityOption = { id: string; name: string; short_name: string | null }
type CreditEditForm = { name: string; notes: string }
type CurrencyFilter = 'all' | 'PEN' | 'USD'

function resolveErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const candidate = error as { message?: string; detail?: string; root?: string }
    return candidate.message ?? candidate.detail ?? candidate.root ?? 'Ocurrió un error inesperado.'
  }
  return 'Ocurrió un error inesperado.'
}

function creditIcon(type: Credit['credit_type']) {
  return type === 'CREDIT_CARD' ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 4l9 6.5v8A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-8Z" /><path d="M9 20v-5h6v5" />
    </svg>
  )
}

function creditIconClass(type: CreditDisplayType) {
  return { CARD: styles.cardIcon, LOAN: styles.loanIcon, LINE: styles.lineIcon }[type]
}

function bankName(credit: CreditListItem) {
  return credit.bank_entity?.short_name || credit.bank_entity?.name || 'Entidad no disponible'
}

function moneyValues(credit: CreditListItem, field: 'used' | 'limit') {
  const values = (['PEN', 'USD'] as const).map(currency => {
    const specific = field === 'used'
      ? currency === 'PEN' ? Number(credit.used_amount_pen ?? 0) : Number(credit.used_amount_usd ?? 0)
      : currency === 'PEN' ? Number(credit.credit_limit_pen ?? 0) : Number(credit.credit_limit_usd ?? 0)
    const primary = credit.currency === currency
      ? Number(field === 'used' ? credit.used_amount ?? 0 : credit.credit_limit ?? 0)
      : 0
    return { currency, amount: specific || primary }
  }).filter(item => item.amount > 0)
  if (credit.currency !== 'PEN' && credit.currency !== 'USD') {
    const nativeAmount = Number(field === 'used' ? credit.used_amount ?? 0 : credit.credit_limit ?? 0)
    if (nativeAmount > 0) return [{ currency: credit.currency, amount: nativeAmount }]
  }
  return values
}

function CreditAmount({ credit }: { credit: CreditListItem }) {
  const isCard = credit.display_type === 'CARD'
  const amounts = moneyValues(credit, isCard ? 'used' : 'limit')
  const label = isCard
    ? 'Deuda registrada'
    : credit.display_type === 'LOAN' ? 'Capital original' : 'Importe registrado'

  return amounts.length ? (
    <div className={styles.amountStack}>
      <span className={styles.cellLabel}>{label}</span>
      {amounts.map(item => (
        <span className={styles.amountLine} key={item.currency}>
          <AmountCell value={formatCurrency(item.amount, item.currency)} align="left" />
          {amounts.length > 1 ? <span className={styles.currencyCode}>{item.currency}</span> : null}
        </span>
      ))}
    </div>
  ) : <span className={styles.unavailableValue}>No disponible</span>
}

function CreditSecondaryFacts({ credit }: { credit: CreditListItem }) {
  if (credit.display_type === 'CARD') {
    return (
      <div className={styles.secondaryFacts}>
        <span>Límite: {moneyValues(credit, 'limit').map(item => formatCurrency(item.amount, item.currency)).join(' · ') || 'No registrado'}</span>
        <span>{credit.closing_day ? `Corte día ${credit.closing_day}` : 'Corte no registrado'}</span>
        <span>{credit.payment_day ? `Pago día ${credit.payment_day}` : 'Pago no registrado'}</span>
      </div>
    )
  }

  if (credit.display_type === 'LOAN') {
    return (
      <div className={styles.secondaryFacts}>
        <span>{credit.has_loan ? 'Cronograma vinculado' : 'Cronograma no disponible'}</span>
        <span>Sin vencimiento registrado en esta vista</span>
      </div>
    )
  }

  return (
    <div className={styles.secondaryFacts}>
      <span>Línea: {moneyValues(credit, 'limit').map(item => formatCurrency(item.amount, item.currency)).join(' · ') || 'Importe no registrado'}</span>
      <span>Uso y disponibilidad se consultan en el detalle</span>
    </div>
  )
}

function CreditActions({
  credit,
  loading,
  onEdit,
  onToggle,
  onDelete,
  onViewLoan,
}: {
  credit: CreditListItem
  loading: boolean
  onEdit: (credit: CreditListItem) => void
  onToggle: (credit: CreditListItem) => void
  onDelete: (credit: CreditListItem) => void
  onViewLoan: (credit: CreditListItem) => void
}) {
  const isActive = credit.status === 'ACTIVE'
  const view = credit.display_type === 'CARD' || credit.display_type === 'LINE'
    ? <ActionIconButton icon="view" label={`Ver ${credit.display_type === 'CARD' ? 'tarjeta' : 'línea'}`} href={`/credits/${credit.id}`} testId={`credit-view-${credit.id}`} />
    : <ActionIconButton icon="view" label="Ver préstamo" testId={`credit-view-${credit.id}`} onClick={() => onViewLoan(credit)} />
  const actions: AnchoredAction[] = [
    { id: 'edit', label: credit.display_type === 'LOAN' ? 'Editar préstamo' : 'Editar', onSelect: () => onEdit(credit) },
    { id: 'status', label: isActive ? 'Desactivar' : 'Activar', icon: isActive ? '−' : '+', onSelect: () => onToggle(credit) },
    { id: 'delete', label: 'Eliminar', icon: '×', destructive: true, onSelect: () => onDelete(credit) },
  ]
  const secondaryActions = actions.filter(action => action.id !== 'edit')

  return (
    <div className={styles.rowActions}>
      {view}
      <ActionIconButton className={styles.directEditAction} icon="edit" label={credit.display_type === 'LOAN' ? 'Editar préstamo' : 'Editar'} disabled={loading} testId={`credit-edit-${credit.id}`} onClick={() => onEdit(credit)} />
      <span className={styles.desktopMoreAction}><AnchoredActionMenu label={`Más acciones de ${credit.name}`} actions={secondaryActions} disabled={loading} align="end" /></span>
      <span className={styles.compactMoreAction}><AnchoredActionMenu label={`Acciones de ${credit.name}`} actions={actions} disabled={loading} align="end" /></span>
    </div>
  )
}

function statusLabel(status: string) {
  if (status === 'ACTIVE') return 'Activo'
  if (status === 'BLOCKED') return 'Bloqueado'
  return 'Cerrado'
}

function statusTone(status: string): 'success' | 'muted' | 'warning' {
  return status === 'ACTIVE' ? 'success' : status === 'BLOCKED' ? 'warning' : 'muted'
}

export function CreditsListPanel({ onCreate }: { onCreate: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CreditDisplayType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [bankEntities, setBankEntities] = useState<BankEntityOption[]>([])
  const [bankEntitiesLoading, setBankEntitiesLoading] = useState(true)
  const [bankEntitiesError, setBankEntitiesError] = useState<string | null>(null)
  const [editingCredit, setEditingCredit] = useState<CreditListItem | null>(null)
  const [isLoanFinancialEdit, setIsLoanFinancialEdit] = useState(false)
  const [viewingLoan, setViewingLoan] = useState<CreditListItem | null>(null)
  const [editForm, setEditForm] = useState<CreditEditForm>({ name: '', notes: '' })
  const [pendingDelete, setPendingDelete] = useState<CreditListItem | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { credits, isLoading, error: hookError, refetch } = useCredits({ status: undefined })

  const loadBankEntities = useCallback(async () => {
    setBankEntitiesLoading(true)
    setBankEntitiesError(null)
    try {
      const response = await fetch('/api/bank-entities', { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok || !Array.isArray(json.data)) {
        throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las entidades financieras.'))
      }
      setBankEntities(json.data)
    } catch (error) {
      setBankEntitiesError(error instanceof Error ? error.message : 'No se pudieron cargar las entidades financieras.')
    } finally {
      setBankEntitiesLoading(false)
    }
  }, [])

  useEffect(() => { void loadBankEntities() }, [loadBankEntities])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return credits.filter(credit => {
      if (typeFilter !== 'all' && credit.display_type !== typeFilter) return false
      if (statusFilter !== 'all' && credit.status !== statusFilter) return false
      if (currencyFilter !== 'all' && credit.currency !== currencyFilter) return false
      if (bankFilter === 'none' && credit.bank_entity_id) return false
      if (bankFilter !== 'all' && bankFilter !== 'none' && credit.bank_entity_id !== bankFilter) return false
      if (!query) return true
      return [credit.name, credit.bank_entity?.name, credit.bank_entity?.short_name, credit.account?.name]
        .filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(query))
    })
  }, [bankFilter, credits, currencyFilter, search, statusFilter, typeFilter])

  const overview = useMemo(() => summarizeCredits(credits), [credits])
  const activeCountLabel = isLoading ? 'Cargando…' : String(overview.activeCount)
  const surfaceError = actionError ?? bankEntitiesError ?? resolveErrorMessage(hookError)
  const editIsCard = editingCredit?.credit_type === 'CREDIT_CARD'
  const editIsLoan = editingCredit?.display_type === 'LOAN'
  const editIsLoanFinancial = Boolean(editIsLoan && isLoanFinancialEdit)

  const openEditModal = useCallback(async (credit: CreditListItem) => {
    setActionError(null)
    let canEditLoanFinances = false
    if (credit.display_type === 'LOAN') {
      try {
        const response = await fetch(`/api/credits/${credit.id}`, { cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo verificar el préstamo.'))
        canEditLoanFinances = Boolean(json.data?.permissions?.can_edit_loan_finances)
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'No se pudo verificar el préstamo.')
      }
    }
    setIsLoanFinancialEdit(canEditLoanFinances)
    setEditingCredit(credit)
    setEditForm({ name: credit.name, notes: credit.notes ?? '' })
  }, [])

  const openLoanPreview = useCallback((credit: CreditListItem) => setViewingLoan(credit), [])

  const closeEditModal = useCallback(() => {
    if (actionLoadingId) return
    setEditingCredit(null)
    setIsLoanFinancialEdit(false)
    setEditForm({ name: '', notes: '' })
  }, [actionLoadingId])

  const handleToggleStatus = useCallback(async (credit: CreditListItem) => {
    if (actionLoadingId) return
    const nextStatus = credit.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE'
    setActionLoadingId(credit.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/credits/${credit.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el estado.'))
      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
      router.refresh()
      toast.success(nextStatus === 'ACTIVE' ? 'Crédito activado' : 'Crédito desactivado', credit.name, { persist: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar.'
      setActionError(message)
      toast.error('Error', message)
    } finally { setActionLoadingId(null) }
  }, [actionLoadingId, refetch, router, toast])

  const handleSaveEdit = useCallback(async () => {
    if (!editingCredit || actionLoadingId) return
    const name = editForm.name.trim()
    if (name.length < 2) {
      const message = 'El nombre debe tener al menos 2 caracteres.'
      setActionError(message)
      toast.error('No se pudo actualizar el crédito', message)
      return
    }
    setActionLoadingId(editingCredit.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/credits/${editingCredit.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, notes: editForm.notes.trim() || null }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.ok) throw new Error(getApiErrorMessage(json, 'No se pudo actualizar el crédito.'))
      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
      router.refresh()
      toast.success('Crédito actualizado', name, { persist: false })
      closeEditModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el crédito.'
      setActionError(message)
      toast.error('No se pudo actualizar el crédito', message)
    } finally { setActionLoadingId(null) }
  }, [actionLoadingId, closeEditModal, editForm, editingCredit, refetch, router, toast])

  const afterFormSuccess = useCallback(async (name: string, type: 'Tarjeta' | 'Préstamo') => {
    await refetch()
    await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
    router.refresh()
    toast.success(`${type} actualizado`, name, { persist: false })
    closeEditModal()
  }, [closeEditModal, refetch, router, toast])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete || actionLoadingId) return
    setActionLoadingId(pendingDelete.id)
    setActionError(null)
    try {
      const response = await fetch(`/api/credits/${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null)
        throw new Error(getApiErrorMessage(json, 'No se pudo eliminar el crédito.'))
      }
      await refetch()
      await mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits'))
      router.refresh()
      toast.success('Crédito eliminado', pendingDelete.name, { persist: false })
      setPendingDelete(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al eliminar.'
      setActionError(message)
      toast.error('No se pudo eliminar', message)
    } finally { setActionLoadingId(null) }
  }, [actionLoadingId, pendingDelete, refetch, router, toast])

  const clearFilters = useCallback(() => {
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
    setCurrencyFilter('all')
    setBankFilter('all')
  }, [])

  const bankOptions = useMemo(() => [
    { value: 'all', label: bankEntitiesLoading ? 'Cargando entidades…' : 'Todas las entidades' },
    { value: 'none', label: 'Sin entidad' },
    ...bankEntities.map(bank => ({ value: bank.id, label: bank.name })),
  ], [bankEntities, bankEntitiesLoading])
  const currencyOptions = useMemo(() => Array.from(new Set(credits.map(credit => credit.currency).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map(currency => ({ value: currency, label: currency })), [credits])

  const renderActions = (credit: CreditListItem) => (
    <CreditActions
      credit={credit}
      loading={Boolean(actionLoadingId)}
      onEdit={item => void openEditModal(item)}
      onToggle={item => void handleToggleStatus(item)}
      onDelete={item => { setActionError(null); setPendingDelete(item) }}
      onViewLoan={openLoanPreview}
    />
  )

  const renderRecord = (credit: CreditListItem) => {
    const isActive = credit.status === 'ACTIVE'
    const issuer = bankName(credit)
    return viewMode === 'list' ? (
      <article key={credit.id} className={styles.recordRow} data-testid={`credit-row-${credit.id}`}>
        <div className={styles.productCell}>
          <span className={`${styles.creditIcon} ${creditIconClass(credit.display_type)}`}>{creditIcon(credit.credit_type)}</span>
          <span className={styles.productCopy}>
            <span className={styles.productName}>{credit.name}</span>
            <span className={styles.productMeta}>{issuer} · {credit.account?.name ?? 'Cuenta no vinculada'}</span>
          </span>
        </div>
        <div className={styles.amountCell}><CreditAmount credit={credit} /></div>
        <div className={styles.detailsCell}>
          <span className={styles.kindLine}>
            <StatusBadge tone={getCreditDisplayTone(credit.display_type)} dot={false}>{getCreditDisplayLabel(credit.display_type)}</StatusBadge>
            <StatusBadge tone={statusTone(credit.status)}>{statusLabel(credit.status)}</StatusBadge>
          </span>
          <CreditSecondaryFacts credit={credit} />
        </div>
        <div className={styles.dateCell}>
          {credit.display_type === 'CARD'
            ? credit.payment_day ? `Pago día ${credit.payment_day}` : 'Sin día de pago'
            : credit.display_type === 'LOAN' ? 'Ver cronograma' : 'No registrado'}
        </div>
        <div className={styles.actionCell}>{renderActions(credit)}</div>
      </article>
    ) : (
      <article key={credit.id} className={styles.creditCard} data-testid={`credit-card-${credit.id}`}>
        <header className={styles.cardHeader}>
          <span className={`${styles.creditIcon} ${creditIconClass(credit.display_type)}`}>{creditIcon(credit.credit_type)}</span>
          <div className={styles.productCopy}>
            <span className={styles.productName}>{credit.name}</span>
            <span className={styles.productMeta}>{issuer}</span>
          </div>
          <StatusBadge tone={statusTone(credit.status)}>{statusLabel(credit.status)}</StatusBadge>
        </header>
        <div className={styles.cardAmount}><CreditAmount credit={credit} /></div>
        <div className={styles.cardFacts}>
          <StatusBadge tone={getCreditDisplayTone(credit.display_type)} dot={false}>{getCreditDisplayLabel(credit.display_type)}</StatusBadge>
          <CreditSecondaryFacts credit={credit} />
        </div>
        <footer className={styles.cardActions}>{renderActions(credit)}</footer>
      </article>
    )
  }

  return (
    <>
      <div className={styles.page}>
        <header className={`${pageStyles.pageOverview} ${styles.pageOverview}`} data-testid="credits-page-overview">
          <div className={styles.heroHeader}>
            <div className={styles.heroCopy}>
              <h1 data-ft-route-heading="" tabIndex={-1}>Créditos</h1>
              <p>Tarjetas, préstamos y líneas de crédito en su moneda y contexto.</p>
            </div>
            <CreateModuleButton
              onClick={onCreate}
              label="Nuevo crédito"
              className={`${pageStyles.v3ModulePrimaryAction} ${styles.createAction}`}
              testId="credits-hero-create-button"
            />
          </div>

          <section className={`${pageStyles.summary} ${styles.summary}`} aria-label="Resumen de créditos" data-ft-route-group="summary">
            <div className={pageStyles.summaryItem}>
              <p>Deuda activa en tarjetas</p>
              <div className={`${pageStyles.summaryValue} ${styles.summaryValue}`}>
                {isLoading ? 'Cargando…' : overview.activeCardCurrencyCount.PEN ? formatCurrency(overview.cardDebt.PEN, 'PEN') : '—'}
              </div>
              <span className={styles.summaryDetail}>
                {overview.activeCardCount
                  ? overview.activeCardCurrencyCount.USD ? formatCurrency(overview.cardDebt.USD, 'USD') : '—'
                  : 'Sin tarjetas activas'}
              </span>
            </div>
            <div className={pageStyles.summaryItem}>
              <p>Capital original de préstamos</p>
              <div className={`${pageStyles.summaryValue} ${styles.summaryValue}`}>
                {isLoading ? 'Cargando…' : overview.verifiedLoanCountByCurrency.PEN ? formatCurrency(overview.verifiedLoanCapital.PEN, 'PEN') : '—'}
              </div>
              <span className={styles.summaryDetail}>
                {isLoading ? 'Cargando productos…' : overview.activeLoanCount === 0
                  ? 'Sin préstamos activos'
                  : `${overview.verifiedLoanCountByCurrency.USD ? formatCurrency(overview.verifiedLoanCapital.USD, 'USD') : '—'}${overview.unavailableLoanCapitalCount ? ` · ${overview.unavailableLoanCapitalCount} sin capital verificable` : ''}`}
              </span>
            </div>
            <div className={`${pageStyles.summaryItem} ${styles.productSummary}`}>
              <p>Productos activos</p>
              <div className={`${pageStyles.summaryValue} ${styles.summaryValue}`}>{activeCountLabel}</div>
              <span className={styles.summaryDetail}>
                {isLoading ? 'Cargando productos…' : `${overview.activeLineCount} línea${overview.activeLineCount === 1 ? '' : 's'} · ${overview.closedCount} cerrado${overview.closedCount === 1 ? '' : 's'}`}
              </span>
            </div>
          </section>
        </header>

        <section className={styles.controls} aria-label="Filtros de créditos">
          <div className={`${pageStyles.tabs} ${styles.tabs}`} role="tablist" aria-label="Tipo de crédito">
            {([
              ['all', 'Todos'], ['CARD', 'Tarjetas'], ['LOAN', 'Préstamos'], ['LINE', 'Líneas'],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={typeFilter === value}
                className={typeFilter === value ? styles.activeTab : ''}
                key={value}
                onClick={() => setTypeFilter(value)}
              >{label}</button>
            ))}
          </div>
          <div className={`${pageStyles.controls} ${pageStyles.portfolioFilterBar} ${pageStyles.portfolioControls} ${styles.filterBar}`}>
            <div className={pageStyles.controlsMain}>
            <DataSearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar crédito o entidad"
              aria-label="Buscar crédito o entidad"
              data-testid="credits-search-input"
              className={`${pageStyles.searchControl} ${styles.search}`}
            />
            <AppSelect
              ariaLabel="Filtrar créditos por estado"
              value={statusFilter}
              onChange={value => setStatusFilter(value as StatusFilter)}
              compact
              className={`${styles.filterSelect} ${styles.statusFilter} filters-control`}
              options={[
                { value: 'all', label: 'Todos los estados' }, { value: 'ACTIVE', label: 'Activos' },
                { value: 'CLOSED', label: 'Cerrados' }, { value: 'BLOCKED', label: 'Bloqueados' },
              ]}
              testId="credits-status-filter"
            />
            <AppSelect
              ariaLabel="Filtrar créditos por moneda"
              value={currencyFilter}
              onChange={value => setCurrencyFilter(value as CurrencyFilter)}
              compact
              className={`${styles.filterSelect} ${styles.currencyFilter} filters-control`}
              options={[{ value: 'all', label: 'Todas las monedas' }, ...currencyOptions]}
              testId="credits-currency-filter"
            />
            <AppSelect
              ariaLabel="Filtrar créditos por entidad"
              value={bankFilter}
              onChange={setBankFilter}
              compact
              className={`${styles.filterSelect} ${styles.entityFilter} filters-control`}
              options={bankOptions}
              loading={bankEntitiesLoading}
              error={bankEntitiesError}
              onRetry={() => void loadBankEntities()}
              searchPlaceholder="Buscar entidad…"
              testId="credits-entity-filter"
            />
            </div>
            <div className={`${pageStyles.controlsActions} ${styles.toolbarActions}`}>
              <ViewToggle value={viewMode} onChange={setViewMode} id="credits-view-toggle" />
              <span className={styles.resultCount} aria-live="polite">{isLoading ? 'Cargando…' : `${filtered.length} productos`}</span>
            </div>
          </div>
        </section>

        {surfaceError ? <DataErrorBanner message={surfaceError} onRetry={() => { void refetch(); void loadBankEntities() }} /> : null}

        {isLoading ? (
          <DataTable density="credit" className={styles.table}>
            {[0, 1, 2].map(index => <div className={styles.skeletonRow} key={index} aria-hidden="true"><span /><span /><span /><span /><span /></div>)}
          </DataTable>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={credits.length ? 'No encontramos créditos con esos filtros.' : 'Todavía no tienes créditos registrados.'}
            description={credits.length ? 'Ajusta la búsqueda o los filtros para ver otros productos.' : 'Registra una tarjeta, un préstamo o una línea para consultar sus datos aquí.'}
            action={credits.length ? { label: 'Limpiar filtros', onClick: clearFilters } : { label: 'Nuevo crédito', onClick: onCreate }}
          />
        ) : viewMode === 'list' ? (
          <DataTable density="credit" className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Producto</span><span>Importe</span><span>Línea / cronograma</span><span>Vencimiento</span><span className="text-right">Acciones</span>
            </div>
            <div className={styles.records}>{filtered.map(renderRecord)}</div>
          </DataTable>
        ) : (
          <div className={styles.cardGrid}>{filtered.map(renderRecord)}</div>
        )}
      </div>

      <RecordModal
        open={Boolean(editingCredit)}
        onClose={closeEditModal}
        eyebrow="Créditos"
        title={editIsCard ? 'Editar tarjeta de crédito' : editIsLoanFinancial ? 'Editar préstamo bancario' : 'Editar crédito'}
        subtitle={editIsCard ? 'Ajusta los datos permitidos de la tarjeta.' : editIsLoanFinancial ? 'Actualiza el préstamo y cronograma si sus cuotas aún no tienen pagos.' : 'Actualiza la referencia sin modificar el cronograma existente.'}
        size={editIsLoanFinancial ? 'xl' : undefined}
        widthClassName={editIsCard || editIsLoanFinancial ? 'w-[calc(100vw-32px)] max-w-[1120px]' : 'w-[calc(100vw-32px)] max-w-[720px]'}
        bodyClassName={editIsLoanFinancial ? 'credits-modal-body !overflow-hidden py-4' : undefined}
        presentation="workbench"
        overlayClassName={editIsCard || editIsLoanFinancial ? workbenchStyles.creditFormOverlay : undefined}
        motionSource="pointer"
        testId="credits-edit-modal"
      >
        {editIsCard && editingCredit ? (
          <CreditCardForm mode="edit" credit={editingCredit} onCancel={closeEditModal} onSuccess={name => void afterFormSuccess(name, 'Tarjeta')} />
        ) : editIsLoanFinancial && editingCredit ? (
          <BankLoanForm key={editingCredit.id} mode="edit" creditId={editingCredit.id} onCancel={closeEditModal} onSuccess={name => void afterFormSuccess(name, 'Préstamo')} />
        ) : (
          <>
            <div className="space-y-[var(--ft-form-section-gap)]">
              <FormSection title="Datos base" columns="2" className="rounded-[var(--ft-form-radius)] border border-[var(--ft-form-border)] bg-[var(--ft-form-surface)] p-4 [--ft-form-field-gap:12px] [--ft-form-section-gap:12px]">
                <FormField label="Nombre" className="md:col-span-2">
                  <input value={editForm.name} onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))} className="field-base ft-form-input w-full" maxLength={100} disabled={Boolean(actionLoadingId)} />
                </FormField>
                <FormField label="Notas" optional className="md:col-span-2">
                  <textarea value={editForm.notes} onChange={event => setEditForm(prev => ({ ...prev, notes: event.target.value }))} className="field-base ft-form-input min-h-[112px] w-full resize-y" maxLength={500} disabled={Boolean(actionLoadingId)} />
                </FormField>
              </FormSection>
              {actionError ? <p className="rounded-[var(--ft-form-radius)] border border-[color:var(--ft-form-error)]/20 bg-[var(--ft-danger-soft)] px-3.5 py-3 text-[12px] font-medium text-[var(--ft-form-error)]">{actionError}</p> : null}
            </div>
            <RecordModalFooter>
              <FormActions
                secondaryAction={<Button type="button" onClick={closeEditModal} disabled={Boolean(actionLoadingId)} variant="secondary" size="lg">Cancelar</Button>}
                primaryAction={<Button type="button" onClick={() => void handleSaveEdit()} disabled={Boolean(actionLoadingId)} loading={Boolean(editingCredit && actionLoadingId === editingCredit.id)} variant="primary" size="lg" testId="credits-edit-save-button">Guardar cambios</Button>}
              />
            </RecordModalFooter>
          </>
        )}
      </RecordModal>

      <LoanDetailsModal credit={viewingLoan} open={Boolean(viewingLoan)} onClose={() => setViewingLoan(null)} onEdit={credit => void openEditModal(credit)} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar crédito"
        message={<>Se eliminará <span className="font-semibold text-[var(--ft-text-strong)]">{pendingDelete?.name}</span>. Si tiene transacciones asociadas, la operación será bloqueada.</>}
        onCancel={() => { if (!actionLoadingId) setPendingDelete(null) }}
        onConfirm={() => void handleDelete()}
        loading={pendingDelete ? actionLoadingId === pendingDelete.id : false}
        danger
        confirmLabel="Eliminar"
        testId="credits-delete-modal"
        cancelTestId="credits-delete-cancel-button"
        confirmTestId="credits-delete-confirm-button"
      />
    </>
  )
}
