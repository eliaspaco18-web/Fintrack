import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { CreditRepository } from '@/modules/credits/credit.repository'
import { TransactionService } from '@/modules/transactions/transaction.service'
import type { ImportJobSummary, ImportJobWithRows } from '@/lib/imports/import-types'

type DbClient = SupabaseClient<Database>

type RollbackTarget = {
  table: string
  id: string
}

type RollbackMeta = {
  version: 'rollback-v1'
  createdTargets: RollbackTarget[]
  reusedTargets?: RollbackTarget[]
  creditAdjustment?: {
    creditId: string
    operation: 'CONSUMPTION' | 'PAYMENT'
    amount: number
  }
}

type RollbackPlan = {
  targetsByTable: Map<string, Set<string>>
  transactionAdjustments: Map<string, RollbackMeta['creditAdjustment']>
}

const DELETE_ORDER = [
  'recurring_transactions',
  'accounts_receivable',
  'accounts_payable',
  'assets',
  'transactions',
  'credits',
  'budget_periods',
  'budget_series',
  'budgets',
  'debtors',
  'creditors',
  'accounts',
  'categories',
  'asset_types',
  'bank_entities',
  'user_currencies',
] as const

function untyped(db: DbClient) {
  return db as unknown as SupabaseClient
}

function readRollbackMeta(payload: Record<string, unknown>): RollbackMeta | null {
  const candidate = payload.__import_commit
  if (!candidate || typeof candidate !== 'object') return null

  const record = candidate as Record<string, unknown>
  const createdTargets = Array.isArray(record.createdTargets)
    ? record.createdTargets
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const target = item as Record<string, unknown>
        return {
          table: typeof target.table === 'string' ? target.table : '',
          id: typeof target.id === 'string' ? target.id : '',
        }
      })
      .filter(item => item.table.length > 0 && item.id.length > 0)
    : []

  const adjustmentRaw = record.creditAdjustment
  const creditAdjustment: RollbackMeta['creditAdjustment'] = adjustmentRaw && typeof adjustmentRaw === 'object'
    ? {
        creditId: typeof (adjustmentRaw as Record<string, unknown>).creditId === 'string'
          ? String((adjustmentRaw as Record<string, unknown>).creditId)
          : '',
        operation: (adjustmentRaw as Record<string, unknown>).operation === 'PAYMENT' ? 'PAYMENT' : 'CONSUMPTION',
        amount: typeof (adjustmentRaw as Record<string, unknown>).amount === 'number'
          ? Number((adjustmentRaw as Record<string, unknown>).amount)
          : 0,
      }
    : undefined

  if (record.version !== 'rollback-v1') return null

  return {
    version: 'rollback-v1',
    createdTargets,
    reusedTargets: [],
    creditAdjustment: creditAdjustment && creditAdjustment.creditId && creditAdjustment.amount > 0
      ? creditAdjustment
      : undefined,
  }
}

function collectRollbackPlan(job: ImportJobWithRows): RollbackPlan {
  const targetsByTable = new Map<string, Set<string>>()
  const transactionAdjustments = new Map<string, RollbackMeta['creditAdjustment']>()

  for (const row of job.rows) {
    if (row.status !== 'IMPORTED') continue

    const meta = readRollbackMeta(row.payload)
    if (!meta) {
      if (row.target_table || row.target_record_id) {
        throw new Error(
          'Esta importación fue confirmada antes de que FinTrack guardara metadata de reversión automática. Reimporta el archivo con la versión actual para habilitar el rollback seguro.',
        )
      }
      continue
    }

    for (const target of meta.createdTargets) {
      const bucket = targetsByTable.get(target.table) ?? new Set<string>()
      bucket.add(target.id)
      targetsByTable.set(target.table, bucket)
      if (target.table === 'transactions' && meta.creditAdjustment) {
        transactionAdjustments.set(target.id, meta.creditAdjustment)
      }
    }
  }

  return { targetsByTable, transactionAdjustments }
}

function listTargetIds(plan: RollbackPlan, table: string): string[] {
  return [...(plan.targetsByTable.get(table) ?? new Set<string>())]
}

async function selectExistingIds(
  db: DbClient,
  userId: string,
  table: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()

  const { data, error } = await untyped(db)
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .in('id', ids)

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map(row => String((row as { id: string }).id)))
}

async function findRowsByForeignKey(
  db: DbClient,
  userId: string,
  table: string,
  foreignKey: string,
  ids: string[],
  ignoredIds: string[] = [],
): Promise<Array<{ id: string }>> {
  if (ids.length === 0) return []

  let query = untyped(db)
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .in(foreignKey, ids)

  if (ignoredIds.length > 0) {
    query = query.not('id', 'in', `(${ignoredIds.map(id => `"${id}"`).join(',')})`)
  }

  const { data, error } = await query.limit(20)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{ id: string }>
}

async function collectRollbackBlockers(
  db: DbClient,
  userId: string,
  plan: RollbackPlan,
): Promise<string[]> {
  const blockers: string[] = []

  for (const table of DELETE_ORDER) {
    const ids = listTargetIds(plan, table)
    if (ids.length === 0) continue
    const existing = await selectExistingIds(db, userId, table, ids)
    if (existing.size !== ids.length) {
      blockers.push(`Faltan registros en ${table}; la importación ya cambió desde que fue confirmada.`)
    }
  }

  const txIds = listTargetIds(plan, 'transactions')
  if (txIds.length > 0) {
    const [assets, credits, loans, receivables, payables] = await Promise.all([
      findRowsByForeignKey(db, userId, 'assets', 'transaction_id', txIds, listTargetIds(plan, 'assets')),
      findRowsByForeignKey(db, userId, 'credits', 'transaction_id', txIds, listTargetIds(plan, 'credits')),
      findRowsByForeignKey(db, userId, 'loans', 'transaction_id', txIds),
      findRowsByForeignKey(db, userId, 'accounts_receivable', 'transaction_id', txIds, listTargetIds(plan, 'accounts_receivable')),
      findRowsByForeignKey(db, userId, 'accounts_payable', 'transaction_id', txIds, listTargetIds(plan, 'accounts_payable')),
    ])

    if (assets.length > 0) blockers.push('Hay activos no incluidos en este rollback que todavía apuntan a transacciones importadas.')
    if (credits.length > 0) blockers.push('Hay créditos no incluidos en este rollback que todavía apuntan a transacciones importadas.')
    if (loans.length > 0) blockers.push('Hay préstamos ligados a transacciones importadas; revísalos antes de deshacer.')
    if (receivables.length > 0) blockers.push('Hay cuentas por cobrar externas ligadas a transacciones importadas.')
    if (payables.length > 0) blockers.push('Hay cuentas por pagar externas ligadas a transacciones importadas.')
  }

  const accountIds = listTargetIds(plan, 'accounts')
  if (accountIds.length > 0) {
    const [txs, recurring, credits] = await Promise.all([
      findRowsByForeignKey(db, userId, 'transactions', 'source_account_id', accountIds, txIds),
      findRowsByForeignKey(db, userId, 'recurring_transactions', 'source_account_id', accountIds, listTargetIds(plan, 'recurring_transactions')),
      findRowsByForeignKey(db, userId, 'credits', 'account_id', accountIds, listTargetIds(plan, 'credits')),
    ])
    const txDest = await findRowsByForeignKey(db, userId, 'transactions', 'destination_account_id', accountIds, txIds)
    const recurringDest = await findRowsByForeignKey(db, userId, 'recurring_transactions', 'destination_account_id', accountIds, listTargetIds(plan, 'recurring_transactions'))

    if (txs.length + txDest.length > 0) blockers.push('Algunas cuentas importadas ya están siendo usadas por transacciones fuera de este rollback.')
    if (recurring.length + recurringDest.length > 0) blockers.push('Algunas cuentas importadas ya están siendo usadas por recurrentes fuera de este rollback.')
    if (credits.length > 0) blockers.push('Algunas cuentas importadas todavía están vinculadas a créditos fuera de este rollback.')
  }

  const budgetIds = listTargetIds(plan, 'budgets')
  if (budgetIds.length > 0) {
    const [txs, recurring] = await Promise.all([
      findRowsByForeignKey(db, userId, 'transactions', 'budget_id', budgetIds, txIds),
      findRowsByForeignKey(db, userId, 'recurring_transactions', 'budget_id', budgetIds, listTargetIds(plan, 'recurring_transactions')),
    ])
    if (txs.length > 0 || recurring.length > 0) blockers.push('Hay presupuestos importados que ya quedaron referenciados por movimientos o recurrentes nuevos.')
  }

  const budgetPeriodIds = listTargetIds(plan, 'budget_periods')
  if (budgetPeriodIds.length > 0) {
    const txs = await findRowsByForeignKey(db, userId, 'transactions', 'budget_period_id', budgetPeriodIds, txIds)
    if (txs.length > 0) blockers.push('Hay periodos presupuestales importados que ya quedaron referenciados por movimientos nuevos.')
  }

  const categoryIds = listTargetIds(plan, 'categories')
  if (categoryIds.length > 0) {
    const [txs, recurring, budgets] = await Promise.all([
      findRowsByForeignKey(db, userId, 'transactions', 'category_id', categoryIds, txIds),
      findRowsByForeignKey(db, userId, 'recurring_transactions', 'category_id', categoryIds, listTargetIds(plan, 'recurring_transactions')),
      findRowsByForeignKey(db, userId, 'budgets', 'category_id', categoryIds, budgetIds),
    ])
    if (txs.length > 0 || recurring.length > 0 || budgets.length > 0) blockers.push('Hay categorías importadas que ya fueron reutilizadas fuera de esta importación.')
  }

  const assetTypeIds = listTargetIds(plan, 'asset_types')
  if (assetTypeIds.length > 0) {
    const assets = await findRowsByForeignKey(db, userId, 'assets', 'asset_type_id', assetTypeIds, listTargetIds(plan, 'assets'))
    if (assets.length > 0) blockers.push('Hay tipos de activo importados que ya se usan en activos fuera de este rollback.')
  }

  const bankEntityIds = listTargetIds(plan, 'bank_entities')
  if (bankEntityIds.length > 0) {
    const [accounts, credits] = await Promise.all([
      findRowsByForeignKey(db, userId, 'accounts', 'bank_entity_id', bankEntityIds, accountIds),
      findRowsByForeignKey(db, userId, 'credits', 'bank_entity_id', bankEntityIds, listTargetIds(plan, 'credits')),
    ])
    if (accounts.length > 0 || credits.length > 0) blockers.push('Hay entidades bancarias importadas que ya se están usando fuera de este rollback.')
  }

  const debtorIds = listTargetIds(plan, 'debtors')
  if (debtorIds.length > 0) {
    const [receivables, recurring, txs] = await Promise.all([
      findRowsByForeignKey(db, userId, 'accounts_receivable', 'debtor_id', debtorIds, listTargetIds(plan, 'accounts_receivable')),
      findRowsByForeignKey(db, userId, 'recurring_transactions', 'debtor_id', debtorIds, listTargetIds(plan, 'recurring_transactions')),
      findRowsByForeignKey(db, userId, 'transactions', 'debtor_id', debtorIds, txIds),
    ])
    if (receivables.length > 0 || recurring.length > 0 || txs.length > 0) blockers.push('Hay deudores importados que ya quedaron referenciados por registros externos.')
  }

  const creditorIds = listTargetIds(plan, 'creditors')
  if (creditorIds.length > 0) {
    const [payables, recurring, txs] = await Promise.all([
      findRowsByForeignKey(db, userId, 'accounts_payable', 'creditor_id', creditorIds, listTargetIds(plan, 'accounts_payable')),
      findRowsByForeignKey(db, userId, 'recurring_transactions', 'creditor_id', creditorIds, listTargetIds(plan, 'recurring_transactions')),
      findRowsByForeignKey(db, userId, 'transactions', 'creditor_id', creditorIds, txIds),
    ])
    if (payables.length > 0 || recurring.length > 0 || txs.length > 0) blockers.push('Hay acreedores importados que ya quedaron referenciados por registros externos.')
  }

  const creditIds = listTargetIds(plan, 'credits')
  if (creditIds.length > 0) {
    const [loans, cycles] = await Promise.all([
      findRowsByForeignKey(db, userId, 'loans', 'credit_id', creditIds),
      findRowsByForeignKey(db, userId, 'billing_cycles', 'credit_id', creditIds),
    ])
    if (loans.length > 0 || cycles.length > 0) blockers.push('Hay créditos importados que ya tienen préstamos o ciclos de facturación asociados.')
  }

  const currencyIds = listTargetIds(plan, 'user_currencies')
  if (currencyIds.length > 0) {
    const { data: currencies, error } = await untyped(db)
      .from('user_currencies')
      .select('id, code')
      .eq('user_id', userId)
      .in('id', currencyIds)

    if (error) throw new Error(error.message)

    for (const currency of currencies ?? []) {
      const code = String((currency as { code: string }).code)
      const checks = await Promise.all([
        untyped(db).from('accounts').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${accountIds.map(id => `"${id}"`).join(',') || '""'})`).limit(1),
        untyped(db).from('credits').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${creditIds.map(id => `"${id}"`).join(',') || '""'})`).limit(1),
        untyped(db).from('budgets').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${budgetIds.map(id => `"${id}"`).join(',') || '""'})`).limit(1),
        untyped(db).from('transactions').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${txIds.map(id => `"${id}"`).join(',') || '""'})`).limit(1),
        untyped(db).from('assets').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${listTargetIds(plan, 'assets').map(id => `"${id}"`).join(',') || '""'})`).limit(1),
        untyped(db).from('accounts_receivable').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${listTargetIds(plan, 'accounts_receivable').map(id => `"${id}"`).join(',') || '""'})`).limit(1),
        untyped(db).from('accounts_payable').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${listTargetIds(plan, 'accounts_payable').map(id => `"${id}"`).join(',') || '""'})`).limit(1),
        untyped(db).from('recurring_transactions').select('id').eq('user_id', userId).eq('currency', code).not('id', 'in', `(${listTargetIds(plan, 'recurring_transactions').map(id => `"${id}"`).join(',') || '""'})`).limit(1),
      ])

      if (checks.some(result => (result.data ?? []).length > 0)) {
        blockers.push(`La moneda ${code} ya está siendo usada fuera de esta importación.`)
      }
    }
  }

  for (const [transactionId, adjustment] of plan.transactionAdjustments.entries()) {
    if (!adjustment) continue
    const { data: credit, error } = await untyped(db)
      .from('credits')
      .select('id, used_amount, credit_limit')
      .eq('user_id', userId)
      .eq('id', adjustment.creditId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!credit) {
      blockers.push(`La tarjeta vinculada a la transacción ${transactionId} ya no existe.`)
      continue
    }

    if (adjustment.operation === 'CONSUMPTION' && Number(credit.used_amount ?? 0) < adjustment.amount) {
      blockers.push(`La tarjeta vinculada a la transacción ${transactionId} ya cambió de saldo usado y no se puede revertir automáticamente.`)
    }

    if (adjustment.operation === 'PAYMENT') {
      const currentUsed = Number(credit.used_amount ?? 0)
      const limit = Number(credit.credit_limit ?? 0)
      if (currentUsed + adjustment.amount > limit) {
        blockers.push(`La tarjeta vinculada a la transacción ${transactionId} ya no admite revertir ese pago automáticamente.`)
      }
    }
  }

  return [...new Set(blockers)]
}

async function deleteOwnedRecord(
  db: DbClient,
  userId: string,
  table: string,
  id: string,
): Promise<void> {
  const { error } = await untyped(db)
    .from(table)
    .delete()
    .eq('user_id', userId)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function rollbackImportJob(
  supabase: DbClient,
  userId: string,
  job: ImportJobWithRows,
): Promise<ImportJobWithRows> {
  const db = supabase as DbClient
  if (job.status === 'CANCELLED') return job
  if (job.status !== 'COMMITTED') {
    throw new Error('Solo se puede deshacer una importación ya confirmada.')
  }

  const plan = collectRollbackPlan(job)
  const blockers = await collectRollbackBlockers(db, userId, plan)
  if (blockers.length > 0) {
    throw new Error(blockers.join(' | '))
  }

  const counts: Record<string, number> = {}
  const txService = new TransactionService(db)
  const creditRepo = new CreditRepository(db)

  for (const table of DELETE_ORDER) {
    const ids = listTargetIds(plan, table)
    if (ids.length === 0) continue

    for (const id of ids) {
      if (table === 'transactions') {
        const adjustment = plan.transactionAdjustments.get(id)
        if (adjustment) {
          const result = adjustment.operation === 'CONSUMPTION'
            ? await creditRepo.decrementUsedAmount(adjustment.creditId, adjustment.amount)
            : await creditRepo.incrementUsedAmount(adjustment.creditId, adjustment.amount)

          if (!result.ok) {
            throw new Error(result.error.detail ? `${result.error.message} ${result.error.detail}` : result.error.message)
          }
        }

        const deleted = await txService.deleteTransaction(userId, id, { force: true })
        if (!deleted.ok) {
          throw new Error(deleted.error.detail ? `${deleted.error.message} ${deleted.error.detail}` : deleted.error.message)
        }
      } else {
        await deleteOwnedRecord(db, userId, table, id)
      }

      counts[table] = (counts[table] ?? 0) + 1
    }
  }

  const rolledBackAt = new Date().toISOString()
  const nextSummary: ImportJobSummary = {
    ...(job.summary ?? {}),
    rollbackReady: false,
    rollbackVersion: 'rollback-v1',
    rollbackCounts: counts,
    rolledBackAt,
    lastRollbackError: undefined,
  }

  const { error: updateError } = await untyped(db)
    .from('import_jobs')
    .update({
      status: 'CANCELLED',
      summary: nextSummary,
      warning_count: job.warning_count,
      error_count: 0,
    })
    .eq('user_id', userId)
    .eq('id', job.id)

  if (updateError) throw new Error(updateError.message)

  const { data: updatedJob, error: jobError } = await untyped(db)
    .from('import_jobs')
    .select('id,user_id,source,status,template_version,file_name,file_url,file_size_bytes,file_hash,summary,error_count,warning_count,created_at,updated_at,committed_at')
    .eq('user_id', userId)
    .eq('id', job.id)
    .single()

  if (jobError) throw new Error(jobError.message)

  const { data: rows, error: rowsError } = await untyped(db)
    .from('import_job_rows')
    .select('id,import_job_id,user_id,sheet_name,row_number,row_key,status,payload,errors,warnings,target_table,target_record_id,created_at,updated_at')
    .eq('user_id', userId)
    .eq('import_job_id', job.id)
    .order('sheet_name', { ascending: true })
    .order('row_number', { ascending: true })

  if (rowsError) throw new Error(rowsError.message)

  return {
    ...(updatedJob as ImportJobWithRows),
    rows: rows as ImportJobWithRows['rows'],
  }
}
