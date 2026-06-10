// =============================================================================
// modules/portfolio/portfolio.repository.ts
// Repository para el módulo Portafolio.
// CRUD de cuentas con validación de eliminación (transacciones vinculadas).
// =============================================================================

import type { Account, TablesInsert, TablesUpdate } from '@/types/database.types'
import { BaseRepository, type DbClient }           from '@/modules/shared/repository.base'
import { type Result, Errors, ok }                  from '@/modules/shared/result.types'

/** Account row enriched with bank entity relation */
export type AccountWithBank = Account & {
  bank_entity: {
    id: string
    name: string
    short_name: string | null
    color: string
    icon: string
    is_active: boolean
  } | null
}

/** Summary of blockers preventing deactivation */
export interface DeactivationBlockers {
  transactions: number
  credits: number
}

export class PortfolioRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  // ── List ──────────────────────────────────────────────────────────────────

  /**
   * List all accounts for a user, optionally including inactive ones.
   * Joins bank_entities for rich display.
   */
  async findAllByUser(
    userId: string,
    opts: { includeInactive?: boolean } = {},
  ): Promise<Result<AccountWithBank[]>> {
    try {
      let query = this.db
        .from('accounts')
        .select('*, bank_entity:bank_entities(id,name,short_name,color,icon,is_active)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!opts.includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) return Errors.database(error.message)
      return ok((data ?? []) as unknown as AccountWithBank[])
    } catch (caught) {
      return Errors.database(caught instanceof Error ? caught.message : 'Error inesperado')
    }
  }

  // ── Single ────────────────────────────────────────────────────────────────

  async findById(id: string, userId: string): Promise<Result<AccountWithBank>> {
    return this.query(async () =>
      await this.db
        .from('accounts')
        .select('*, bank_entity:bank_entities(id,name,short_name,color,icon,is_active)')
        .eq('id', id)
        .eq('user_id', userId)
        .single()
    ) as Promise<Result<AccountWithBank>>
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(data: TablesInsert<'accounts'>): Promise<Result<Account>> {
    return this.query(async () =>
      await this.db.from('accounts').insert(data).select().single()
    )
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateOwned(
    id: string,
    userId: string,
    data: TablesUpdate<'accounts'>,
  ): Promise<Result<Account>> {
    return this.query(async () =>
      await this.db
        .from('accounts')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
    )
  }

  // ── Deactivation validation ───────────────────────────────────────────────

  /**
   * Counts linked records that would block deactivation.
   * Returns transaction + credit counts so the caller can build a message.
   */
  async countBlockers(id: string, userId: string): Promise<Result<DeactivationBlockers>> {
    try {
      const [txResult, creditResult] = await Promise.all([
        this.db
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .or(`source_account_id.eq.${id},destination_account_id.eq.${id}`),
        this.db
          .from('credits')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('account_id', id),
      ])

      if (txResult.error) return Errors.database(txResult.error.message)
      if (creditResult.error) return Errors.database(creditResult.error.message)

      return ok({
        transactions: txResult.count ?? 0,
        credits: creditResult.count ?? 0,
      })
    } catch (caught) {
      return Errors.database(caught instanceof Error ? caught.message : 'Error inesperado')
    }
  }

  /**
   * Returns true if the account can be safely deactivated (no linked records).
   */
  async canDeactivate(id: string, userId: string): Promise<Result<boolean>> {
    const blockers = await this.countBlockers(id, userId)
    if (!blockers.ok) return blockers
    return ok(blockers.data.transactions + blockers.data.credits === 0)
  }

  // ── Soft delete (deactivate) ──────────────────────────────────────────────

  async deactivate(id: string, userId: string): Promise<Result<true>> {
    try {
      const { error } = await this.db
        .from('accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (caught) {
      return Errors.database(caught instanceof Error ? caught.message : 'Error desconocido')
    }
  }

  // ── Reactivate ────────────────────────────────────────────────────────────

  async reactivate(id: string, userId: string): Promise<Result<Account>> {
    return this.query(async () =>
      await this.db
        .from('accounts')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()
    )
  }
}
