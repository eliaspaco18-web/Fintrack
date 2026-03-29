// =============================================================================
// modules/payables/payable.repository.ts
// =============================================================================

import type {
  AccountPayable,
  TablesInsert,
  TablesUpdate,
} from '@/types/database.types'
import { BaseRepository, type DbClient } from '@/modules/shared/repository.base'
import { type Result, Errors, ok }       from '@/modules/shared/result.types'

export class PayableRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  async findById(id: string): Promise<Result<AccountPayable>> {
    return this.query(async () =>
      await this.db.from('accounts_payable').select('*').eq('id', id).single()
    )
  }

  async findPendingByUser(userId: string): Promise<Result<AccountPayable[]>> {
    return this.queryList(async () =>
      await this.db
        .from('accounts_payable')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])
        .order('due_date', { ascending: true, nullsFirst: false })
    )
  }

  async findAllByUser(userId: string): Promise<Result<AccountPayable[]>> {
    return this.queryList(async () =>
      await this.db
        .from('accounts_payable')
        .select('*')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false })
    )
  }

  async create(data: TablesInsert<'accounts_payable'>): Promise<Result<AccountPayable>> {
    return this.query(async () =>
      await this.db.from('accounts_payable').insert(data).select().single()
    )
  }

  async update(id: string, data: TablesUpdate<'accounts_payable'>): Promise<Result<AccountPayable>> {
    return this.query(async () =>
      await this.db
        .from('accounts_payable')
        .update(data)
        .eq('id', id)
        .select()
        .single()
    )
  }

  async markAsPaid(
    id:        string,
    paidDate?: string
  ): Promise<Result<AccountPayable>> {
    return this.query(async () =>
      await this.db
        .from('accounts_payable')
        .update({
          status:    'PAID',
          paid_date: paidDate ?? new Date().toISOString().split('T')[0],
        })
        .eq('id', id)
        .select()
        .single()
    )
  }

  async delete(id: string): Promise<Result<true>> {
    try {
      const { error } = await this.db
        .from('accounts_payable')
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
        .from('accounts_payable')
        .select('amount, paid_amount, currency')
        .eq('user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])

      if (error) return Errors.database(error.message)

      const total = (data ?? []).reduce((sum, p) => {
        const pending    = p.amount - p.paid_amount
        const pendingPen = p.currency === 'PEN' ? pending : pending * exchangeRate
        return sum + pendingPen
      }, 0)

      return ok(Math.round(total * 100) / 100)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }
}
