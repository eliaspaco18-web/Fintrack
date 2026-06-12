// =============================================================================
// lib/utils/file-upload.ts
// Utilidad para subir/descargar/eliminar archivos del bucket 'attachments'
// en Supabase Storage. Estructura: {user_id}/{module}/{record_id}/{filename}
// =============================================================================

import { createClient } from '@/lib/supabase.client'

const BUCKET = 'attachments'

export const ATTACHMENT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const DEFAULT_ATTACHMENT_MIME_TYPES = [
  ...ATTACHMENT_IMAGE_MIME_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export type UploadModule =
  | 'transactions'
  | 'credits'
  | 'loans'
  | 'assets'
  | 'categories'
  | 'bank-entities'
  | 'receivables'
  | 'payables'
  | 'billing-cycles'

export interface UploadResult {
  path: string
  url: string
}

/**
 * Sube un archivo al bucket de attachments.
 * @returns path relativo y URL pública firmada (1h)
 */
export async function uploadAttachment(
  userId: string,
  module: UploadModule,
  recordId: string,
  file: File
): Promise<UploadResult> {
  const supabase = createClient()

  const extensionMatch = file.name.toLowerCase().match(/(\.[a-z0-9]+)$/)
  const extension = extensionMatch?.[1] ?? ''
  const baseName = extension.length > 0
    ? file.name.slice(0, -extension.length)
    : file.name
  const sanitizedBase = baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  const safeBase = (sanitizedBase || 'file').slice(0, 48)
  const sanitized = `${safeBase}${extension}`
  const timestamp = Date.now()
  const path = `${userId}/${module}/${recordId}/${timestamp}_${sanitized}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Error al subir archivo: ${error.message}`)
  }

  const { data: urlData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600) // 1 hora

  return {
    path,
    url: urlData?.signedUrl ?? '',
  }
}

/**
 * Obtiene una URL firmada para un archivo existente.
 * @param path Ruta relativa dentro del bucket
 * @param expiresIn Segundos de validez (default 1h)
 */
export async function getAttachmentUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) return null
  return data?.signedUrl ?? null
}

/**
 * Elimina un archivo del bucket.
 */
export async function deleteAttachment(path: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path])

  return !error
}

/**
 * Obtiene el nombre legible de un archivo a partir de su path.
 */
export function getFileNameFromPath(path: string): string {
  const segments = path.split('/')
  const filename = segments[segments.length - 1] ?? ''
  // Remover timestamp prefix
  return filename.replace(/^\d+_/, '')
}

/**
 * Valida el tipo MIME y tamaño del archivo.
 */
export function validateFile(
  file: File,
  maxSizeMB = 10,
  allowedTypes: readonly string[] = DEFAULT_ATTACHMENT_MIME_TYPES,
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    const allowsOnlyImages = allowedTypes.every(type => type.startsWith('image/'))
    return {
      valid: false,
      error: allowsOnlyImages
        ? 'Tipo de archivo no permitido. Usa una imagen JPG, PNG, WebP o GIF.'
        : 'Tipo de archivo no permitido. Use: JPG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS, XLSX',
    }
  }

  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `El archivo excede el límite de ${maxSizeMB}MB`,
    }
  }

  return { valid: true }
}
