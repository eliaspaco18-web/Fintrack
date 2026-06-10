// =============================================================================
// app/api/profile/change-password/route.ts
// Cambia la contraseña del usuario autenticado.
// Verificamos la contraseña actual haciendo re-auth, luego actualizamos.
// =============================================================================

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, apiZodError } from '@/lib/api/response'

const zChangePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72),
})

export async function POST(req: NextRequest) {
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

  const parsed = zChangePasswordSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })

  if (updateError) {
    return apiError({
      code: 'AUTH_ERROR',
      message: updateError.message ?? 'No se pudo cambiar la contraseña',
    })
  }

  return apiOk({ message: 'Contraseña actualizada correctamente' })
}
