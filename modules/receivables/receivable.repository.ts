// =============================================================================
// modules/receivables/receivable.repository.ts
// Repositorio para accounts_receivable y debtors.
// =============================================================================

import type {
  AccountReceivable,
  Debtor,
  TablesInsert,
  TablesUpdate,
} from '@/types/database.types'
import { BaseRepository, type DbClient } from '@/modules/shared/repository.base'
import { type Result, Errors, ok }       from '@/modules/shared/result.types'

// ─── TIPOS EXTENDIDOS ─────────────────────────────────────────────────────────

export type DebtorWithStats = Debtor & {
  total_lent:       number
  total_collected:  number
  pending_amount:   number
  progress_pct:     number
  all_collected:    boolean
  count_pending:    number
  receivables_count: number
}

export type ReceivableWithDebtor = AccountReceivable & {
  debtor: Pick<Debtor, 'id' | 'name' | 'relationship' | 'initial_debt' | 'is_active'> | null
}

// ─── REPOSITORY ───────────────────────────────────────────────────────────────

export class ReceivableRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  // ── accounts_receivable ────────────────────────────────────────────────────

  async findById(id: string): Promise<Result<ReceivableWithDebtor>> {
    return this.query(async () =>
      await this.db
        .from('accounts_receivable')
        .select('*, debtor:debtors(id, name, relationship, initial_debt, is_active)')
        .eq('id', id)
        .single()
    ) as Promise<Result<ReceivableWithDebtor>>
  }

  async findAllByUser(userId: string): Promise<Result<ReceivableWithDebtor[]>> {
    return this.queryList(async () =>
      await this.db
        .from('accounts_receivable')
        .select('*, debtor:debtors(id, name, relationship, initial_debt, is_active)')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false })
    ) as Promise<Result<ReceivableWithDebtor[]>>
  }

  async findPendingByUser(userId: string): Promise<Result<AccountReceivable[]>> {
    return this.queryList(async () =>
      await this.db
        .from('accounts_receivable')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])
        .order('due_date', { ascending: true, nullsFirst: false })
    )
  }

  async findByDebtor(userId: string, debtorId: string): Promise<Result<AccountReceivable[]>> {
    return this.queryList(async () =>
      await this.db
        .from('accounts_receivable')
        .select('*')
        .eq('user_id', userId)
        .eq('debtor_id', debtorId)
        .order('issue_date', { ascending: false })
    )
  }

  async create(data: TablesInsert<'accounts_receivable'>): Promise<Result<AccountReceivable>> {
    return this.query(async () =>
      await this.db.from('accounts_receivable').insert(data).select().single()
    )
  }

  async update(id: string, data: TablesUpdate<'accounts_receivable'>): Promise<Result<AccountReceivable>> {
    return this.query(async () =>
      await this.db
        .from('accounts_receivable')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    )
  }

  async markAsCollected(id: string, collectedDate?: string): Promise<Result<AccountReceivable>> {
    return this.query(async () =>
      await this.db
        .from('accounts_receivable')
        .update({
          status:         'COLLECTED',
          collected_date: collectedDate ?? new Date().toISOString().split('T')[0],
        })
        .eq('id', id)
        .select()
        .single()
    )
  }

  async delete(id: string): Promise<Result<true>> {
    try {
      const { error } = await this.db
        .from('accounts_receivable')
        .delete()
        .eq('id', id)
      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  // ── debtors ───────────────────────────────────────────────────────────────

  async findAllDebtors(userId: string): Promise<Result<Debtor[]>> {
    return this.queryList(async () =>
      await this.db
        .from('debtors')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })
    )
  }

  async findDebtorById(userId: string, id: string): Promise<Result<Debtor>> {
    return this.query(async () =>
      await this.db
        .from('debtors')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()
    )
  }

  async createDebtor(data: TablesInsert<'debtors'>): Promise<Result<Debtor>> {
    return this.query(async () =>
      await this.db.from('debtors').insert(data).select().single()
    )
  }

  async updateDebtor(id: string, userId: string, data: TablesUpdate<'debtors'>): Promise<Result<Debtor>> {
    return this.query(async () =>
      await this.db
        .from('debtors')
        .update(data)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
    )
  }

  async deleteDebtor(id: string, userId: string): Promise<Result<true>> {
    try {
      // Verificar que no tenga cuentas por cobrar asociadas
      const { count } = await this.db
        .from('accounts_receivable')
        .select('id', { count: 'exact', head: true })
        .eq('debtor_id', id)
        .eq('user_id', userId)

      if ((count ?? 0) > 0) {
        return Errors.businessRule('No se puede eliminar un deudor con cuentas por cobrar asociadas.')
      }

      const { error } = await this.db
        .from('debtors')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  // ── utilidades ────────────────────────────────────────────────────────────

  async getTotalPendingPen(userId: string, exchangeRate: number): Promise<Result<number>> {
    try {
      const { data, error } = await this.db
        .from('accounts_receivable')
        .select('amount, collected_amount, currency')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])

      if (error) return Errors.database(error.message)

      const total = (data ?? []).reduce((sum, r) => {
        const pending    = r.amount - r.collected_amount
        const pendingPen = r.currency === 'PEN' ? pending : pending * exchangeRate
        return sum + pendingPen
      }, 0)

      return ok(Math.round(total * 100) / 100)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }
}
