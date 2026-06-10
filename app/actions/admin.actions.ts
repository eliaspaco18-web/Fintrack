'use server'

import { revalidatePath }                           from 'next/cache'
import { z }                                        from 'zod'
import { createClient }                             from '@/lib/supabase.server'
import { type Result, Errors }                      from '@/modules/shared/result.types'
import { CurrencyRepository }                        from '@/modules/admin/currency.repository'
import { AssetTypeRepository }                       from '@/modules/admin/asset-type.repository'
import type { UserCurrency, AssetTypeRow as AssetType } from '@/types/database.types'

const zCurrencyInput = z.object({
  code: z.string().trim().min(2).max(10),
  name: z.string().trim().min(2).max(60),
  symbol: z.string().trim().min(1).max(10).default('$'),
  country: z.string().trim().min(2).max(60).optional().nullable(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

const zUpdateCurrencyInput = z.object({
  code: z.string().trim().min(2).max(10).optional(),
  name: z.string().trim().min(2).max(60).optional(),
  symbol: z.string().trim().min(1).max(10).optional(),
  country: z.string().trim().min(2).max(60).nullable().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
}).refine(
  value => Object.keys(value).length > 0,
  { message: 'No hay campos para actualizar' }
)

const zAssetTypeInput = z.object({
  name: z.string().trim().min(2).max(80),
  icon: z.string().trim().min(1).max(40).default('package'),
  color: z.string().trim().min(4).max(20).default('#6366f1'),
  is_active: z.boolean().default(true),
})

const zUpdateAssetTypeInput = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  color: z.string().trim().min(4).max(20).optional(),
  is_active: z.boolean().optional(),
}).refine(
  value => Object.keys(value).length > 0,
  { message: 'No hay campos para actualizar' }
)

async function getAuthContext() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      supabase: null as ReturnType<typeof createClient> | null,
      userId: null as string | null,
      currencyRepo: null as CurrencyRepository | null,
      assetTypeRepo: null as AssetTypeRepository | null,
    }
  }

  return {
    supabase,
    userId: user.id,
    currencyRepo: new CurrencyRepository(supabase),
    assetTypeRepo: new AssetTypeRepository(supabase),
  }
}

function normalizeCatalogName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function revalidateAdminScreens() {
  revalidatePath('/admin')
  revalidatePath('/portfolio')
  revalidatePath('/assets')
  revalidatePath('/transactions')
}

export async function listCurrenciesAction(): Promise<Result<UserCurrency[]>> {
  const { userId, currencyRepo } = await getAuthContext()
  if (!userId || !currencyRepo) return Errors.unauthorized()

  return currencyRepo.findAllByUser(userId)
}

export async function createCurrencyAction(input: unknown): Promise<Result<UserCurrency>> {
  const { userId, currencyRepo } = await getAuthContext()
  if (!userId || !currencyRepo) return Errors.unauthorized()

  const parsed = zCurrencyInput.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de moneda inválidos',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' | ')
    )
  }

  const payload = parsed.data
  const existing = await currencyRepo.findAllByUser(userId)
  if (!existing.ok) return existing

  const duplicated = existing.data.some(currency =>
    currency.code.toLocaleUpperCase('es') === payload.code.toLocaleUpperCase('es')
      || normalizeCatalogName(currency.name) === normalizeCatalogName(payload.name)
  )
  if (duplicated) {
    return Errors.businessRule('Ya existe una moneda con ese código o nombre.')
  }

  if (payload.is_default) {
    const clearDefault = await currencyRepo.clearDefaultForUser(userId)
    if (!clearDefault.ok) return clearDefault
  }

  const result = await currencyRepo.create({
    user_id: userId,
    code: payload.code.toUpperCase(),
    name: payload.name,
    symbol: payload.symbol,
    country: payload.country ?? null,
    is_default: payload.is_default,
    is_system: false,
    is_active: payload.is_active,
  })

  if (result.ok) revalidateAdminScreens()
  return result
}

export async function updateCurrencyAction(id: string, input: unknown): Promise<Result<UserCurrency>> {
  const { userId, currencyRepo } = await getAuthContext()
  if (!userId || !currencyRepo) return Errors.unauthorized()

  const parsed = zUpdateCurrencyInput.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de moneda inválidos',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' | ')
    )
  }

  const payload = parsed.data
  const existing = await currencyRepo.findAllByUser(userId)
  if (!existing.ok) return existing

  const duplicated = existing.data.some(currency =>
    currency.id !== id && (
      (payload.code ? currency.code.toLocaleUpperCase('es') === payload.code.toLocaleUpperCase('es') : false)
      || (payload.name ? normalizeCatalogName(currency.name) === normalizeCatalogName(payload.name) : false)
    )
  )
  if (duplicated) {
    return Errors.businessRule('Ya existe una moneda con ese código o nombre.')
  }

  if (payload.is_default === true) {
    const clearDefault = await currencyRepo.clearDefaultForUser(userId)
    if (!clearDefault.ok) return clearDefault
  }

  const result = await currencyRepo.updateOwned(id, userId, {
    code: payload.code?.toUpperCase(),
    name: payload.name,
    symbol: payload.symbol,
    country: payload.country ?? undefined,
    is_default: payload.is_default,
    is_active: payload.is_active,
  })

  if (result.ok) revalidateAdminScreens()
  return result
}

export async function deleteCurrencyAction(id: string): Promise<Result<true>> {
  const { userId, currencyRepo } = await getAuthContext()
  if (!userId || !currencyRepo) return Errors.unauthorized()

  const result = await currencyRepo.deleteOwned(id, userId)
  if (result.ok) revalidateAdminScreens()
  return result
}

export async function listAssetTypesAction(): Promise<Result<AssetType[]>> {
  const { userId, assetTypeRepo } = await getAuthContext()
  if (!userId || !assetTypeRepo) return Errors.unauthorized()

  return assetTypeRepo.findAllByUser(userId)
}

export async function createAssetTypeAction(input: unknown): Promise<Result<AssetType>> {
  const { userId, assetTypeRepo } = await getAuthContext()
  if (!userId || !assetTypeRepo) return Errors.unauthorized()

  const parsed = zAssetTypeInput.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de tipo de activo inválidos',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' | ')
    )
  }

  const payload = parsed.data
  const existing = await assetTypeRepo.findAllByUser(userId)
  if (!existing.ok) return existing

  const duplicated = existing.data.some(item =>
    normalizeCatalogName(item.name) === normalizeCatalogName(payload.name)
  )
  if (duplicated) {
    return Errors.businessRule('Ya existe un tipo de activo con ese nombre.')
  }

  const result = await assetTypeRepo.create({
    user_id: userId,
    name: payload.name,
    icon: payload.icon,
    color: payload.color,
    is_system: false,
    is_active: payload.is_active,
  })

  if (result.ok) revalidateAdminScreens()
  return result
}

export async function updateAssetTypeAction(id: string, input: unknown): Promise<Result<AssetType>> {
  const { userId, assetTypeRepo } = await getAuthContext()
  if (!userId || !assetTypeRepo) return Errors.unauthorized()

  const parsed = zUpdateAssetTypeInput.safeParse(input)
  if (!parsed.success) {
    return Errors.validation(
      'Datos de tipo de activo inválidos',
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' | ')
    )
  }

  const payload = parsed.data
  const current = await assetTypeRepo.findByIdAccessible(id)
  if (!current.ok) return current

  const existing = await assetTypeRepo.findAllByUser(userId)
  if (!existing.ok) return existing

  const nextName = payload.name ?? current.data.name
  const duplicated = existing.data.some(item =>
    item.id !== current.data.id && normalizeCatalogName(item.name) === normalizeCatalogName(nextName)
  )
  if (duplicated) {
    return Errors.businessRule('Ya existe un tipo de activo con ese nombre.')
  }

  if (current.data.is_system || current.data.user_id === null) {
    const result = await assetTypeRepo.create({
      user_id: userId,
      name: nextName,
      icon: payload.icon ?? current.data.icon,
      color: payload.color ?? current.data.color,
      is_system: false,
      is_active: payload.is_active ?? current.data.is_active,
    })

    if (result.ok) revalidateAdminScreens()
    return result
  }

  const result = await assetTypeRepo.updateOwned(id, userId, {
    name: payload.name,
    icon: payload.icon,
    color: payload.color,
    is_active: payload.is_active,
  })

  if (result.ok) revalidateAdminScreens()
  return result
}

export async function deleteAssetTypeAction(id: string): Promise<Result<true>> {
  const { userId, assetTypeRepo } = await getAuthContext()
  if (!userId || !assetTypeRepo) return Errors.unauthorized()

  const current = await assetTypeRepo.findByIdAccessible(id)
  if (!current.ok) return current

  if (current.data.is_system || current.data.user_id === null) {
    return Errors.businessRule('Los tipos base del sistema no se eliminan directamente. Puedes desactivarlos o personalizarlos.')
  }

  const result = await assetTypeRepo.deleteOwned(id, userId)
  if (result.ok) revalidateAdminScreens()
  return result
}
