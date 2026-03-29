import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized } from '@/lib/api/response'

const AVATAR_BUCKET = 'profile-avatars'
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

type AuthenticatedUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().toLowerCase()
  const normalized = trimmed
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized.length > 0 ? normalized : `avatar-${Date.now()}.png`
}

function isAllowedImage(file: File): boolean {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true

  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif')
  )
}

function extractBucketPath(url: string | null): string | null {
  if (!url) return null

  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null

  const rawPath = url.slice(index + marker.length)
  if (!rawPath) return null

  try {
    return decodeURIComponent(rawPath)
  } catch {
    return rawPath
  }
}

async function ensureAvatarBucket(service: ReturnType<typeof createServiceClient>) {
  const lookup = await service.storage.getBucket(AVATAR_BUCKET)
  if (!lookup.error && lookup.data) return

  await service.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_AVATAR_SIZE_BYTES}`,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  })
}

async function ensureProfileRow(user: AuthenticatedUser) {
  const service = createServiceClient()
  const fallbackName = user.email?.split('@')[0] ?? 'Usuario'
  const metadataName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : null

  const { error } = await service
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email ?? `${user.id}@local.fintrack`,
      full_name: metadataName ?? fallbackName,
    }, { onConflict: 'id' })

  if (error) throw new Error(error.message)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiUnauthorized()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'No se pudo leer el formulario' })
  }

  const fileValue = formData.get('file')
  if (!(fileValue instanceof File)) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Debes adjuntar una imagen válida' })
  }

  if (fileValue.size <= 0) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'La imagen no puede estar vacía' })
  }

  if (fileValue.size > MAX_AVATAR_SIZE_BYTES) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'La imagen supera el límite permitido (5 MB)',
    })
  }

  if (!isAllowedImage(fileValue)) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Formato no permitido. Usa PNG, JPG, WEBP o GIF.',
    })
  }

  const service = createServiceClient()

  try {
    await ensureProfileRow(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo preparar el perfil'
    return apiError({ code: 'DATABASE_ERROR', message })
  }

  await ensureAvatarBucket(service)

  const { data: profile } = await service
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  const safeName = sanitizeFilename(fileValue.name)
  const path = `${user.id}/${Date.now()}-${safeName}`
  const contentType = fileValue.type || 'application/octet-stream'

  const { error: uploadError } = await service.storage
    .from(AVATAR_BUCKET)
    .upload(path, fileValue, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) {
    return apiError({ code: 'DATABASE_ERROR', message: uploadError.message })
  }

  const { data: publicData } = service.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path)

  const avatarUrl = publicData.publicUrl

  const { error: profileUpdateError } = await service
    .from('profiles')
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileUpdateError) {
    return apiError({ code: 'DATABASE_ERROR', message: profileUpdateError.message })
  }

  const previousPath = extractBucketPath(profile?.avatar_url ?? null)
  if (previousPath && previousPath !== path) {
    await service.storage.from(AVATAR_BUCKET).remove([previousPath])
  }

  return apiOk({
    avatar_url: avatarUrl,
    bucket: AVATAR_BUCKET,
    path,
  })
}

export async function DELETE() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return apiUnauthorized()

  const service = createServiceClient()
  try {
    await ensureProfileRow(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo preparar el perfil'
    return apiError({ code: 'DATABASE_ERROR', message })
  }

  const { data: profile, error: profileReadError } = await service
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  if (profileReadError) {
    return apiError({ code: 'DATABASE_ERROR', message: profileReadError.message })
  }

  const previousPath = extractBucketPath(profile?.avatar_url ?? null)

  const { error: clearError } = await service
    .from('profiles')
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (clearError) {
    return apiError({ code: 'DATABASE_ERROR', message: clearError.message })
  }

  if (previousPath) {
    await service.storage.from(AVATAR_BUCKET).remove([previousPath])
  }

  return apiOk({ avatar_url: null })
}
