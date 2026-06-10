import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '@/types/database.types'
import { TransactionService } from '@/modules/transactions/transaction.service'
import type { ImportJob, ImportJobRow, ImportJobSummary, ImportJobWithRows } from '@/lib/imports/import-types'
import { resolveAccountingUsdPenExchangeRate } from '@/lib/server/exchange-rate'

type DbClient = SupabaseClient<Database>
type UntypedDbClient = SupabaseClient

type CommitCounts = Record<
  | 'user_currencies'
  | 'bank_entities'
  | 'categories'
  | 'asset_types'
  | 'accounts'
  | 'credits'
  | 'assets'
  | 'budgets'
  | 'debtors'
  | 'creditors'
  | 'receivables'
  | 'payables'
  | 'recurring_transactions'
  | 'transactions',
  number
>

type AccountRef = {
  id: string
  name: string
  currency: string
  type: Database['public']['Enums']['account_type']
  bank_entity_id: string | null
}

type CreditRef = {
  id: string
  name: string
  account_id: string | null
  credit_type: Database['public']['Enums']['credit_type']
}

type BudgetRef = {
  id: string
  name: string
  currency: string
  period_type: Database['public']['Enums']['budget_period']
  start_date: string
}

type CounterpartyRef = {
  id: string
  name: string
}

type CreatedOrReused<T> = {
  record: T
  created: boolean
}

type ImportCommitMetaTarget = {
  table: string
  id: string
}

type RowImportCommitMeta = {
  version: 'rollback-v1'
  createdTargets: ImportCommitMetaTarget[]
  reusedTargets?: ImportCommitMetaTarget[]
  creditAdjustment?: {
    creditId: string
    operation: 'CONSUMPTION' | 'PAYMENT'
    amount: number
  }
}

type NormalizedCatalogs = {
  currencies: Map<string, { id: string; code: string }>
  bankEntities: Map<string, { id: string; name: string }>
  categoriesByScopedName: Map<string, { id: string; name: string; scope: 'INCOME' | 'EXPENSE' }>
  categoriesByName: Map<string, Array<{ id: string; name: string; scope: 'INCOME' | 'EXPENSE' }>>
  assetTypes: Map<string, { id: string; name: string }>
  accountsByComposite: Map<string, AccountRef>
  accountsByName: Map<string, AccountRef[]>
  accountsByRowKey: Map<string, AccountRef>
  creditsByName: Map<string, CreditRef>
  creditsByRowKey: Map<string, CreditRef>
  budgetsByName: Map<string, BudgetRef>
  budgetsByRowKey: Map<string, BudgetRef>
  debtorsByName: Map<string, CounterpartyRef>
  debtorsByRowKey: Map<string, CounterpartyRef>
  creditorsByName: Map<string, CounterpartyRef>
  creditorsByRowKey: Map<string, CounterpartyRef>
  transactionsByRowKey: Map<string, { id: string }>
}

type ImportContext = NormalizedCatalogs

type ImportCommitRuntime = {
  exchangeRateCache: Map<string, number | undefined>
}

function trimText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function untyped(db: DbClient): UntypedDbClient {
  return db as unknown as UntypedDbClient
}

function toUpperText(value: unknown): string | null {
  const trimmed = trimText(value)
  return trimmed ? trimmed.toUpperCase() : null
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function normalizeScopedCategory(scope: 'INCOME' | 'EXPENSE', name: string): string {
  return `${scope}::${normalizeName(name)}`
}

function normalizeAccountKey(name: string, currency: string): string {
  return `${normalizeName(name)}::${currency.toUpperCase()}`
}

function normalizeBudgetKey(name: string, periodType: string, currency: string, startDate: string): string {
  return `${normalizeName(name)}::${periodType.toUpperCase()}::${currency.toUpperCase()}::${startDate}`
}

function asBoolean(value: unknown, fallback = true): boolean {
  const normalized = trimText(value)?.toUpperCase()
  if (normalized === 'SI') return true
  if (normalized === 'NO') return false
  return fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function hasConcreteValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return !!trimText(value)
}

function isRowImportable(row: ImportJobRow) {
  return row.status === 'VALID' || row.status === 'WARNING'
}

function withRowCommitMeta(
  payload: Record<string, unknown>,
  meta: RowImportCommitMeta | null,
): Record<string, unknown> {
  const nextPayload = { ...payload }
  if (meta) {
    nextPayload.__import_commit = meta
  } else {
    delete nextPayload.__import_commit
  }
  return nextPayload
}

async function loadExistingContext(db: DbClient, userId: string): Promise<ImportContext> {
  const [
    currenciesRes,
    bankEntitiesRes,
    categoriesRes,
    assetTypesRes,
    accountsRes,
    budgetsRes,
    creditsRes,
    debtorsRes,
    creditorsRes,
  ] = await Promise.all([
    db.from('user_currencies').select('id, code').or(`user_id.eq.${userId},is_system.eq.true`),
    db.from('bank_entities').select('id, name, short_name, code').eq('user_id', userId),
    db.from('categories').select('id, name, scope').eq('user_id', userId),
    db.from('asset_types').select('id, name, is_system, user_id').or(`user_id.eq.${userId},is_system.eq.true`),
    db.from('accounts').select('id, name, currency, type, bank_entity_id').eq('user_id', userId),
    db.from('budgets').select('id, name, currency, period_type, start_date').eq('user_id', userId),
    db.from('credits').select('id, name, account_id, credit_type').eq('user_id', userId),
    db.from('debtors').select('id, name').eq('user_id', userId),
    db.from('creditors').select('id, name').eq('user_id', userId),
  ])

  const firstError =
    currenciesRes.error ??
    bankEntitiesRes.error ??
    categoriesRes.error ??
    assetTypesRes.error ??
    accountsRes.error ??
    budgetsRes.error ??
    creditsRes.error ??
    debtorsRes.error ??
    creditorsRes.error

  if (firstError) throw new Error(firstError.message)

  const currencies = new Map<string, { id: string; code: string }>()
  for (const row of currenciesRes.data ?? []) {
    currencies.set(String(row.code).toUpperCase(), { id: String(row.id), code: String(row.code).toUpperCase() })
  }

  const bankEntities = new Map<string, { id: string; name: string }>()
  for (const row of bankEntitiesRes.data ?? []) {
    const values = [row.name, row.short_name, row.code].map(value => trimText(value)).filter(Boolean) as string[]
    for (const value of values) {
      bankEntities.set(normalizeName(value), { id: String(row.id), name: String(row.name) })
    }
  }

  const categoriesByScopedName = new Map<string, { id: string; name: string; scope: 'INCOME' | 'EXPENSE' }>()
  const categoriesByName = new Map<string, Array<{ id: string; name: string; scope: 'INCOME' | 'EXPENSE' }>>()
  for (const row of categoriesRes.data ?? []) {
    const scope = row.scope === 'INCOME' ? 'INCOME' : 'EXPENSE'
    const entry = {
      id: String(row.id),
      name: String(row.name),
      scope,
    } as const
    categoriesByScopedName.set(normalizeScopedCategory(scope, entry.name), entry)
    const nameKey = normalizeName(entry.name)
    const group = categoriesByName.get(nameKey) ?? []
    group.push(entry)
    categoriesByName.set(nameKey, group)
  }

  const assetTypes = new Map<string, { id: string; name: string }>()
  for (const row of assetTypesRes.data ?? []) {
    assetTypes.set(normalizeName(String(row.name)), { id: String(row.id), name: String(row.name) })
  }

  const accountsByComposite = new Map<string, AccountRef>()
  const accountsByName = new Map<string, AccountRef[]>()
  for (const row of accountsRes.data ?? []) {
    const entry = {
      id: String(row.id),
      name: String(row.name),
      currency: String(row.currency),
      type: row.type,
      bank_entity_id: row.bank_entity_id ? String(row.bank_entity_id) : null,
    } satisfies AccountRef

    accountsByComposite.set(normalizeAccountKey(entry.name, entry.currency), entry)
    const nameKey = normalizeName(entry.name)
    const group = accountsByName.get(nameKey) ?? []
    group.push(entry)
    accountsByName.set(nameKey, group)
  }

  const budgetsByName = new Map<string, BudgetRef>()
  for (const row of budgetsRes.data ?? []) {
    budgetsByName.set(normalizeName(String(row.name)), {
      id: String(row.id),
      name: String(row.name),
      currency: String(row.currency),
      period_type: row.period_type,
      start_date: String(row.start_date),
    })
  }

  const creditsByName = new Map<string, CreditRef>()
  for (const row of creditsRes.data ?? []) {
    creditsByName.set(normalizeName(String(row.name)), {
      id: String(row.id),
      name: String(row.name),
      account_id: row.account_id ? String(row.account_id) : null,
      credit_type: row.credit_type,
    })
  }

  const debtorsByName = new Map<string, CounterpartyRef>()
  for (const row of debtorsRes.data ?? []) {
    debtorsByName.set(normalizeName(String(row.name)), { id: String(row.id), name: String(row.name) })
  }

  const creditorsByName = new Map<string, CounterpartyRef>()
  for (const row of creditorsRes.data ?? []) {
    creditorsByName.set(normalizeName(String(row.name)), { id: String(row.id), name: String(row.name) })
  }

  return {
    currencies,
    bankEntities,
    categoriesByScopedName,
    categoriesByName,
    assetTypes,
    accountsByComposite,
    accountsByName,
    accountsByRowKey: new Map(),
    creditsByName,
    creditsByRowKey: new Map(),
    budgetsByName,
    budgetsByRowKey: new Map(),
    debtorsByName,
    debtorsByRowKey: new Map(),
    creditorsByName,
    creditorsByRowKey: new Map(),
    transactionsByRowKey: new Map(),
  }
}

function resolveCategoryId(
  ctx: ImportContext,
  type: 'INCOME' | 'EXPENSE',
  rawCategory: unknown,
): string | null {
  const category = trimText(rawCategory)
  if (!category) return null

  if (category.includes(':')) {
    const [rawScope, ...rest] = category.split(':')
    const scopedName = rest.join(':').trim()
    const scopedType = rawScope?.trim().toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE'
    return ctx.categoriesByScopedName.get(normalizeScopedCategory(scopedType, scopedName))?.id ?? null
  }

  const candidates = ctx.categoriesByName.get(normalizeName(category)) ?? []
  const sameType = candidates.find(candidate => candidate.scope === type)
  if (sameType) return sameType.id
  if (candidates.length === 1) return candidates[0]?.id ?? null
  return null
}

function resolveAccount(
  ctx: ImportContext,
  rawName: unknown,
  rawCurrency?: unknown,
): AccountRef | null {
  const name = trimText(rawName)
  if (!name) return null

  const candidates = ctx.accountsByName.get(normalizeName(name)) ?? []
  if (candidates.length === 1) return candidates[0] ?? null

  const currency = toUpperText(rawCurrency)
  if (currency) {
    const exact = candidates.find(candidate => candidate.currency.toUpperCase() === currency)
    if (exact) return exact
  }

  return null
}

function resolveBankEntityId(ctx: ImportContext, rawValue: unknown): string | null {
  const value = trimText(rawValue)
  if (!value) return null
  return ctx.bankEntities.get(normalizeName(value))?.id ?? null
}

function resolveBudgetId(ctx: ImportContext, rawValue: unknown): string | null {
  const value = trimText(rawValue)
  if (!value) return null
  return (
    ctx.budgetsByRowKey.get(value)?.id ??
    ctx.budgetsByName.get(normalizeName(value))?.id ??
    null
  )
}

function resolveCreditId(ctx: ImportContext, rawValue: unknown): string | null {
  const value = trimText(rawValue)
  if (!value) return null
  return (
    ctx.creditsByRowKey.get(value)?.id ??
    ctx.creditsByName.get(normalizeName(value))?.id ??
    null
  )
}

async function resolveImportExchangeRate(
  _db: DbClient,
  runtime: ImportCommitRuntime,
  currency: string,
  transactionDate: string | null,
): Promise<number | undefined> {
  if (currency !== 'USD') return undefined

  const cacheKey = `${currency}::${transactionDate ?? 'latest'}`
  if (runtime.exchangeRateCache.has(cacheKey)) {
    return runtime.exchangeRateCache.get(cacheKey)
  }

  const fallback = await resolveAccountingUsdPenExchangeRate({
    date: transactionDate,
    allowPrior: true,
    ensureForToday: true,
  })
  const resolved = fallback.rate > 0 ? fallback.rate : undefined
  runtime.exchangeRateCache.set(cacheKey, resolved)
  return resolved
}

function resolveDebtor(ctx: ImportContext, rawValue: unknown): CounterpartyRef | null {
  const value = trimText(rawValue)
  if (!value) return null
  return (
    ctx.debtorsByRowKey.get(value) ??
    ctx.debtorsByName.get(normalizeName(value)) ??
    null
  )
}

function resolveCreditor(ctx: ImportContext, rawValue: unknown): CounterpartyRef | null {
  const value = trimText(rawValue)
  if (!value) return null
  return (
    ctx.creditorsByRowKey.get(value) ??
    ctx.creditorsByName.get(normalizeName(value)) ??
    null
  )
}

async function markRow(
  db: DbClient,
  row: ImportJobRow,
  status: 'IMPORTED' | 'SKIPPED',
  targetTable: string | null,
  targetRecordId: string | null,
  commitMeta?: RowImportCommitMeta | null,
) {
  const { error } = await untyped(db)
    .from('import_job_rows')
    .update({
      status,
      target_table: targetTable,
      target_record_id: targetRecordId,
      payload: withRowCommitMeta(row.payload, commitMeta ?? null),
    })
    .eq('id', row.id)

  if (error) throw new Error(error.message)
}

async function updateJobState(
  db: DbClient,
  jobId: string,
  status: 'VALIDATED' | 'COMMITTED' | 'FAILED',
  patch: Partial<ImportJob>,
  summaryPatch: Partial<ImportJobSummary> = {},
) {
  const current = patch.summary as ImportJobSummary | undefined
  const summary = {
    ...(current ?? {}),
    ...summaryPatch,
  }

  const { error } = await untyped(db)
    .from('import_jobs')
    .update({
      status,
      summary,
      committed_at: status === 'COMMITTED' ? new Date().toISOString() : patch.committed_at ?? null,
      error_count: patch.error_count,
      warning_count: patch.warning_count,
    })
    .eq('id', jobId)

  if (error) throw new Error(error.message)
}

async function countImportedRows(
  db: DbClient,
  userId: string,
  jobId: string,
): Promise<number> {
  const { count, error } = await untyped(db)
    .from('import_job_rows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('import_job_id', jobId)
    .eq('status', 'IMPORTED')

  if (error) throw new Error(error.message)
  return count ?? 0
}

async function findCommittedJobByFileHash(
  db: DbClient,
  userId: string,
  fileHash: string,
  excludeJobId?: string,
): Promise<ImportJobWithRows | null> {
  let request = untyped(db)
    .from('import_jobs')
    .select('id,user_id,source,status,template_version,file_name,file_url,file_size_bytes,file_hash,summary,error_count,warning_count,created_at,updated_at,committed_at')
    .eq('user_id', userId)
    .eq('file_hash', fileHash)
    .eq('status', 'COMMITTED')
    .order('created_at', { ascending: false })
    .limit(1)

  if (excludeJobId) {
    request = request.neq('id', excludeJobId)
  }

  const { data, error } = await request
  if (error) throw new Error(error.message)
  const job = (data ?? [])[0] as ImportJob | undefined
  if (!job) return null

  const { data: rows, error: rowsError } = await untyped(db)
    .from('import_job_rows')
    .select('id,import_job_id,user_id,sheet_name,row_number,row_key,status,payload,errors,warnings,target_table,target_record_id,created_at,updated_at')
    .eq('user_id', userId)
    .eq('import_job_id', job.id)
    .order('sheet_name', { ascending: true })
    .order('row_number', { ascending: true })

  if (rowsError) throw new Error(rowsError.message)

  return {
    ...job,
    rows: rows as unknown as ImportJobRow[],
  }
}

async function createOrReuseCategory(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<CreatedOrReused<{ id: string }>> {
  const name = trimText(row.payload.nombre)
  const scope: 'INCOME' | 'EXPENSE' = trimText(row.payload.alcance) === 'INGRESO' ? 'INCOME' : 'EXPENSE'
  if (!name) throw new Error(`La fila ${row.row_number} de catalogos no tiene nombre de categoria.`)

  const scopedKey = normalizeScopedCategory(scope, name)
  const existing = ctx.categoriesByScopedName.get(scopedKey)
  if (existing) return { record: { id: existing.id }, created: false }

  const insertPayload: TablesInsert<'categories'> = {
    user_id: userId,
    is_system: false,
    system_key: null,
    name,
    scope,
    icon: trimText(row.payload.icono) ?? 'tag',
    color: trimText(row.payload.color) ?? '#6b7280',
    sort_order: 100,
  }

  const { data, error } = await db.from('categories').insert(insertPayload).select('id, name, scope').single()
  if (error) throw new Error(error.message)

  const created = {
    id: String(data.id),
    name: String(data.name),
    scope: data.scope === 'INCOME' ? 'INCOME' : 'EXPENSE',
  } as const
  ctx.categoriesByScopedName.set(scopedKey, created)
  const nameKey = normalizeName(created.name)
  const group = ctx.categoriesByName.get(nameKey) ?? []
  group.push(created)
  ctx.categoriesByName.set(nameKey, group)
  return { record: { id: created.id }, created: true }
}

async function createOrReuseCurrency(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<CreatedOrReused<{ id: string }>> {
  const code = toUpperText(row.payload.codigo_moneda) ?? toUpperText(row.payload.clave)
  const name = trimText(row.payload.nombre)
  if (!code || !name) throw new Error(`La fila ${row.row_number} de catalogos no tiene codigo o nombre de moneda.`)

  const existing = ctx.currencies.get(code)
  if (existing) return { record: { id: existing.id }, created: false }

  const { data, error } = await db
    .from('user_currencies')
    .insert({
      user_id: userId,
      code,
      name,
      symbol: trimText(row.payload.simbolo) ?? '$',
      is_default: false,
      is_system: false,
      is_active: asBoolean(row.payload.activo, true),
    })
    .select('id, code')
    .single()

  if (error) throw new Error(error.message)
  const created = { id: String(data.id), code: String(data.code).toUpperCase() }
  ctx.currencies.set(created.code, created)
  return { record: { id: created.id }, created: true }
}

async function createOrReuseBankEntity(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<CreatedOrReused<{ id: string }>> {
  const name = trimText(row.payload.nombre)
  if (!name) throw new Error(`La fila ${row.row_number} de catalogos no tiene nombre de entidad bancaria.`)

  const aliases = [name, trimText(row.payload.clave)].filter(Boolean) as string[]
  for (const alias of aliases) {
    const existing = ctx.bankEntities.get(normalizeName(alias))
    if (existing) return { record: { id: existing.id }, created: false }
  }

  const { data, error } = await db
    .from('bank_entities')
    .insert({
      user_id: userId,
      name,
      short_name: trimText(row.payload.clave),
      code: trimText(row.payload.clave),
      country: 'PE',
      color: trimText(row.payload.color) ?? '#0ea5e9',
      icon: trimText(row.payload.icono) ?? 'bank',
      is_active: asBoolean(row.payload.activo, true),
    })
    .select('id, name, short_name, code')
    .single()

  if (error) throw new Error(error.message)

  const created = { id: String(data.id), name: String(data.name) }
  for (const alias of [data.name, data.short_name, data.code].map(value => trimText(value)).filter(Boolean) as string[]) {
    ctx.bankEntities.set(normalizeName(alias), created)
  }
  return { record: { id: created.id }, created: true }
}

async function createOrReuseAssetType(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<CreatedOrReused<{ id: string }>> {
  const name = trimText(row.payload.nombre)
  if (!name) throw new Error(`La fila ${row.row_number} de catalogos no tiene nombre de tipo de activo.`)

  const existing = ctx.assetTypes.get(normalizeName(name))
  if (existing) return { record: { id: existing.id }, created: false }

  const { data, error } = await db
    .from('asset_types')
    .insert({
      user_id: userId,
      name,
      icon: trimText(row.payload.icono) ?? 'package',
      color: trimText(row.payload.color) ?? '#6366f1',
      is_system: false,
      is_active: asBoolean(row.payload.activo, true),
    })
    .select('id, name')
    .single()

  if (error) throw new Error(error.message)
  const created = { id: String(data.id), name: String(data.name) }
  ctx.assetTypes.set(normalizeName(created.name), created)
  return { record: { id: created.id }, created: true }
}

async function createOrReuseAccount(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<CreatedOrReused<AccountRef>> {
  const name = trimText(row.payload.nombre)
  const currency = toUpperText(row.payload.moneda)
  if (!name || !currency) throw new Error(`La fila ${row.row_number} de portafolios no tiene nombre o moneda.`)

  const composite = normalizeAccountKey(name, currency)
  const existing = ctx.accountsByComposite.get(composite)
  if (existing) {
    const rowKey = trimText(row.payload.clave_portafolio)
    if (rowKey) ctx.accountsByRowKey.set(rowKey, existing)
    return { record: existing, created: false }
  }

  const bankEntityId = resolveBankEntityId(ctx, row.payload.entidad_bancaria)
  const institution = trimText(row.payload.entidad_bancaria)
  const { data, error } = await db
    .from('accounts')
    .insert({
      user_id: userId,
      name,
      institution: institution ?? null,
      bank_entity_id: bankEntityId,
      type: (trimText(row.payload.tipo) ?? 'CHECKING') as Database['public']['Enums']['account_type'],
      currency,
      initial_balance: asNumber(row.payload.saldo_inicial, 0),
      balance: asNumber(row.payload.saldo_inicial, 0),
      include_in_net_worth: asBoolean(row.payload.incluir_patrimonio, true),
      color: trimText(row.payload.color) ?? '#10b981',
      icon: trimText(row.payload.icono) ?? 'wallet',
      notes: trimText(row.payload.notas),
      is_active: asBoolean(row.payload.activo, true),
    })
    .select('id, name, currency, type, bank_entity_id')
    .single()

  if (error) throw new Error(error.message)
  const created: AccountRef = {
    id: String(data.id),
    name: String(data.name),
    currency: String(data.currency),
    type: data.type,
    bank_entity_id: data.bank_entity_id ? String(data.bank_entity_id) : null,
  }
  ctx.accountsByComposite.set(composite, created)
  const rowKey = trimText(row.payload.clave_portafolio)
  if (rowKey) ctx.accountsByRowKey.set(rowKey, created)
  return { record: created, created: true }
}

async function createOrReuseBudget(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<CreatedOrReused<BudgetRef>> {
  const name = trimText(row.payload.nombre)
  const currency = toUpperText(row.payload.moneda)
  const periodType = trimText(row.payload.periodicidad)
  const startDate = trimText(row.payload.fecha_inicio)
  if (!name || !currency || !periodType || !startDate) {
    throw new Error(`La fila ${row.row_number} de presupuestos no tiene nombre, moneda, periodicidad o fecha_inicio.`)
  }

  const compositeKey = normalizeBudgetKey(name, periodType, currency, startDate)
  const existing =
    [...ctx.budgetsByRowKey.values()].find(candidate => normalizeBudgetKey(candidate.name, candidate.period_type, candidate.currency, candidate.start_date) === compositeKey) ??
    [...ctx.budgetsByName.values()].find(candidate => normalizeBudgetKey(candidate.name, candidate.period_type, candidate.currency, candidate.start_date) === compositeKey)

  if (existing) {
    const rowKey = trimText(row.payload.clave_presupuesto)
    if (rowKey) ctx.budgetsByRowKey.set(rowKey, existing)
    return { record: existing, created: false }
  }

  const categoryId = resolveCategoryId(ctx, 'EXPENSE', row.payload.categoria)
  const { data, error } = await db
    .from('budgets')
    .insert({
      user_id: userId,
      series_id: crypto.randomUUID(),
      name,
      description: trimText(row.payload.descripcion),
      category_id: categoryId,
      amount: asNumber(row.payload.monto),
      currency,
      period_type: periodType as Database['public']['Enums']['budget_period'],
      start_date: startDate,
      end_date: trimText(row.payload.fecha_fin),
      is_active: asBoolean(row.payload.estado, true),
      notes: null,
    })
    .select('id, name, currency, period_type, start_date')
    .single()

  if (error) throw new Error(error.message)

  const created: BudgetRef = {
    id: String(data.id),
    name: String(data.name),
    currency: String(data.currency),
    period_type: data.period_type,
    start_date: String(data.start_date),
  }
  ctx.budgetsByName.set(normalizeName(created.name), created)
  const rowKey = trimText(row.payload.clave_presupuesto)
  if (rowKey) ctx.budgetsByRowKey.set(rowKey, created)
  return { record: created, created: true }
}

async function ensureDebtor(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  rawNameOrKey: unknown,
  relationship?: unknown,
  rowKey?: string | null,
): Promise<CreatedOrReused<CounterpartyRef>> {
  const directKey = trimText(rawNameOrKey)
  if (!directKey) throw new Error('No se pudo resolver el deudor.')

  const existing = resolveDebtor(ctx, directKey)
  if (existing) {
    if (rowKey) ctx.debtorsByRowKey.set(rowKey, existing)
    return { record: existing, created: false }
  }

  const { data, error } = await db
    .from('debtors')
    .insert({
      user_id: userId,
      name: directKey,
      relationship: trimText(relationship),
      initial_debt: 0,
      is_active: true,
    })
    .select('id, name')
    .single()

  if (error) throw new Error(error.message)
  const created = { id: String(data.id), name: String(data.name) }
  ctx.debtorsByName.set(normalizeName(created.name), created)
  if (rowKey) ctx.debtorsByRowKey.set(rowKey, created)
  return { record: created, created: true }
}

async function ensureCreditor(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  rawNameOrKey: unknown,
  relationship?: unknown,
  rowKey?: string | null,
): Promise<CreatedOrReused<CounterpartyRef>> {
  const directKey = trimText(rawNameOrKey)
  if (!directKey) throw new Error('No se pudo resolver el acreedor.')

  const existing = resolveCreditor(ctx, directKey)
  if (existing) {
    if (rowKey) ctx.creditorsByRowKey.set(rowKey, existing)
    return { record: existing, created: false }
  }

  const { data, error } = await db
    .from('creditors')
    .insert({
      user_id: userId,
      name: directKey,
      relationship: trimText(relationship),
      initial_debt: 0,
      is_active: true,
    })
    .select('id, name')
    .single()

  if (error) throw new Error(error.message)
  const created = { id: String(data.id), name: String(data.name) }
  ctx.creditorsByName.set(normalizeName(created.name), created)
  if (rowKey) ctx.creditorsByRowKey.set(rowKey, created)
  return { record: created, created: true }
}

async function createOrReuseCredit(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<CreatedOrReused<CreditRef>> {
  const rowKey = trimText(row.payload.clave_credito)
  const name = trimText(row.payload.nombre)
  if (!rowKey || !name) throw new Error(`La fila ${row.row_number} de creditos no tiene clave o nombre.`)

  const existing = resolveCreditId(ctx, rowKey) ?? resolveCreditId(ctx, name)
  if (existing) {
    const resolved = ctx.creditsByRowKey.get(rowKey) ?? ctx.creditsByName.get(normalizeName(name))
    if (resolved) {
      ctx.creditsByRowKey.set(rowKey, resolved)
      return { record: resolved, created: false }
    }
  }

  const associatedPortfolioKey = trimText(row.payload.portafolio_asociado)
  const associatedAccount = associatedPortfolioKey ? ctx.accountsByRowKey.get(associatedPortfolioKey) : null
  const bankEntityId =
    resolveBankEntityId(ctx, row.payload.entidad_bancaria) ??
    associatedAccount?.bank_entity_id ??
    null

  const { data, error } = await db
    .from('credits')
    .insert({
      user_id: userId,
      account_id: associatedAccount?.id ?? null,
      transaction_id: null,
      bank_entity_id: bankEntityId,
      credit_type: (trimText(row.payload.tipo_credito) ?? 'CREDIT_CARD') as Database['public']['Enums']['credit_type'],
      name,
      credit_limit: asNumber(row.payload.limite_credito),
      used_amount: asNumber(row.payload.monto_usado),
      available_amount: asNumber(row.payload.limite_credito) - asNumber(row.payload.monto_usado),
      interest_rate: asNumber(row.payload.tasa_interes, 0),
      closing_day: hasConcreteValue(row.payload.dia_cierre) ? asNumber(row.payload.dia_cierre) : null,
      payment_day: hasConcreteValue(row.payload.dia_pago) ? asNumber(row.payload.dia_pago) : null,
      currency: toUpperText(row.payload.moneda) ?? 'PEN',
      status: (trimText(row.payload.estado) ?? 'ACTIVE') as Database['public']['Enums']['credit_status'],
      notes: trimText(row.payload.notas),
    })
    .select('id, name, account_id, credit_type')
    .single()

  if (error) throw new Error(error.message)

  const created: CreditRef = {
    id: String(data.id),
    name: String(data.name),
    account_id: data.account_id ? String(data.account_id) : null,
    credit_type: data.credit_type,
  }
  ctx.creditsByName.set(normalizeName(created.name), created)
  ctx.creditsByRowKey.set(rowKey, created)
  return { record: created, created: true }
}

async function createAssetRecord(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<string> {
  const name = trimText(row.payload.nombre)
  const purchaseDate = trimText(row.payload.fecha_compra)
  const currency = toUpperText(row.payload.moneda)
  if (!name || !purchaseDate || !currency) {
    throw new Error(`La fila ${row.row_number} de activos no tiene nombre, fecha_compra o moneda.`)
  }

  const linkedTransactionKey = trimText(row.payload.clave_transaccion)
  const linkedTransactionId = linkedTransactionKey ? ctx.transactionsByRowKey.get(linkedTransactionKey)?.id ?? null : null
  const assetTypeId = (() => {
    const raw = trimText(row.payload.tipo_activo)
    if (!raw) return null
    return ctx.assetTypes.get(normalizeName(raw))?.id ?? null
  })()

  const { data, error } = await db
    .from('assets')
    .insert({
      user_id: userId,
      name,
      asset_type: 'OTHER',
      asset_type_id: assetTypeId,
      purchase_date: purchaseDate,
      purchase_value: asNumber(row.payload.valor_compra),
      current_value: asNumber(row.payload.valor_actual),
      currency,
      depreciation_rate: hasConcreteValue(row.payload.tasa_depreciacion) ? asNumber(row.payload.tasa_depreciacion) : null,
      serial_number: trimText(row.payload.numero_serie),
      location: trimText(row.payload.ubicacion),
      notes: trimText(row.payload.notas),
      status: (trimText(row.payload.estado) ?? 'ACTIVE') as Database['public']['Enums']['asset_status'],
      transaction_id: linkedTransactionId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

async function createAssetFromPurchaseRow(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
  transactionId: string,
): Promise<string> {
  const name = trimText(row.payload.nombre_activo)
  const purchaseDate = trimText(row.payload.fecha)
  const currency = toUpperText(row.payload.moneda)
  if (!name || !purchaseDate || !currency) {
    throw new Error(`La fila ${row.row_number} de compra de activo no tiene nombre_activo, fecha o moneda.`)
  }

  const assetTypeId = (() => {
    const raw = trimText(row.payload.tipo_activo)
    if (!raw) return null
    return ctx.assetTypes.get(normalizeName(raw))?.id ?? null
  })()

  const { data, error } = await db
    .from('assets')
    .insert({
      user_id: userId,
      name,
      asset_type: 'OTHER',
      asset_type_id: assetTypeId,
      purchase_date: purchaseDate,
      purchase_value: asNumber(row.payload.monto),
      current_value: asNumber(row.payload.valor_actual, asNumber(row.payload.monto)),
      currency,
      depreciation_rate: hasConcreteValue(row.payload.tasa_depreciacion) ? asNumber(row.payload.tasa_depreciacion) : null,
      serial_number: trimText(row.payload.numero_serie),
      location: trimText(row.payload.ubicacion),
      notes: trimText(row.payload.notas),
      status: 'ACTIVE',
      transaction_id: transactionId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

async function createStandaloneReceivable(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<string> {
  const debtor = await ensureDebtor(db, userId, ctx, row.payload.deudor, row.payload.relacion)

  const { data, error } = await db
    .from('accounts_receivable')
    .insert({
      user_id: userId,
      debtor_id: debtor.record.id,
      debtor_name: debtor.record.name,
      issue_date: trimText(row.payload.fecha) ?? new Date().toISOString().slice(0, 10),
      due_date: trimText(row.payload.fecha_vencimiento),
      amount: asNumber(row.payload.monto),
      collected_amount: asNumber(row.payload.monto_cobrado, 0),
      collected_date: (trimText(row.payload.estado) === 'COLLECTED' || trimText(row.payload.estado) === 'PARTIAL')
        ? trimText(row.payload.fecha_vencimiento) ?? trimText(row.payload.fecha) ?? null
        : null,
      concept: trimText(row.payload.concepto),
      currency: toUpperText(row.payload.moneda) ?? 'PEN',
      notes: trimText(row.payload.notas),
      status: (trimText(row.payload.estado) ?? 'PENDING') as Database['public']['Enums']['receivable_status'],
      transaction_id: null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

async function createStandalonePayable(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<string> {
  const creditor = await ensureCreditor(db, userId, ctx, row.payload.acreedor, row.payload.relacion)

  const { data, error } = await db
    .from('accounts_payable')
    .insert({
      user_id: userId,
      creditor_id: creditor.record.id,
      creditor_name: creditor.record.name,
      issue_date: trimText(row.payload.fecha) ?? new Date().toISOString().slice(0, 10),
      due_date: trimText(row.payload.fecha_vencimiento),
      amount: asNumber(row.payload.monto),
      paid_amount: asNumber(row.payload.monto_pagado, 0),
      paid_date: (trimText(row.payload.estado) === 'PAID' || trimText(row.payload.estado) === 'PARTIAL')
        ? trimText(row.payload.fecha_vencimiento) ?? trimText(row.payload.fecha) ?? null
        : null,
      concept: trimText(row.payload.concepto),
      currency: toUpperText(row.payload.moneda) ?? 'PEN',
      notes: trimText(row.payload.notas),
      status: (trimText(row.payload.estado) ?? 'PENDING') as Database['public']['Enums']['payable_status'],
      transaction_id: null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

async function createRecurringTransaction(
  db: DbClient,
  userId: string,
  ctx: ImportContext,
  row: ImportJobRow,
): Promise<string> {
  const type = (trimText(row.payload.tipo) ?? 'EXPENSE') as Database['public']['Enums']['transaction_type']
  const subtype = trimText(row.payload.subtipo)
  const sourceKey = trimText(row.payload.portafolio_origen)
  const sourceAccount = sourceKey ? ctx.accountsByRowKey.get(sourceKey) : null
  if (!sourceAccount) throw new Error(`No se pudo resolver el portafolio origen para la recurrente fila ${row.row_number}.`)

  const destinationKey = trimText(row.payload.portafolio_destino)
  const destinationAccount = destinationKey ? ctx.accountsByRowKey.get(destinationKey) : null
  const debtor = trimText(row.payload.deudor)
    ? await ensureDebtor(db, userId, ctx, row.payload.deudor)
    : null
  const creditor = trimText(row.payload.acreedor)
    ? await ensureCreditor(db, userId, ctx, row.payload.acreedor)
    : null

  const categoryId =
    type === 'INCOME' || type === 'EXPENSE'
      ? resolveCategoryId(ctx, type as 'INCOME' | 'EXPENSE', row.payload.categoria)
      : null

  const { data, error } = await db
    .from('recurring_transactions')
    .insert({
      user_id: userId,
      name: trimText(row.payload.nombre) ?? trimText(row.payload.clave_recurrente) ?? 'Recurrente importada',
      type,
      sub_type: subtype && subtype !== 'NORMAL'
        ? (subtype as Database['public']['Enums']['transaction_sub_type'])
        : null,
      source_account_id: sourceAccount.id,
      destination_account_id: type === 'TRANSFER' ? destinationAccount?.id ?? null : null,
      category_id: categoryId,
      budget_id: type === 'EXPENSE' ? resolveBudgetId(ctx, row.payload.presupuesto) : null,
      debtor_id: debtor?.record.id ?? null,
      creditor_id: creditor?.record.id ?? null,
      amount: asNumber(row.payload.monto),
      currency: toUpperText(row.payload.moneda) ?? 'PEN',
      description: trimText(row.payload.descripcion),
      payment_method: trimText(row.payload.forma_pago)
        ? (trimText(row.payload.forma_pago) as Database['public']['Enums']['payment_method_type'])
        : null,
      recipient: trimText(row.payload.acreedor) ?? trimText(row.payload.destinatario),
      sender: trimText(row.payload.deudor) ?? trimText(row.payload.remitente),
      notes: trimText(row.payload.notas),
      is_active: asBoolean(row.payload.activo, true),
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

function preflightCommit(job: ImportJobWithRows, ctx: ImportContext): string[] {
  const errors: string[] = []
  const summary = (job.summary ?? {}) as ImportJobSummary
  const hasImportedRows = job.rows.some(row => row.status === 'IMPORTED')

  if (job.status === 'COMMITTED') return errors
  if (job.status !== 'VALIDATED' && !(job.status === 'FAILED' && !hasImportedRows)) {
    errors.push('La importación debe estar en estado VALIDATED antes de confirmarse.')
  }

  if ((job.error_count ?? 0) > 0) {
    errors.push('La importación todavía tiene errores bloqueantes.')
  }

  const globalErrors = summary.globalErrors ?? []
  if (globalErrors.length > 0) {
    errors.push('La plantilla todavía tiene errores globales de estructura o versión.')
  }

  const currenciesKnown = new Set(ctx.currencies.keys())
  for (const row of job.rows.filter(isRowImportable)) {
    const currency = toUpperText(row.payload.moneda)
    if (currency && !currenciesKnown.has(currency)) {
      errors.push(`${row.sheet_name} fila ${row.row_number}: la moneda ${currency} no existe en el catálogo disponible.`)
    }

    if (row.sheet_name === '03_Ingresos') {
      const destination = resolveAccount(ctx, row.payload.portafolio_destino, row.payload.moneda)
      if (!destination) {
        errors.push(`Ingreso fila ${row.row_number}: el portafolio destino no existe en FinTrack.`)
      }
      if (!resolveCategoryId(ctx, 'INCOME', row.payload.categoria)) {
        errors.push(`Ingreso fila ${row.row_number}: la categoría "${trimText(row.payload.categoria) ?? 'vacía'}" no existe en FinTrack.`)
      }
    }

    if (row.sheet_name === '04_Egresos') {
      const origin = resolveAccount(ctx, row.payload.portafolio_origen, row.payload.moneda)
      const paymentMethod = trimText(row.payload.forma_pago)
      const creditRef = trimText(row.payload.tarjeta_credito)
      if (!origin) {
        errors.push(`Egreso fila ${row.row_number}: el portafolio origen no existe en FinTrack.`)
      }
      if (!resolveCategoryId(ctx, 'EXPENSE', row.payload.categoria)) {
        errors.push(`Egreso fila ${row.row_number}: la categoría "${trimText(row.payload.categoria) ?? 'vacía'}" no existe en FinTrack.`)
      }
      if (paymentMethod === 'CREDIT' && !creditRef) {
        errors.push(`Egreso fila ${row.row_number}: forma_pago=CREDIT requiere tarjeta_credito.`)
      }
      if (creditRef && !resolveCreditId(ctx, creditRef)) {
        errors.push(`Egreso fila ${row.row_number}: la tarjeta_credito "${creditRef}" no se puede resolver en FinTrack.`)
      }
    }

    if (row.sheet_name === '05_Transferencias') {
      const origin = resolveAccount(ctx, row.payload.portafolio_origen)
      const destination = resolveAccount(ctx, row.payload.portafolio_destino)
      if (!origin) {
        errors.push(`Transferencia fila ${row.row_number}: el portafolio origen no existe en FinTrack.`)
      }
      if (!destination) {
        errors.push(`Transferencia fila ${row.row_number}: el portafolio destino no existe en FinTrack.`)
      }
      if (origin && destination && origin.id === destination.id) {
        errors.push(`Transferencia fila ${row.row_number}: el portafolio origen y destino no pueden ser el mismo.`)
      }
    }

    if (row.sheet_name === '06_Compra_Activo') {
      const origin = resolveAccount(ctx, row.payload.portafolio_origen, row.payload.moneda)
      const paymentMethod = trimText(row.payload.forma_pago)
      const creditRef = trimText(row.payload.tarjeta_credito)
      if (!origin) {
        errors.push(`Compra de activo fila ${row.row_number}: el portafolio origen no existe en FinTrack.`)
      }
      if (!resolveCategoryId(ctx, 'EXPENSE', row.payload.categoria)) {
        errors.push(`Compra de activo fila ${row.row_number}: la categoría "${trimText(row.payload.categoria) ?? 'vacía'}" no existe en FinTrack.`)
      }
      if (paymentMethod === 'CREDIT' && !creditRef) {
        errors.push(`Compra de activo fila ${row.row_number}: forma_pago=CREDIT requiere tarjeta_credito.`)
      }
      if (creditRef && !resolveCreditId(ctx, creditRef)) {
        errors.push(`Compra de activo fila ${row.row_number}: la tarjeta_credito "${creditRef}" no se puede resolver en FinTrack.`)
      }
    }

    if (row.sheet_name === '07_Por_Cobrar' || row.sheet_name === '08_Por_Pagar') {
      const referencePortfolio = trimText(row.payload.portafolio_origen)
      if (referencePortfolio && !resolveAccount(ctx, referencePortfolio, row.payload.moneda)) {
        errors.push(`${row.sheet_name} fila ${row.row_number}: el portafolio de referencia no existe en FinTrack.`)
      }
    }
  }

  return errors
}

async function commitImportJobData(db: DbClient, userId: string, job: ImportJobWithRows): Promise<ImportJobWithRows> {
  const ctx = await loadExistingContext(db, userId)
  const runtime: ImportCommitRuntime = {
    exchangeRateCache: new Map(),
  }
  const preflightErrors = preflightCommit(job, ctx)
  if (preflightErrors.length > 0) {
    throw new Error(preflightErrors.join(' | '))
  }

  const counts: CommitCounts = {
    user_currencies: 0,
    bank_entities: 0,
    categories: 0,
    asset_types: 0,
    accounts: 0,
    credits: 0,
    assets: 0,
    budgets: 0,
    debtors: 0,
    creditors: 0,
    receivables: 0,
    payables: 0,
    recurring_transactions: 0,
    transactions: 0,
  }

  for (const row of job.rows.filter(row => row.sheet_name === '01_Catalogos' && isRowImportable(row))) {
    const kind = trimText(row.payload.tipo_catalogo)
    let targetId: string | null = null
    let targetTable: keyof CommitCounts | null = null
    let created = false

    if (kind === 'moneda') {
      const result = await createOrReuseCurrency(db, userId, ctx, row)
      targetId = result.record.id
      created = result.created
      targetTable = 'user_currencies'
    }
    if (kind === 'entidad_bancaria') {
      const result = await createOrReuseBankEntity(db, userId, ctx, row)
      targetId = result.record.id
      created = result.created
      targetTable = 'bank_entities'
    }
    if (kind === 'categoria') {
      const result = await createOrReuseCategory(db, userId, ctx, row)
      targetId = result.record.id
      created = result.created
      targetTable = 'categories'
    }
    if (kind === 'tipo_activo') {
      const result = await createOrReuseAssetType(db, userId, ctx, row)
      targetId = result.record.id
      created = result.created
      targetTable = 'asset_types'
    }

    if (targetId && targetTable) {
      counts[targetTable] += 1
      await markRow(db, row, 'IMPORTED', targetTable, targetId, {
        version: 'rollback-v1',
        createdTargets: created ? [{ table: targetTable, id: targetId }] : [],
        reusedTargets: created ? [] : [{ table: targetTable, id: targetId }],
      })
    } else {
      await markRow(db, row, 'SKIPPED', null, null, null)
    }
  }

  for (const row of job.rows.filter(row => row.sheet_name === '02_Portafolios' && isRowImportable(row))) {
    const accountResult = await createOrReuseAccount(db, userId, ctx, row)
    const account = accountResult.record
    counts.accounts += 1
    await markRow(db, row, 'IMPORTED', 'accounts', account.id, {
      version: 'rollback-v1',
      createdTargets: accountResult.created ? [{ table: 'accounts', id: account.id }] : [],
      reusedTargets: accountResult.created ? [] : [{ table: 'accounts', id: account.id }],
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '04_Creditos' && isRowImportable(row))) {
    const creditResult = await createOrReuseCredit(db, userId, ctx, row)
    const credit = creditResult.record
    counts.credits += 1
    await markRow(db, row, 'IMPORTED', 'credits', credit.id, {
      version: 'rollback-v1',
      createdTargets: creditResult.created ? [{ table: 'credits', id: credit.id }] : [],
      reusedTargets: creditResult.created ? [] : [{ table: 'credits', id: credit.id }],
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '06_Presupuestos' && isRowImportable(row))) {
    const budgetResult = await createOrReuseBudget(db, userId, ctx, row)
    const budget = budgetResult.record
    counts.budgets += 1
    await markRow(db, row, 'IMPORTED', 'budgets', budget.id, {
      version: 'rollback-v1',
      createdTargets: budgetResult.created ? [{ table: 'budgets', id: budget.id }] : [],
      reusedTargets: budgetResult.created ? [] : [{ table: 'budgets', id: budget.id }],
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '07_Por_Cobrar' && isRowImportable(row))) {
    const before = resolveDebtor(ctx, row.payload.deudor)
    await ensureDebtor(db, userId, ctx, row.payload.deudor, row.payload.relacion)
    if (!before) counts.debtors += 1
  }

  for (const row of job.rows.filter(row => row.sheet_name === '08_Por_Pagar' && isRowImportable(row))) {
    const before = resolveCreditor(ctx, row.payload.acreedor)
    await ensureCreditor(db, userId, ctx, row.payload.acreedor, row.payload.relacion)
    if (!before) counts.creditors += 1
  }

  const txService = new TransactionService(db)
  for (const row of job.rows.filter(row => row.sheet_name === '03_Ingresos' && isRowImportable(row))) {
    const destinationAccount = resolveAccount(ctx, row.payload.portafolio_destino, row.payload.moneda)
    if (!destinationAccount) throw new Error(`No se pudo resolver el portafolio destino para la fila ${row.row_number}.`)

    const currency = toUpperText(row.payload.moneda) ?? destinationAccount.currency
    const description = trimText(row.payload.descripcion) ?? 'Ingreso importado'
    const categoryId = resolveCategoryId(ctx, 'INCOME', row.payload.categoria) ?? undefined
    const transactionDate = trimText(row.payload.fecha) ?? new Date().toISOString().slice(0, 10)
    const exchangeRate = await resolveImportExchangeRate(db, runtime, currency, transactionDate)

    const result = await txService.createTransaction(userId, {
      type: 'INCOME',
      source_account_id: destinationAccount.id,
      amount: asNumber(row.payload.monto),
      currency,
      exchange_rate: exchangeRate,
      description,
      transaction_date: transactionDate,
      notes: trimText(row.payload.notas) ?? undefined,
      sender: trimText(row.payload.remitente) ?? undefined,
      category_id: categoryId,
    })

    if (!result.ok) throw new Error(result.error.detail ? `${result.error.message} ${result.error.detail}` : result.error.message)

    counts.transactions += 1
    if (row.row_key) ctx.transactionsByRowKey.set(row.row_key, { id: result.data.transaction.id })
    await markRow(db, row, 'IMPORTED', 'transactions', result.data.transaction.id, {
      version: 'rollback-v1',
      createdTargets: [{ table: 'transactions', id: result.data.transaction.id }],
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '04_Egresos' && isRowImportable(row))) {
    const sourceAccount = resolveAccount(ctx, row.payload.portafolio_origen, row.payload.moneda)
    if (!sourceAccount) throw new Error(`No se pudo resolver el portafolio origen para la fila ${row.row_number}.`)

    const currency = toUpperText(row.payload.moneda) ?? sourceAccount.currency
    const paymentMethod = trimText(row.payload.forma_pago) === 'CREDIT' ? 'CREDIT' as const : 'DEBIT' as const
    const creditCardId = paymentMethod === 'CREDIT' ? resolveCreditId(ctx, row.payload.tarjeta_credito) ?? undefined : undefined
    const description = trimText(row.payload.descripcion) ?? 'Egreso importado'
    const categoryId = resolveCategoryId(ctx, 'EXPENSE', row.payload.categoria) ?? undefined
    const transactionDate = trimText(row.payload.fecha) ?? new Date().toISOString().slice(0, 10)
    const exchangeRate = await resolveImportExchangeRate(db, runtime, currency, transactionDate)

    const result = await txService.createTransaction(userId, {
      type: 'EXPENSE',
      source_account_id: sourceAccount.id,
      amount: asNumber(row.payload.monto),
      currency,
      exchange_rate: exchangeRate,
      description,
      transaction_date: transactionDate,
      notes: trimText(row.payload.notas) ?? undefined,
      recipient: trimText(row.payload.destinatario) ?? undefined,
      payment_method: paymentMethod,
      credit_card_id: creditCardId,
      credit_operation: paymentMethod === 'CREDIT' ? 'CONSUMPTION' : undefined,
      category_id: categoryId,
    })

    if (!result.ok) throw new Error(result.error.detail ? `${result.error.message} ${result.error.detail}` : result.error.message)

    counts.transactions += 1
    if (row.row_key) ctx.transactionsByRowKey.set(row.row_key, { id: result.data.transaction.id })
    await markRow(db, row, 'IMPORTED', 'transactions', result.data.transaction.id, {
      version: 'rollback-v1',
      createdTargets: [{ table: 'transactions', id: result.data.transaction.id }],
      creditAdjustment: paymentMethod === 'CREDIT' && creditCardId
        ? {
            creditId: creditCardId,
            operation: 'CONSUMPTION',
            amount: asNumber(row.payload.monto),
          }
        : undefined,
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '05_Transferencias' && isRowImportable(row))) {
    const sourceAccount = resolveAccount(ctx, row.payload.portafolio_origen)
    const destinationAccount = resolveAccount(ctx, row.payload.portafolio_destino)
    if (!sourceAccount) throw new Error(`No se pudo resolver el portafolio origen para la fila ${row.row_number}.`)
    if (!destinationAccount) throw new Error(`No se pudo resolver el portafolio destino para la fila ${row.row_number}.`)

    const currency = toUpperText(row.payload.moneda) ?? sourceAccount.currency
    const description = trimText(row.payload.descripcion) ?? 'Transferencia importada'
    const transactionDate = trimText(row.payload.fecha) ?? new Date().toISOString().slice(0, 10)
    const exchangeRate = await resolveImportExchangeRate(db, runtime, currency, transactionDate)
    const result = await txService.createTransaction(userId, {
      type: 'TRANSFER',
      source_account_id: sourceAccount.id,
      destination_account_id: destinationAccount.id,
      amount: asNumber(row.payload.monto),
      currency,
      exchange_rate: exchangeRate,
      description,
      transaction_date: transactionDate,
      notes: trimText(row.payload.notas) ?? undefined,
    })

    if (!result.ok) throw new Error(result.error.detail ? `${result.error.message} ${result.error.detail}` : result.error.message)

    counts.transactions += 1
    if (row.row_key) ctx.transactionsByRowKey.set(row.row_key, { id: result.data.transaction.id })
    await markRow(db, row, 'IMPORTED', 'transactions', result.data.transaction.id, {
      version: 'rollback-v1',
      createdTargets: [{ table: 'transactions', id: result.data.transaction.id }],
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '06_Compra_Activo' && isRowImportable(row))) {
    const sourceAccount = resolveAccount(ctx, row.payload.portafolio_origen, row.payload.moneda)
    if (!sourceAccount) throw new Error(`No se pudo resolver el portafolio origen para la fila ${row.row_number}.`)

    const currency = toUpperText(row.payload.moneda) ?? sourceAccount.currency
    const paymentMethod = trimText(row.payload.forma_pago) === 'CREDIT' ? 'CREDIT' as const : 'DEBIT' as const
    const creditCardId = paymentMethod === 'CREDIT' ? resolveCreditId(ctx, row.payload.tarjeta_credito) ?? undefined : undefined
    const description = trimText(row.payload.descripcion) ?? trimText(row.payload.nombre_activo) ?? 'Compra de activo importada'
    const categoryId = resolveCategoryId(ctx, 'EXPENSE', row.payload.categoria) ?? undefined
    const transactionDate = trimText(row.payload.fecha) ?? new Date().toISOString().slice(0, 10)
    const exchangeRate = await resolveImportExchangeRate(db, runtime, currency, transactionDate)

    const result = await txService.createTransaction(userId, {
      type: 'EXPENSE',
      source_account_id: sourceAccount.id,
      amount: asNumber(row.payload.monto),
      currency,
      exchange_rate: exchangeRate,
      description,
      transaction_date: transactionDate,
      notes: trimText(row.payload.notas) ?? undefined,
      payment_method: paymentMethod,
      credit_card_id: creditCardId,
      credit_operation: paymentMethod === 'CREDIT' ? 'CONSUMPTION' : undefined,
      category_id: categoryId,
      recipient: trimText(row.payload.destinatario) ?? undefined,
    })

    if (!result.ok) throw new Error(result.error.detail ? `${result.error.message} ${result.error.detail}` : result.error.message)

    const assetId = await createAssetFromPurchaseRow(db, userId, ctx, row, result.data.transaction.id)
    counts.transactions += 1
    counts.assets += 1
    if (row.row_key) ctx.transactionsByRowKey.set(row.row_key, { id: result.data.transaction.id })
    await markRow(db, row, 'IMPORTED', 'transactions', result.data.transaction.id, {
      version: 'rollback-v1',
      createdTargets: [
        { table: 'transactions', id: result.data.transaction.id },
        { table: 'assets', id: assetId },
      ],
      creditAdjustment: paymentMethod === 'CREDIT' && creditCardId
        ? {
            creditId: creditCardId,
            operation: 'CONSUMPTION',
            amount: asNumber(row.payload.monto),
          }
        : undefined,
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '07_Por_Cobrar' && isRowImportable(row))) {
    const debtor = await ensureDebtor(db, userId, ctx, row.payload.deudor, row.payload.relacion)
    const receivableId = await createStandaloneReceivable(db, userId, {
      ...ctx,
      debtorsByName: ctx.debtorsByName,
      debtorsByRowKey: ctx.debtorsByRowKey,
    }, {
      ...row,
      payload: {
        ...row.payload,
        deudor: debtor.record.name,
      },
    })
    counts.receivables += 1
    await markRow(db, row, 'IMPORTED', 'accounts_receivable', receivableId, {
      version: 'rollback-v1',
      createdTargets: [
        ...(debtor.created ? [{ table: 'debtors', id: debtor.record.id }] : []),
        { table: 'accounts_receivable', id: receivableId },
      ],
      reusedTargets: debtor.created ? [] : [{ table: 'debtors', id: debtor.record.id }],
    })
  }

  for (const row of job.rows.filter(row => row.sheet_name === '08_Por_Pagar' && isRowImportable(row))) {
    const creditor = await ensureCreditor(db, userId, ctx, row.payload.acreedor, row.payload.relacion)
    const payableId = await createStandalonePayable(db, userId, {
      ...ctx,
      creditorsByName: ctx.creditorsByName,
      creditorsByRowKey: ctx.creditorsByRowKey,
    }, {
      ...row,
      payload: {
        ...row.payload,
        acreedor: creditor.record.name,
      },
    })
    counts.payables += 1
    await markRow(db, row, 'IMPORTED', 'accounts_payable', payableId, {
      version: 'rollback-v1',
      createdTargets: [
        ...(creditor.created ? [{ table: 'creditors', id: creditor.record.id }] : []),
        { table: 'accounts_payable', id: payableId },
      ],
      reusedTargets: creditor.created ? [] : [{ table: 'creditors', id: creditor.record.id }],
    })
  }

  const committedAt = new Date().toISOString()
  const nextSummary: Partial<ImportJobSummary> = {
    committedTables: counts,
    committedAt,
    rollbackVersion: 'rollback-v1',
    rollbackReady: true,
    rolledBackAt: undefined,
    rollbackCounts: undefined,
    lastRollbackError: undefined,
    lastCommitError: undefined,
  }

  await updateJobState(db, job.id, 'COMMITTED', {
    ...job,
    committed_at: committedAt,
    error_count: 0,
    warning_count: job.warning_count,
  }, nextSummary)

  const { data, error } = await untyped(db)
    .from('import_jobs')
    .select('id,user_id,source,status,template_version,file_name,file_url,file_size_bytes,file_hash,summary,error_count,warning_count,created_at,updated_at,committed_at')
    .eq('user_id', userId)
    .eq('id', job.id)
    .single()

  if (error) throw new Error(error.message)

  const { data: rows, error: rowsError } = await untyped(db)
    .from('import_job_rows')
    .select('id,import_job_id,user_id,sheet_name,row_number,row_key,status,payload,errors,warnings,target_table,target_record_id,created_at,updated_at')
    .eq('user_id', userId)
    .eq('import_job_id', job.id)
    .order('sheet_name', { ascending: true })
    .order('row_number', { ascending: true })

  if (rowsError) throw new Error(rowsError.message)

  return {
    ...(data as unknown as ImportJob),
    rows: rows as unknown as ImportJobRow[],
  }
}

export async function commitImportJob(
  supabase: DbClient,
  userId: string,
  job: ImportJobWithRows,
): Promise<ImportJobWithRows> {
  const db = supabase as DbClient
  if (job.status === 'COMMITTED') return job

  if (job.file_hash) {
    const existingCommitted = await findCommittedJobByFileHash(db, userId, job.file_hash, job.id)
    if (existingCommitted) return existingCommitted
  }

  try {
    return await commitImportJobData(db, userId, job)
  } catch (error) {
    const importedRows = await countImportedRows(db, userId, job.id).catch(() => 0)
    const nextStatus = importedRows > 0 ? 'FAILED' : 'VALIDATED'

    await updateJobState(db, job.id, nextStatus, {
      ...job,
      committed_at: null,
      error_count: job.error_count,
      warning_count: job.warning_count,
    }, {
      lastCommitError: error instanceof Error ? error.message : 'Error desconocido',
    }).catch(() => undefined)
    throw error
  }
}
