import type { UserCurrency, TablesInsert, TablesUpdate } from '@/types/database.types'
import { BaseRepository, type DbClient }             from '@/modules/shared/repository.base'
import { type Result, Errors, ok }                   from '@/modules/shared/result.types'

function normalizeCurrencyKey(item: Pick<UserCurrency, 'code' | 'name'>): string {
  const code = item.code.trim().toLocaleUpperCase('es')
  const name = item.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
  return `${code}::${name}`
}

function preferCurrencyCandidate(current: UserCurrency, candidate: UserCurrency): UserCurrency {
  const currentOwned = !current.is_system && current.user_id !== null
  const candidateOwned = !candidate.is_system && candidate.user_id !== null

  if (currentOwned !== candidateOwned) return candidateOwned ? candidate : current
  if (current.is_default !== candidate.is_default) return candidate.is_default ? candidate : current
  if (current.is_active !== candidate.is_active) return candidate.is_active ? candidate : current

  return current
}

function dedupeCurrencies(items: UserCurrency[]): UserCurrency[] {
  const grouped = new Map<string, UserCurrency>()

  for (const item of items) {
    const key = normalizeCurrencyKey(item)
    const existing = grouped.get(key)
    grouped.set(key, existing ? preferCurrencyCandidate(existing, item) : item)
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    if (a.is_system !== b.is_system) return a.is_system ? 1 : -1
    return a.code.localeCompare(b.code, 'es')
  })
}

export class CurrencyRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  async findAllByUser(userId: string): Promise<Result<UserCurrency[]>> {
    const result = await this.queryList(async () =>
      await this.db
        .from('user_currencies')
        .select('*')
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .order('is_system', { ascending: false })
        .order('is_default', { ascending: false })
        .order('code', { ascending: true })
    )

    if (!result.ok) return result
    return ok(dedupeCurrencies(result.data))
  }

  async create(data: TablesInsert<'user_currencies'>): Promise<Result<UserCurrency>> {
    return this.query(async () =>
      await this.db.from('user_currencies').insert(data).select().single()
    )
  }

  async updateOwned(
    id: string,
    userId: string,
    data: TablesUpdate<'user_currencies'>
  ): Promise<Result<UserCurrency>> {
    return this.query(async () =>
      await this.db
        .from('user_currencies')
        .update(data)
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_system', false)
        .select()
        .single()
    )
  }

  async deleteOwned(id: string, userId: string): Promise<Result<true>> {
    try {
      const { error } = await this.db
        .from('user_currencies')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .eq('is_system', false)

      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (caught) {
      return Errors.database(caught instanceof Error ? caught.message : 'Error desconocido')
    }
  }

  async clearDefaultForUser(userId: string): Promise<Result<true>> {
    try {
      const { error } = await this.db
        .from('user_currencies')
        .update({ is_default: false })
        .eq('user_id', userId)

      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (caught) {
      return Errors.database(caught instanceof Error ? caught.message : 'Error desconocido')
    }
  }
}
