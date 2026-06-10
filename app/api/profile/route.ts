import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import { apiError, apiNoContent, apiOk, apiUnauthorized, apiZodError } from '@/lib/api/response'

const zCurrency = z.enum(['PEN', 'USD'])
const zAvatarUrl = z.string().trim().max(1000).refine((value) => {
  return (
    value.startsWith('/avatars/') ||
    value.startsWith('https://') ||
    value.startsWith('http://')
  )
}, {
  message: 'avatar_url inválido',
})

const zUpdateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  default_currency: zCurrency,
  avatar_url: zAvatarUrl.nullable().optional(),
})

type AuthenticatedUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

async function ensureProfileRow(user: AuthenticatedUser) {
  const service = createServiceClient()
  const metadataName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : null
  const metadataAvatar = typeof user.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : null

  const { error } = await service
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email ?? `${user.id}@local.fintrack`,
      full_name: metadataName,
      avatar_url: metadataAvatar,
    }, {
      onConflict: 'id',
      // Solo crea el perfil si no existe; evita sobreescribir nombre/avatar del usuario.
      ignoreDuplicates: true,
    })

  if (error) throw new Error(error.message)
}

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiUnauthorized()

  try {
    await ensureProfileRow(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo preparar el perfil'
    return apiError({ code: 'DATABASE_ERROR', message })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('profiles')
    .select('id, email, full_name, avatar_url, default_currency, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiUnauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Body JSON inválido' })
  }

  const parsed = zUpdateProfileSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  try {
    await ensureProfileRow(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo preparar el perfil'
    return apiError({ code: 'DATABASE_ERROR', message })
  }

  const service = createServiceClient()
  const updatePayload: {
    full_name: string
    default_currency: 'PEN' | 'USD'
    avatar_url?: string | null
    updated_at: string
  } = {
    full_name: parsed.data.full_name,
    default_currency: parsed.data.default_currency,
    updated_at: new Date().toISOString(),
  }

  if ('avatar_url' in parsed.data) {
    updatePayload.avatar_url = parsed.data.avatar_url ?? null
  }

  const { data, error } = await service
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id)
    .select('id, email, full_name, avatar_url, default_currency, created_at, updated_at')
    .single()

  if (error) return apiError({ code: 'DATABASE_ERROR', message: error.message })
  return apiOk(data)
}

export async function DELETE() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiUnauthorized()

  const service = createServiceClient()

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) {
    return apiError({
      code: 'DATABASE_ERROR',
      message: error.message || 'No se pudo eliminar la cuenta.',
    })
  }

  await supabase.auth.signOut({ scope: 'global' })

  return apiNoContent()
}
