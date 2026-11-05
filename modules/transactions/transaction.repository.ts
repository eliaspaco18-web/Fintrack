// =============================================================================
// modules/transactions/transaction.repository.ts
// Acceso a datos para la tabla transactions.
// No contiene lógica de negocio — solo queries.
// =============================================================================

import type {
  Transaction,
  TransactionWithRelations,
  TablesInsert,
  TablesUpdate,
} from '@/types/database.types'
import type {
  TransactionFilters,
  PaginatedTransactions,
} from './transaction.service.types'
import { BaseRepository, type DbClient } from '@/modules/shared/repository.base'
import { type Result, Errors, ok }       from '@/modules/shared/result.types'

export class TransactionRepository extends BaseRepository {
  constructor(db: DbClient) {
    super(db)
  }

  // ── READ ────────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Result<TransactionWithRelations>> {
    return this.query(async () =>
      await this.db
        .from('transactions')
        .select(`
          *,
          source_account:accounts!source_account_id(id, name, color, icon),
          destination_account:accounts!destination_account_id(id, name, color, icon),
          category:categories(id, name, icon, color, system_key),
          linked_asset:assets(id, name, asset_type, asset_type_id, serial_number, location, purchase_value, current_value, purchase_date, recipient),
          linked_receivable:accounts_receivable(id, debtor_id, debtor_name, due_date, concept, notes, amount, collected_amount, collected_date, currency, status),
          linked_payable:accounts_payable(id, creditor_id, creditor_name, due_date, concept, notes, amount, paid_amount, paid_date, currency, status)
        `)
        .eq('id', id)
        .single()
    )
  }

  async findByIdForUser(id: string, userId: string): Promise<Result<TransactionWithRelations>> {
    return this.query(async () =>
      await this.db
        .from('transactions')
        .select(`
          *,
          source_account:accounts!source_account_id(id, name, color, icon),
          destination_account:accounts!destination_account_id(id, name, color, icon),
          category:categories(id, name, icon, color, system_key),
          linked_asset:assets(id, name, asset_type, asset_type_id, serial_number, location, purchase_value, current_value, purchase_date, recipient),
          linked_receivable:accounts_receivable(id, debtor_id, debtor_name, due_date, concept, notes, amount, collected_amount, collected_date, currency, status),
          linked_payable:accounts_payable(id, creditor_id, creditor_name, due_date, concept, notes, amount, paid_amount, paid_date, currency, status),
          linked_credit:credits!credits_transaction_id_fkey(id),
          linked_loan:loans!loans_transaction_id_fkey(id)
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single()
    )
  }

  async findMany(
    userId:  string,
    filters: TransactionFilters = {}
  ): Promise<Result<PaginatedTransactions>> {
    const {
      type,
      account_id,
      category_id,
      currency,
      date_from,
      date_to,
      affects_reports,
      search,
      sort_by  = 'transaction_date',
      sort_dir = 'desc',
      page     = 1,
      per_page = 20,
    } = filters

    const safePage    = Math.max(1, page)
    const safePerPage = Math.min(100, Math.max(1, per_page))
    const from        = (safePage - 1) * safePerPage
    const to          = from + safePerPage - 1

    let query = this.db
      .from('transactions')
      .select(`
        *,
        source_account:accounts!source_account_id(id, name, color, icon),
        destination_account:accounts!destination_account_id(id, name, color, icon),
        category:categories(id, name, icon, color, system_key),
        linked_asset:assets(id),
        linked_receivable:accounts_receivable(id),
        linked_payable:accounts_payable(id)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .range(from, to)

    if (type) {
      Array.isArray(type)
        ? query = query.in('type', type)
        : query = query.eq('type', type)
    }

    if (account_id) {
      query = query.or(
        `source_account_id.eq.${account_id},destination_account_id.eq.${account_id}`
      )
    }

    if (category_id)      query = query.eq('category_id', category_id)
    if (currency)         query = query.eq('currency', currency)
    if (date_from)        query = query.gte('transaction_date', date_from)
    if (date_to)          query = query.lte('transaction_date', date_to)

    if (affects_reports !== undefined) {
      query = query.eq('affects_reports', affects_reports)
    }

    if (search) {
      query = query.ilike('description', `%${search.trim()}%`)
    }

    // Ordenamiento seguro (whitelist de columnas soportadas)
    const sortColumn = sort_by === 'amount'
      ? 'amount_pen'
      : sort_by === 'created_at'
        ? 'created_at'
        : 'transaction_date'

    query = query.order(sortColumn, { ascending: sort_dir === 'asc' })

    // Tie-breaker estable para evitar saltos de filas entre páginas
    if (sortColumn !== 'created_at') {
      query = query.order('created_at', { ascending: false })
    }

    try {
      const { data, error, count } = await query

      if (error) {
        return Errors.database(error.message)
      }

      return ok({
        data:     (data ?? []) as TransactionWithRelations[],
        total:    count ?? 0,
        page:     safePage,
        per_page: safePerPage,
        has_more: (count ?? 0) > to + 1,
      })
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  async countByScope(
    userId: string,
    filters: Omit<TransactionFilters, 'type' | 'page' | 'per_page' | 'sort_by' | 'sort_dir'> = {},
  ): Promise<Result<{ all: number; income: number; expense: number; transfer: number }>> {
    const countFor = async (type?: Transaction['type']) => {
      let query = this.db.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      if (type) query = query.eq('type', type)
      if (filters.account_id) query = query.or(`source_account_id.eq.${filters.account_id},destination_account_id.eq.${filters.account_id}`)
      if (filters.category_id) query = query.eq('category_id', filters.category_id)
      if (filters.currency) query = query.eq('currency', filters.currency)
      if (filters.date_from) query = query.gte('transaction_date', filters.date_from)
      if (filters.date_to) query = query.lte('transaction_date', filters.date_to)
      if (filters.search) query = query.ilike('description', `%${filters.search.trim()}%`)
      return query
    }

    try {
      const [all, income, expense, transfer] = await Promise.all([
        countFor(), countFor('INCOME'), countFor('EXPENSE'), countFor('TRANSFER'),
      ])
      const results = [all, income, expense, transfer]
      const failed = results.find(result => result.error)
      if (failed?.error) return Errors.database(failed.error.message)
      if (results.some(result => !Number.isInteger(result.count) || result.count! < 0)) {
        return Errors.database('Transaction type counts are incomplete')
      }
      return ok({ all: all.count!, income: income.count!, expense: expense.count!, transfer: transfer.count! })
    } catch (error) {
      return Errors.database(error instanceof Error ? error.message : 'Error desconocido')
    }
  }

  async findRecent(
    userId:  string,
    limit = 10
  ): Promise<Result<TransactionWithRelations[]>> {
    const result = await this.queryList(async () =>
      await this.db
        .from('transactions')
        .select(`
          *,
          source_account:accounts!source_account_id(id, name, color, icon),
          destination_account:accounts!destination_account_id(id, name, color, icon),
          category:categories(id, name, icon, color)
        `)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
    )

    if (!result.ok) return result
    return ok(result.data as TransactionWithRelations[])
  }

  // ── WRITE ───────────────────────────────────────────────────────────────────

  async create(data: TablesInsert<'transactions'>): Promise<Result<Transaction>> {
    return this.query(async () =>
      await this.db.from('transactions').insert(data).select().single()
    )
  }

  async update(id: string, data: TablesUpdate<'transactions'>): Promise<Result<Transaction>> {
    return this.query(async () =>
      await this.db
        .from('transactions')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    )
  }

  async delete(id: string): Promise<Result<true>> {
    try {
      const { error } = await this.db
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  // ── AGGREGATES (para dashboard) ──────────────────────────────────────────────

  /**
   * Suma de ingresos y egresos del mes actual en PEN.
   * Excluye transferencias automáticamente (affects_reports = true).
   */
  async getMonthlySummary(
    userId: string,
    year:   number,
    month:  number
  ): Promise<Result<{ total_income_pen: number; total_expense_pen: number }>> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    try {
      const { data, error } = await this.db
        .from('v_monthly_summary')
        .select('total_income_pen, total_expense_pen')
        .eq('user_id', userId)
        .eq('month', startDate)
        .maybeSingle()

      if (error) return Errors.database(error.message)

      return ok({
        total_income_pen:  data?.total_income_pen  ?? 0,
        total_expense_pen: data?.total_expense_pen ?? 0,
      })
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }
}
