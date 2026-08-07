'use client'

// =============================================================================
// components/ui/FileUpload.tsx
// Componente de subida de archivos (drag & drop + click).
// Soporta: JPG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS, XLSX (max 10MB)
// Usado en: Transacciones, Créditos, Activos, CxC, CxP, Billing Cycles
// =============================================================================

import { useCallback, useRef, useState } from 'react'
import { validateFile, getFileNameFromPath } from '@/lib/utils/file-upload'

interface FileUploadProps {
  /** Archivo actualmente seleccionado */
  value?: File | null
  /** URL de un archivo existente (para mostrar el nombre) */
  existingUrl?: string | null
  /** Callback al seleccionar archivo */
  onChange: (file: File | null) => void
  /** Callback al eliminar archivo existente */
  onRemoveExisting?: () => void
  /** Tamaño máximo en MB */
  maxSizeMB?: number
  /** Etiqueta personalizada */
  label?: string
  /** ID para testing */
  id?: string
  /** Deshabilitado */
  disabled?: boolean
  /** Tipos MIME permitidos */
  allowedMimeTypes?: readonly string[]
  /** atributo accept para el input */
  accept?: string
  /** Texto de ayuda visible debajo del dropzone */
  acceptedTypesDescription?: string
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ft-text-subtle)]">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function FileTextIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h4" />
    </svg>
  )
}

function ImageIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

export function FileUpload({
  value,
  existingUrl,
  onChange,
  onRemoveExisting,
  maxSizeMB = 10,
  label = 'Adjuntar constancia o comprobante',
  id,
  disabled = false,
  allowedMimeTypes,
  accept = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx',
  acceptedTypesDescription,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      const validation = validateFile(file, maxSizeMB, allowedMimeTypes)
      if (!validation.valid) {
        setError(validation.error ?? 'Archivo inválido')
        return
      }
      setError(null)
      onChange(file)
    },
    [allowedMimeTypes, maxSizeMB, onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [disabled, handleFile]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      if (inputRef.current) inputRef.current.value = ''
    },
    [handleFile]
  )

  const handleRemove = useCallback(() => {
    setError(null)
    onChange(null)
  }, [onChange])

  // ─── Archivo seleccionado (nuevo) ─────────────────────────────────────────
  if (value) {
    return (
      <div id={id} className="space-y-[var(--ft-form-label-gap)]">
        <p className="text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--ft-text-strong)]">
          {label}
        </p>
        <div className="flex min-h-11 items-center gap-3 rounded-[var(--ft-radius-surface)] border border-[color-mix(in_srgb,var(--ft-success)_22%,transparent)] bg-[color-mix(in_srgb,var(--ft-success)_8%,var(--ft-surface))] px-3 py-2.5">
          {value.type.startsWith('image/')
            ? <ImageIcon className="shrink-0 text-[var(--ft-info)]" />
            : <FileTextIcon className="shrink-0 text-[var(--ft-warning)]" />
          }
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-[var(--ft-text-strong)]">{value.name}</p>
            <p className="text-[12px] text-[var(--ft-text-muted)]">{formatFileSize(value.size)}</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="ui-pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-[var(--ft-text-muted)] transition-[background-color,color,box-shadow,transform] duration-fast ease-[var(--ft-ease-out)] hover:bg-[var(--ft-danger-soft)] hover:text-[var(--ft-danger)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--ft-focus-ring-color)]"
            aria-label="Eliminar archivo"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    )
  }

  // ─── Archivo existente (URL guardada) ─────────────────────────────────────
  if (existingUrl) {
    return (
      <div id={id} className="space-y-[var(--ft-form-label-gap)]">
        <p className="text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--ft-text-strong)]">
          {label}
        </p>
        <div className="flex min-h-11 items-center gap-3 rounded-[var(--ft-radius-surface)] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2.5">
          <FileTextIcon className="shrink-0 text-[var(--ft-text-muted)]" />
          <p className="flex-1 truncate text-sm text-[var(--ft-text-strong)]">
            {getFileNameFromPath(existingUrl)}
          </p>
          {onRemoveExisting && (
            <button
              type="button"
              onClick={onRemoveExisting}
              className="ui-pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-[var(--ft-text-muted)] transition-[background-color,color,box-shadow,transform] duration-fast ease-[var(--ft-ease-out)] hover:bg-[var(--ft-danger-soft)] hover:text-[var(--ft-danger)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--ft-focus-ring-color)]"
              aria-label="Eliminar archivo"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Dropzone ─────────────────────────────────────────────────────────────
  return (
    <div id={id} className="space-y-[var(--ft-form-label-gap)]">
      <p className="text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--ft-text-strong)]">
        {label}
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-[var(--ft-radius-surface)] border border-dashed
          px-4 py-5 transition-[background-color,border-color,color,opacity] duration-fast ease-[var(--ft-ease-out)]
          ${isDragging
            ? 'border-[var(--ft-primary)] bg-[var(--ft-primary-soft)]'
            : 'border-[var(--ft-border)] bg-[var(--ft-surface-muted)]'
          }
          ${disabled
            ? 'cursor-not-allowed opacity-45'
            : 'cursor-pointer hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)]'
          }
        `.trim()}
      >
        <UploadIcon />
        <p className="text-center text-[12px] text-[var(--ft-text-muted)]">
          Arrastra un archivo o <span className="font-medium text-[var(--ft-primary)]">haz clic</span>
        </p>
        <p className="text-[11px] text-[var(--ft-text-subtle)]">
          {acceptedTypesDescription ?? `JPG, PNG, PDF, DOC, XLS — Máx ${maxSizeMB}MB`}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>
      {error && (
        <p className="mt-1 text-[12px] font-medium leading-[1.45] text-[var(--ft-danger)]">{error}</p>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
