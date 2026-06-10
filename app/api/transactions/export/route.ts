// =============================================================================
// app/api/transactions/export/route.ts
// Exporta movimientos en CSV, XLSX y PDF con resumen visual + detalle tabular.
// =============================================================================

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized } from '@/lib/api/response'
import type { CurrencyCode, TransactionType } from '@/types/database.types'

export const runtime = 'nodejs'

type ExportFormat = 'csv' | 'xlsx' | 'pdf'
type ExportPeriod = 'all' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'
type ExportExercise = 'all' | string
type PortfolioFilter = 'all' | string[]

interface AccountRelation {
  id: string
  name: string
  currency: CurrencyCode
  institution: string | null
}

interface CategoryRelation {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE'
}

interface TransactionExportRow {
  id: string
  transaction_date: string
  created_at: string
  type: TransactionType
  amount: number
  amount_pen: number
  currency: CurrencyCode
  exchange_rate: number
  description: string
  notes: string | null
  affects_reports: boolean
  source_account: AccountRelation | null
  destination_account: AccountRelation | null
  category: CategoryRelation | null
}

interface ExportPortfolioOption {
  id: string
  name: string
  currency: CurrencyCode
  is_active: boolean
}

interface TypeSummaryItem {
  type: TransactionType
  label: string
  count: number
  amountPen: number
  share: number
}

interface MonthlySummaryItem {
  key: string
  label: string
  count: number
  incomePen: number
  expensePen: number
  transferPen: number
  netPen: number
}

interface ExportSummary {
  totalCount: number
  incomePen: number
  expensePen: number
  transferPen: number
  netPen: number
  movementPen: number
  byType: TypeSummaryItem[]
  monthly: MonthlySummaryItem[]
  monthlyChart: MonthlySummaryItem[]
}

interface ExportFilters {
  format: ExportFormat
  period: ExportPeriod
  exercise: ExportExercise
  portfolios: PortfolioFilter
}

interface ExportPayload {
  rows: TransactionExportRow[]
  summary: ExportSummary
  filters: ExportFilters
  generatedAt: Date
  filterDescriptor: string
}

interface MetaPayload {
  years: string[]
  portfolios: ExportPortfolioOption[]
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PERIOD_LABELS: Record<ExportPeriod, string> = {
  all: 'Todos',
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Setiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
}

const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Egreso',
  TRANSFER: 'Transferencia',
}

const TYPE_COLORS = {
  INCOME: '#0f9d6d',
  EXPENSE: '#dc4d4d',
  TRANSFER: '#2f83e1',
} as const

const A4_PORTRAIT_WIDTH = 595.28
const A4_PORTRAIT_HEIGHT = 841.89
const PDF_PAGE_SIZE_A4_PORTRAIT: [number, number] = [A4_PORTRAIT_WIDTH, A4_PORTRAIT_HEIGHT]

const exportQuerySchema = z.object({
  meta: z
    .string()
    .optional()
    .transform(value => value === '1' || value === 'true'),
  format: z.enum(['csv', 'xlsx', 'pdf']).default('pdf'),
  period: z
    .string()
    .regex(/^(all|0[1-9]|1[0-2])$/)
    .default('all'),
  exercise: z
    .string()
    .regex(/^(all|\d{4})$/)
    .default('all'),
  portfolios: z.string().default('all'),
})

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function toSafeCurrency(value: unknown): CurrencyCode {
  return value === 'USD' ? 'USD' : 'PEN'
}

function normalizeCategoryScope(scope: unknown, transactionType: unknown): 'INCOME' | 'EXPENSE' {
  if (scope === 'INCOME' || scope === 'EXPENSE') return scope
  if (transactionType === 'INCOME') return 'INCOME'
  return 'EXPENSE'
}

function parsePortfolioFilter(raw: string): PortfolioFilter {
  if (raw === 'all') return 'all'

  const ids = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => UUID_REGEX.test(part))

  if (ids.length === 0) return 'all'
  return Array.from(new Set(ids))
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function monthLabelFromKey(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  if (!year || !month) return monthKey
  const date = new Date(`${year}-${month}-01T00:00:00`)
  return new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' }).format(date)
}

function formatPen(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatOriginal(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(value)
}

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateTimeForFile(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}-${hour}${minute}`
}

function toBodyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(output).set(bytes)
  return output
}

function buildFilterDescriptor(filters: ExportFilters, portfolioNames: string[]): string {
  const periodLabel = PERIOD_LABELS[filters.period]
  const exerciseLabel = filters.exercise === 'all' ? 'Todos' : filters.exercise
  const portfoliosLabel =
    filters.portfolios === 'all' || portfolioNames.length === 0
      ? 'Todos'
      : portfolioNames.join(', ')

  return `Periodo: ${periodLabel} · Ejercicio: ${exerciseLabel} · Portafolios: ${portfoliosLabel}`
}

function applyExportFilters(rows: TransactionExportRow[], filters: ExportFilters): TransactionExportRow[] {
  return rows
    .filter(row => {
      const txDate = row.transaction_date.slice(0, 10)
      const txYear = txDate.slice(0, 4)
      const txMonth = txDate.slice(5, 7)

      if (filters.exercise !== 'all' && txYear !== filters.exercise) return false
      if (filters.period !== 'all' && txMonth !== filters.period) return false

      if (filters.portfolios !== 'all') {
        const sourceId = row.source_account?.id ?? ''
        const destinationId = row.destination_account?.id ?? ''
        if (!filters.portfolios.includes(sourceId) && !filters.portfolios.includes(destinationId)) {
          return false
        }
      }

      return true
    })
    .sort((a, b) => {
      if (a.transaction_date === b.transaction_date) {
        return a.created_at.localeCompare(b.created_at)
      }
      return a.transaction_date.localeCompare(b.transaction_date)
    })
}

function buildSummary(rows: TransactionExportRow[]): ExportSummary {
  let incomePen = 0
  let expensePen = 0
  let transferPen = 0
  let movementPen = 0

  const countByType: Record<TransactionType, number> = {
    INCOME: 0,
    EXPENSE: 0,
    TRANSFER: 0,
  }
  const amountByType: Record<TransactionType, number> = {
    INCOME: 0,
    EXPENSE: 0,
    TRANSFER: 0,
  }

  const monthly = new Map<string, MonthlySummaryItem>()

  rows.forEach(row => {
    const amountPen = Math.abs(toSafeNumber(row.amount_pen))
    movementPen += amountPen
    countByType[row.type] += 1
    amountByType[row.type] += amountPen

    if (row.type === 'INCOME') incomePen += amountPen
    if (row.type === 'EXPENSE') expensePen += amountPen
    if (row.type === 'TRANSFER') transferPen += amountPen

    const monthKey = row.transaction_date.slice(0, 7)
    const current = monthly.get(monthKey) ?? {
      key: monthKey,
      label: monthLabelFromKey(monthKey),
      count: 0,
      incomePen: 0,
      expensePen: 0,
      transferPen: 0,
      netPen: 0,
    }

    current.count += 1
    if (row.type === 'INCOME') current.incomePen += amountPen
    if (row.type === 'EXPENSE') current.expensePen += amountPen
    if (row.type === 'TRANSFER') current.transferPen += amountPen
    current.netPen = current.incomePen - current.expensePen

    monthly.set(monthKey, current)
  })

  const totalCount = rows.length
  const byTypeOrder: TransactionType[] = ['INCOME', 'EXPENSE', 'TRANSFER']
  const byType: TypeSummaryItem[] = byTypeOrder.map(type => ({
    type,
    label: TYPE_LABELS[type],
    count: countByType[type],
    amountPen: amountByType[type],
    share: movementPen > 0 ? amountByType[type] / movementPen : 0,
  }))

  const monthlyItems = Array.from(monthly.values()).sort((a, b) => a.key.localeCompare(b.key))
  const monthlyChart = monthlyItems.slice(-12)

  return {
    totalCount,
    incomePen,
    expensePen,
    transferPen,
    netPen: incomePen - expensePen,
    movementPen,
    byType,
    monthly: monthlyItems,
    monthlyChart,
  }
}

async function readLogoFilePath(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'public', 'brand', 'fintrack-mark.png'),
    path.join(process.cwd(), 'public', 'brand', 'logo-fintrack.png'),
    path.join(process.cwd(), 'public', 'logo.png'),
  ]

  for (const filePath of candidates) {
    try {
      await fs.access(filePath)
      return filePath
    } catch {
      // continúa con el siguiente candidato
    }
  }

  return null
}

async function readLogoBuffer(): Promise<Uint8Array | null> {
  const logoPath = await readLogoFilePath()
  if (!logoPath) return null

  try {
    const bytes = await fs.readFile(logoPath)
    if (bytes.length === 0) return null
    return bytes
  } catch {
    return null
  }
}

async function buildCsv(payload: ExportPayload): Promise<Uint8Array> {
  const headers = [
    'Fecha',
    'Tipo',
    'Portafolio origen',
    'Portafolio destino',
    'Categoria',
    'Descripcion',
    'Monto original',
    'Moneda',
    'Tipo de cambio',
    'Monto PEN',
    'Incluye reportes',
    'Notas',
  ]

  const rows = payload.rows.map(row => {
    const source = row.source_account?.name ?? '—'
    const destination = row.destination_account?.name ?? '—'
    const category = row.category?.name ?? 'Sin categoria'

    return [
      formatDate(row.transaction_date),
      TYPE_LABELS[row.type],
      source,
      destination,
      category,
      row.description,
      row.amount.toFixed(2),
      row.currency,
      row.exchange_rate.toFixed(4),
      row.amount_pen.toFixed(2),
      row.affects_reports ? 'Si' : 'No',
      row.notes ?? '',
    ]
      .map(value => escapeCsv(value))
      .join(',')
  })

  const lines = [
    `Reporte generado,${escapeCsv(formatTimestamp(payload.generatedAt))}`,
    `Filtros,${escapeCsv(payload.filterDescriptor)}`,
    '',
    headers.join(','),
    ...rows,
  ]

  return new TextEncoder().encode(lines.join('\n'))
}

async function buildXlsx(payload: ExportPayload): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FinTrack'
  workbook.lastModifiedBy = 'FinTrack'
  workbook.created = payload.generatedAt
  workbook.modified = payload.generatedAt

  const logoPath = await readLogoFilePath()

  const summarySheet = workbook.addWorksheet('Resumen', {
    views: [{ showGridLines: false }],
  })

  summarySheet.columns = [
    { width: 18 },
    { width: 18 },
    { width: 4 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 4 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ]

  summarySheet.mergeCells('A1:F2')
  const titleCell = summarySheet.getCell('A1')
  titleCell.value = 'FinTrack · Reporte Profesional de Movimientos'
  titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF006948' },
  }

  summarySheet.mergeCells('A3:F3')
  const subtitleCell = summarySheet.getCell('A3')
  subtitleCell.value = 'Resumen ejecutivo con indicadores clave, distribución por tipo y tendencia mensual.'
  subtitleCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF3A4A5A' } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' }

  summarySheet.mergeCells('A5:F5')
  const generatedCell = summarySheet.getCell('A5')
  generatedCell.value = `Generado: ${formatTimestamp(payload.generatedAt)}`
  generatedCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF5A6876' } }

  summarySheet.mergeCells('A6:F6')
  const filterCell = summarySheet.getCell('A6')
  filterCell.value = payload.filterDescriptor
  filterCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF5A6876' } }

  if (logoPath) {
    const imageId = workbook.addImage({ filename: logoPath, extension: 'png' })
    summarySheet.addImage(imageId, {
      tl: { col: 9.05, row: 0.25 },
      ext: { width: 56, height: 56 },
      editAs: 'oneCell',
    })
  }

  const kpiConfigs = [
    { range: 'A8:B10', label: 'Movimientos', value: String(payload.summary.totalCount), color: 'FF006948' },
    { range: 'D8:E10', label: 'Ingresos (PEN)', value: formatPen(payload.summary.incomePen), color: 'FF0F9D6D' },
    { range: 'F8:G10', label: 'Egresos (PEN)', value: formatPen(payload.summary.expensePen), color: 'FFDC4D4D' },
    { range: 'H8:I10', label: 'Neto (PEN)', value: formatPen(payload.summary.netPen), color: 'FF2563EB' },
  ]

  kpiConfigs.forEach(kpi => {
    summarySheet.mergeCells(kpi.range)
    const cell = summarySheet.getCell(kpi.range.split(':')[0] ?? kpi.range)
    cell.value = `${kpi.label}\n${kpi.value}`
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: kpi.color },
    }
    cell.border = {
      top: { style: 'thin', color: { argb: '22FFFFFF' } },
      left: { style: 'thin', color: { argb: '22FFFFFF' } },
      bottom: { style: 'thin', color: { argb: '22FFFFFF' } },
      right: { style: 'thin', color: { argb: '22FFFFFF' } },
    }
  })

  const typeHeaderRow = 13
  summarySheet.getCell(`A${typeHeaderRow}`).value = 'Tipo'
  summarySheet.getCell(`B${typeHeaderRow}`).value = 'Movimientos'
  summarySheet.getCell(`C${typeHeaderRow}`).value = 'Monto PEN'
  summarySheet.getCell(`D${typeHeaderRow}`).value = 'Participación'
  summarySheet.getCell(`E${typeHeaderRow}`).value = 'Gráfico'

  for (let col = 1; col <= 5; col += 1) {
    const cell = summarySheet.getCell(typeHeaderRow, col)
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  }

  const maxTypeAmount = Math.max(1, ...payload.summary.byType.map(item => item.amountPen))

  payload.summary.byType.forEach((item, index) => {
    const row = typeHeaderRow + 1 + index
    const barLength = Math.max(1, Math.round((item.amountPen / maxTypeAmount) * 20))
    const bar = '█'.repeat(barLength)
    const color = TYPE_COLORS[item.type].replace('#', '').toUpperCase()

    summarySheet.getCell(`A${row}`).value = item.label
    summarySheet.getCell(`B${row}`).value = item.count
    summarySheet.getCell(`C${row}`).value = item.amountPen
    summarySheet.getCell(`D${row}`).value = item.share
    summarySheet.getCell(`E${row}`).value = bar

    summarySheet.getCell(`C${row}`).numFmt = '"S/" #,##0.00'
    summarySheet.getCell(`D${row}`).numFmt = '0.0%'
    summarySheet.getCell(`E${row}`).font = { name: 'Consolas', size: 10, color: { argb: `FF${color}` } }

    for (let col = 1; col <= 5; col += 1) {
      const cell = summarySheet.getCell(row, col)
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      if (col === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' },
        }
      }
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' }
      cell.font = cell.font ?? { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }
    }
  })

  const monthlyHeaderRow = 13
  summarySheet.getCell(`H${monthlyHeaderRow}`).value = 'Periodo'
  summarySheet.getCell(`I${monthlyHeaderRow}`).value = 'Neto PEN'
  summarySheet.getCell(`J${monthlyHeaderRow}`).value = 'Tendencia'

  for (const col of ['H', 'I', 'J'] as const) {
    const cell = summarySheet.getCell(`${col}${monthlyHeaderRow}`)
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  }

  const monthlyItems = payload.summary.monthlyChart
  const maxAbsNet = Math.max(1, ...monthlyItems.map(item => Math.abs(item.netPen)))

  monthlyItems.forEach((item, index) => {
    const row = monthlyHeaderRow + 1 + index
    const barLength = Math.max(1, Math.round((Math.abs(item.netPen) / maxAbsNet) * 16))
    const bar = `${item.netPen >= 0 ? '▲' : '▼'} ${'█'.repeat(barLength)}`

    summarySheet.getCell(`H${row}`).value = item.label
    summarySheet.getCell(`I${row}`).value = item.netPen
    summarySheet.getCell(`J${row}`).value = bar

    summarySheet.getCell(`I${row}`).numFmt = '"S/" #,##0.00'
    summarySheet.getCell(`J${row}`).font = {
      name: 'Consolas',
      size: 10,
      color: { argb: item.netPen >= 0 ? 'FF0F9D6D' : 'FFDC4D4D' },
    }

    for (const col of ['H', 'I', 'J'] as const) {
      const cell = summarySheet.getCell(`${col}${row}`)
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { horizontal: col === 'H' ? 'left' : 'center', vertical: 'middle' }
      if (col !== 'J') {
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }
      }
    }
  })

  summarySheet.getCell('A21').value = 'Notas'
  summarySheet.getCell('A21').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } }
  summarySheet.mergeCells('A22:J23')
  const noteCell = summarySheet.getCell('A22')
  noteCell.value =
    'Este reporte fue generado automáticamente por FinTrack. Los montos se consolidan en PEN para facilitar análisis comparativo.'
  noteCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } }
  noteCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }

  const detailSheet = workbook.addWorksheet('Detalle movimientos', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  detailSheet.columns = [
    { key: 'date', width: 13 },
    { key: 'type', width: 14 },
    { key: 'source', width: 24 },
    { key: 'destination', width: 24 },
    { key: 'category', width: 18 },
    { key: 'description', width: 34 },
    { key: 'amount', width: 16 },
    { key: 'currency', width: 9 },
    { key: 'rate', width: 11 },
    { key: 'amountPen', width: 16 },
    { key: 'reports', width: 13 },
    { key: 'notes', width: 22 },
  ]

  detailSheet.mergeCells('A1:L1')
  const detailTitle = detailSheet.getCell('A1')
  detailTitle.value = 'Detalle completo de transacciones'
  detailTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  detailTitle.alignment = { horizontal: 'left', vertical: 'middle' }
  detailTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF006948' } }

  detailSheet.mergeCells('A2:L2')
  const detailMeta = detailSheet.getCell('A2')
  detailMeta.value = `Generado: ${formatTimestamp(payload.generatedAt)} · ${payload.filterDescriptor}`
  detailMeta.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } }

  const detailHeaderRow = 4
  const detailHeaders = [
    'Fecha',
    'Tipo',
    'Portafolio origen',
    'Portafolio destino',
    'Categoría',
    'Descripción',
    'Monto',
    'Moneda',
    'TC',
    'Monto PEN',
    'Reportes',
    'Notas',
  ]

  detailHeaders.forEach((header, index) => {
    const cell = detailSheet.getCell(detailHeaderRow, index + 1)
    cell.value = header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  })

  payload.rows.forEach((row, rowIndex) => {
    const excelRow = detailSheet.addRow({
      date: formatDate(row.transaction_date),
      type: TYPE_LABELS[row.type],
      source: row.source_account?.name ?? '—',
      destination: row.destination_account?.name ?? '—',
      category: row.category?.name ?? 'Sin categoría',
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      rate: row.exchange_rate,
      amountPen: row.amount_pen,
      reports: row.affects_reports ? 'Sí' : 'No',
      notes: row.notes ?? '',
    })

    const excelRowNumber = detailHeaderRow + 1 + rowIndex
    excelRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      if (rowIndex % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    })

    detailSheet.getCell(`G${excelRowNumber}`).numFmt = '#,##0.00'
    detailSheet.getCell(`I${excelRowNumber}`).numFmt = '0.0000'
    detailSheet.getCell(`J${excelRowNumber}`).numFmt = '#,##0.00'

    const typeCell = detailSheet.getCell(`B${excelRowNumber}`)
    typeCell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: {
        argb:
          row.type === 'INCOME'
            ? 'FF0F9D6D'
            : row.type === 'EXPENSE'
              ? 'FFDC4D4D'
              : 'FF2F83E1',
      },
    }
  })

  const totalRowNumber = detailHeaderRow + payload.rows.length + 1
  detailSheet.mergeCells(`A${totalRowNumber}:F${totalRowNumber}`)
  const totalLabelCell = detailSheet.getCell(`A${totalRowNumber}`)
  totalLabelCell.value = 'Totales'
  totalLabelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' }
  totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }

  const amountTotalCell = detailSheet.getCell(`G${totalRowNumber}`)
  amountTotalCell.value = payload.rows.reduce((sum, row) => sum + row.amount, 0)
  amountTotalCell.numFmt = '#,##0.00'
  amountTotalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  amountTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  amountTotalCell.alignment = { horizontal: 'right', vertical: 'middle' }

  const amountPenTotalCell = detailSheet.getCell(`J${totalRowNumber}`)
  amountPenTotalCell.value = payload.rows.reduce((sum, row) => sum + row.amount_pen, 0)
  amountPenTotalCell.numFmt = '#,##0.00'
  amountPenTotalCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  amountPenTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  amountPenTotalCell.alignment = { horizontal: 'right', vertical: 'middle' }

  detailSheet.getCell(`H${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  detailSheet.getCell(`I${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  detailSheet.getCell(`K${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  detailSheet.getCell(`L${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }

  detailSheet.autoFilter = {
    from: { row: detailHeaderRow, column: 1 },
    to: { row: detailHeaderRow, column: 12 },
  }

  if (logoPath) {
    const imageId = workbook.addImage({ filename: logoPath, extension: 'png' })
    detailSheet.addImage(imageId, {
      tl: { col: 11.1, row: 0.25 },
      ext: { width: 42, height: 42 },
      editAs: 'oneCell',
    })
  }

  const output = await workbook.xlsx.writeBuffer()
  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output)
  }
  return new Uint8Array(output)
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let safe = text
  while (safe.length > 1 && font.widthOfTextAtSize(`${safe}…`, size) > maxWidth) {
    safe = safe.slice(0, -1)
  }
  return `${safe}…`
}

function colorFromHex(hex: string) {
  const normalized = /^#?[0-9a-f]{6}$/i.test(hex) ? hex.replace('#', '') : '2f83e1'
  return rgb(
    parseInt(normalized.slice(0, 2), 16) / 255,
    parseInt(normalized.slice(2, 4), 16) / 255,
    parseInt(normalized.slice(4, 6), 16) / 255
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function controlPoint(
  current: { x: number; y: number },
  previous: { x: number; y: number },
  next: { x: number; y: number },
  reverse = false
) {
  const smoothing = 0.2
  const p = previous || current
  const n = next || current
  const angle = Math.atan2(n.y - p.y, n.x - p.x) + (reverse ? Math.PI : 0)
  const length = Math.hypot(n.x - p.x, n.y - p.y) * smoothing
  return {
    x: current.x + Math.cos(angle) * length,
    y: current.y + Math.sin(angle) * length,
  }
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M ${first.x} ${first.y}`

  let d = `M ${first.x} ${first.y}`
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    if (!prev || !curr) continue
    const prevPrev = points[i - 2] ?? prev
    const next = points[i + 1] ?? curr
    const cp1 = controlPoint(prev, prevPrev, curr)
    const cp2 = controlPoint(curr, prev, next, true)
    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${curr.x} ${curr.y}`
  }
  return d
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

function buildDonutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle)
  const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function drawLegendChip(page: PDFPage, label: string, colorHex: string, x: number, y: number, font: PDFFont) {
  const color = colorFromHex(colorHex)
  page.drawRectangle({
    x,
    y: y - 7,
    width: 9,
    height: 9,
    color,
    borderColor: rgb(1, 1, 1),
    borderWidth: 0.45,
  })
  page.drawText(label, {
    x: x + 12.5,
    y: y - 6.6,
    size: 8.2,
    font,
    color: rgb(0.2, 0.26, 0.33),
  })
}

function drawLogoBadge(page: PDFPage, logo: PDFImage | null, x: number, y: number, size: number) {
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.83, 0.89, 0.86),
    borderWidth: 1,
  })

  if (!logo) return

  const ratio = logo.width / logo.height
  const inner = size - 14
  const drawWidth = ratio >= 1 ? inner : inner * ratio
  const drawHeight = ratio >= 1 ? inner / ratio : inner

  page.drawImage(logo, {
    x: x + (size - drawWidth) / 2,
    y: y + (size - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  })
}

function drawDetailHeader(
  page: PDFPage,
  pageIndex: number,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  logo: PDFImage | null,
  generatedAtLabel: string,
  filterDescriptor: string
) {
  const { width, height } = page.getSize()
  const headerHeight = 86

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.954, 0.969, 0.98),
  })

  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: rgb(0.03, 0.34, 0.25),
  })
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: 3,
    color: rgb(0.1, 0.61, 0.44),
  })

  drawLogoBadge(page, logo, width - 68, height - 64, 42)

  page.drawText('FinTrack · Detalle de movimientos', {
    x: 22,
    y: height - 35,
    size: 15.2,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  page.drawText(`Generado: ${generatedAtLabel}`, {
    x: 22,
    y: height - 54,
    size: 8.8,
    font: fontRegular,
    color: rgb(0.92, 0.96, 0.94),
  })

  page.drawText(fitText(filterDescriptor, fontRegular, 8.6, width - 130), {
    x: 22,
    y: height - 67,
    size: 8.6,
    font: fontRegular,
    color: rgb(0.84, 0.91, 0.88),
  })

  const pageLabel = `Página ${pageIndex}`
  const pageLabelWidth = fontRegular.widthOfTextAtSize(pageLabel, 9)
  page.drawText(pageLabel, {
    x: width - pageLabelWidth - 22,
    y: 18,
    size: 9,
    font: fontRegular,
    color: rgb(0.32, 0.39, 0.46),
  })
}

async function buildPdf(payload: ExportPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const logoBuffer = await readLogoBuffer()
  const logo = logoBuffer ? await pdf.embedPng(logoBuffer).catch(() => null) : null

  const summaryPage = pdf.addPage(PDF_PAGE_SIZE_A4_PORTRAIT)
  const { width, height } = summaryPage.getSize()
  const marginX = 28
  const contentWidth = width - marginX * 2

  const pageBg = rgb(0.954, 0.969, 0.98)
  const panelBg = rgb(1, 1, 1)
  const panelBorder = rgb(0.81, 0.87, 0.92)
  const textMain = rgb(0.08, 0.12, 0.18)
  const textMuted = rgb(0.33, 0.41, 0.49)

  summaryPage.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: pageBg,
  })

  const headerHeight = 132
  summaryPage.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: rgb(0.02, 0.34, 0.25),
  })
  summaryPage.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: 4,
    color: rgb(0.1, 0.62, 0.45),
  })

  drawLogoBadge(summaryPage, logo, width - 86, height - 86, 56)

  summaryPage.drawText('Reporte de Movimientos', {
    x: marginX,
    y: height - 49,
    size: 25,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  summaryPage.drawText('Resumen ejecutivo con gráficos analíticos y detalle profesional', {
    x: marginX,
    y: height - 72,
    size: 10.6,
    font: fontRegular,
    color: rgb(0.9, 0.95, 0.93),
  })

  summaryPage.drawText(`Generado: ${formatTimestamp(payload.generatedAt)}`, {
    x: marginX,
    y: height - 92,
    size: 9,
    font: fontRegular,
    color: rgb(0.84, 0.92, 0.88),
  })

  summaryPage.drawText(fitText(payload.filterDescriptor, fontRegular, 8.9, width - marginX * 2 - 82), {
    x: marginX,
    y: height - 106,
    size: 8.9,
    font: fontRegular,
    color: rgb(0.78, 0.89, 0.84),
  })

  const netAccent = payload.summary.netPen >= 0 ? '#0f9d6d' : '#dc4d4d'
  const cards = [
    { label: 'Movimientos', value: String(payload.summary.totalCount), accent: '#0f172a' },
    { label: 'Ingresos (PEN)', value: formatPen(payload.summary.incomePen), accent: TYPE_COLORS.INCOME },
    { label: 'Egresos (PEN)', value: formatPen(payload.summary.expensePen), accent: TYPE_COLORS.EXPENSE },
    { label: 'Neto (PEN)', value: formatPen(payload.summary.netPen), accent: netAccent },
  ] as const

  const cardTopY = height - headerHeight - 60
  const cardHeight = 54
  const cardGapX = 12
  const cardGapY = 10
  const cardWidth = (contentWidth - cardGapX) / 2

  cards.forEach((card, index) => {
    const row = Math.floor(index / 2)
    const col = index % 2
    const x = marginX + col * (cardWidth + cardGapX)
    const y = cardTopY - row * (cardHeight + cardGapY)

    summaryPage.drawRectangle({
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      color: panelBg,
      borderColor: panelBorder,
      borderWidth: 1,
    })
    summaryPage.drawRectangle({
      x,
      y,
      width: 6,
      height: cardHeight,
      color: colorFromHex(card.accent),
    })
    summaryPage.drawText(card.label, {
      x: x + 12,
      y: y + 36,
      size: 8.8,
      font: fontRegular,
      color: textMuted,
    })
    summaryPage.drawText(card.value, {
      x: x + 12,
      y: y + 14,
      size: 14.2,
      font: fontBold,
      color: colorFromHex(card.accent),
    })
  })

  const flowPanelX = marginX
  const flowPanelY = 304
  const flowPanelW = contentWidth
  const flowPanelH = 252
  const mixPanelX = marginX
  const mixPanelY = 58
  const mixPanelW = contentWidth
  const mixPanelH = 230
  const chartData = payload.summary.monthlyChart

  summaryPage.drawRectangle({
    x: flowPanelX,
    y: flowPanelY,
    width: flowPanelW,
    height: flowPanelH,
    color: panelBg,
    borderColor: panelBorder,
    borderWidth: 1.1,
  })
  summaryPage.drawRectangle({
    x: mixPanelX,
    y: mixPanelY,
    width: mixPanelW,
    height: mixPanelH,
    color: panelBg,
    borderColor: panelBorder,
    borderWidth: 1.1,
  })
  summaryPage.drawRectangle({
    x: flowPanelX,
    y: flowPanelY + flowPanelH - 3,
    width: flowPanelW,
    height: 3,
    color: colorFromHex('#0f9d6d'),
  })
  summaryPage.drawRectangle({
    x: mixPanelX,
    y: mixPanelY + mixPanelH - 3,
    width: mixPanelW,
    height: 3,
    color: colorFromHex('#2f83e1'),
  })

  summaryPage.drawText('Cash Flow mensual (PEN)', {
    x: flowPanelX + 14,
    y: flowPanelY + flowPanelH - 24,
    size: 12.4,
    font: fontBold,
    color: textMain,
  })
  summaryPage.drawText('Ingresos vs egresos + curva de neto', {
    x: flowPanelX + 14,
    y: flowPanelY + flowPanelH - 38,
    size: 8.1,
    font: fontRegular,
    color: textMuted,
  })
  drawLegendChip(summaryPage, 'Ingreso', TYPE_COLORS.INCOME, flowPanelX + flowPanelW - 182, flowPanelY + flowPanelH - 20, fontRegular)
  drawLegendChip(summaryPage, 'Egreso', TYPE_COLORS.EXPENSE, flowPanelX + flowPanelW - 120, flowPanelY + flowPanelH - 20, fontRegular)
  drawLegendChip(summaryPage, 'Neto', '#2f83e1', flowPanelX + flowPanelW - 62, flowPanelY + flowPanelH - 20, fontRegular)

  const flowPlotX = flowPanelX + 48
  const flowPlotY = flowPanelY + 48
  const flowPlotW = flowPanelW - 64
  const flowPlotH = flowPanelH - 102

  summaryPage.drawRectangle({
    x: flowPlotX - 12,
    y: flowPlotY - 18,
    width: flowPlotW + 20,
    height: flowPlotH + 28,
    color: rgb(0.975, 0.984, 0.992),
    borderColor: rgb(0.89, 0.93, 0.96),
    borderWidth: 0.8,
  })

  if (chartData.length > 0) {
    const maxAbsFlow = Math.max(
      1,
      ...chartData.flatMap(item => [item.incomePen, item.expensePen, Math.abs(item.netPen)])
    )
    const usableHalf = Math.max(10, flowPlotH / 2 - 10)
    const zeroY = flowPlotY + flowPlotH / 2
    const xStep = chartData.length > 1 ? flowPlotW / (chartData.length - 1) : 0
    const monthSlot = flowPlotW / Math.max(chartData.length, 1)
    const barW = clamp(monthSlot * 0.28, 3.5, 10)
    const yFor = (value: number) => zeroY + (value / maxAbsFlow) * usableHalf

    for (let i = -2; i <= 2; i += 1) {
      const value = (maxAbsFlow / 2) * i
      const y = yFor(value)
      const isZero = i === 0

      summaryPage.drawLine({
        start: { x: flowPlotX, y },
        end: { x: flowPlotX + flowPlotW, y },
        thickness: isZero ? 1.2 : 0.75,
        color: isZero ? rgb(0.56, 0.64, 0.72) : rgb(0.9, 0.93, 0.96),
      })

      const axisLabel = fitText(formatPen(value), fontRegular, 6.8, 36)
      summaryPage.drawText(axisLabel, {
        x: flowPanelX + 8,
        y: y - 2.4,
        size: 6.8,
        font: fontRegular,
        color: rgb(0.46, 0.54, 0.61),
      })
    }

    const netPoints: Array<{ x: number; y: number }> = []

    chartData.forEach((item, index) => {
      const x = flowPlotX + index * xStep
      const incomeY = yFor(item.incomePen)
      const expenseY = yFor(-item.expensePen)
      const netY = yFor(item.netPen)

      const incomeHeight = Math.max(1.2, incomeY - zeroY)
      const expenseHeight = Math.max(1.2, zeroY - expenseY)

      summaryPage.drawRectangle({
        x: x - barW - 1.2,
        y: zeroY,
        width: barW,
        height: incomeHeight,
        color: rgb(0.71, 0.9, 0.81),
      })
      summaryPage.drawRectangle({
        x: x + 1.2,
        y: expenseY,
        width: barW,
        height: expenseHeight,
        color: rgb(0.96, 0.8, 0.8),
      })

      netPoints.push({ x, y: netY })

      const showXLabel = chartData.length <= 8 || index % 2 === 0 || index === chartData.length - 1
      if (showXLabel) {
        const monthShort = fitText((item.label.split(' ')[0] ?? item.label).replace('.', ''), fontRegular, 7.1, 28)
        const monthWidth = fontRegular.widthOfTextAtSize(monthShort, 7.1)
        summaryPage.drawText(monthShort, {
          x: x - monthWidth / 2,
          y: flowPlotY - 14,
          size: 7.1,
          font: fontRegular,
          color: rgb(0.44, 0.51, 0.58),
        })
      }
    })

    if (netPoints.length > 1) {
      const netPath = buildSmoothPath(netPoints)
      const firstPoint = netPoints[0]
      const lastPoint = netPoints[netPoints.length - 1]
      if (firstPoint && lastPoint) {
        const netAreaPath = `${netPath} L ${lastPoint.x} ${zeroY} L ${firstPoint.x} ${zeroY} Z`
        summaryPage.drawSvgPath(netAreaPath, {
          color: colorFromHex('#2f83e1'),
          opacity: 0.12,
        })
      }

      summaryPage.drawSvgPath(netPath, {
        borderColor: colorFromHex('#2f83e1'),
        borderWidth: 2.2,
        opacity: 0.95,
      })
    }

    netPoints.forEach(point => {
      summaryPage.drawCircle({
        x: point.x,
        y: point.y,
        size: 3.2,
        color: rgb(1, 1, 1),
      })
      summaryPage.drawCircle({
        x: point.x,
        y: point.y,
        size: 2.05,
        color: colorFromHex('#2f83e1'),
      })
    })

    const lastPoint = netPoints[netPoints.length - 1]
    const lastData = chartData[chartData.length - 1]
    if (lastPoint && lastData) {
      const netLabel = formatPen(lastData.netPen)
      const netLabelWidth = fontBold.widthOfTextAtSize(netLabel, 7.4)
      const tagW = netLabelWidth + 8
      const tagH = 11.5
      const desiredY = lastData.netPen >= 0 ? lastPoint.y + 8 : lastPoint.y - tagH - 8
      const tagX = clamp(lastPoint.x - tagW / 2, flowPlotX + 1, flowPlotX + flowPlotW - tagW - 1)
      const tagY = clamp(desiredY, flowPlotY + 2, flowPlotY + flowPlotH - tagH - 2)

      summaryPage.drawRectangle({
        x: tagX,
        y: tagY,
        width: tagW,
        height: tagH,
        color: rgb(1, 1, 1),
        borderColor: colorFromHex('#2f83e1'),
        borderWidth: 0.85,
      })
      summaryPage.drawText(netLabel, {
        x: tagX + 4,
        y: tagY + 3,
        size: 7.4,
        font: fontBold,
        color: colorFromHex('#2f83e1'),
      })
    }
  } else {
    const noDataText = 'No hay datos suficientes para construir el cash flow.'
    const noDataWidth = fontRegular.widthOfTextAtSize(noDataText, 9)
    summaryPage.drawText(noDataText, {
      x: flowPlotX + (flowPlotW - noDataWidth) / 2,
      y: flowPlotY + flowPlotH / 2 - 4,
      size: 9,
      font: fontRegular,
      color: rgb(0.47, 0.54, 0.61),
    })
  }

  summaryPage.drawText('Composición por tipo', {
    x: mixPanelX + 14,
    y: mixPanelY + mixPanelH - 24,
    size: 12.4,
    font: fontBold,
    color: textMain,
  })
  summaryPage.drawText('Distribución profesional de volumen y participación', {
    x: mixPanelX + 14,
    y: mixPanelY + mixPanelH - 38,
    size: 8.1,
    font: fontRegular,
    color: textMuted,
  })

  const netCardX = mixPanelX + 14
  const netCardY = mixPanelY + mixPanelH - 72
  const netCardW = mixPanelW - 28
  const netCardH = 42
  const netPositive = payload.summary.netPen >= 0

  summaryPage.drawRectangle({
    x: netCardX,
    y: netCardY,
    width: netCardW,
    height: netCardH,
    color: netPositive ? rgb(0.92, 0.98, 0.95) : rgb(0.99, 0.93, 0.93),
    borderColor: netPositive ? rgb(0.75, 0.9, 0.81) : rgb(0.95, 0.79, 0.79),
    borderWidth: 0.8,
  })
  summaryPage.drawText('Balance neto acumulado', {
    x: netCardX + 10,
    y: netCardY + 26,
    size: 8.1,
    font: fontRegular,
    color: rgb(0.36, 0.44, 0.52),
  })
  summaryPage.drawText(formatPen(payload.summary.netPen), {
    x: netCardX + 10,
    y: netCardY + 10,
    size: 13.2,
    font: fontBold,
    color: netPositive ? colorFromHex('#0f9d6d') : colorFromHex('#dc4d4d'),
  })

  const donutCx = mixPanelX + 120
  const donutCy = mixPanelY + 106
  const donutOuter = 58
  const donutInner = 36
  const totalMovement = payload.summary.movementPen
  const visibleTypes = payload.summary.byType.filter(item => item.amountPen > 0)

  summaryPage.drawCircle({
    x: donutCx,
    y: donutCy,
    size: donutOuter,
    color: rgb(0.94, 0.96, 0.98),
  })

  if (totalMovement > 0 && visibleTypes.length > 0) {
    let startAngle = -90
    visibleTypes.forEach(item => {
      const sweep = Math.max(2.2, (item.amountPen / totalMovement) * 360)
      const slicePath = buildDonutSlicePath(
        donutCx,
        donutCy,
        donutOuter - 0.4,
        donutInner,
        startAngle,
        startAngle + sweep
      )
      summaryPage.drawSvgPath(slicePath, {
        color: colorFromHex(TYPE_COLORS[item.type]),
        borderColor: rgb(1, 1, 1),
        borderWidth: 0.7,
      })
      startAngle += sweep
    })
  }

  summaryPage.drawCircle({
    x: donutCx,
    y: donutCy,
    size: donutInner - 0.5,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.9, 0.94, 0.97),
    borderWidth: 0.8,
  })

  const centerTitle = 'Movimientos'
  const centerTitleW = fontRegular.widthOfTextAtSize(centerTitle, 7.8)
  summaryPage.drawText(centerTitle, {
    x: donutCx - centerTitleW / 2,
    y: donutCy + 6.4,
    size: 7.8,
    font: fontRegular,
    color: rgb(0.45, 0.52, 0.59),
  })

  const centerCount = String(payload.summary.totalCount)
  const centerCountW = fontBold.widthOfTextAtSize(centerCount, 14.6)
  summaryPage.drawText(centerCount, {
    x: donutCx - centerCountW / 2,
    y: donutCy - 7.8,
    size: 14.6,
    font: fontBold,
    color: rgb(0.12, 0.19, 0.27),
  })

  const centerAmount = fitText(formatPen(totalMovement), fontBold, 7, 64)
  const centerAmountW = fontBold.widthOfTextAtSize(centerAmount, 7)
  summaryPage.drawText(centerAmount, {
    x: donutCx - centerAmountW / 2,
    y: donutCy - 18,
    size: 7,
    font: fontBold,
    color: rgb(0.35, 0.43, 0.5),
  })

  const rankingX = mixPanelX + 220
  const rankingW = mixPanelW - (rankingX - mixPanelX) - 14
  const rankingTop = mixPanelY + 175
  const rankingGap = 48

  payload.summary.byType.forEach((item, index) => {
    const rowY = rankingTop - index * rankingGap
    const color = colorFromHex(TYPE_COLORS[item.type])
    const pct = `${(item.share * 100).toFixed(1)}%`
    const amount = fitText(formatPen(item.amountPen), fontBold, 7.1, rankingW - 30)

    summaryPage.drawRectangle({
      x: rankingX,
      y: rowY + 4,
      width: 8,
      height: 8,
      color,
    })
    summaryPage.drawText(item.label, {
      x: rankingX + 12,
      y: rowY + 4,
      size: 8.2,
      font: fontBold,
      color: rgb(0.2, 0.26, 0.33),
    })
    const pctW = fontBold.widthOfTextAtSize(pct, 7.9)
    summaryPage.drawText(pct, {
      x: rankingX + rankingW - pctW,
      y: rowY + 4,
      size: 7.9,
      font: fontBold,
      color,
    })

    summaryPage.drawRectangle({
      x: rankingX,
      y: rowY - 8,
      width: rankingW,
      height: 5,
      color: rgb(0.92, 0.95, 0.98),
    })
    if (item.share > 0) {
      summaryPage.drawRectangle({
        x: rankingX,
        y: rowY - 8,
        width: Math.max(1.4, rankingW * item.share),
        height: 5,
        color,
      })
    }

    summaryPage.drawText(amount, {
      x: rankingX,
      y: rowY - 18,
      size: 7.1,
      font: fontBold,
      color: rgb(0.33, 0.41, 0.49),
    })

    const countLabel = `${item.count} mov.`
    const countW = fontRegular.widthOfTextAtSize(countLabel, 6.8)
    summaryPage.drawText(countLabel, {
      x: rankingX + rankingW - countW,
      y: rowY - 18,
      size: 6.8,
      font: fontRegular,
      color: rgb(0.42, 0.49, 0.56),
    })
  })

  summaryPage.drawText('Detalle tabular en páginas siguientes.', {
    x: marginX,
    y: 40,
    size: 10,
    font: fontRegular,
    color: rgb(0.31, 0.39, 0.47),
  })

  const columnDefs = [
    { key: 'date', label: 'Fecha', width: 46 },
    { key: 'type', label: 'Tipo', width: 48 },
    { key: 'portfolio', label: 'Portafolio', width: 90 },
    { key: 'category', label: 'Categoría', width: 66 },
    { key: 'description', label: 'Descripción', width: 126 },
    { key: 'amount', label: 'Monto', width: 58 },
    { key: 'currency', label: 'Mon.', width: 30 },
    { key: 'amountPen', label: 'Monto PEN', width: 66 },
    { key: 'reports', label: 'Rep.', width: 29 },
  ] as const

  const tableStartX = 18
  const headerY = 724
  const rowHeight = 17
  const bottomLimit = 40
  const generatedAtLabel = formatTimestamp(payload.generatedAt)
  const tableWidth = columnDefs.reduce((sum, col) => sum + col.width, 0)

  let detailPage = pdf.addPage(PDF_PAGE_SIZE_A4_PORTRAIT)
  let pageIndex = 1
  drawDetailHeader(detailPage, pageIndex, fontBold, fontRegular, logo, generatedAtLabel, payload.filterDescriptor)

  const drawTableHeader = (page: PDFPage, y: number) => {
    let x = tableStartX
    columnDefs.forEach(column => {
      page.drawRectangle({
        x,
        y,
        width: column.width,
        height: rowHeight,
        color: rgb(0.06, 0.1, 0.18),
        borderColor: rgb(0.15, 0.22, 0.31),
        borderWidth: 0.8,
      })
      page.drawText(column.label, {
        x: x + 5,
        y: y + 5.3,
        size: 7.2,
        font: fontBold,
        color: rgb(1, 1, 1),
      })
      x += column.width
    })
  }

  let currentY = headerY
  drawTableHeader(detailPage, currentY)
  currentY -= rowHeight

  payload.rows.forEach((row, index) => {
    if (currentY <= bottomLimit) {
      detailPage = pdf.addPage(PDF_PAGE_SIZE_A4_PORTRAIT)
      pageIndex += 1
      drawDetailHeader(detailPage, pageIndex, fontBold, fontRegular, logo, generatedAtLabel, payload.filterDescriptor)
      currentY = headerY
      drawTableHeader(detailPage, currentY)
      currentY -= rowHeight
    }

    if (index % 2 === 0) {
      detailPage.drawRectangle({
        x: tableStartX,
        y: currentY,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.975, 0.984, 0.992),
      })
    }

    const portfolio = row.destination_account
      ? `${row.source_account?.name ?? '—'} -> ${row.destination_account.name}`
      : row.source_account?.name ?? '—'

    const values: Record<(typeof columnDefs)[number]['key'], string> = {
      date: formatDate(row.transaction_date),
      type: TYPE_LABELS[row.type],
      portfolio,
      category: row.category?.name ?? 'Sin categoría',
      description: row.description,
      amount: formatOriginal(row.amount, row.currency),
      currency: row.currency,
      amountPen: formatPen(row.amount_pen),
      reports: row.affects_reports ? 'Sí' : 'No',
    }

    let x = tableStartX
    columnDefs.forEach(column => {
      const raw = values[column.key] ?? ''
      const size = column.key === 'description' ? 6.6 : 6.9
      const text = fitText(raw, fontRegular, size, column.width - 8)
      const isTypeColumn = column.key === 'type'
      const textColor =
        isTypeColumn && row.type === 'INCOME'
          ? rgb(0.06, 0.62, 0.43)
          : isTypeColumn && row.type === 'EXPENSE'
            ? rgb(0.84, 0.3, 0.3)
            : isTypeColumn && row.type === 'TRANSFER'
              ? rgb(0.12, 0.43, 0.74)
              : rgb(0.16, 0.2, 0.26)

      detailPage.drawText(text, {
        x: x + 4,
        y: currentY + 5,
        size,
        font: isTypeColumn ? fontBold : fontRegular,
        color: textColor,
      })

      detailPage.drawRectangle({
        x,
        y: currentY,
        width: column.width,
        height: rowHeight,
        borderColor: rgb(0.88, 0.92, 0.95),
        borderWidth: 0.55,
      })

      x += column.width
    })

    currentY -= rowHeight
  })

  return await pdf.save()
}

async function fetchExportMeta(userId: string): Promise<MetaPayload> {
  const supabase = createClient()
  const [{ data: txDates, error: txError }, { data: portfolios, error: portfolioError }] = await Promise.all([
    supabase
      .from('transactions')
      .select('transaction_date')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(20000),
    supabase
      .from('accounts')
      .select('id,name,currency,is_active')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
  ])

  if (txError) {
    throw new Error(txError.message)
  }
  if (portfolioError) {
    throw new Error(portfolioError.message)
  }

  const years = Array.from(
    new Set((txDates ?? []).map(row => String(row.transaction_date ?? '').slice(0, 4)).filter(Boolean))
  ).sort((a, b) => Number(b) - Number(a))

  const portfolioList: ExportPortfolioOption[] = (portfolios ?? []).map(item => ({
    id: String(item.id),
    name: String(item.name),
    currency: toSafeCurrency(item.currency),
    is_active: Boolean(item.is_active),
  }))

  return {
    years,
    portfolios: portfolioList,
  }
}

async function fetchTransactions(userId: string): Promise<TransactionExportRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      transaction_date,
      created_at,
      type,
      amount,
      amount_pen,
      currency,
      exchange_rate,
      description,
      notes,
      affects_reports,
      source_account:accounts!source_account_id(id,name,currency,institution),
      destination_account:accounts!destination_account_id(id,name,currency,institution),
      category:categories(id,name,scope)
    `)
    .eq('user_id', userId)
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(25000)

  if (error) throw new Error(error.message)

  return (data ?? []).map(row => {
    const source = normalizeRelation(row.source_account)
    const destination = normalizeRelation(row.destination_account)
    const category = normalizeRelation(row.category)

    const sourceAccount: AccountRelation | null = source
      ? {
          id: String(source.id),
          name: String(source.name),
          currency: toSafeCurrency(source.currency),
          institution: typeof source.institution === 'string' ? source.institution : null,
        }
      : null

    const destinationAccount: AccountRelation | null = destination
      ? {
          id: String(destination.id),
          name: String(destination.name),
          currency: toSafeCurrency(destination.currency),
          institution: typeof destination.institution === 'string' ? destination.institution : null,
        }
      : null

    const categoryRelation: CategoryRelation | null = category
      ? {
          id: String(category.id),
          name: String(category.name),
          scope: normalizeCategoryScope(category.scope, row.type),
        }
      : null

    return {
      id: String(row.id),
      transaction_date: String(row.transaction_date),
      created_at: String(row.created_at),
      type: (row.type === 'INCOME' || row.type === 'EXPENSE' || row.type === 'TRANSFER'
        ? row.type
        : 'EXPENSE') as TransactionType,
      amount: toSafeNumber(row.amount),
      amount_pen: toSafeNumber(row.amount_pen),
      currency: toSafeCurrency(row.currency),
      exchange_rate: toSafeNumber(row.exchange_rate, 1),
      description: String(row.description ?? ''),
      notes: typeof row.notes === 'string' ? row.notes : null,
      affects_reports: row.affects_reports !== false,
      source_account: sourceAccount,
      destination_account: destinationAccount,
      category: categoryRelation,
    }
  })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiUnauthorized()

  const parsed = exportQuerySchema.safeParse({
    meta: req.nextUrl.searchParams.get('meta') ?? undefined,
    format: req.nextUrl.searchParams.get('format') ?? 'pdf',
    period: req.nextUrl.searchParams.get('period') ?? 'all',
    exercise: req.nextUrl.searchParams.get('exercise') ?? 'all',
    portfolios: req.nextUrl.searchParams.get('portfolios') ?? 'all',
  })

  if (!parsed.success) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Parámetros de exportación inválidos.',
      detail: parsed.error.issues[0]?.message,
    })
  }

  try {
    if (parsed.data.meta) {
      const meta = await fetchExportMeta(user.id)
      return apiOk(meta)
    }

    const filters: ExportFilters = {
      format: parsed.data.format as ExportFormat,
      period: parsed.data.period as ExportPeriod,
      exercise: parsed.data.exercise as ExportExercise,
      portfolios: parsePortfolioFilter(parsed.data.portfolios),
    }

    const [allRows, meta] = await Promise.all([
      fetchTransactions(user.id),
      fetchExportMeta(user.id),
    ])

    const filteredRows = applyExportFilters(allRows, filters)
    const summary = buildSummary(filteredRows)

    const selectedPortfolioNames =
      filters.portfolios === 'all'
        ? []
        : meta.portfolios
            .filter(portfolio => filters.portfolios.includes(portfolio.id))
            .map(portfolio => portfolio.name)

    const payload: ExportPayload = {
      rows: filteredRows,
      summary,
      filters,
      generatedAt: new Date(),
      filterDescriptor: buildFilterDescriptor(filters, selectedPortfolioNames),
    }

    const timestamp = formatDateTimeForFile(payload.generatedAt)
    const baseFilename = `fintrack-movimientos-${timestamp}`

    if (filters.format === 'csv') {
      const csv = await buildCsv(payload)
      return new NextResponse(toBodyArrayBuffer(csv), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseFilename}.csv"`,
        },
      })
    }

    if (filters.format === 'xlsx') {
      const xlsx = await buildXlsx(payload)
      return new NextResponse(toBodyArrayBuffer(xlsx), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseFilename}.xlsx"`,
        },
      })
    }

    const pdf = await buildPdf(payload)
    return new NextResponse(toBodyArrayBuffer(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseFilename}.pdf"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar la exportación.'
    return apiError({
      code: 'DATABASE_ERROR',
      message: 'No se pudo generar el archivo de exportación.',
      detail: message,
    })
  }
}
