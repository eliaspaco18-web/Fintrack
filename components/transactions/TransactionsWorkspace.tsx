'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { TransactionForm } from '@/components/forms/TransactionForm'
import styles from '@/components/tables/TransactionsRound07.module.css'
import { TransactionTable } from '@/components/tables/TransactionTable'
import { RecordModal } from '@/components/ui/RecordModal'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { useToast } from '@/lib/toast/toast'
import { formatCurrency, type TransactionFormOptions, type TransactionFormValues } from '@/lib/contracts/ui.contracts'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'
import type { DashboardSummary } from '@/lib/dashboard/types'
import { fetchDashboardData } from '@/components/dashboard/api'
import {
  OperationTypePopover,
  OperationTypeSelector,
  OPERATION_TITLES,
  type OperationType,
} from '@/components/transactions/OperationTypeSelector'
import { useTransactionModalInitialValues } from '@/components/transactions/use-transaction-modal-initial-values'

export interface TransactionPreloadWarning {
  area: 'options' | 'initialValues'
  message: string
  detail?: string
  affectedOptions: string[]
}

interface TransactionsWorkspaceProps {
  options: TransactionFormOptions
  initialValues: Partial<TransactionFormValues>
  preloadWarnings?: TransactionPreloadWarning[]
}

const PREFILL_QUERY_KEYS = [
  'type',
  'source_account_id',
  'account_id',
  'currency',
  'description',
  'transaction_date',
  'destination_account_id',
  'sender',
  'recipient',
  'budget_id',
  'recurring_name',
  'module',
  'credit_kind',
  'loan_schedule',
  'credit_card_id',
  'category_id',
  'from_recurring',
] as const

type ExportFormat = 'pdf' | 'xlsx' | 'csv'
type ExportPeriod = 'all' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'

interface ExportPortfolioOption {
  id: string
  name: string
  currency: 'PEN' | 'USD'
  is_active: boolean
}

const EXPORT_PERIOD_OPTIONS: Array<{ value: ExportPeriod; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const EXPORT_FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string; hint: string }> = [
  { value: 'pdf', label: 'PDF', hint: 'Resumen visual + detalle tabular profesional.' },
  { value: 'xlsx', label: 'XLSX', hint: 'Hoja ejecutiva + tabla completa en Excel.' },
  { value: 'csv', label: 'CSV', hint: 'Plano y compatible con herramientas analíticas.' },
]

const summaryFetcher = (url: string) => fetchDashboardData<DashboardSummary>(url)

function currentLimaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function toNextUrl(pathname: string, params: URLSearchParams): string {
  const qs = params.toString()
  return qs.length > 0 ? `${pathname}?${qs}` : pathname
}

function inferOperationType(
  initialValues: Partial<TransactionFormValues> | undefined,
  searchParams: URLSearchParams,
): OperationType | null {
  const requestedModule = searchParams.get('module')
  const requestedType = searchParams.get('type')

  if (requestedModule === 'receivable') {
    if (requestedType === 'INCOME') return 'receivable_collect'
    if (requestedType === 'EXPENSE') return 'receivable_issue'
  }

  if (requestedModule === 'payable') {
    if (requestedType === 'EXPENSE') return 'payable_pay'
    if (requestedType === 'INCOME') return 'payable_issue'
  }

  if (!initialValues) return null
  if (initialValues.type === 'TRANSFER') return 'transfer'
  if (initialValues.creates_receivable) return 'receivable_issue'
  if (initialValues.creates_payable) return 'payable_issue'
  if (initialValues.creates_asset) return 'asset_purchase'
  if (initialValues.type === 'INCOME') return 'income'
  if (initialValues.type === 'EXPENSE') return 'expense'
  return null
}

function parseDownloadFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1])
    } catch {
      return utfMatch[1]
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] ?? fallback
}

export function TransactionsWorkspace({
  options,
  initialValues,
  preloadWarnings = [],
}: TransactionsWorkspaceProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const monthSummary = useSWR('/api/dashboard/summary', summaryFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOperationPopoverOpen, setIsOperationPopoverOpen] = useState(false)
  const [isDesktopOperationSelector, setIsDesktopOperationSelector] = useState(false)
  const operationMenuAnchorRef = useRef<HTMLDivElement>(null)
  const operationMenuId = useId()
  const [formInstanceKey, setFormInstanceKey] = useState(0)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingExportMeta, setIsLoadingExportMeta] = useState(false)
  const [exportMetaError, setExportMetaError] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('all')
  const [exportExercise, setExportExercise] = useState('all')
  const [allPortfolios, setAllPortfolios] = useState(true)
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([])
  const handledQueryOpenRef = useRef(false)
  const primaryPreloadWarning = preloadWarnings[0] ?? null
  const optionsLoadWarning =
    preloadWarnings.find(warning => warning.area === 'options') ?? null

  // PRD: flujo de 2 pasos para crear transacción
  const [modalStep, setModalStep] = useState<'select_type' | 'form'>('select_type')
  const [selectedOperationType, setSelectedOperationType] = useState<OperationType | null>(null)

  const openFromQuery = searchParams.get('new') === 'transaction'

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktopOperationSelector(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const hasPrefillParams = useMemo(
    () => PREFILL_QUERY_KEYS.some(key => {
      const value = searchParams.get(key)
      return typeof value === 'string' && value.trim().length > 0
    }),
    [searchParams],
  )
  const prefilledOperationType = useMemo(
    () => inferOperationType(initialValues, searchParams),
    [initialValues, searchParams]
  )

  const clearCreateQueryParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    PREFILL_QUERY_KEYS.forEach(key => params.delete(key))
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [pathname, router, searchParams])

  const openCreateModal = useCallback(() => {
    if (isOperationPopoverOpen) {
      setIsOperationPopoverOpen(false)
      if (openFromQuery) clearCreateQueryParams()
      return
    }

    setFormInstanceKey(previous => previous + 1)
    setModalStep('select_type')
    setSelectedOperationType(null)
    const usePopover = window.matchMedia('(min-width: 768px)').matches
    setIsOperationPopoverOpen(usePopover)
    setIsModalOpen(!usePopover)

    if (openFromQuery) return
    handledQueryOpenRef.current = true
    const params = new URLSearchParams(searchParams.toString())
    params.set('new', 'transaction')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [clearCreateQueryParams, isOperationPopoverOpen, openFromQuery, pathname, router, searchParams])

  const dismissOperationPopover = useCallback(() => {
    setIsOperationPopoverOpen(false)
    if (openFromQuery && !selectedOperationType) clearCreateQueryParams()
  }, [clearCreateQueryParams, openFromQuery, selectedOperationType])

  const closeCreateModal = useCallback(() => {
    setIsOperationPopoverOpen(false)
    setIsModalOpen(false)
    clearCreateQueryParams()
  }, [clearCreateQueryParams])

  const resetCreateModalAfterExit = useCallback(() => {
    // Keep the active selector/form mounted until RecordModal confirms its exit.
    if (isModalOpen) return
    setModalStep('select_type')
    setSelectedOperationType(null)
  }, [isModalOpen])

  const retryPreload = useCallback(() => {
    router.refresh()
  }, [router])

  // PRD: cuando el usuario elige un tipo de operación, pasar al formulario
  const handleOperationTypeSelected = useCallback((opType: OperationType) => {
    setIsOperationPopoverOpen(false)
    setSelectedOperationType(opType)
    setFormInstanceKey(previous => previous + 1)
    setModalStep('form')
    setIsModalOpen(true)
  }, [])

  const handleBackToTypeSelection = useCallback(() => {
    setModalStep('select_type')
    setSelectedOperationType(null)
    const usePopover = window.matchMedia('(min-width: 768px)').matches
    setIsOperationPopoverOpen(usePopover)
    setIsModalOpen(!usePopover)
  }, [])

  const handleSuccess = useCallback(async (result: CreateTransactionResult) => {
    toast.success(
      'Transacción registrada',
      result.transaction.description,
      {
        category: 'TRANSACTION',
        event: 'TRANSACTION_CREATED',
        href: `/transactions/${result.transaction.id}`,
      },
    )

    if (result.recurring_template?.warning) {
      toast.warning(
        'La transacción se guardó, pero no se pudo crear la plantilla recurrente',
        result.recurring_template.warning,
      )
    }

    setIsModalOpen(false)
    setIsOperationPopoverOpen(false)
    clearCreateQueryParams()
    await Promise.all([
      mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/transactions')),
      mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/credits')),
      mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/dashboard')),
    ])
    router.refresh()
  }, [clearCreateQueryParams, router, toast])

  useEffect(() => {
    if (openFromQuery) {
      if (handledQueryOpenRef.current) return
      handledQueryOpenRef.current = true
      setFormInstanceKey(previous => previous + 1)
      if (hasPrefillParams && prefilledOperationType) {
        setIsOperationPopoverOpen(false)
        setModalStep('form')
        setSelectedOperationType(prefilledOperationType)
        setIsModalOpen(true)
      } else {
        const usePopover = window.matchMedia('(min-width: 768px)').matches
        setIsOperationPopoverOpen(usePopover)
        setModalStep('select_type')
        setSelectedOperationType(null)
        setIsModalOpen(!usePopover)
      }
      return
    }

    handledQueryOpenRef.current = false
  }, [hasPrefillParams, openFromQuery, prefilledOperationType])

  const modalInitialValues = useTransactionModalInitialValues(
    initialValues,
    openFromQuery,
    hasPrefillParams,
    selectedOperationType,
  )

  const modalTitle = modalStep === 'form' && selectedOperationType
    ? OPERATION_TITLES[selectedOperationType]
    : '¿Qué vas a registrar?'

  const modalSubtitle = modalStep === 'form' && selectedOperationType
    ? 'Completa los datos reales del movimiento; sus relaciones y validaciones se mantienen.'
    : 'Elige lo que ocurrió. FinTrack mantiene la relación con tus cuentas.'
  const createModalWidthClassName = 'max-w-[min(96vw,580px)]'

  const fallbackPortfolioOptions = useMemo<ExportPortfolioOption[]>(
    () =>
      options.accounts.map(account => ({
        id: account.value,
        name: account.label,
        currency: account.meta?.currency === 'USD' ? 'USD' : 'PEN',
        is_active: true,
      })),
    [options.accounts],
  )

  const fallbackExerciseOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 8 }, (_, index) => String(currentYear - index))
  }, [])

  const reportDate = currentLimaDate()
  const reportMonth = reportDate.slice(0, 7)
  const reportMonthLabel = new Intl.DateTimeFormat('es-PE', {
    month: 'long', year: 'numeric', timeZone: 'America/Lima',
  }).format(new Date(`${reportMonth}-15T12:00:00-05:00`))
  const reportStart = `${reportMonth}-01`

  const [exportYears, setExportYears] = useState<string[]>(fallbackExerciseOptions)
  const [exportPortfolios, setExportPortfolios] = useState<ExportPortfolioOption[]>(fallbackPortfolioOptions)

  useEffect(() => {
    if (exportYears.length === 0) {
      setExportYears(fallbackExerciseOptions)
    }
  }, [exportYears.length, fallbackExerciseOptions])

  useEffect(() => {
    if (exportPortfolios.length === 0) {
      setExportPortfolios(fallbackPortfolioOptions)
    }
  }, [exportPortfolios.length, fallbackPortfolioOptions])

  const portfolioNameById = useMemo(() => {
    const map = new Map<string, string>()
    exportPortfolios.forEach(portfolio => {
      map.set(portfolio.id, portfolio.name)
    })
    return map
  }, [exportPortfolios])

  const selectedPortfoliosLabel = useMemo(() => {
    if (allPortfolios || selectedPortfolioIds.length === 0) return 'Todos'
    return selectedPortfolioIds
      .map(id => portfolioNameById.get(id) ?? id)
      .join(', ')
  }, [allPortfolios, portfolioNameById, selectedPortfolioIds])

  const loadExportMeta = useCallback(async () => {
    setIsLoadingExportMeta(true)
    setExportMetaError(null)

    try {
      const response = await fetch('/api/transactions/export?meta=true', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? 'No se pudieron cargar los filtros de exportación.')
      }

      const years = Array.isArray(payload.data?.years)
        ? payload.data.years.filter((year: unknown) => typeof year === 'string' && /^\d{4}$/.test(year))
        : []

      const portfolios = Array.isArray(payload.data?.portfolios)
        ? payload.data.portfolios
            .map((item: unknown) => {
              const row = item as Partial<ExportPortfolioOption>
              if (
                typeof row?.id !== 'string' ||
                typeof row?.name !== 'string' ||
                (row?.currency !== 'PEN' && row?.currency !== 'USD')
              ) {
                return null
              }

              return {
                id: row.id,
                name: row.name,
                currency: row.currency,
                is_active: Boolean(row.is_active),
              } satisfies ExportPortfolioOption
            })
            .filter((item: ExportPortfolioOption | null): item is ExportPortfolioOption => item !== null)
        : []

      setExportYears(years.length > 0 ? years : fallbackExerciseOptions)
      setExportPortfolios(portfolios.length > 0 ? portfolios : fallbackPortfolioOptions)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'No se pudieron cargar los filtros de exportación.'

      setExportMetaError(message)
      setExportYears(fallbackExerciseOptions)
      setExportPortfolios(fallbackPortfolioOptions)
    } finally {
      setIsLoadingExportMeta(false)
    }
  }, [fallbackExerciseOptions, fallbackPortfolioOptions])

  const openExportModal = useCallback(() => {
    setIsExportModalOpen(true)
    void loadExportMeta()
  }, [loadExportMeta])

  const closeExportModal = useCallback(() => {
    if (isExporting) return
    setIsExportModalOpen(false)
  }, [isExporting])

  const togglePortfolio = useCallback((id: string, checked: boolean) => {
    setAllPortfolios(false)
    setSelectedPortfolioIds(previous => {
      if (checked) {
        if (previous.includes(id)) return previous
        return [...previous, id]
      }
      return previous.filter(currentId => currentId !== id)
    })
  }, [])

  const handleExport = useCallback(async () => {
    if (!allPortfolios && selectedPortfolioIds.length === 0) {
      toast.error('Selecciona portafolios', 'Elige al menos un portafolio o usa la opción Todos.')
      return
    }

    setIsExporting(true)
    setExportMetaError(null)

    try {
      const params = new URLSearchParams()
      params.set('format', exportFormat)
      params.set('period', exportPeriod)
      params.set('exercise', exportExercise)
      params.set(
        'portfolios',
        allPortfolios
          ? 'all'
          : selectedPortfolioIds.join(','),
      )

      const response = await fetch(`/api/transactions/export?${params.toString()}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error?.message ?? 'No se pudo generar la exportación.')
      }

      const blob = await response.blob()
      const fallbackName = `fintrack-movimientos.${exportFormat}`
      const filename = parseDownloadFilename(
        response.headers.get('content-disposition'),
        fallbackName,
      )

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast.success('Exportación generada', `Archivo listo: ${filename}`)
      setIsExportModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo exportar el archivo.'
      toast.error('No se pudo exportar', message)
    } finally {
      setIsExporting(false)
    }
  }, [allPortfolios, exportExercise, exportFormat, exportPeriod, selectedPortfolioIds, toast])

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 pb-10">
      {primaryPreloadWarning && (
        <section
          role="alert"
          className="rounded-panel border border-[color-mix(in_srgb,var(--ft-warning)_24%,var(--ft-border))] bg-[var(--ft-warning-soft)] px-4 py-3.5 text-[13px] text-[var(--ft-warning)] shadow-elevation-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <svg aria-hidden="true" className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 9v4m0 4h.01" />
                <path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold">
                  {primaryPreloadWarning.message}
                </p>
                {primaryPreloadWarning.detail && (
                  <p className="text-[12px] leading-5 text-[var(--ft-text-muted)]">
                    {primaryPreloadWarning.detail}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={retryPreload}
            >
              Reintentar
            </Button>
          </div>
        </section>
      )}

      {/* ── REGISTRO CON FILTROS Y REVISIÓN CONTEXTUAL ──────────────── */}
      <TransactionTable
        options={options}
        toolbarActions={(
          <Button type="button" onClick={openExportModal} variant="secondary" size="sm" className="shrink-0" testId="transactions-summary-export-button" leadingIcon={(
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
          )}>Exportar</Button>
        )}
        workspaceHeader={(
      <div className={styles.pageOverview} data-testid="transactions-page-overview">
            <header aria-labelledby="transactions-workspace-heading" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 id="transactions-workspace-heading" className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">
                  Movimientos
                </h1>
                <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">
                  El registro de lo que entra, sale y se mueve.
                </p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                <span className={`${styles.monthScope} inline-flex items-center`}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
                  <span className="capitalize">{reportMonthLabel}</span>
                </span>
                <div ref={operationMenuAnchorRef} className="w-full sm:w-auto">
                  <CreateModuleButton
                    onClick={openCreateModal}
                    label="Nuevo movimiento"
                    className={`${styles.v3ModulePrimaryAction} w-full sm:w-auto`}
                    testId="transactions-summary-create-button"
                    ariaHasPopup={isDesktopOperationSelector ? 'menu' : 'dialog'}
                    ariaExpanded={isDesktopOperationSelector
                      ? isOperationPopoverOpen
                      : isModalOpen && modalStep === 'select_type'}
                    ariaControls={isDesktopOperationSelector ? operationMenuId : 'transaction-operation-selector-dialog'}
                  />
                </div>
              </div>
            </header>

            <section aria-label={`Resumen del mes: ${reportMonthLabel}`} className={styles.summary}>
              {[
                { label: 'Ingresos', value: monthSummary.data?.ingresos_mes, type: 'INCOME' as const, tone: 'text-[var(--ft-success)]' },
                { label: 'Egresos', value: monthSummary.data?.egresos_mes, type: 'EXPENSE' as const, tone: 'text-[var(--ft-text-strong)]' },
                { label: 'Resultado', value: monthSummary.data?.resultado_mensual, type: null, tone: monthSummary.data && monthSummary.data.resultado_mensual < 0 ? 'text-[var(--ft-danger)]' : 'text-[var(--ft-text-strong)]' },
              ].map(item => (
                <div key={item.label} className={`${styles.summaryItem} min-w-0`}>
                  <p>
                    <span>{item.label}{item.label === 'Resultado' ? ' del mes' : ''} · PEN</span>
                  </p>
                  {monthSummary.data ? (
                    <div className={`${styles.summaryValue} font-display tabular-nums ${item.tone}`}>
                      {item.type ? <a className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ft-focus-ring-color)]" href={`/transactions?type=${item.type}&date_from=${reportStart}&date_to=${reportDate}&page=1`} aria-label={`Ver ${item.label.toLowerCase()} del mes`}>{formatCurrency(item.value ?? 0, 'PEN')}</a> : `${(item.value ?? 0) > 0 ? '+' : ''}${formatCurrency(item.value ?? 0, 'PEN')}`}
                    </div>
                  ) : (
                    <div className="mt-2 h-6 w-32 animate-pulse rounded bg-[var(--ft-surface-muted)] motion-reduce:animate-none" role="status" aria-label={monthSummary.error ? 'Resumen mensual no disponible' : 'Cargando resumen mensual'} />
                  )}
                  {item.label === 'Resultado' ? <small className={styles.summaryNote} title={`Período: ${reportMonthLabel}. Los filtros no cambian estos totales.`}>Excluye transferencias internas</small> : null}
                </div>
              ))}
            </section>
            {monthSummary.error ? (
              <p className="-mt-2 flex items-center gap-2 text-[11px] text-[var(--ft-danger)]" role={monthSummary.data ? 'status' : 'alert'}>
                {monthSummary.data ? 'No se pudo actualizar el resumen; se muestran los últimos datos cargados.' : 'No se pudo cargar el resumen mensual.'}
                <button type="button" onClick={() => void monthSummary.mutate()} className="font-semibold underline underline-offset-2">Reintentar</button>
              </p>
            ) : null}
          </div>
        )}
      />

      <OperationTypePopover
        anchorRef={operationMenuAnchorRef}
        menuId={operationMenuId}
        open={isOperationPopoverOpen}
        onClose={dismissOperationPopover}
        onSelect={handleOperationTypeSelected}
      />

      {/* ── MODAL CREAR TRANSACCIÓN (PRD: flujo 2 pasos) ─────────── */}
      <RecordModal
        open={isModalOpen}
        dialogId="transaction-operation-selector-dialog"
        onClose={closeCreateModal}
        onExitComplete={resetCreateModalAfterExit}
        title={modalTitle}
        subtitle={modalSubtitle}
        widthClassName={createModalWidthClassName}
        presentation="workbench"
        motionSource="pointer"
        overlayClassName={modalStep === 'form' ? styles.formOverlay : styles.astraOverlay}
      >
        {modalStep === 'select_type' ? (
          <OperationTypeSelector onSelect={handleOperationTypeSelected} />
        ) : (
          <div>
            {/* Botón volver al selector de tipo */}
            <button
              type="button"
              onClick={handleBackToTypeSelection}
              disabled={openFromQuery && hasPrefillParams && !!prefilledOperationType}
              className="mb-3 inline-flex items-center gap-1 rounded-control text-[11px] font-semibold text-[var(--ft-text-muted)] transition-colors duration-fast hover:text-[var(--ft-text-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)] motion-reduce:transition-none"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Cambiar tipo de operación
            </button>
            <TransactionForm
              key={formInstanceKey}
              options={options}
              initialValues={modalInitialValues}
              showSuccessSummary={false}
              onSuccess={handleSuccess}
              onCancel={closeCreateModal}
              className="tx-modal-form !space-y-2.5"
              hideTypeSelector
              operationType={selectedOperationType ?? undefined}
              optionsLoadWarning={optionsLoadWarning}
            />
          </div>
        )}
      </RecordModal>

      {/* ── MODAL EXPORTAR ──────────────────────────────────────────── */}
      <RecordModal
        open={isExportModalOpen}
        onClose={closeExportModal}
        eyebrow="Movimientos"
        title="Exportar movimientos"
        subtitle="Selecciona periodo, ejercicio, portafolios y formato para generar un reporte profesional."
        widthClassName="max-w-[min(96vw,920px)]"
        presentation="workbench"
        motionSource="pointer"
        overlayClassName={styles.formOverlay}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">Periodo</span>
              <select
                value={exportPeriod}
                onChange={event => setExportPeriod(event.target.value as ExportPeriod)}
                className="field-base h-[38px]"
              >
                {EXPORT_PERIOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">Ejercicio</span>
              <select
                value={exportExercise}
                onChange={event => setExportExercise(event.target.value)}
                className="field-base h-[38px]"
              >
                <option value="all">Todos</option>
                {exportYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">Portafolios</p>
            <label className="flex items-center gap-2 rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2 text-[12px] font-semibold text-[var(--ft-text-strong)]">
              <input
                type="checkbox"
                checked={allPortfolios}
                onChange={event => {
                  const checked = event.target.checked
                  setAllPortfolios(checked)
                  if (checked) setSelectedPortfolioIds([])
                }}
              />
              Todos
            </label>

            <div className="max-h-44 overflow-y-auto rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] p-2">
              {exportPortfolios.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-[var(--ft-text-muted)]">
                  No hay portafolios disponibles para seleccionar.
                </p>
              ) : (
                <div className="space-y-1">
                  {exportPortfolios.map(portfolio => {
                    const checked = selectedPortfolioIds.includes(portfolio.id)
                    return (
                      <label
                        key={portfolio.id}
                        className="flex items-center justify-between gap-3 rounded-control px-2 py-1.5 text-[12px] transition-colors duration-fast hover:bg-[var(--ft-surface-hover)] motion-reduce:transition-none"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={allPortfolios}
                            onChange={event => togglePortfolio(portfolio.id, event.target.checked)}
                          />
                          <span className="truncate text-[var(--ft-text-strong)]">{portfolio.name}</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--ft-text-subtle)]">
                          {portfolio.currency}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">Formato</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {EXPORT_FORMAT_OPTIONS.map(option => {
                const active = option.value === exportFormat
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExportFormat(option.value)}
                    className={`rounded-surface border px-3 py-2 text-left transition-[background-color,border-color,box-shadow] duration-fast focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)] motion-reduce:transition-none ${
                      active
                        ? 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] shadow-elevation-sm'
                        : 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)] hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)]'
                    }`}
                  >
                    <p className="text-[12px] font-bold text-[var(--ft-text-strong)]">{option.label}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--ft-text-muted)]">{option.hint}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {(exportMetaError || isLoadingExportMeta) && (
            <div className="rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2 text-[12px] text-[var(--ft-text-muted)]">
              {isLoadingExportMeta
                ? 'Cargando opciones de exportación...'
                : `Aviso: ${exportMetaError}`}
            </div>
          )}

          <div className="rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2.5">
            <p className="text-[12px] font-semibold text-[var(--ft-text-strong)]">Resumen de selección</p>
            <p className="mt-0.5 text-[11px] leading-5 text-[var(--ft-text-muted)]">
              Periodo: {EXPORT_PERIOD_OPTIONS.find(option => option.value === exportPeriod)?.label ?? 'Todos'} · Ejercicio: {exportExercise === 'all' ? 'Todos' : exportExercise} · Portafolios: {selectedPortfoliosLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" onClick={closeExportModal} disabled={isExporting} variant="secondary" size="sm">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting || (!allPortfolios && selectedPortfolioIds.length === 0)}
              loading={isExporting}
              variant="primary"
              size="sm"
            >
              {isExporting ? 'Generando...' : 'Exportar ahora'}
            </Button>
          </div>
        </div>
      </RecordModal>
    </div>
  )
}
