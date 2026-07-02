'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { mutate } from 'swr'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { TransactionTable } from '@/components/tables/TransactionTable'
import { RecordModal } from '@/components/ui/RecordModal'
import { Button } from '@/components/ui/Button'
import { CreateModuleButton } from '@/components/ui/CreateModuleButton'
import { useToast } from '@/lib/toast/toast'
import type { TransactionFormOptions, TransactionFormValues } from '@/lib/contracts/ui.contracts'
import type { CreateTransactionResult } from '@/modules/transactions/transaction.service.types'
import {
  OperationTypeSelector,
  operationTypeToFormConfig,
  operationTypeLabel,
  type OperationType,
} from '@/components/transactions/OperationTypeSelector'

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

  const [isModalOpen, setIsModalOpen] = useState(false)
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
    setFormInstanceKey(previous => previous + 1)
    setModalStep('select_type')
    setSelectedOperationType(null)
    setIsModalOpen(true)

    if (openFromQuery) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('new', 'transaction')
    router.replace(toNextUrl(pathname, params), { scroll: false })
  }, [openFromQuery, pathname, router, searchParams])

  const closeCreateModal = useCallback(() => {
    setIsModalOpen(false)
    setModalStep('select_type')
    setSelectedOperationType(null)
    clearCreateQueryParams()
  }, [clearCreateQueryParams])

  const retryPreload = useCallback(() => {
    router.refresh()
  }, [router])

  // PRD: cuando el usuario elige un tipo de operación, pasar al formulario
  const handleOperationTypeSelected = useCallback((opType: OperationType) => {
    setSelectedOperationType(opType)
    setFormInstanceKey(previous => previous + 1)
    setModalStep('form')
  }, [])

  const handleBackToTypeSelection = useCallback(() => {
    setModalStep('select_type')
    setSelectedOperationType(null)
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
        setModalStep('form')
        setSelectedOperationType(prefilledOperationType)
      }
      setIsModalOpen(true)
      return
    }

    handledQueryOpenRef.current = false
  }, [hasPrefillParams, openFromQuery, prefilledOperationType])

  const modalInitialValues = useMemo(() => {
    // Si vino con prefill desde URL, usar esos valores
    if (openFromQuery && hasPrefillParams && !selectedOperationType) return initialValues
    // Si el usuario eligió un tipo de operación, mapear a form config
    if (selectedOperationType) {
      return {
        ...initialValues,
        ...(operationTypeToFormConfig(selectedOperationType) as Partial<TransactionFormValues>),
      }
    }
    return undefined
  }, [openFromQuery, hasPrefillParams, initialValues, selectedOperationType])

  const modalTitle = modalStep === 'form' && selectedOperationType
    ? operationTypeLabel(selectedOperationType)
    : 'Nueva transacción'

  const modalSubtitle = modalStep === 'form' && selectedOperationType
    ? `Registrar operación de tipo: ${operationTypeLabel(selectedOperationType)}`
    : 'Selecciona el tipo de operación que deseas registrar.'
  const createModalWidthClassName = useMemo(() => {
    if (modalStep === 'select_type') return 'max-w-[min(96vw,560px)]'

    switch (selectedOperationType) {
      case 'income':
      case 'expense':
      case 'transfer':
        return 'max-w-[min(96vw,920px)]'
      case 'asset_purchase':
      case 'payable_issue':
      case 'payable_pay':
      case 'receivable_issue':
      case 'receivable_collect':
        return 'max-w-[min(96vw,960px)]'
      default:
        return 'max-w-[min(96vw,920px)]'
    }
  }, [modalStep, selectedOperationType])

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
    <div className="space-y-5">
      <section className="rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--c-text-faint)]">
              Libro operativo
            </p>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--c-text-muted)]">
              Registra ingresos, egresos, transferencias y movimientos vinculados a activos, cuentas por pagar y cuentas por cobrar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={openExportModal}
              variant="secondary"
              size="md"
              testId="transactions-summary-export-button"
              leadingIcon={(
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
              )}
            >
              Exportar
            </Button>
            <CreateModuleButton
              onClick={openCreateModal}
              label="Nueva transacción"
              testId="transactions-summary-create-button"
            />
          </div>
        </div>
      </section>

      {primaryPreloadWarning && (
        <section className="rounded-[16px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-amber-50">
                {primaryPreloadWarning.message}
              </p>
              {primaryPreloadWarning.detail && (
                <p className="text-[12px] leading-5 text-amber-100/80">
                  {primaryPreloadWarning.detail}
                </p>
              )}
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

      {/* ── TABLA CON FILTROS (PRD §3 "Después de parte superior" + "Parte intermedia") ── */}
      <TransactionTable options={options} />

      {/* ── MODAL CREAR TRANSACCIÓN (PRD: flujo 2 pasos) ─────────── */}
      <RecordModal
        open={isModalOpen}
        onClose={closeCreateModal}
        eyebrow="Movimientos"
        title={modalTitle}
        subtitle={modalSubtitle}
        widthClassName={createModalWidthClassName}
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
              className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition-colors"
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
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">Periodo</span>
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
              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">Ejercicio</span>
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
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">Portafolios</p>
            <label className="flex items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[12px] font-semibold text-[var(--c-text)]">
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

            <div className="max-h-44 overflow-y-auto rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-2">
              {exportPortfolios.length === 0 ? (
                <p className="px-2 py-3 text-[12px] text-[var(--c-text-muted)]">
                  No hay portafolios disponibles para seleccionar.
                </p>
              ) : (
                <div className="space-y-1">
                  {exportPortfolios.map(portfolio => {
                    const checked = selectedPortfolioIds.includes(portfolio.id)
                    return (
                      <label
                        key={portfolio.id}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12px] hover:bg-[var(--c-surface)]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={allPortfolios}
                            onChange={event => togglePortfolio(portfolio.id, event.target.checked)}
                          />
                          <span className="truncate text-[var(--c-text)]">{portfolio.name}</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--c-text-faint)]">
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
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--c-text-muted)]">Formato</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {EXPORT_FORMAT_OPTIONS.map(option => {
                const active = option.value === exportFormat
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExportFormat(option.value)}
                    className={`rounded-xl border px-3 py-2 text-left transition-all ${
                      active
                        ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)]'
                        : 'border-[var(--c-border)] bg-[var(--c-surface-2)] hover:border-[var(--c-border-hover)]'
                    }`}
                  >
                    <p className="text-[12px] font-bold text-[var(--c-text)]">{option.label}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--c-text-muted)]">{option.hint}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {(exportMetaError || isLoadingExportMeta) && (
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[12px] text-[var(--c-text-muted)]">
              {isLoadingExportMeta
                ? 'Cargando opciones de exportación...'
                : `Aviso: ${exportMetaError}`}
            </div>
          )}

          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
            <p className="text-[12px] font-semibold text-[var(--c-text)]">Resumen de selección</p>
            <p className="mt-0.5 text-[11px] text-[var(--c-text-muted)]">
              Periodo: {EXPORT_PERIOD_OPTIONS.find(option => option.value === exportPeriod)?.label ?? 'Todos'} · Ejercicio: {exportExercise === 'all' ? 'Todos' : exportExercise} · Portafolios: {selectedPortfoliosLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeExportModal}
              disabled={isExporting}
              className="btn-secondary !w-auto px-4 py-2 text-[12px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || (!allPortfolios && selectedPortfolioIds.length === 0)}
              className="btn-primary !w-auto px-4 py-2 text-[12px]"
            >
              {isExporting ? 'Generando...' : 'Exportar ahora'}
            </button>
          </div>
        </div>
      </RecordModal>
    </div>
  )
}
