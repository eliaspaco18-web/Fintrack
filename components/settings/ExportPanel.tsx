'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ProgressMetric } from '@/components/finance/primitives'
import {
  SettingsBadge,
  SettingsMetric,
  SettingsPanel,
  SettingsRow,
  SettingsSubsection,
} from '@/components/settings/primitives'
import { useToast } from '@/lib/toast/toast'
import type { ImportJobWithRows } from '@/lib/imports/import-types'

function IconDownload({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 17.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    </svg>
  )
}

function IconFileText({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6M9 9h1" />
    </svg>
  )
}

function IconUpload({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V10" />
      <path d="m7.5 14.5 4.5-4.5 4.5 4.5" />
      <path d="M4 6.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5" />
    </svg>
  )
}

function IconCheckCircle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.25 2.25L15.75 9.5" />
    </svg>
  )
}

function IconAlertTriangle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 4.4 2.9 17.2A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.8L13.7 4.4a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

type ExportOption = {
  id: string
  title: string
  description: string
  endpoint: string
  filename: string
  badge?: string
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'transactions',
    title: 'Transacciones',
    description: 'Incluye fecha, tipo, monto, cuenta, categoría y descripción del movimiento.',
    endpoint: '/api/profile/export',
    filename: 'transacciones.csv',
    badge: 'CSV',
  },
]

type ImportSummary = NonNullable<ImportJobWithRows['summary']> & {
  totals?: {
    rows?: number
    validRows?: number
    errorRows?: number
    warningRows?: number
  }
  projectedBalances?: Array<{
    portfolioKey: string
    currency: string
    initialBalance: number
    projectedBalance: number
  }>
  globalErrors?: Array<{ field?: string; message?: string; code?: string }>
  globalWarnings?: Array<{ field?: string; message?: string; code?: string }>
  committedTables?: Record<string, number>
}

type ImportProgressState = {
  mode: 'analyze' | 'commit'
  value: number
  title: string
  detail: string
  tone: 'info' | 'success' | 'warning'
}

function progressValueLabel(progress: ImportProgressState): string {
  if (progress.mode === 'commit' && progress.value >= 84 && progress.value < 100) {
    return 'Procesando...'
  }
  return `${Math.round(progress.value)}%`
}

function formatNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat('es-PE').format(numeric)
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`
}

function humanizeSheetName(sheetName: string): string {
  return sheetName
    .replace(/^\d+_?/, '')
    .replace(/_/g, ' ')
    .trim()
}

function humanizeFieldName(field?: string) {
  if (!field) return 'Revisa este dato'
  return field.replace(/_/g, ' ')
}

function correctionHint(field?: string, message?: string): string {
  const normalized = `${field ?? ''} ${message ?? ''}`.toLowerCase()

  if (normalized.includes('portafolio')) {
    return 'Usa exactamente el mismo nombre del portafolio que ya existe en FinTrack.'
  }
  if (normalized.includes('categoria')) {
    return 'Elige una categoría visible en el sistema y respeta el mismo texto.'
  }
  if (normalized.includes('tarjeta_credito') || normalized.includes('tarjeta de credito')) {
    return 'Selecciona una tarjeta existente en FinTrack o cambia la forma de pago.'
  }
  if (normalized.includes('moneda')) {
    return 'Usa PEN o USD tal como aparece en la plantilla.'
  }
  if (normalized.includes('fecha')) {
    return 'Completa la fecha con el formato yyyy-mm-dd.'
  }
  if (normalized.includes('monto') || normalized.includes('decimal')) {
    return 'Usa solo números, sin símbolo de moneda, y con máximo 2 decimales.'
  }
  if (normalized.includes('tipo de cambio') || normalized.includes('exchange')) {
    return 'Esa fecha necesita una tasa disponible. Vuelve a intentar tras sincronizar tipos de cambio o ajusta la fecha del movimiento.'
  }

  return 'Corrige el dato indicado y vuelve a subir la plantilla para validarla otra vez.'
}

export function ExportPanel() {
  const { toast } = useToast()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const [reportDownloading, setReportDownloading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ImportJobWithRows | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const progressDismissRef = useRef<number | null>(null)

  const clearProgressTimers = () => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (progressDismissRef.current !== null) {
      window.clearTimeout(progressDismissRef.current)
      progressDismissRef.current = null
    }
  }

  const startProgress = (
    next: ImportProgressState,
    options: { maxAutoValue?: number; tick?: number } = {},
  ) => {
    clearProgressTimers()
    setImportProgress(next)

    const maxAutoValue = options.maxAutoValue ?? 92
    const tick = options.tick ?? 4

    progressTimerRef.current = window.setInterval(() => {
      setImportProgress(current => {
        if (!current || current.mode !== next.mode) return current
        const candidate = Math.min(maxAutoValue, current.value + tick)
        if (candidate === current.value) return current
        return { ...current, value: candidate }
      })
    }, 280)
  }

  const updateProgress = (patch: Partial<ImportProgressState>) => {
    setImportProgress(current => {
      if (!current) return current
      return { ...current, ...patch }
    })
  }

  const finishProgress = (
    patch: Partial<ImportProgressState>,
    delayMs = 900,
  ) => {
    clearProgressTimers()
    setImportProgress(current => (
      current
        ? { ...current, ...patch, value: 100, tone: patch.tone ?? 'success' }
        : null
    ))
    progressDismissRef.current = window.setTimeout(() => {
      setImportProgress(null)
      progressDismissRef.current = null
    }, delayMs)
  }

  const analyzeWorkbookRequest = async (file: File): Promise<ImportJobWithRows> => {
    const formData = new FormData()
    formData.append('file', file)

    return await new Promise<ImportJobWithRows>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/imports/excel/analyze')
      xhr.responseType = 'json'

      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return
        const uploadRatio = event.total > 0 ? event.loaded / event.total : 0
        const nextValue = Math.min(58, Math.max(14, Math.round(uploadRatio * 58)))
        updateProgress({
          value: nextValue,
          title: 'Subiendo archivo',
          detail: 'Cargando el Excel para validar su estructura y contenido.',
        })
      }

      xhr.onload = () => {
        const payload = xhr.response
          ?? (() => {
            try {
              return JSON.parse(xhr.responseText)
            } catch {
              return null
            }
          })()

        if (xhr.status < 200 || xhr.status >= 300 || !payload?.ok) {
          reject(new Error(payload?.error?.message ?? 'No se pudo analizar el archivo Excel.'))
          return
        }

        resolve(payload.data as ImportJobWithRows)
      }

      xhr.onerror = () => reject(new Error('No se pudo conectar con el servidor.'))
      xhr.send(formData)
    })
  }

  const refreshImportJob = async (jobId: string): Promise<ImportJobWithRows | null> => {
    try {
      const response = await fetch(`/api/imports/${jobId}`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) return null
      const nextAnalysis = data.data as ImportJobWithRows
      setAnalysis(nextAnalysis)
      return nextAnalysis
    } catch {
      return null
    }
  }

  useEffect(() => {
    return () => {
      clearProgressTimers()
    }
  }, [])

  const handleDownload = async (option: ExportOption) => {
    setDownloading(option.id)
    try {
      const response = await fetch(option.endpoint)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error('Error al exportar', data?.error?.message ?? 'Inténtalo de nuevo.')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = option.filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast.success('Descarga iniciada', `Tu archivo ${option.filename} está listo.`)
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setDownloading(null)
    }
  }

  const downloadImportTemplate = async () => {
    setTemplateDownloading(true)
    try {
      const response = await fetch('/api/imports/excel/template')
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error('No se pudo generar la plantilla', data?.error?.message ?? 'Inténtalo de nuevo.')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'FinTrack_Plantilla_Migracion.xlsx'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success('Plantilla descargada', 'Completa las hojas y vuelve a subir el archivo.', { persist: false })
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setTemplateDownloading(false)
    }
  }

  const downloadImportReport = async () => {
    if (!analysis?.id) return
    setReportDownloading(true)
    try {
      const response = await fetch(`/api/imports/${analysis.id}/report`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        toast.error('No se pudo descargar el reporte', data?.error?.message ?? 'Inténtalo de nuevo.')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `FinTrack_Import_Report_${analysis.id}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success('Reporte descargado', 'Ya tienes el detalle de errores y advertencias en CSV.', { persist: false })
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setReportDownloading(false)
    }
  }

  const analyzeFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Archivo no compatible', 'Sube la plantilla en formato .xlsx.')
      return
    }

    setSelectedFileName(file.name)
    setAnalyzing(true)
    setAnalysis(null)
    startProgress({
      mode: 'analyze',
      value: 10,
      title: 'Preparando validación',
      detail: 'Vamos a revisar hojas, formatos y relaciones antes de importar.',
      tone: 'info',
    }, { maxAutoValue: 84, tick: 3 })

    try {
      updateProgress({
        value: 64,
        title: 'Validando contenido',
        detail: 'FinTrack está comprobando montos, categorías, portafolios y relaciones.',
      })

      const nextAnalysis = await analyzeWorkbookRequest(file)
      setAnalysis(nextAnalysis)
      const summary = nextAnalysis.summary as ImportSummary
      const errorRows = summary?.totals?.errorRows ?? nextAnalysis.error_count ?? 0

      finishProgress({
        title: errorRows > 0 ? 'Validación completada con observaciones' : 'Archivo validado',
        detail: errorRows > 0
          ? 'Ya tienes el detalle para corregir antes de confirmar.'
          : 'El archivo quedó listo para la confirmación final.',
        tone: errorRows > 0 ? 'warning' : 'success',
      })

      if (errorRows > 0 || nextAnalysis.error_count > 0) {
        toast.warning('Archivo analizado con errores', 'Corrige las filas marcadas antes de confirmar la importación.')
      } else {
        toast.success('Archivo listo para revisión', 'La información fue validada sin guardar datos finales.', { persist: false })
      }
    } catch (error) {
      finishProgress({
        title: 'Validación interrumpida',
        detail: error instanceof Error ? error.message : 'No se pudo validar el archivo.',
        tone: 'warning',
      }, 1800)
      toast.error('No se pudo analizar', error instanceof Error ? error.message : 'Revisa el archivo y vuelve a intentar.')
    } finally {
      setAnalyzing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const summary = analysis?.summary as ImportSummary | undefined
  const totals = summary?.totals
  const globalIssues = [
    ...(summary?.globalErrors ?? []).map(item => ({ ...item, status: 'ERROR' as const })),
    ...(summary?.globalWarnings ?? []).map(item => ({ ...item, status: 'WARNING' as const })),
  ].slice(0, 6)
  const visibleProblemRows = (analysis?.rows ?? [])
    .filter(row => row.status === 'ERROR' || row.status === 'WARNING')
    .slice(0, 8)
  const totalErrors = analysis?.error_count ?? totals?.errorRows ?? 0
  const hasImportedRows = (analysis?.rows ?? []).some(row => row.status === 'IMPORTED')
  const committedTables = summary?.committedTables ?? {}
  const committedTransactionCount = Number(committedTables.transactions ?? 0)
  const committedReceivableCount = Number(committedTables.receivables ?? 0)
  const committedPayableCount = Number(committedTables.payables ?? 0)
  const committedAssetCount = Number(committedTables.assets ?? 0)
  const committedBudgetCount = Number(committedTables.budgets ?? 0)
  const committedCreditCount = Number(committedTables.credits ?? 0)
  const totalCommittedRecords =
    committedTransactionCount +
    committedReceivableCount +
    committedPayableCount +
    committedAssetCount +
    committedBudgetCount +
    committedCreditCount
  const sheetBreakdown = Object.entries(summary?.sheets ?? {})
  const canCommit =
    !!analysis &&
    totalErrors === 0 &&
    !analyzing &&
    !committing &&
    !rollingBack &&
    (analysis.status === 'VALIDATED' || (analysis.status === 'FAILED' && !hasImportedRows))

  const canRollback =
    !!analysis &&
    analysis.status === 'COMMITTED' &&
    !analyzing &&
    !committing &&
    !rollingBack

  const commitImport = async () => {
    if (!analysis?.id || !canCommit) return
    setCommitting(true)
    startProgress({
      mode: 'commit',
      value: 12,
      title: 'Preparando importación',
      detail: 'Estamos organizando los registros para guardarlos en FinTrack.',
      tone: 'info',
    }, { maxAutoValue: 84, tick: 4 })
    try {
      updateProgress({
        value: 28,
        title: 'Guardando movimientos',
        detail: 'Esto puede tardar un poco si el archivo trae varias filas.',
      })
      const response = await fetch('/api/imports/excel/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ import_job_id: analysis.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        const refreshed = await refreshImportJob(analysis.id)
        finishProgress({
          title: 'Importación interrumpida',
          detail:
            refreshed?.summary?.lastCommitError
            ?? data?.error?.detail
            ?? data?.error?.message
            ?? 'Revisa el análisis y vuelve a intentar.',
          tone: 'warning',
        }, 1800)
        toast.error(
          'No se pudo confirmar',
          refreshed?.summary?.lastCommitError
          ?? data?.error?.detail
          ?? data?.error?.message
          ?? 'Revisa el análisis y vuelve a intentar.'
        )
        return
      }

      const committedAnalysis = data.data as ImportJobWithRows
      setAnalysis(committedAnalysis)
      const committedSummary = committedAnalysis.summary as ImportSummary | undefined
      const committedCounts = committedSummary?.committedTables ?? {}
      const txCount = Number(committedCounts.transactions ?? 0)
      const receivableCount = Number(committedCounts.receivables ?? 0)
      const payableCount = Number(committedCounts.payables ?? 0)
      const parts = [
        txCount > 0 ? `${txCount} transacción${txCount === 1 ? '' : 'es'}` : null,
        receivableCount > 0 ? `${receivableCount} por cobrar` : null,
        payableCount > 0 ? `${payableCount} por pagar` : null,
      ].filter(Boolean)
      finishProgress({
        title: 'Importación completada',
        detail: 'Los registros del Excel ya fueron creados en FinTrack.',
        tone: 'success',
      })
      toast.success(
        'Importación confirmada',
        parts.length > 0
          ? `FinTrack creó ${parts.join(', ')}.`
          : 'FinTrack terminó la importación y ya puedes revisar el resumen creado.',
        {
        category: 'TRANSACTION',
        event: 'IMPORT_JOB_COMMITTED',
        href: '/settings?tab=export',
      })
    } catch {
      const refreshed = await refreshImportJob(analysis.id)
      finishProgress({
        title: 'Importación interrumpida',
        detail:
          refreshed?.summary?.lastCommitError
          ?? 'No se pudo conectar con el servidor durante la importación.',
        tone: 'warning',
      }, 1800)
      toast.error(
        'Error de red',
        refreshed?.summary?.lastCommitError
        ?? 'No se pudo conectar con el servidor.'
      )
    } finally {
      setCommitting(false)
    }
  }

  const rollbackImport = async () => {
    if (!analysis?.id || !canRollback) return
    setRollingBack(true)
    try {
      const response = await fetch(`/api/imports/${analysis.id}/rollback`, {
        method: 'POST',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        toast.error('No se pudo deshacer', data?.error?.detail ?? data?.error?.message ?? 'Revisa el historial y vuelve a intentar.')
        return
      }

      setAnalysis(data.data as ImportJobWithRows)
      toast.success('Importación revertida', 'Los registros creados por esta importación fueron retirados de FinTrack.', {
        category: 'TRANSACTION',
        event: 'IMPORT_JOB_ROLLED_BACK',
        href: '/settings?tab=export',
      })
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setRollingBack(false)
    }
  }

  return (
    <SettingsPanel
      eyebrow="Datos"
      title="Importar y exportar"
      description="Migra información desde Excel y conserva respaldos claros de tus movimientos."
      density="compact"
      className="mx-auto max-w-[960px]"
      action={<SettingsBadge tone="accent">Datos sensibles</SettingsBadge>}
    >
      <div className="space-y-4">
        <SettingsSubsection
          title="Importar desde Excel"
          description="Descarga la plantilla oficial, completa los módulos que necesites y valida el archivo antes de guardar datos finales."
          density="compact"
          action={<SettingsBadge tone={analysis ? (analysis.status === 'COMMITTED' ? 'success' : analysis.status === 'CANCELLED' ? 'neutral' : analysis.status === 'FAILED' || analysis.error_count > 0 ? 'warning' : 'accent') : 'neutral'}>{analysis ? (analysis.status === 'COMMITTED' ? 'Importado' : analysis.status === 'CANCELLED' ? 'Revertido' : analysis.status === 'FAILED' ? 'Con error' : 'Analizado') : 'Datos'}</SettingsBadge>}
        >
          <div className="space-y-3">
            <SettingsRow
              icon={<IconDownload size={16} />}
              title="Plantilla oficial"
              description="Incluye hojas protegidas, formatos de fecha y monto, listas desplegables y metadata de versión."
              variant="compact"
            >
              <Button
                onClick={downloadImportTemplate}
                loading={templateDownloading}
                leadingIcon={<IconDownload size={14} />}
                size="sm"
              >
                Descargar
              </Button>
            </SettingsRow>

            <SettingsRow
              icon={<IconUpload size={16} />}
              title="Validar archivo"
              description={selectedFileName ? selectedFileName : 'Sube la plantilla completada. FinTrack revisará filas, formatos y relaciones sin importar todavía.'}
              variant="compact"
            >
              <div className="flex flex-wrap items-center justify-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void analyzeFile(file)
                  }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  loading={analyzing}
                  leadingIcon={<IconUpload size={14} />}
                  size="sm"
                  variant="primary"
                >
                  Subir Excel
                </Button>
                {analysis ? (
                  <Button
                    onClick={downloadImportReport}
                    loading={reportDownloading}
                    leadingIcon={<IconFileText size={14} />}
                    size="sm"
                    variant="secondary"
                  >
                    Reporte
                  </Button>
                ) : null}
              </div>
            </SettingsRow>

            {importProgress ? (
              <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
                <ProgressMetric
                  value={importProgress.value}
                  label={importProgress.title}
                  valueLabel={progressValueLabel(importProgress)}
                  description={importProgress.detail}
                  tone={importProgress.tone}
                />
              </div>
            ) : null}

            {analysis && totals ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <SettingsMetric
                  label="Filas"
                  value={formatNumber(totals.rows ?? 0)}
                  caption="Leídas"
                />
                <SettingsMetric
                  label="Válidas"
                  value={formatNumber(totals.validRows ?? 0)}
                  caption="Sin avisos"
                />
                <SettingsMetric
                  label="Advertencias"
                  value={formatNumber(totals.warningRows ?? 0)}
                  caption="Revisables"
                />
                <SettingsMetric
                  label="Errores"
                  value={formatNumber(totalErrors)}
                  caption="Bloqueantes"
                />
              </div>
            ) : null}

            {analysis && sheetBreakdown.length > 0 ? (
              <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[12px] font-semibold text-[var(--c-text)]">Resultado por módulo</p>
                  <SettingsBadge tone="neutral">{sheetBreakdown.length} hoja(s)</SettingsBadge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sheetBreakdown.map(([sheetName, stats]) => (
                    <div
                      key={sheetName}
                      className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface-muted)] px-3 py-2"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-[var(--c-text)]">{humanizeSheetName(sheetName)}</p>
                        <SettingsBadge tone={stats.errorRows > 0 ? 'danger' : stats.warningRows > 0 ? 'warning' : 'success'}>
                          {stats.errorRows > 0 ? 'Revisar' : stats.warningRows > 0 ? 'Con aviso' : 'Listo'}
                        </SettingsBadge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--c-text-muted)]">
                        <span>{formatNumber(stats.totalRows)} fila(s)</span>
                        <span>{formatNumber(stats.validRows)} válidas</span>
                        <span>{formatNumber(stats.warningRows)} avisos</span>
                        <span>{formatNumber(stats.errorRows)} errores</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis?.status !== 'COMMITTED' && canCommit ? (
              <div className="rounded-[18px] border border-[color:rgba(63,127,98,0.22)] bg-[var(--c-success-soft)] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--c-success)]">
                      <IconCheckCircle size={15} />
                      Listo para importar
                    </div>
                    <p className="max-w-[58ch] text-[12px] leading-5 text-[var(--c-text-muted)]">
                      FinTrack ya validó la plantilla. Si confirmas ahora, guardará los módulos listos y te mostrará exactamente cuántos registros creó.
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-[var(--c-text-muted)]">
                    <div>{formatNumber(totals?.validRows ?? 0)} fila(s) listas</div>
                    <div>{formatNumber(totals?.warningRows ?? 0)} observación(es) no bloqueantes</div>
                  </div>
                </div>
              </div>
            ) : null}

            {summary?.lastCommitError ? (
              <div className="rounded-[18px] border border-[color:rgba(169,120,47,0.18)] bg-[var(--c-warning-soft)] p-3">
                <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-[var(--c-warning)]">
                  <IconAlertTriangle size={15} />
                  Último intento de importación
                </div>
                <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
                  {summary.lastCommitError}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[var(--c-text-muted)]">
                  {correctionHint(undefined, summary.lastCommitError)}
                </p>
              </div>
            ) : null}

            {summary?.projectedBalances && summary.projectedBalances.length > 0 ? (
              <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[12px] font-semibold text-[var(--c-text)]">Saldos proyectados</p>
                  <SettingsBadge tone="neutral">{summary.projectedBalances.length} portafolio(s)</SettingsBadge>
                </div>
                <div className="divide-y divide-[var(--c-border)]">
                  {summary.projectedBalances.slice(0, 6).map(balance => (
                    <div key={balance.portfolioKey} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                      <span className="min-w-0 truncate font-medium text-[var(--c-text)]">{balance.portfolioKey}</span>
                      <span className="shrink-0 tabular-nums text-[var(--c-text-muted)]">
                        {formatMoney(balance.initialBalance, balance.currency)} → {formatMoney(balance.projectedBalance, balance.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis?.status === 'COMMITTED' && summary?.committedTables ? (
              <div className="rounded-[18px] border border-[color:rgba(63,127,98,0.2)] bg-[var(--c-success-soft)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--c-success)]">
                    <IconCheckCircle size={15} />
                    Importación completada con éxito
                  </div>
                  <SettingsBadge tone="success">{formatNumber(totalCommittedRecords)} registro(s)</SettingsBadge>
                </div>
                <p className="mb-3 text-[12px] leading-5 text-[var(--c-text-muted)]">
                  FinTrack terminó el guardado. Este resumen te confirma qué módulos sí se crearon y te ayuda a revisar el resultado enseguida.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SettingsMetric
                    label="Transacciones"
                    value={formatNumber(committedTransactionCount)}
                    caption="Movimientos creados"
                  />
                  <SettingsMetric
                    label="Por cobrar"
                    value={formatNumber(committedReceivableCount)}
                    caption="Cuentas por cobrar"
                  />
                  <SettingsMetric
                    label="Por pagar"
                    value={formatNumber(committedPayableCount)}
                    caption="Cuentas por pagar"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button href="/transactions" size="sm" variant="primary">
                    Ver movimientos
                  </Button>
                  {committedReceivableCount > 0 ? (
                    <Button href="/receivables" size="sm" variant="secondary">
                      Ver por cobrar
                    </Button>
                  ) : null}
                  {committedPayableCount > 0 ? (
                    <Button href="/payables" size="sm" variant="secondary">
                      Ver por pagar
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {globalIssues.length > 0 ? (
              <div className="rounded-[18px] border border-[color:rgba(184,74,74,0.18)] bg-[var(--c-danger-soft)] p-3">
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--c-danger)]">
                  <IconAlertTriangle size={15} />
                  Problemas de plantilla
                </div>
                <div className="space-y-2">
                  {globalIssues.map((item, index) => (
                    <div key={`${item.status}-${item.field ?? 'global'}-${index}`} className="rounded-[12px] border border-[color:rgba(184,74,74,0.14)] bg-[var(--c-surface)] px-3 py-2 text-[12px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <SettingsBadge tone={item.status === 'ERROR' ? 'danger' : 'warning'}>{item.status === 'ERROR' ? 'Error' : 'Aviso'}</SettingsBadge>
                        {item.field ? <span className="font-medium text-[var(--c-text)]">{item.field}</span> : null}
                      </div>
                      <p className="mt-1 text-[var(--c-text-muted)]">{item.message ?? 'Revisa la plantilla.'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {visibleProblemRows.length > 0 ? (
              <div className="rounded-[18px] border border-[color:rgba(169,120,47,0.18)] bg-[var(--c-warning-soft)] p-3">
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[var(--c-warning)]">
                  <IconAlertTriangle size={15} />
                  Revisión pendiente
                </div>
                <div className="space-y-2">
                  {visibleProblemRows.map(row => {
                    const firstIssue = [...row.errors, ...row.warnings][0] as { message?: string; field?: string } | undefined
                    return (
                      <div key={`${row.sheet_name}-${row.row_number}`} className="rounded-[12px] border border-[color:rgba(169,120,47,0.14)] bg-[var(--c-surface)] px-3 py-2 text-[12px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <SettingsBadge tone={row.status === 'ERROR' ? 'danger' : 'warning'}>{row.status === 'ERROR' ? 'Error' : 'Aviso'}</SettingsBadge>
                          <span className="font-medium text-[var(--c-text)]">{row.sheet_name} · fila {row.row_number}</span>
                          {row.row_key ? <span className="text-[var(--c-text-faint)]">{row.row_key}</span> : null}
                        </div>
                        <p className="mt-1 text-[var(--c-text-muted)]">
                          {firstIssue?.field ? `${firstIssue.field}: ` : null}{firstIssue?.message ?? 'Revisa esta fila.'}
                        </p>
                        <p className="mt-2 text-[11px] leading-5 text-[var(--c-text-faint)]">
                          Qué corregir: {correctionHint(firstIssue?.field, firstIssue?.message)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : analysis && globalIssues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-[18px] border border-[color:rgba(63,127,98,0.2)] bg-[var(--c-success-soft)] px-3 py-3 text-[12px] font-medium text-[var(--c-success)]">
                <IconCheckCircle size={15} />
                El archivo no tiene errores bloqueantes en esta revisión.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface-muted)] px-3 py-3">
              <p className="max-w-[62ch] text-[12px] leading-5 text-[var(--c-text-muted)]">
                {analysis?.status === 'CANCELLED'
                  ? 'Esta importación ya fue revertida. Conservamos el análisis y el historial para auditoría, pero sus registros creados ya no siguen activos.'
                  : analysis?.status === 'COMMITTED'
                  ? 'La importación ya fue confirmada. Si vuelves a subir el mismo archivo, FinTrack lo analizará de nuevo, pero al confirmar evitará duplicar registros ya importados.'
                  : 'La confirmación crea catálogos, portafolios, transacciones y módulos relacionados cuando las referencias y formatos ya están consistentes.'}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {analysis?.status === 'COMMITTED' ? (
                  <Button
                    onClick={() => void rollbackImport()}
                    loading={rollingBack}
                    leadingIcon={<IconAlertTriangle size={14} />}
                    size="sm"
                    variant="secondary"
                  >
                    Deshacer importación
                  </Button>
                ) : null}
                <Button
                  disabled={!canCommit}
                  onClick={() => void commitImport()}
                  loading={committing}
                  leadingIcon={<IconCheckCircle size={14} />}
                  size="md"
                  variant="primary"
                  className={canCommit
                    ? 'min-w-[220px] shadow-[0_10px_30px_rgba(13,107,94,0.18)] ring-1 ring-[rgba(13,107,94,0.12)]'
                    : 'min-w-[220px]'}
                >
                  {analysis?.status === 'FAILED' && !hasImportedRows ? 'Reintentar importación' : 'Confirmar importación'}
                </Button>
              </div>
            </div>
          </div>
        </SettingsSubsection>

        <SettingsSubsection
          title="Descarga disponible"
          description="Priorizamos un export útil y concreto en lugar de varias opciones superficiales."
          density="compact"
        >
          {EXPORT_OPTIONS.map(option => (
            <SettingsRow
              key={option.id}
              icon={<IconFileText size={16} />}
              title={option.title}
              description={option.description}
              variant="compact"
            >
              <div className="flex items-center gap-2">
                {option.badge ? <SettingsBadge tone="neutral">{option.badge}</SettingsBadge> : null}
                <Button
                  onClick={() => handleDownload(option)}
                  loading={downloading === option.id}
                  leadingIcon={<IconDownload size={14} />}
                  size="sm"
                >
                  Descargar
                </Button>
              </div>
            </SettingsRow>
          ))}
        </SettingsSubsection>

        <SettingsSubsection
          title="Nota sensible"
          description="Los archivos exportados contienen información financiera utilizable fuera de FinTrack."
          density="compact"
          action={<SettingsBadge tone="warning">Manéjalo con cuidado</SettingsBadge>}
          className="border-[color:rgba(169,120,47,0.16)]"
        >
          <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
            Guarda el archivo solo en equipos confiables. El formato CSV es compatible con Excel, Sheets y flujos de análisis internos.
          </p>
        </SettingsSubsection>
      </div>
    </SettingsPanel>
  )
}
