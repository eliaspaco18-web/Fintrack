// =============================================================================
// modules/receivables/receivable.repository.ts
// =============================================================================

import type {
  AccountReceivable,
  TablesInsert,
  TablesUpdate,
} from '@/types/database.types'
import { BaseRepository, type DbClient } from '@/modules/shared/repository.base'
import { type Result, Errors, ok }       from '@/modules/shared/result.types'

export class ReceivableRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  async findById(id: string): Promise<Result<AccountReceivable>> {
    return this.query(async () =>
      await this.db.from('accounts_receivable').select('*').eq('id', id).single()
    )
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

  async findAllByUser(userId: string): Promise<Result<AccountReceivable[]>> {
    return this.queryList(async () =>
      await this.db
        .from('accounts_receivable')
        .select('*')
        .eq('user_id', userId)
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

  /** Marca como cobrada y registra la fecha */
  async markAsCollected(
    id:             string,
    collectedDate?: string
  ): Promise<Result<AccountReceivable>> {
    return this.query(async () =>
      await this.db
        .from('accounts_receivable')
        .update({
          status:         'COLLECTED',
          collected_date: collectedDate ?? new Date().toISOString().split('T')[0],
          collected_amount: undefined, // será actualizado por la transacción de cobro
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

  async getTotalPendingPen(userId: string, exchangeRate: number): Promise<Result<number>> {
    try {
      const { data, error } = await this.db
        .from('accounts_receivable')
        .select('amount, collected_amount, currency')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])

      if (error) return Errors.database(error.message)

      const total = (data ?? []).reduce((sum, r) => {
        const pending  = r.amount - r.collected_amount
        const pendingPen = r.currency === 'PEN' ? pending : pending * exchangeRate
        return sum + pendingPen
      }, 0)

      return ok(Math.round(total * 100) / 100)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }
}
