// =============================================================================
// modules/credits/credit.repository.ts
// =============================================================================

import type { Credit, TablesInsert, TablesUpdate } from '@/types/database.types'
import { BaseRepository, type DbClient }           from '@/modules/shared/repository.base'
import { type Result, Errors, ok }                 from '@/modules/shared/result.types'

type CreditCurrency = 'PEN' | 'USD'

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function hasDualCurrencyColumns(credit: Record<string, unknown>): boolean {
  return 'used_amount_pen' in credit
    && 'used_amount_usd' in credit
    && 'credit_limit_pen' in credit
    && 'credit_limit_usd' in credit
}

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
    amount: number,
    currency?: CreditCurrency,
  ): Promise<Result<Credit>> {
    try {
      const { data: current, error: fetchErr } = await this.db
        .from('credits')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchErr) return Errors.database(fetchErr.message)

      const currentRow = current as Record<string, unknown>
      const supportsDualCurrency = hasDualCurrencyColumns(currentRow)
      const targetCurrency = currency ?? (current.currency as CreditCurrency)
      const usedPen = Number(currentRow.used_amount_pen ?? (current.currency === 'PEN' ? current.used_amount : 0))
      const usedUsd = Number(currentRow.used_amount_usd ?? (current.currency === 'USD' ? current.used_amount : 0))
      const nextUsedPen = targetCurrency === 'PEN' ? roundMoney(usedPen + amount) : usedPen
      const nextUsedUsd = targetCurrency === 'USD' ? roundMoney(usedUsd + amount) : usedUsd
      const primaryCurrency = current.currency as CreditCurrency
      const nextPrimaryUsed = primaryCurrency === 'PEN' ? nextUsedPen : nextUsedUsd
      const primaryLimit = primaryCurrency === 'PEN'
        ? Number(currentRow.credit_limit_pen ?? current.credit_limit)
        : Number(currentRow.credit_limit_usd ?? current.credit_limit)
      const targetLimit = targetCurrency === 'PEN'
        ? Number(currentRow.credit_limit_pen ?? 0)
        : Number(currentRow.credit_limit_usd ?? 0)

      if (
        (targetCurrency === primaryCurrency && nextPrimaryUsed > primaryLimit)
        || (targetCurrency !== primaryCurrency && targetLimit > 0 && (targetCurrency === 'PEN' ? nextUsedPen : nextUsedUsd) > targetLimit)
      ) {
        return Errors.businessRule(
          'El gasto supera el límite de crédito disponible',
          `Disponible: ${Math.max(primaryLimit - nextPrimaryUsed, 0)} ${primaryCurrency}`
        )
      }

      return this.query(async () =>
        await this.db
          .from('credits')
          .update(supportsDualCurrency ? {
            used_amount: nextPrimaryUsed,
            used_amount_pen: nextUsedPen,
            used_amount_usd: nextUsedUsd,
          } : {
            used_amount: nextPrimaryUsed,
          })
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
    amount: number,
    currency?: CreditCurrency,
  ): Promise<Result<Credit>> {
    try {
      const { data: current, error: fetchErr } = await this.db
        .from('credits')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchErr) return Errors.database(fetchErr.message)

      const currentRow = current as Record<string, unknown>
      const supportsDualCurrency = hasDualCurrencyColumns(currentRow)
      const targetCurrency = currency ?? (current.currency as CreditCurrency)
      const usedPen = Number(currentRow.used_amount_pen ?? (current.currency === 'PEN' ? current.used_amount : 0))
      const usedUsd = Number(currentRow.used_amount_usd ?? (current.currency === 'USD' ? current.used_amount : 0))
      const currentUsed = targetCurrency === 'PEN' ? usedPen : usedUsd
      if (amount > currentUsed) {
        return Errors.businessRule(
          'El pago excede la deuda usada de la tarjeta',
          `Deuda usada actual: ${currentUsed} ${targetCurrency}`
        )
      }

      const nextUsedPen = targetCurrency === 'PEN' ? roundMoney(currentUsed - amount) : usedPen
      const nextUsedUsd = targetCurrency === 'USD' ? roundMoney(currentUsed - amount) : usedUsd
      const primaryCurrency = current.currency as CreditCurrency
      const nextPrimaryUsed = primaryCurrency === 'PEN' ? nextUsedPen : nextUsedUsd

      return this.query(async () =>
        await this.db
          .from('credits')
          .update(supportsDualCurrency ? {
            used_amount: nextPrimaryUsed,
            used_amount_pen: nextUsedPen,
            used_amount_usd: nextUsedUsd,
          } : {
            used_amount: nextPrimaryUsed,
          })
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
