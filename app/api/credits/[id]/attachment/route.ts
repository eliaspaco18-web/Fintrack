import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase.server'
import { apiCreated, apiError, apiUnauthorized, getSessionUserId } from '@/lib/api/response'

type Params = { params: { id: string } }

const ATTACHMENT_BUCKET = 'credit-documents'
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
])

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().toLowerCase()
  const normalized = trimmed
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized.length > 0 ? normalized : `adjunto-${Date.now()}`
}

function isAllowedFileType(file: File): boolean {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true

  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.heic') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.txt')
  )
}

async function ensureBucket(service: any) {
  const lookup = await service.storage.getBucket(ATTACHMENT_BUCKET)
  if (!lookup.error && lookup.data) return

  await service.storage.createBucket(ATTACHMENT_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const { data: credit, error: creditError } = await supabase
    .from('credits')
    .select('id, notes')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (creditError || !credit) {
    return apiError({ code: 'NOT_FOUND', message: 'Crédito no encontrado' })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return apiError({ code: 'VALIDATION_ERROR', message: 'No se pudo leer el formulario' })
  }

  const fileValue = formData.get('file')
  if (!(fileValue instanceof File)) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Debes adjuntar un archivo válido' })
  }

  if (fileValue.size <= 0) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'El archivo no puede estar vacío' })
  }

  if (fileValue.size > MAX_FILE_SIZE_BYTES) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'El archivo supera el límite permitido (8 MB)',
    })
  }

  if (!isAllowedFileType(fileValue)) {
    return apiError({
      code: 'VALIDATION_ERROR',
      message: 'Formato no permitido. Usa imagen, PDF o documento.',
    })
  }

  const service = createServiceClient() as any
  await ensureBucket(service)

  const safeName = sanitizeFilename(fileValue.name)
  const path = `${userId}/${params.id}/${Date.now()}-${safeName}`
  const contentType = fileValue.type || 'application/octet-stream'

  const { error: uploadError } = await service.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, fileValue, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    })

  if (uploadError) {
    return apiError({ code: 'DATABASE_ERROR', message: uploadError.message })
  }

  const { data: signedData } = await service.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  const attachmentLine = `[adjunto_credito:${fileValue.name}|${path}]`
  const nextNotes = credit.notes
    ? `${credit.notes}\n${attachmentLine}`
    : attachmentLine

  const { error: updateError } = await supabase
    .from('credits')
    .update({ notes: nextNotes })
    .eq('id', params.id)
    .eq('user_id', userId)

  if (updateError) {
    return apiError({ code: 'DATABASE_ERROR', message: updateError.message })
  }

  return apiCreated({
    path,
    file_name: fileValue.name,
    file_size: fileValue.size,
    content_type: contentType,
    signed_url: signedData?.signedUrl ?? null,
  })
}
