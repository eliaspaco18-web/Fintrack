import ExcelJS from 'exceljs'
import { IMPORT_TEMPLATE_VERSION } from '@/lib/imports/import-types'
import type { ImportTemplateCatalogs } from '@/lib/imports/excel-template'
import { hasAtMostDecimals } from '@/lib/utils/numeric-input'

const HEADER_ROW = 4
const FIRST_INPUT_ROW = 5
const MAX_TEMPLATE_ROWS = 500
const LAST_INPUT_ROW = FIRST_INPUT_ROW + MAX_TEMPLATE_ROWS - 1

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024

type SheetName =
  | '03_Ingresos'
  | '04_Egresos'
  | '05_Transferencias'
  | '06_Compra_Activo'
  | '07_Por_Cobrar'
  | '08_Por_Pagar'

type Severity = 'ERROR' | 'WARNING'

type FieldIssue = {
  severity: Severity
  field: string
  code: string
  message: string
}

type ColumnRule = {
  key: string
  header: string
  required?: boolean
  type?: 'text' | 'date' | 'number'
  allowed?: readonly string[]
}

type RowAnalysis = {
  sheet_name: SheetName
  row_number: number
  row_key: string | null
  status: 'VALID' | 'WARNING' | 'ERROR'
  payload: Record<string, unknown>
  errors: FieldIssue[]
  warnings: FieldIssue[]
}

export type ExcelImportAnalysis = {
  templateVersion: string | null
  summary: {
    sheets: Record<string, {
      totalRows: number
      validRows: number
      errorRows: number
      warningRows: number
    }>
    totals: {
      rows: number
      validRows: number
      errorRows: number
      warningRows: number
    }
    projectedBalances: Array<{
      portfolioKey: string
      currency: string
      initialBalance: number
      projectedBalance: number
    }>
  }
  rows: RowAnalysis[]
  errors: FieldIssue[]
  warnings: FieldIssue[]
}

type AnalysisCatalogs = Pick<
  ImportTemplateCatalogs,
  'portfolios' | 'portfolioSnapshots' | 'incomeCategories' | 'expenseCategories' | 'creditCards'
>

const PAYMENT_METHODS = ['DEBIT', 'CREDIT'] as const
const RECEIVABLE_STATUSES = ['PENDING', 'PARTIAL', 'COLLECTED', 'WRITTEN_OFF'] as const
const PAYABLE_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'DISPUTED'] as const

const SHEET_RULES: Record<SheetName, ColumnRule[]> = {
  '03_Ingresos': [
    { key: 'fecha', header: 'Fecha del ingreso', required: true, type: 'date' },
    { key: 'portafolio_destino', header: 'Portafolio destino', required: true, type: 'text' },
    { key: 'categoria', header: 'Categoria del ingreso', required: true, type: 'text' },
    { key: 'descripcion', header: 'Descripcion', required: true, type: 'text' },
    { key: 'moneda', header: 'Moneda', required: true, type: 'text' },
    { key: 'monto', header: 'Monto del ingreso', required: true, type: 'number' },
    { key: 'remitente', header: 'Remitente', type: 'text' },
    { key: 'notas', header: 'Notas', type: 'text' },
  ],
  '04_Egresos': [
    { key: 'fecha', header: 'Fecha del egreso', required: true, type: 'date' },
    { key: 'portafolio_origen', header: 'Portafolio origen', required: true, type: 'text' },
    { key: 'categoria', header: 'Categoria del egreso', required: true, type: 'text' },
    { key: 'descripcion', header: 'Descripcion', required: true, type: 'text' },
    { key: 'moneda', header: 'Moneda', required: true, type: 'text' },
    { key: 'monto', header: 'Monto del egreso', required: true, type: 'number' },
    { key: 'forma_pago', header: 'Forma de pago', type: 'text', allowed: PAYMENT_METHODS },
    { key: 'tarjeta_credito', header: 'Tarjeta de credito', type: 'text' },
    { key: 'destinatario', header: 'Destinatario', type: 'text' },
    { key: 'notas', header: 'Notas', type: 'text' },
  ],
  '05_Transferencias': [
    { key: 'fecha', header: 'Fecha de la transferencia', required: true, type: 'date' },
    { key: 'portafolio_origen', header: 'Portafolio origen', required: true, type: 'text' },
    { key: 'portafolio_destino', header: 'Portafolio destino', required: true, type: 'text' },
    { key: 'descripcion', header: 'Descripcion', required: true, type: 'text' },
    { key: 'moneda', header: 'Moneda', required: true, type: 'text' },
    { key: 'monto', header: 'Monto de la transferencia', required: true, type: 'number' },
    { key: 'notas', header: 'Notas', type: 'text' },
  ],
  '06_Compra_Activo': [
    { key: 'fecha', header: 'Fecha de compra', required: true, type: 'date' },
    { key: 'portafolio_origen', header: 'Portafolio origen', required: true, type: 'text' },
    { key: 'categoria', header: 'Categoria del egreso', required: true, type: 'text' },
    { key: 'descripcion', header: 'Descripcion', required: true, type: 'text' },
    { key: 'moneda', header: 'Moneda', required: true, type: 'text' },
    { key: 'monto', header: 'Monto de la compra', required: true, type: 'number' },
    { key: 'forma_pago', header: 'Forma de pago', type: 'text', allowed: PAYMENT_METHODS },
    { key: 'tarjeta_credito', header: 'Tarjeta de credito', type: 'text' },
    { key: 'nombre_activo', header: 'Nombre del activo', required: true, type: 'text' },
    { key: 'tipo_activo', header: 'Tipo de activo', type: 'text' },
    { key: 'valor_actual', header: 'Valor actual', required: true, type: 'number' },
    { key: 'tasa_depreciacion', header: 'Tasa de depreciacion', type: 'number' },
    { key: 'numero_serie', header: 'Numero de serie', type: 'text' },
    { key: 'ubicacion', header: 'Ubicacion', type: 'text' },
    { key: 'notas', header: 'Notas', type: 'text' },
  ],
  '07_Por_Cobrar': [
    { key: 'deudor', header: 'Nombre del deudor', required: true, type: 'text' },
    { key: 'relacion', header: 'Relacion', type: 'text' },
    { key: 'fecha', header: 'Fecha de origen', required: true, type: 'date' },
    { key: 'fecha_vencimiento', header: 'Fecha de vencimiento', type: 'date' },
    { key: 'moneda', header: 'Moneda', required: true, type: 'text' },
    { key: 'monto', header: 'Monto total', required: true, type: 'number' },
    { key: 'monto_cobrado', header: 'Monto cobrado', type: 'number' },
    { key: 'concepto', header: 'Concepto', required: true, type: 'text' },
    { key: 'estado', header: 'Estado', type: 'text', allowed: RECEIVABLE_STATUSES },
    { key: 'portafolio_origen', header: 'Portafolio de referencia', type: 'text' },
    { key: 'notas', header: 'Notas', type: 'text' },
  ],
  '08_Por_Pagar': [
    { key: 'acreedor', header: 'Nombre del acreedor', required: true, type: 'text' },
    { key: 'relacion', header: 'Relacion', type: 'text' },
    { key: 'fecha', header: 'Fecha de origen', required: true, type: 'date' },
    { key: 'fecha_vencimiento', header: 'Fecha de vencimiento', type: 'date' },
    { key: 'moneda', header: 'Moneda', required: true, type: 'text' },
    { key: 'monto', header: 'Monto total', required: true, type: 'number' },
    { key: 'monto_pagado', header: 'Monto pagado', type: 'number' },
    { key: 'concepto', header: 'Concepto', required: true, type: 'text' },
    { key: 'estado', header: 'Estado', type: 'text', allowed: PAYABLE_STATUSES },
    { key: 'portafolio_origen', header: 'Portafolio de referencia', type: 'text' },
    { key: 'notas', header: 'Notas', type: 'text' },
  ],
}

function issue(severity: Severity, field: string, code: string, message: string): FieldIssue {
  return { severity, field, code, message }
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\*/g, '')
    .trim()
    .toLocaleLowerCase('es')
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (typeof value === 'object' && value !== null && 'text' in value && String((value as { text?: unknown }).text ?? '').trim().length === 0) {
    return true
  }
  return false
}

function cellRawValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if ('result' in value) return value.result
    if ('text' in value) return value.text
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text).join('')
    }
  }
  return value
}

function textValue(value: unknown): string | null {
  if (isBlank(value)) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function numberValue(value: unknown): number | null {
  if (isBlank(value)) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/,/g, '')
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function excelSerialToDate(value: number): Date | null {
  if (!Number.isFinite(value)) return null
  const utcDays = Math.floor(value - 25569)
  const utcValue = utcDays * 86400
  const dateInfo = new Date(utcValue * 1000)
  return Number.isNaN(dateInfo.getTime()) ? null : dateInfo
}

function dateValue(value: unknown): string | null {
  if (isBlank(value)) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const date = excelSerialToDate(value)
    return date ? date.toISOString().slice(0, 10) : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
    const date = new Date(`${trimmed}T00:00:00.000Z`)
    return Number.isNaN(date.getTime()) ? null : trimmed
  }
  return null
}

function normalizeCell(rule: ColumnRule, rawValue: unknown, rowIssues: FieldIssue[]): unknown {
  if (isBlank(rawValue)) {
    if (rule.required) rowIssues.push(issue('ERROR', rule.key, 'REQUIRED', 'Campo obligatorio.'))
    return null
  }

  if (rule.type === 'number') {
    const value = numberValue(rawValue)
    if (value === null) {
      rowIssues.push(issue('ERROR', rule.key, 'INVALID_NUMBER', 'Debe ser un numero sin simbolo de moneda.'))
      return null
    }
    return value
  }

  if (rule.type === 'date') {
    const value = dateValue(rawValue)
    if (!value) {
      rowIssues.push(issue('ERROR', rule.key, 'INVALID_DATE', 'Debe ser una fecha valida con formato yyyy-mm-dd.'))
      return null
    }
    return value
  }

  const value = textValue(rawValue)
  if (value && rule.allowed && !rule.allowed.includes(value as never)) {
    rowIssues.push(issue('ERROR', rule.key, 'INVALID_ENUM', `Valor no permitido: ${value}.`))
  }
  return value
}

function sheetHeaders(sheet: ExcelJS.Worksheet, rules: ColumnRule[]): { errors: FieldIssue[] } {
  const row = sheet.getRow(HEADER_ROW)
  const errors: FieldIssue[] = []

  rules.forEach((rule, index) => {
    const header = normalizeHeader(cellRawValue(row.getCell(index + 1)))
    if (header !== normalizeHeader(rule.header)) {
      errors.push(issue('ERROR', rule.key, 'INVALID_HEADER', `Encabezado esperado "${rule.header}" en columna ${index + 1}.`))
    }
  })

  return { errors }
}

function isRowEmpty(sheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number): boolean {
  const row = sheet.getRow(rowNumber)
  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    if (!isBlank(cellRawValue(row.getCell(columnIndex)))) return false
  }
  return true
}

function addBusinessIssues(
  sheetName: SheetName,
  payload: Record<string, unknown>,
  errors: FieldIssue[],
  warnings: FieldIssue[],
) {
  if (sheetName === '03_Ingresos' || sheetName === '04_Egresos' || sheetName === '05_Transferencias' || sheetName === '06_Compra_Activo') {
    const amount = typeof payload.monto === 'number' ? payload.monto : null
    if (amount !== null && amount <= 0) {
      errors.push(issue('ERROR', 'monto', 'POSITIVE_AMOUNT_REQUIRED', 'El monto debe ser mayor que cero.'))
    }
    if (amount !== null && !hasAtMostDecimals(amount, 2)) {
      errors.push(issue('ERROR', 'monto', 'MAX_TWO_DECIMALS', 'El monto debe tener maximo 2 decimales.'))
    }
  }

  if (sheetName === '04_Egresos' || sheetName === '06_Compra_Activo') {
    if (payload.forma_pago === 'CREDIT' && !payload.tarjeta_credito) {
      warnings.push(issue('WARNING', 'tarjeta_credito', 'CREDIT_CARD_RECOMMENDED', 'Si forma_pago es CREDIT, se recomienda indicar la tarjeta de credito.'))
    }
  }

  if (sheetName === '05_Transferencias') {
    if (payload.portafolio_origen && payload.portafolio_origen === payload.portafolio_destino) {
      errors.push(issue('ERROR', 'portafolio_destino', 'SAME_PORTFOLIO', 'Origen y destino no pueden ser iguales.'))
    }
  }

  if (sheetName === '06_Compra_Activo') {
    const currentValue = typeof payload.valor_actual === 'number' ? payload.valor_actual : null
    const depreciation = typeof payload.tasa_depreciacion === 'number' ? payload.tasa_depreciacion : null
    if (currentValue !== null && currentValue < 0) {
      errors.push(issue('ERROR', 'valor_actual', 'NON_NEGATIVE_AMOUNT_REQUIRED', 'El valor_actual no puede ser negativo.'))
    }
    if (currentValue !== null && !hasAtMostDecimals(currentValue, 2)) {
      errors.push(issue('ERROR', 'valor_actual', 'MAX_TWO_DECIMALS', 'El valor_actual debe tener maximo 2 decimales.'))
    }
    if (depreciation !== null && (depreciation < 0 || depreciation > 100)) {
      warnings.push(issue('WARNING', 'tasa_depreciacion', 'UNUSUAL_DEPRECIATION_RATE', 'La tasa_depreciacion suele estar entre 0 y 100.'))
    }
  }

  if (sheetName === '07_Por_Cobrar') {
    const amount = typeof payload.monto === 'number' ? payload.monto : null
    const collected = typeof payload.monto_cobrado === 'number' ? payload.monto_cobrado : 0
    const startDate = typeof payload.fecha === 'string' ? payload.fecha : null
    const dueDate = typeof payload.fecha_vencimiento === 'string' ? payload.fecha_vencimiento : null

    if (amount !== null && amount <= 0) errors.push(issue('ERROR', 'monto', 'POSITIVE_AMOUNT_REQUIRED', 'El monto debe ser mayor que cero.'))
    if (collected < 0) errors.push(issue('ERROR', 'monto_cobrado', 'NON_NEGATIVE_AMOUNT_REQUIRED', 'El monto_cobrado no puede ser negativo.'))
    if (amount !== null && collected > amount) errors.push(issue('ERROR', 'monto_cobrado', 'COLLECTED_OVER_TOTAL', 'El monto_cobrado no puede superar el monto total.'))
    if (payload.estado === 'COLLECTED' && amount !== null && collected !== amount) {
      errors.push(issue('ERROR', 'estado', 'COLLECTED_MUST_MATCH_TOTAL', 'Si el estado es COLLECTED, monto_cobrado debe igualar monto.'))
    }
    if (startDate && dueDate && dueDate < startDate) {
      errors.push(issue('ERROR', 'fecha_vencimiento', 'INVALID_DATE_RANGE', 'La fecha_vencimiento no puede ser anterior a la fecha.'))
    }
  }

  if (sheetName === '08_Por_Pagar') {
    const amount = typeof payload.monto === 'number' ? payload.monto : null
    const paid = typeof payload.monto_pagado === 'number' ? payload.monto_pagado : 0
    const startDate = typeof payload.fecha === 'string' ? payload.fecha : null
    const dueDate = typeof payload.fecha_vencimiento === 'string' ? payload.fecha_vencimiento : null

    if (amount !== null && amount <= 0) errors.push(issue('ERROR', 'monto', 'POSITIVE_AMOUNT_REQUIRED', 'El monto debe ser mayor que cero.'))
    if (paid < 0) errors.push(issue('ERROR', 'monto_pagado', 'NON_NEGATIVE_AMOUNT_REQUIRED', 'El monto_pagado no puede ser negativo.'))
    if (amount !== null && paid > amount) errors.push(issue('ERROR', 'monto_pagado', 'PAID_OVER_TOTAL', 'El monto_pagado no puede superar el monto total.'))
    if (payload.estado === 'PAID' && amount !== null && paid !== amount) {
      errors.push(issue('ERROR', 'estado', 'PAID_MUST_MATCH_TOTAL', 'Si el estado es PAID, monto_pagado debe igualar monto.'))
    }
    if (startDate && dueDate && dueDate < startDate) {
      errors.push(issue('ERROR', 'fecha_vencimiento', 'INVALID_DATE_RANGE', 'La fecha_vencimiento no puede ser anterior a la fecha.'))
    }
  }
}

function analyzeSheet(sheet: ExcelJS.Worksheet, sheetName: SheetName): { rows: RowAnalysis[]; errors: FieldIssue[] } {
  const rules = SHEET_RULES[sheetName]
  const headerCheck = sheetHeaders(sheet, rules)
  if (headerCheck.errors.length > 0) return { rows: [], errors: headerCheck.errors }

  const rows: RowAnalysis[] = []

  for (let rowNumber = FIRST_INPUT_ROW; rowNumber <= LAST_INPUT_ROW; rowNumber += 1) {
    if (isRowEmpty(sheet, rowNumber, rules.length)) continue

    const row = sheet.getRow(rowNumber)
    const payload: Record<string, unknown> = {}
    const errors: FieldIssue[] = []
    const warnings: FieldIssue[] = []

    rules.forEach((rule, index) => {
      payload[rule.key] = normalizeCell(rule, cellRawValue(row.getCell(index + 1)), errors)
    })

    addBusinessIssues(sheetName, payload, errors, warnings)

    rows.push({
      sheet_name: sheetName,
      row_number: rowNumber,
      row_key: null,
      status: errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'VALID',
      payload,
      errors,
      warnings,
    })
  }

  return { rows, errors: [] }
}

function addRelationIssues(rows: RowAnalysis[], catalogs: AnalysisCatalogs) {
  const portfolioNames = new Set(catalogs.portfolios.map(value => normalizeName(value)))
  const incomeCategories = new Set(catalogs.incomeCategories.map(value => normalizeName(value)))
  const expenseCategories = new Set(catalogs.expenseCategories.map(value => normalizeName(value)))
  const creditCards = new Set(catalogs.creditCards.map(value => normalizeName(value)))

  for (const row of rows) {
    const origin = textValue(row.payload.portafolio_origen)
    const destination = textValue(row.payload.portafolio_destino)
    const category = textValue(row.payload.categoria)
    const paymentMethod = textValue(row.payload.forma_pago)
    const creditCard = textValue(row.payload.tarjeta_credito)

    if (row.sheet_name === '03_Ingresos') {
      if (destination && !portfolioNames.has(normalizeName(destination))) {
        row.errors.push(issue('ERROR', 'portafolio_destino', 'UNKNOWN_PORTFOLIO', 'El portafolio destino no existe en FinTrack.'))
      }
      if (category && !incomeCategories.has(normalizeName(category))) {
        row.errors.push(issue('ERROR', 'categoria', 'UNKNOWN_CATEGORY', 'La categoria del ingreso no existe en FinTrack.'))
      }
    }

    if (row.sheet_name === '04_Egresos' || row.sheet_name === '06_Compra_Activo') {
      if (origin && !portfolioNames.has(normalizeName(origin))) {
        row.errors.push(issue('ERROR', 'portafolio_origen', 'UNKNOWN_PORTFOLIO', 'El portafolio origen no existe en FinTrack.'))
      }
      if (category && !expenseCategories.has(normalizeName(category))) {
        row.errors.push(issue('ERROR', 'categoria', 'UNKNOWN_CATEGORY', 'La categoria del egreso no existe en FinTrack.'))
      }
      if (paymentMethod === 'CREDIT' && creditCard && !creditCards.has(normalizeName(creditCard))) {
        row.errors.push(issue('ERROR', 'tarjeta_credito', 'UNKNOWN_CREDIT_CARD', 'La tarjeta de credito no existe en FinTrack.'))
      }
    }

    if (row.sheet_name === '05_Transferencias') {
      if (origin && !portfolioNames.has(normalizeName(origin))) {
        row.errors.push(issue('ERROR', 'portafolio_origen', 'UNKNOWN_PORTFOLIO', 'El portafolio origen no existe en FinTrack.'))
      }
      if (destination && !portfolioNames.has(normalizeName(destination))) {
        row.errors.push(issue('ERROR', 'portafolio_destino', 'UNKNOWN_PORTFOLIO', 'El portafolio destino no existe en FinTrack.'))
      }
    }

    if (row.sheet_name === '07_Por_Cobrar' || row.sheet_name === '08_Por_Pagar') {
      if (origin && !portfolioNames.has(normalizeName(origin))) {
        row.errors.push(issue('ERROR', 'portafolio_origen', 'UNKNOWN_PORTFOLIO', 'El portafolio de referencia no existe en FinTrack.'))
      }
    }

    if (row.errors.length > 0) row.status = 'ERROR'
    else if (row.warnings.length > 0) row.status = 'WARNING'
  }
}

function buildProjectedBalances(rows: RowAnalysis[], catalogs: AnalysisCatalogs) {
  const balances = new Map<string, {
    portfolioKey: string
    currency: string
    initialBalance: number
    projectedBalance: number
  }>()

  for (const portfolio of catalogs.portfolioSnapshots) {
    balances.set(normalizeName(portfolio.name), {
      portfolioKey: portfolio.name,
      currency: portfolio.currency,
      initialBalance: portfolio.balance,
      projectedBalance: portfolio.balance,
    })
  }

  for (const row of rows.filter(item => item.status !== 'ERROR')) {
    const amount = typeof row.payload.monto === 'number' ? row.payload.monto : 0

    if (row.sheet_name === '03_Ingresos') {
      const target = textValue(row.payload.portafolio_destino)
      const balance = target ? balances.get(normalizeName(target)) : null
      if (balance) balance.projectedBalance += amount
    }

    if (row.sheet_name === '04_Egresos' || row.sheet_name === '06_Compra_Activo') {
      const source = textValue(row.payload.portafolio_origen)
      const balance = source ? balances.get(normalizeName(source)) : null
      if (balance) balance.projectedBalance -= amount
    }

    if (row.sheet_name === '05_Transferencias') {
      const source = textValue(row.payload.portafolio_origen)
      const target = textValue(row.payload.portafolio_destino)
      const sourceBalance = source ? balances.get(normalizeName(source)) : null
      const targetBalance = target ? balances.get(normalizeName(target)) : null
      if (sourceBalance) sourceBalance.projectedBalance -= amount
      if (targetBalance) targetBalance.projectedBalance += amount
    }
  }

  return [...balances.values()].map(balance => ({
    ...balance,
    initialBalance: Number(balance.initialBalance.toFixed(2)),
    projectedBalance: Number(balance.projectedBalance.toFixed(2)),
  }))
}

function buildSummary(rows: RowAnalysis[], catalogs: AnalysisCatalogs) {
  const sheets: ExcelImportAnalysis['summary']['sheets'] = {}

  for (const sheetName of Object.keys(SHEET_RULES) as SheetName[]) {
    const sheetRows = rows.filter(row => row.sheet_name === sheetName)
    sheets[sheetName] = {
      totalRows: sheetRows.length,
      validRows: sheetRows.filter(row => row.status === 'VALID').length,
      warningRows: sheetRows.filter(row => row.status === 'WARNING').length,
      errorRows: sheetRows.filter(row => row.status === 'ERROR').length,
    }
  }

  return {
    sheets,
    totals: {
      rows: rows.length,
      validRows: rows.filter(row => row.status === 'VALID').length,
      warningRows: rows.filter(row => row.status === 'WARNING').length,
      errorRows: rows.filter(row => row.status === 'ERROR').length,
    },
    projectedBalances: buildProjectedBalances(rows, catalogs),
  }
}

function readTemplateVersion(workbook: ExcelJS.Workbook): string | null {
  const sheet = workbook.getWorksheet('_metadata')
  if (!sheet) return null
  for (let rowNumber = 1; rowNumber <= 20; rowNumber += 1) {
    const key = textValue(cellRawValue(sheet.getRow(rowNumber).getCell(1)))
    const value = textValue(cellRawValue(sheet.getRow(rowNumber).getCell(2)))
    if (key === 'template_version') return value
  }
  return null
}

function findDuplicateCatalogValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    const normalized = normalizeName(value)
    if (seen.has(normalized)) duplicates.add(value)
    else seen.add(normalized)
  }
  return [...duplicates]
}

export async function analyzeImportWorkbook(
  buffer: ArrayBuffer,
  catalogs: AnalysisCatalogs,
): Promise<ExcelImportAnalysis> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const templateVersion = readTemplateVersion(workbook)
  const globalErrors: FieldIssue[] = []
  const globalWarnings: FieldIssue[] = []

  if (templateVersion !== IMPORT_TEMPLATE_VERSION) {
    globalErrors.push(issue('ERROR', 'template_version', 'INCOMPATIBLE_TEMPLATE_VERSION', `La plantilla debe usar version ${IMPORT_TEMPLATE_VERSION}.`))
  }

  const duplicatePortfolios = findDuplicateCatalogValues(catalogs.portfolios)
  if (duplicatePortfolios.length > 0) {
    globalWarnings.push(
      issue(
        'WARNING',
        'portafolios',
        'DUPLICATE_SYSTEM_PORTFOLIO_NAMES',
        'Hay portafolios con el mismo nombre en FinTrack. La importacion usa el nombre visible, asi que conviene renombrarlos antes de importar.',
      ),
    )
  }

  const rows: RowAnalysis[] = []

  for (const sheetName of Object.keys(SHEET_RULES) as SheetName[]) {
    const sheet = workbook.getWorksheet(sheetName)
    if (!sheet) {
      globalErrors.push(issue('ERROR', sheetName, 'MISSING_SHEET', `Falta la hoja ${sheetName}.`))
      continue
    }

    const result = analyzeSheet(sheet, sheetName)
    rows.push(...result.rows)
    globalErrors.push(...result.errors)
  }

  addRelationIssues(rows, catalogs)

  const summary = buildSummary(rows, catalogs)
  return {
    templateVersion,
    summary,
    rows,
    errors: globalErrors,
    warnings: globalWarnings,
  }
}
