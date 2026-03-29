// =============================================================================
// modules/credits/credit.repository.ts
// =============================================================================

import type { Credit, TablesInsert, TablesUpdate } from '@/types/database.types'
import { BaseRepository, type DbClient }           from '@/modules/shared/repository.base'
import { type Result, Errors, ok }                 from '@/modules/shared/result.types'

export class CreditRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  async findById(id: string): Promise<Result<Credit>> {
    return this.query(async () =>
      await this.db.from('credits').select('*').eq('id', id).single()
    )
  }

  async findByIdForUser(id: string, userId: string): Promise<Result<Credit>> {
    return this.query(async () =>
      await this.db
        .from('credits')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()
    )
  }

  async findAllByUser(userId: string): Promise<Result<Credit[]>> {
    return this.queryList(async () =>
      await this.db
        .from('credits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )
  }

  async findActiveByUser(userId: string): Promise<Result<Credit[]>> {
    return this.queryList(async () =>
      await this.db
        .from('credits')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .order('name')
    )
  }

  async create(data: TablesInsert<'credits'>): Promise<Result<Credit>> {
    return this.query(async () =>
      await this.db.from('credits').insert(data).select().single()
    )
  }

  async update(id: string, data: TablesUpdate<'credits'>): Promise<Result<Credit>> {
    return this.query(async () =>
      await this.db.from('credits').update(data).eq('id', id).select().single()
    )
  }

  /** Incrementa used_amount — llamado al registrar un gasto en la tarjeta */
  async incrementUsedAmount(
    id:     string,
    amount: number
  ): Promise<Result<Credit>> {
    try {
      const { data: current, error: fetchErr } = await this.db
        .from('credits')
        .select('used_amount, credit_limit')
        .eq('id', id)
        .single()

      if (fetchErr) return Errors.database(fetchErr.message)

      const newUsed = current.used_amount + amount
      if (newUsed > current.credit_limit) {
        return Errors.businessRule(
          'El gasto supera el límite de crédito disponible',
          `Disponible: ${current.credit_limit - current.used_amount}`
        )
      }

      return this.query(async () =>
        await this.db
          .from('credits')
          .update({ used_amount: newUsed })
          .eq('id', id)
          .select()
          .single()
      )
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  /** Reduce used_amount — llamado al registrar pago de tarjeta */
  async decrementUsedAmount(
    id:     string,
    amount: number
  ): Promise<Result<Credit>> {
    try {
      const { data: current, error: fetchErr } = await this.db
        .from('credits')
        .select('used_amount')
        .eq('id', id)
        .single()

      if (fetchErr) return Errors.database(fetchErr.message)

      if (amount > current.used_amount) {
        return Errors.businessRule(
          'El pago excede la deuda usada de la tarjeta',
          `Deuda usada actual: ${current.used_amount}`
        )
      }

      const newUsed = current.used_amount - amount

      return this.query(async () =>
        await this.db
          .from('credits')
          .update({ used_amount: newUsed })
          .eq('id', id)
          .select()
          .single()
      )
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  async delete(id: string): Promise<Result<true>> {
    try {
      const { error } = await this.db.from('credits').delete().eq('id', id)
      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }
}
