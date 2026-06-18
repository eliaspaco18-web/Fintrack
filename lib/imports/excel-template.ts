import ExcelJS from 'exceljs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { IMPORT_TEMPLATE_VERSION } from '@/lib/imports/import-types'
import {
  buildPayableImportReference,
  buildReceivableImportReference,
} from '@/lib/imports/loan-reference'

const MAX_TEMPLATE_ROWS = 500
const HEADER_ROW = 4
const FIRST_INPUT_ROW = HEADER_ROW + 1
const LAST_INPUT_ROW = FIRST_INPUT_ROW + MAX_TEMPLATE_ROWS - 1

const COLORS = {
  primary: 'FF006948',
  primarySoft: 'FFE5F3EE',
  surface: 'FFF7FAF8',
  header: 'FF183A2D',
  border: 'FFD7E2DD',
  required: 'FFFFF4CC',
  muted: 'FF64766F',
  danger: 'FFDC4D4D',
  text: 'FF17352A',
  white: 'FFFFFFFF',
}

type TemplateListKey =
  | 'catalogTypes'
  | 'categoryScopes'
  | 'accountTypes'
  | 'transactionTypes'
  | 'transactionSubtypes'
  | 'paymentMethods'
  | 'creditTypes'
  | 'creditStatuses'
  | 'assetStatuses'
  | 'budgetPeriods'
  | 'receivableStatuses'
  | 'payableStatuses'
  | 'yesNo'
  | 'currencies'
  | 'incomeCategories'
  | 'expenseCategories'
  | 'bankEntities'
  | 'assetTypes'
  | 'portfolios'
  | 'creditCards'
  | 'budgets'
  | 'credits'
  | 'debtors'
  | 'creditors'
  | 'receivableReferences'
  | 'payableReferences'
  | 'receivableSettlementTargets'
  | 'payableSettlementTargets'

type ColumnKind = 'text' | 'date' | 'money' | 'number' | 'percent' | 'integer'

type TemplateColumn = {
  key: string
  header: string
  width: number
  required?: boolean
  kind?: ColumnKind
  list?: TemplateListKey
  listFormula?: string
  note?: string
}

type RawCatalogRow = {
  name?: string | null
  code?: string | null
  short_name?: string | null
  scope?: string | null
  is_active?: boolean | null
  is_system?: boolean | null
}

export type ImportTemplateCatalogs = {
  currencies: string[]
  incomeCategories: string[]
  expenseCategories: string[]
  bankEntities: string[]
  assetTypes: string[]
  portfolios: string[]
  portfolioSnapshots: Array<{
    name: string
    currency: string
    balance: number
  }>
  creditCards: string[]
  budgets: string[]
  debtors: string[]
  creditors: string[]
  receivableReferences: string[]
  payableReferences: string[]
  budgetWindows: Array<{
    name: string
    currency: string
    period_type: string
    start_date: string
    end_date: string | null
    category: string | null
  }>
  generatedFor: string
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  const normalized = values
    .map(value => (value ?? '').trim())
    .filter(Boolean)

  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b, 'es'))
}

function toListFormula(values: string[]): string {
  const safeValues = values
    .map(value => value.replace(/"/g, '""'))
    .filter(value => value.length > 0)
    .slice(0, 40)

  if (safeValues.length === 0) return '" "'
  return `"${safeValues.join(',')}"`
}

function sheetRange(sheetName: string, column: string, start: number, end: number): string {
  return `'${sheetName}'!$${column}$${start}:$${column}$${end}`
}

function listRef(listSheet: ExcelJS.Worksheet, listColumns: Record<TemplateListKey, string>, key: TemplateListKey): string {
  const column = listColumns[key]
  return sheetRange(listSheet.name, column, 2, 250)
}

function getColumnLetter(index: number): string {
  let value = index
  let output = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    output = String.fromCharCode(65 + remainder) + output
    value = Math.floor((value - 1) / 26)
  }
  return output
}

function setTitle(sheet: ExcelJS.Worksheet, title: string, description: string, columnCount: number) {
  sheet.mergeCells(1, 1, 1, Math.max(columnCount, 4))
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.white } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } }

  sheet.mergeCells(2, 1, 2, Math.max(columnCount, 4))
  const descriptionCell = sheet.getCell(2, 1)
  descriptionCell.value = description
  descriptionCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.muted } }
  descriptionCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  descriptionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.surface } }

  sheet.getRow(1).height = 26
  sheet.getRow(2).height = 34
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, columns: TemplateColumn[]) {
  const row = sheet.getRow(HEADER_ROW)
  row.height = 24
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1)
    cell.value = column.required ? `${column.header} *` : column.header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: column.required ? COLORS.header : COLORS.primary } }
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    }
    if (column.note) {
      cell.note = column.note
    }
  })
}

function applyColumnFormat(cell: ExcelJS.Cell, kind?: ColumnKind) {
  if (kind === 'date') cell.numFmt = 'yyyy-mm-dd'
  if (kind === 'money') cell.numFmt = '#,##0.00'
  if (kind === 'number') cell.numFmt = '#,##0.00'
  if (kind === 'percent') cell.numFmt = '0.00%'
  if (kind === 'integer') cell.numFmt = '0'
  if (kind === 'text' || !kind) cell.numFmt = '@'
}

function applyValidations(
  sheet: ExcelJS.Worksheet,
  columns: TemplateColumn[],
  listSheet: ExcelJS.Worksheet,
  listColumns: Record<TemplateListKey, string>,
) {
  for (let rowNumber = FIRST_INPUT_ROW; rowNumber <= LAST_INPUT_ROW; rowNumber += 1) {
    columns.forEach((column, index) => {
      const cell = sheet.getCell(rowNumber, index + 1)
      applyColumnFormat(cell, column.kind)
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false }
      cell.border = {
        bottom: { style: 'hair', color: { argb: COLORS.border } },
      }
      if (column.required) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.required } }
      }

      if (column.list || column.listFormula) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: !column.required,
          formulae: [column.listFormula ?? `=${listRef(listSheet, listColumns, column.list as TemplateListKey)}`],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Valor no permitido',
          error: 'Selecciona un valor de la lista de FinTrack.',
        }
        return
      }

      if (column.kind === 'date') {
        cell.dataValidation = {
          type: 'date',
          operator: 'between',
          allowBlank: !column.required,
          formulae: [new Date(2000, 0, 1), new Date(2099, 11, 31)],
          showErrorMessage: true,
          errorTitle: 'Fecha invalida',
          error: 'Usa una fecha real entre 2000-01-01 y 2099-12-31.',
        }
      }

      if (column.kind === 'money' || column.kind === 'number') {
        cell.dataValidation = {
          type: 'decimal',
          operator: 'between',
          allowBlank: !column.required,
          formulae: [-1000000000, 1000000000],
          showErrorMessage: true,
          errorTitle: 'Numero invalido',
          error: 'Ingresa un numero sin simbolo de moneda.',
        }
      }

      if (column.kind === 'integer') {
        cell.dataValidation = {
          type: 'whole',
          operator: 'between',
          allowBlank: !column.required,
          formulae: [1, 31],
          showErrorMessage: true,
          errorTitle: 'Entero invalido',
          error: 'Ingresa un numero entero permitido.',
        }
      }
    })
  }
}

async function setupDataSheet(
  workbook: ExcelJS.Workbook,
  listSheet: ExcelJS.Worksheet,
  listColumns: Record<TemplateListKey, string>,
  name: string,
  title: string,
  description: string,
  columns: TemplateColumn[],
  exampleRows: Array<Record<string, string | number | Date | null>>,
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }],
  })

  sheet.columns = columns.map(column => ({
    key: column.key,
    width: column.width,
    style: { font: { name: 'Calibri', size: 10 } },
  }))

  setTitle(sheet, title, description, columns.length)
  sheet.getRow(3).values = ['Completa desde la fila 5. Las columnas con * son obligatorias. No cambies los encabezados. Revisa la nota de cada encabezado para saber exactamente que espera FinTrack.']
  sheet.getRow(3).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.muted } }
  sheet.getRow(3).height = 20

  styleHeaderRow(sheet, columns)
  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: columns.length },
  }

  exampleRows.forEach((example, exampleIndex) => {
    const row = sheet.getRow(FIRST_INPUT_ROW + exampleIndex)
    columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1)
      cell.value = example[column.key] ?? null
      applyColumnFormat(cell, column.kind)
    })
  })

  applyValidations(sheet, columns, listSheet, listColumns)

  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.protection = { locked: row.number <= HEADER_ROW }
    })
  })
  await sheet.protect('', {
    selectLockedCells: false,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertRows: true,
    deleteRows: false,
    sort: true,
    autoFilter: true,
  })

  return sheet
}

function addListSheet(workbook: ExcelJS.Workbook, catalogs: ImportTemplateCatalogs) {
  const sheet = workbook.addWorksheet('_listas', {
    views: [{ showGridLines: false }],
  })
  sheet.state = 'hidden'

  const lists: Record<TemplateListKey, string[]> = {
    catalogTypes: ['moneda', 'categoria', 'entidad_bancaria', 'tipo_activo'],
    categoryScopes: ['INGRESO', 'EGRESO'],
    accountTypes: ['CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD', 'STOCKS', 'ETF', 'CRYPTO', 'OTHER'],
    transactionTypes: ['INCOME', 'EXPENSE', 'TRANSFER'],
    transactionSubtypes: ['NORMAL', 'ASSET_PURCHASE', 'RECEIVABLE_LENDING', 'PAYABLE_PAYMENT'],
    paymentMethods: ['DEBIT', 'CREDIT'],
    creditTypes: ['CREDIT_CARD', 'LINE_OF_CREDIT'],
    creditStatuses: ['ACTIVE', 'CLOSED', 'BLOCKED'],
    assetStatuses: ['ACTIVE', 'SOLD', 'DEPRECIATED'],
    budgetPeriods: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
    receivableStatuses: ['PENDING', 'PARTIAL', 'COLLECTED', 'WRITTEN_OFF'],
    payableStatuses: ['PENDING', 'PARTIAL', 'PAID', 'DISPUTED'],
    yesNo: ['SI', 'NO'],
    currencies: catalogs.currencies.length > 0 ? catalogs.currencies : ['PEN', 'USD'],
    incomeCategories: catalogs.incomeCategories,
    expenseCategories: catalogs.expenseCategories,
    bankEntities: catalogs.bankEntities,
    assetTypes: catalogs.assetTypes,
    portfolios: catalogs.portfolios,
    creditCards: catalogs.creditCards,
    budgets: catalogs.budgets,
    credits: [],
    debtors: catalogs.debtors,
    creditors: catalogs.creditors,
    receivableReferences: catalogs.receivableReferences,
    payableReferences: catalogs.payableReferences,
    receivableSettlementTargets: uniqueSorted([...catalogs.debtors, ...catalogs.receivableReferences]),
    payableSettlementTargets: uniqueSorted([...catalogs.creditors, ...catalogs.payableReferences]),
  }

  const listKeys = Object.keys(lists) as TemplateListKey[]
  const listColumns = {} as Record<TemplateListKey, string>

  listKeys.forEach((key, index) => {
    const column = getColumnLetter(index + 1)
    listColumns[key] = column
    sheet.getCell(1, index + 1).value = key
    sheet.getCell(1, index + 1).font = { bold: true }
    sheet.getColumn(index + 1).width = 28

    const values = lists[key]
    const fillValues = values.length > 0 ? values : ['']
    fillValues.forEach((value, valueIndex) => {
      sheet.getCell(valueIndex + 2, index + 1).value = value
    })
  })

  return { sheet, listColumns }
}

function addMetadataSheet(workbook: ExcelJS.Workbook, catalogs: ImportTemplateCatalogs, generatedAt: Date) {
  const sheet = workbook.addWorksheet('_metadata', {
    views: [{ showGridLines: false }],
  })
  sheet.state = 'hidden'
  sheet.columns = [{ width: 28 }, { width: 60 }]
  const rows = [
    ['template_version', IMPORT_TEMPLATE_VERSION],
    ['generated_at', generatedAt.toISOString()],
    ['generated_for', catalogs.generatedFor],
    ['max_input_rows_per_sheet', MAX_TEMPLATE_ROWS],
    ['date_format', 'yyyy-mm-dd'],
    ['money_format', '#,##0.00'],
  ]
  rows.forEach((row, index) => {
    sheet.getRow(index + 1).values = row
  })
}

function addCatalogsUserSheet(workbook: ExcelJS.Workbook, catalogs: ImportTemplateCatalogs) {
  const sheet = workbook.addWorksheet('_catalogos_usuario', {
    views: [{ showGridLines: false }],
  })
  sheet.state = 'hidden'
  sheet.columns = [
    { header: 'tipo', key: 'tipo', width: 24 },
    { header: 'valor', key: 'valor', width: 42 },
  ]

  const rows = [
    ...catalogs.currencies.map(value => ({ tipo: 'moneda', valor: value })),
    ...catalogs.portfolios.map(value => ({ tipo: 'portafolio', valor: value })),
    ...catalogs.incomeCategories.map(value => ({ tipo: 'categoria_ingreso', valor: value })),
    ...catalogs.expenseCategories.map(value => ({ tipo: 'categoria_egreso', valor: value })),
    ...catalogs.bankEntities.map(value => ({ tipo: 'entidad_bancaria', valor: value })),
    ...catalogs.assetTypes.map(value => ({ tipo: 'tipo_activo', valor: value })),
    ...catalogs.creditCards.map(value => ({ tipo: 'tarjeta_credito', valor: value })),
    ...catalogs.budgets.map(value => ({ tipo: 'presupuesto', valor: value })),
    ...catalogs.debtors.map(value => ({ tipo: 'deudor', valor: value })),
    ...catalogs.creditors.map(value => ({ tipo: 'acreedor', valor: value })),
    ...catalogs.receivableReferences.map(value => ({ tipo: 'prestamo_por_cobrar', valor: value })),
    ...catalogs.payableReferences.map(value => ({ tipo: 'prestamo_por_pagar', valor: value })),
  ]
  sheet.addRows(rows)
}

function addChecksSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('_checks', {
    views: [{ showGridLines: false }],
  })
  sheet.state = 'hidden'
  sheet.columns = [
    { width: 24 },
    { width: 80 },
  ]
  sheet.getCell('A1').value = 'Check'
  sheet.getCell('B1').value = 'Criterio'
  sheet.getRow(1).font = { bold: true, color: { argb: COLORS.white } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } }
  sheet.addRows([
    ['Formato de fecha', 'Usar fechas reales de Excel con visualizacion yyyy-mm-dd.'],
    ['Montos', 'Usar numeros sin simbolo de moneda.'],
    ['Obligatorios', 'Completar columnas marcadas con *.'],
    ['Validacion final', 'FinTrack volvera a validar todo al subir el archivo.'],
  ])
}

function addInstructionsSheet(workbook: ExcelJS.Workbook, generatedAt: Date) {
  const sheet = workbook.addWorksheet('00_Instrucciones', {
    views: [{ showGridLines: false }],
  })
  sheet.state = 'hidden'
  sheet.columns = [
    { width: 28 },
    { width: 92 },
  ]
  setTitle(
    sheet,
    'FinTrack · Plantilla de migracion',
    'Completa solo las hojas que necesites. Las filas seran validadas antes de importar datos reales.',
    2,
  )

  const rows = [
    ['Version', IMPORT_TEMPLATE_VERSION],
    ['Generado', generatedAt.toISOString()],
    ['Fechas', 'Usa fechas reales de Excel con formato visible yyyy-mm-dd.'],
    ['Montos', 'Ingresa numeros sin simbolo de moneda. Ejemplo: 1500.50'],
    ['Portafolios', 'Los portafolios ya existen en FinTrack. Solo selecciona el nombre desde la lista.'],
    ['Categorias', 'Las categorias se muestran como texto simple tal como existen en FinTrack.'],
    ['Prestamos vinculados', 'En Ingresos y Egresos puedes usar el nombre del deudor o acreedor para una aplicacion general, o la referencia exacta REC-... / PAY-... para una cuenta puntual.'],
    ['Tipo de cambio', 'No necesitas llenarlo en la plantilla. FinTrack lo resolvera al importar usando la fecha del movimiento cuando exista un registro disponible.'],
    ['Obligatorios', 'Las columnas con * son obligatorias.'],
    ['Validacion', 'Excel ayuda con listas y formatos, pero FinTrack validara todo en el servidor.'],
    ['Estructura', 'La migracion de movimientos se divide por tipo de operacion: ingresos, egresos, transferencias, compra de activo, por cobrar y por pagar.'],
  ]

  rows.forEach((row, index) => {
    const rowNumber = index + 4
    sheet.getCell(rowNumber, 1).value = row[0]
    sheet.getCell(rowNumber, 2).value = row[1]
    sheet.getCell(rowNumber, 1).font = { bold: true, color: { argb: COLORS.text } }
    sheet.getCell(rowNumber, 2).alignment = { wrapText: true }
    sheet.getRow(rowNumber).height = 28
  })
}

export async function loadImportTemplateCatalogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<ImportTemplateCatalogs> {
  const db = supabase as SupabaseClient
  const [currenciesRes, categoriesRes, bankEntitiesRes, assetTypesRes, accountsRes, creditsRes, budgetsRes, debtorsRes, creditorsRes, receivablesRes, payablesRes] = await Promise.all([
    db
      .from('user_currencies')
      .select('code, name, is_active, is_system')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .eq('is_active', true),
    db
      .from('categories')
      .select('name, scope')
      .eq('user_id', userId),
    db
      .from('bank_entities')
      .select('name, short_name, code, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
    db
      .from('asset_types')
      .select('name, is_active, is_system, user_id')
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .eq('is_active', true),
    db
      .from('accounts')
      .select('name, currency, balance, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
    db
      .from('credits')
      .select('name, credit_type')
      .eq('user_id', userId)
      .eq('credit_type', 'CREDIT_CARD'),
    db
      .from('budgets')
      .select('name, currency, period_type, start_date, end_date, is_active, category:categories(name)')
      .eq('user_id', userId)
      .eq('is_active', true),
    db
      .from('debtors')
      .select('name, is_active')
      .eq('user_id', userId),
    db
      .from('creditors')
      .select('name, is_active')
      .eq('user_id', userId),
    db
      .from('accounts_receivable')
      .select('id, debtor_name, concept, currency, amount, issue_date, status')
      .eq('user_id', userId)
      .in('status', ['PENDING', 'PARTIAL']),
    db
      .from('accounts_payable')
      .select('id, creditor_name, concept, currency, amount, issue_date, status')
      .eq('user_id', userId)
      .in('status', ['PENDING', 'PARTIAL']),
  ])

  const firstError =
    currenciesRes.error ??
    categoriesRes.error ??
    bankEntitiesRes.error ??
    assetTypesRes.error ??
    accountsRes.error ??
    creditsRes.error ??
    budgetsRes.error ??
    debtorsRes.error ??
    creditorsRes.error ??
    receivablesRes.error ??
    payablesRes.error
  if (firstError) throw new Error(firstError.message)

  const currencies = uniqueSorted(
    ((currenciesRes.data ?? []) as RawCatalogRow[]).map(row => row.code),
  )

  const categoryRows = (categoriesRes.data ?? []) as RawCatalogRow[]
  const incomeCategories = uniqueSorted(
    categoryRows
      .filter(row => String(row.scope ?? '').toUpperCase() === 'INCOME')
      .map(row => row.name),
  )
  const expenseCategories = uniqueSorted(
    categoryRows
      .filter(row => String(row.scope ?? '').toUpperCase() === 'EXPENSE')
      .map(row => row.name),
  )

  const bankEntities = uniqueSorted(
    ((bankEntitiesRes.data ?? []) as RawCatalogRow[]).flatMap(row => [
      row.name,
      row.short_name,
      row.code,
    ]),
  )

  const assetTypes = uniqueSorted(
    ((assetTypesRes.data ?? []) as RawCatalogRow[]).map(row => row.name),
  )

  const portfolioSnapshots = (accountsRes.data ?? []).map(row => ({
    name: String(row.name),
    currency: String(row.currency),
    balance: typeof row.balance === 'number' ? row.balance : 0,
  }))

  const portfolios = uniqueSorted(portfolioSnapshots.map(row => row.name))
  const creditCards = uniqueSorted((creditsRes.data ?? []).map(row => row.name))
  const debtors = uniqueSorted((debtorsRes.data ?? []).map(row => row.name))
  const creditors = uniqueSorted((creditorsRes.data ?? []).map(row => row.name))
  const receivableReferences = uniqueSorted(
    (receivablesRes.data ?? []).map(row => buildReceivableImportReference({
      id: String(row.id),
      debtor_name: String(row.debtor_name ?? ''),
      concept: typeof row.concept === 'string' ? row.concept : null,
      currency: String(row.currency ?? 'PEN'),
      amount: typeof row.amount === 'number' ? row.amount : 0,
      issue_date: String(row.issue_date ?? ''),
    })),
  )
  const payableReferences = uniqueSorted(
    (payablesRes.data ?? []).map(row => buildPayableImportReference({
      id: String(row.id),
      creditor_name: String(row.creditor_name ?? ''),
      concept: typeof row.concept === 'string' ? row.concept : null,
      currency: String(row.currency ?? 'PEN'),
      amount: typeof row.amount === 'number' ? row.amount : 0,
      issue_date: String(row.issue_date ?? ''),
    })),
  )
  const budgetWindows = (budgetsRes.data ?? []).map(row => {
    const category = Array.isArray(row.category) ? row.category[0] : row.category
    return {
      name: String(row.name),
      currency: String(row.currency),
      period_type: String(row.period_type),
      start_date: String(row.start_date),
      end_date: row.end_date ? String(row.end_date) : null,
      category: category?.name ? String(category.name) : null,
    }
  })
  const budgets = uniqueSorted(budgetWindows.map(row => row.name))

  return {
    currencies,
    incomeCategories,
    expenseCategories,
    bankEntities,
    assetTypes,
    portfolios,
    portfolioSnapshots,
    creditCards,
    budgets,
    debtors,
    creditors,
    receivableReferences,
    payableReferences,
    budgetWindows,
    generatedFor: userId,
  }
}

export async function buildImportTemplateWorkbook(catalogs: ImportTemplateCatalogs): Promise<Uint8Array> {
  const generatedAt = new Date()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FinTrack'
  workbook.lastModifiedBy = 'FinTrack'
  workbook.created = generatedAt
  workbook.modified = generatedAt
  workbook.properties.date1904 = false

  addInstructionsSheet(workbook, generatedAt)
  const { sheet: listSheet, listColumns } = addListSheet(workbook, catalogs)
  addMetadataSheet(workbook, catalogs, generatedAt)
  addCatalogsUserSheet(workbook, catalogs)
  addChecksSheet(workbook)

  const catalogsSheet = await setupDataSheet(
    workbook,
    listSheet,
    listColumns,
    '01_Catalogos',
    '01 · Catalogos',
    'Crea o reutiliza catalogos base: monedas, categorias, entidades bancarias y tipos de activo.',
    [
      { key: 'tipo_catalogo', header: 'tipo_catalogo', width: 24, required: true, list: 'catalogTypes' },
      { key: 'clave', header: 'clave', width: 26, required: true, kind: 'text' },
      { key: 'nombre', header: 'nombre', width: 32, required: true, kind: 'text' },
      { key: 'alcance', header: 'alcance', width: 18, list: 'categoryScopes' },
      { key: 'codigo_moneda', header: 'codigo_moneda', width: 18, list: 'currencies' },
      { key: 'simbolo', header: 'simbolo', width: 14, kind: 'text' },
      { key: 'color', header: 'color', width: 14, kind: 'text' },
      { key: 'icono', header: 'icono', width: 16, kind: 'text' },
      { key: 'activo', header: 'activo', width: 14, list: 'yesNo' },
      { key: 'notas', header: 'notas', width: 42, kind: 'text' },
    ],
    [],
  )
  catalogsSheet.state = 'hidden'

  await setupDataSheet(
    workbook,
    listSheet,
    listColumns,
    '03_Ingresos',
    '03 · Ingresos',
    'Registra dinero que entra a tus cuentas. Solo selecciona un portafolio ya existente en FinTrack.',
    [
      { key: 'fecha', header: 'Fecha del ingreso', width: 16, required: true, kind: 'date', note: 'Fecha en que el dinero entro a la cuenta.' },
      {
        key: 'portafolio_destino',
        header: 'Portafolio destino',
        width: 28,
        required: true,
        list: 'portfolios',
        note: 'Selecciona el portafolio existente que recibe el dinero.',
      },
      { key: 'categoria', header: 'Categoria del ingreso', width: 28, required: true, list: 'incomeCategories', note: 'Selecciona la categoría de ingreso exactamente como existe en FinTrack.' },
      { key: 'descripcion', header: 'Descripcion', width: 40, required: true, kind: 'text', note: 'Texto corto para identificar el ingreso. Ejemplo: Sueldo mayo.' },
      { key: 'moneda', header: 'Moneda', width: 14, required: true, list: 'currencies', note: 'Moneda del movimiento.' },
      { key: 'monto', header: 'Monto del ingreso', width: 18, required: true, kind: 'money', note: 'Monto positivo del ingreso. No uses simbolos de moneda.' },
      {
        key: 'remitente',
        header: 'Remitente',
        width: 26,
        kind: 'text',
        note: 'Opcional. Persona o entidad que envia el dinero. Se deja libre porque no todos los ingresos provienen de deudores.',
      },
      {
        key: 'prestamo_relacionado',
        header: 'Prestamo por cobrar relacionado',
        width: 42,
        list: 'receivableSettlementTargets',
        note: 'Opcional. Puedes elegir el nombre del deudor para un cobro general al saldo abierto en esa moneda, o pegar la referencia exacta REC-... para cobrar una cuenta puntual.',
      },
      { key: 'notas', header: 'Notas', width: 42, kind: 'text', note: 'Comentario opcional para ampliar contexto.' },
    ],
    [],
  )

  await setupDataSheet(
    workbook,
    listSheet,
    listColumns,
    '04_Egresos',
    '04 · Egresos',
    'Registra dinero que sale de tus cuentas. Separa esta hoja para que el usuario solo vea campos de egreso.',
    [
      { key: 'fecha', header: 'Fecha del egreso', width: 16, required: true, kind: 'date', note: 'Fecha en que el dinero salio de la cuenta.' },
      {
        key: 'portafolio_origen',
        header: 'Portafolio origen',
        width: 28,
        required: true,
        list: 'portfolios',
        note: 'Selecciona el portafolio existente desde donde sale el dinero.',
      },
      { key: 'categoria', header: 'Categoria del egreso', width: 28, required: true, list: 'expenseCategories', note: 'Selecciona la categoría de egreso exactamente como existe en FinTrack.' },
      { key: 'presupuesto', header: 'Presupuesto', width: 30, list: 'budgets', note: 'Opcional. Selecciona el nombre del presupuesto. FinTrack validara que exista un periodo compatible con la fecha, moneda y categoria del egreso.' },
      { key: 'descripcion', header: 'Descripcion', width: 40, required: true, kind: 'text', note: 'Texto corto para identificar el egreso. Ejemplo: Compra supermercado.' },
      { key: 'moneda', header: 'Moneda', width: 14, required: true, list: 'currencies', note: 'Moneda del movimiento.' },
      { key: 'monto', header: 'Monto del egreso', width: 18, required: true, kind: 'money', note: 'Monto positivo del egreso. No uses simbolos de moneda.' },
      { key: 'forma_pago', header: 'Forma de pago', width: 18, list: 'paymentMethods', note: 'Selecciona DEBIT o CREDIT.' },
      { key: 'tarjeta_credito', header: 'Tarjeta de credito', width: 24, list: 'creditCards', note: 'Solo si forma de pago es CREDIT. Selecciona la tarjeta existente en FinTrack.' },
      {
        key: 'destinatario',
        header: 'Destinatario',
        width: 26,
        kind: 'text',
        note: 'Opcional. Persona o entidad que recibe el pago. Se deja libre porque no todos los egresos corresponden a acreedores.',
      },
      {
        key: 'prestamo_relacionado',
        header: 'Prestamo por pagar relacionado',
        width: 42,
        list: 'payableSettlementTargets',
        note: 'Opcional. Puedes elegir el nombre del acreedor para que FinTrack resuelva una cuenta abierta unica, o pegar la referencia exacta PAY-... para pagar una cuenta puntual.',
      },
      { key: 'notas', header: 'Notas', width: 42, kind: 'text', note: 'Comentario opcional para ampliar contexto.' },
    ],
    [],
  )

  await setupDataSheet(
    workbook,
    listSheet,
    listColumns,
    '05_Transferencias',
    '05 · Transferencias',
    'Usa una hoja exclusiva para movimientos entre tus propias cuentas.',
    [
      { key: 'fecha', header: 'Fecha de la transferencia', width: 20, required: true, kind: 'date', note: 'Fecha en que ocurre la transferencia.' },
      {
        key: 'portafolio_origen',
        header: 'Portafolio origen',
        width: 28,
        required: true,
        list: 'portfolios',
        note: 'Selecciona el portafolio existente desde donde sale el dinero.',
      },
      {
        key: 'portafolio_destino',
        header: 'Portafolio destino',
        width: 28,
        required: true,
        list: 'portfolios',
        note: 'Selecciona el portafolio existente que recibe el dinero.',
      },
      { key: 'descripcion', header: 'Descripcion', width: 40, required: true, kind: 'text', note: 'Texto corto para identificar la transferencia.' },
      { key: 'moneda', header: 'Moneda', width: 14, required: true, list: 'currencies', note: 'Moneda del movimiento.' },
      { key: 'monto', header: 'Monto de la transferencia', width: 22, required: true, kind: 'money', note: 'Monto positivo de la transferencia.' },
      { key: 'notas', header: 'Notas', width: 42, kind: 'text', note: 'Comentario opcional.' },
    ],
    [],
  )

  await setupDataSheet(
    workbook,
    listSheet,
    listColumns,
    '06_Compra_Activo',
    '06 · Compra de Activo',
    'Combina el egreso y el alta del activo en una sola hoja, siguiendo el tipo de operación de FinTrack.',
    [
      { key: 'fecha', header: 'Fecha de compra', width: 16, required: true, kind: 'date', note: 'Fecha de la compra del activo.' },
      {
        key: 'portafolio_origen',
        header: 'Portafolio origen',
        width: 28,
        required: true,
        list: 'portfolios',
        note: 'Selecciona el portafolio existente desde donde sale el dinero.',
      },
      { key: 'categoria', header: 'Categoria del egreso', width: 28, required: true, list: 'expenseCategories', note: 'Selecciona la categoría de egreso exactamente como existe en FinTrack.' },
      { key: 'presupuesto', header: 'Presupuesto', width: 30, list: 'budgets', note: 'Opcional. Selecciona el nombre del presupuesto. FinTrack validara que exista un periodo compatible con la fecha, moneda y categoria de la compra.' },
      { key: 'descripcion', header: 'Descripcion', width: 38, required: true, kind: 'text', note: 'Texto corto del movimiento. Ejemplo: Compra laptop Dell.' },
      { key: 'moneda', header: 'Moneda', width: 14, required: true, list: 'currencies', note: 'Moneda de la compra.' },
      { key: 'monto', header: 'Monto de la compra', width: 18, required: true, kind: 'money', note: 'Monto pagado por el activo.' },
      { key: 'forma_pago', header: 'Forma de pago', width: 18, list: 'paymentMethods', note: 'Selecciona DEBIT o CREDIT.' },
      { key: 'tarjeta_credito', header: 'Tarjeta de credito', width: 24, list: 'creditCards', note: 'Solo si forma de pago es CREDIT. Selecciona la tarjeta existente en FinTrack.' },
      { key: 'destinatario', header: 'Destinatario', width: 26, kind: 'text', note: 'Persona o comercio que recibe el pago. Opcional.' },
      { key: 'nombre_activo', header: 'Nombre del activo', width: 28, required: true, kind: 'text', note: 'Nombre visible del activo que se creará en FinTrack.' },
      { key: 'tipo_activo', header: 'Tipo de activo', width: 24, list: 'assetTypes', note: 'Tipo de activo ya existente en FinTrack. Opcional si luego se ajusta manualmente.' },
      { key: 'valor_actual', header: 'Valor actual', width: 16, required: true, kind: 'money', note: 'Valor actual del activo al momento de importarlo.' },
      { key: 'tasa_depreciacion', header: 'Tasa de depreciacion', width: 18, kind: 'number', note: 'Opcional. Porcentaje estimado de depreciación.' },
      { key: 'numero_serie', header: 'Numero de serie', width: 22, kind: 'text', note: 'Opcional. Serie o código del activo.' },
      { key: 'ubicacion', header: 'Ubicacion', width: 24, kind: 'text', note: 'Opcional. Lugar donde se encuentra el activo.' },
      { key: 'notas', header: 'Notas', width: 42, kind: 'text', note: 'Comentario opcional para ampliar contexto.' },
    ],
    [],
  )

  await setupDataSheet(
    workbook,
    listSheet,
    listColumns,
    '07_Por_Cobrar',
    '07 · Por Cobrar',
    'Deudores y cuentas por cobrar. Permite migrar prestamos personales o saldos pendientes.',
    [
      { key: 'deudor', header: 'Nombre del deudor', width: 30, required: true, list: 'debtors', note: 'Nombre de la persona o entidad que debe pagar. Selecciónalo desde los deudores existentes en FinTrack.' },
      { key: 'relacion', header: 'Relacion', width: 20, kind: 'text', note: 'Opcional. Ejemplo: amigo, cliente, familiar.' },
      { key: 'fecha', header: 'Fecha de origen', width: 16, required: true, kind: 'date', note: 'Fecha en que nace la cuenta por cobrar.' },
      { key: 'fecha_vencimiento', header: 'Fecha de vencimiento', width: 18, kind: 'date', note: 'Fecha límite esperada de cobro. Opcional.' },
      { key: 'moneda', header: 'Moneda', width: 14, required: true, list: 'currencies', note: 'Moneda de la cuenta por cobrar.' },
      { key: 'monto', header: 'Monto total', width: 16, required: true, kind: 'money', note: 'Monto total pendiente o histórico.' },
      { key: 'monto_cobrado', header: 'Monto cobrado', width: 18, kind: 'money', note: 'Si ya se cobró una parte, indícala aquí.' },
      { key: 'concepto', header: 'Concepto', width: 36, required: true, kind: 'text', note: 'Motivo de la deuda. Ejemplo: Préstamo personal.' },
      { key: 'estado', header: 'Estado', width: 18, list: 'receivableStatuses', note: 'Selecciona PENDING, PARTIAL, COLLECTED o WRITTEN_OFF.' },
      {
        key: 'portafolio_origen',
        header: 'Portafolio de referencia',
        width: 28,
        list: 'portfolios',
        note: 'Opcional. Selecciona el portafolio ya existente relacionado al origen del préstamo o cobro.',
      },
      { key: 'notas', header: 'Notas', width: 42, kind: 'text', note: 'Comentario opcional para ampliar contexto.' },
    ],
    [],
  )

  await setupDataSheet(
    workbook,
    listSheet,
    listColumns,
    '08_Por_Pagar',
    '08 · Por Pagar',
    'Acreedores y cuentas por pagar. Permite migrar obligaciones pendientes o historicas.',
    [
      { key: 'acreedor', header: 'Nombre del acreedor', width: 30, required: true, list: 'creditors', note: 'Nombre de la persona o entidad a la que debes pagar. Selecciónalo desde los acreedores existentes en FinTrack.' },
      { key: 'relacion', header: 'Relacion', width: 20, kind: 'text', note: 'Opcional. Ejemplo: proveedor, familiar, banco.' },
      { key: 'fecha', header: 'Fecha de origen', width: 16, required: true, kind: 'date', note: 'Fecha en que nace la obligación.' },
      { key: 'fecha_vencimiento', header: 'Fecha de vencimiento', width: 18, kind: 'date', note: 'Fecha límite esperada de pago. Opcional.' },
      { key: 'moneda', header: 'Moneda', width: 14, required: true, list: 'currencies', note: 'Moneda de la cuenta por pagar.' },
      { key: 'monto', header: 'Monto total', width: 16, required: true, kind: 'money', note: 'Monto total pendiente o histórico.' },
      { key: 'monto_pagado', header: 'Monto pagado', width: 18, kind: 'money', note: 'Si ya se pagó una parte, indícala aquí.' },
      { key: 'concepto', header: 'Concepto', width: 36, required: true, kind: 'text', note: 'Motivo de la obligación. Ejemplo: Compra a proveedor.' },
      { key: 'estado', header: 'Estado', width: 18, list: 'payableStatuses', note: 'Selecciona PENDING, PARTIAL, PAID o DISPUTED.' },
      {
        key: 'portafolio_origen',
        header: 'Portafolio de referencia',
        width: 28,
        list: 'portfolios',
        note: 'Opcional. Selecciona el portafolio ya existente relacionado al origen del pago u obligación.',
      },
      { key: 'notas', header: 'Notas', width: 42, kind: 'text', note: 'Comentario opcional para ampliar contexto.' },
    ],
    [],
  )

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}
