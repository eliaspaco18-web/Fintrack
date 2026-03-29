// =============================================================================
// modules/assets/asset.repository.ts
// =============================================================================

import type { Asset, TablesInsert, TablesUpdate } from '@/types/database.types'
import { BaseRepository, type DbClient }          from '@/modules/shared/repository.base'
import { type Result, Errors, ok }                from '@/modules/shared/result.types'

export class AssetRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  async findById(id: string): Promise<Result<Asset>> {
    return this.query(async () =>
      await this.db.from('assets').select('*').eq('id', id).single()
    )
  }

  async findByTransactionId(transactionId: string): Promise<Result<Asset | null>> {
    return this.queryNullable(async () =>
      await this.db
        .from('assets')
        .select('*')
        .eq('transaction_id', transactionId)
        .maybeSingle()
    )
  }

  async findAllByUser(userId: string): Promise<Result<Asset[]>> {
    return this.queryList(async () =>
      await this.db
        .from('assets')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .order('purchase_date', { ascending: false })
    )
  }

  async create(data: TablesInsert<'assets'>): Promise<Result<Asset>> {
    return this.query(async () =>
      await this.db.from('assets').insert(data).select().single()
    )
  }

  async update(id: string, data: TablesUpdate<'assets'>): Promise<Result<Asset>> {
    return this.query(async () =>
      await this.db.from('assets').update(data).eq('id', id).select().single()
    )
  }

  async delete(id: string): Promise<Result<true>> {
    try {
      const { error } = await this.db.from('assets').delete().eq('id', id)
      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  /** Suma del valor actual de todos los activos del usuario en PEN */
  async getTotalValuePen(userId: string, exchangeRate: number): Promise<Result<number>> {
    try {
      const { data, error } = await this.db
        .from('assets')
        .select('current_value, currency')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')

      if (error) return Errors.database(error.message)

      const total = (data ?? []).reduce((sum, a) => {
        const valuePen = a.currency === 'PEN'
          ? a.current_value
          : a.current_value * exchangeRate
        return sum + valuePen
      }, 0)

      return ok(Math.round(total * 100) / 100)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }
}
