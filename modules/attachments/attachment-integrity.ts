export const MAX_FINANCIAL_ATTACHMENT_BYTES = 8 * 1024 * 1024

export const FINANCIAL_ATTACHMENT_MIME_TYPES = new Set([
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

const FINANCIAL_ATTACHMENT_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.heic',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
] as const

export const ATTACHMENT_TIMEOUT_MESSAGE =
  'La carga tardó demasiado y no pudimos confirmar el resultado. Revisa el registro antes de intentarlo nuevamente.'

export const ATTACHMENT_CONFIRMATION_MESSAGE =
  'No se pudo confirmar que el archivo quedara asociado correctamente.'

export const ATTACHMENT_DELETE_BLOCKED_MESSAGE =
  'No se puede eliminar este registro mientras conserve una referencia de adjunto que no puede gestionarse de forma segura.'

export const ATTACHMENT_UPDATE_BLOCKED_MESSAGE =
  'No se puede reemplazar esta información mientras conserve una referencia de adjunto que no puede preservarse de forma segura.'

export type AttachmentAvailability = 'AVAILABLE' | 'UNVERIFIED'

export type FinancialAttachmentResult = {
  path: string
  fileName: string
  fileSize: number
  contentType: string
  signedUrl: string | null
  availability: AttachmentAvailability
}

export type FinancialAttachmentStorage = {
  ensureReady: () => Promise<void>
  upload: (path: string, file: File, contentType: string) => Promise<void>
  remove: (path: string) => Promise<void>
  createSignedUrl: (path: string) => Promise<string | null>
}

export type StoreFinancialAttachmentInput = {
  userId: string
  module: 'transactions' | 'credits'
  recordId: string
  file: File
  storage: FinancialAttachmentStorage
  associate: (path: string) => Promise<void>
  now?: () => number
}

export class AttachmentIntegrityError extends Error {
  readonly code: 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'ATOMICITY_FAILURE'
  readonly cleanupConfirmed: boolean

  constructor(
    code: AttachmentIntegrityError['code'],
    message: string,
    cleanupConfirmed = true,
  ) {
    super(message)
    this.name = 'AttachmentIntegrityError'
    this.code = code
    this.cleanupConfirmed = cleanupConfirmed
  }
}

export function sanitizeAttachmentFilename(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized.length > 0 ? normalized.slice(0, 120) : 'adjunto'
}

export function sanitizeAttachmentLabel(name: string): string {
  const normalized = name
    .replace(/[\r\n|\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length > 0 ? normalized.slice(0, 160) : 'adjunto'
}

export function isAllowedFinancialAttachment(file: File): boolean {
  if (file.type && FINANCIAL_ATTACHMENT_MIME_TYPES.has(file.type)) return true

  const lowerName = file.name.toLowerCase()
  return FINANCIAL_ATTACHMENT_EXTENSIONS.some(extension => lowerName.endsWith(extension))
}

export function validateFinancialAttachment(file: File): void {
  if (file.size <= 0) {
    throw new AttachmentIntegrityError('VALIDATION_ERROR', 'El archivo no puede estar vacío.')
  }

  if (file.size > MAX_FINANCIAL_ATTACHMENT_BYTES) {
    throw new AttachmentIntegrityError(
      'VALIDATION_ERROR',
      'El archivo supera el límite permitido de 8 MB.',
    )
  }

  if (!isAllowedFinancialAttachment(file)) {
    throw new AttachmentIntegrityError(
      'VALIDATION_ERROR',
      'Formato no permitido. Usa una imagen, PDF o documento compatible.',
    )
  }
}

function safePathSegment(value: string, fallback: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '')
  return normalized || fallback
}

export function buildFinancialAttachmentPath(
  userId: string,
  module: StoreFinancialAttachmentInput['module'],
  recordId: string,
  fileName: string,
  timestamp: number,
): string {
  return [
    safePathSegment(userId, 'unknown-user'),
    module,
    safePathSegment(recordId, 'unknown-record'),
    `${timestamp}-${sanitizeAttachmentFilename(fileName)}`,
  ].join('/')
}

export async function storeFinancialAttachment(
  input: StoreFinancialAttachmentInput,
): Promise<FinancialAttachmentResult> {
  validateFinancialAttachment(input.file)

  try {
    await input.storage.ensureReady()
  } catch {
    throw new AttachmentIntegrityError(
      'DATABASE_ERROR',
      'No se pudo preparar el almacenamiento del archivo.',
    )
  }

  const contentType = input.file.type || 'application/octet-stream'
  const path = buildFinancialAttachmentPath(
    input.userId,
    input.module,
    input.recordId,
    input.file.name,
    (input.now ?? Date.now)(),
  )

  try {
    await input.storage.upload(path, input.file, contentType)
  } catch {
    throw new AttachmentIntegrityError('DATABASE_ERROR', 'No se pudo guardar el archivo.')
  }

  try {
    await input.associate(path)
  } catch {
    let cleanupConfirmed = true
    try {
      await input.storage.remove(path)
    } catch {
      cleanupConfirmed = false
    }

    throw new AttachmentIntegrityError(
      cleanupConfirmed ? 'DATABASE_ERROR' : 'ATOMICITY_FAILURE',
      cleanupConfirmed
        ? ATTACHMENT_CONFIRMATION_MESSAGE
        : 'No se pudo asociar el archivo ni confirmar la limpieza del intento.',
      cleanupConfirmed,
    )
  }

  let signedUrl: string | null = null
  try {
    signedUrl = await input.storage.createSignedUrl(path)
  } catch {
    signedUrl = null
  }

  return {
    path,
    fileName: input.file.name,
    fileSize: input.file.size,
    contentType,
    signedUrl,
    availability: signedUrl ? 'AVAILABLE' : 'UNVERIFIED',
  }
}

export function hasStoredAttachmentReference(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function hasCreditAttachmentReference(notes: unknown): boolean {
  return typeof notes === 'string' && /\[adjunto_credito:[^\]]+\]/.test(notes)
}

export function hasTransactionAttachmentReference(notes: unknown): boolean {
  return typeof notes === 'string' && /\[adjunto:[^\]]+\]/.test(notes)
}
