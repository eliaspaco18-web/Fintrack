'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getFileNameFromPath, validateFile } from '@/lib/utils/file-upload'
import {
  clamp,
  createDefaultIconEditorState,
  ICON_SAFE_SCALE,
  loadIconImageAsset,
  renderIconFile,
  type IconEditorState,
  type IconImageAsset,
} from '@/lib/utils/image-icon'

interface IconImageUploadProps {
  value?: File | null
  existingUrl?: string | null
  onChange: (file: File | null) => void
  onRemoveExisting?: () => void
  maxSizeMB?: number
  label?: string
  id?: string
  disabled?: boolean
  allowedMimeTypes?: readonly string[]
  accept?: string
  acceptedTypesDescription?: string
}

const FRAME_SIZE = 232
const CROP_SIZE = 184
const CROP_MARGIN = (FRAME_SIZE - CROP_SIZE) / 2

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function RotateLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v6h6" />
      <path d="M3 8a9 9 0 1 0 2.64-3.97L3 8" />
    </svg>
  )
}

function RotateRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M21 8a9 9 0 1 1-2.64-3.97L21 8" />
    </svg>
  )
}

function CenterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <circle cx="12" cy="12" r="3" />
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

export function IconImageUpload({
  value,
  existingUrl,
  onChange,
  onRemoveExisting,
  maxSizeMB = 10,
  label = 'Icono personalizado (opcional)',
  id,
  disabled = false,
  allowedMimeTypes,
  accept = '.jpg,.jpeg,.png,.webp,.gif',
  acceptedTypesDescription,
}: IconImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const assetUrlRef = useRef<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [asset, setAsset] = useState<IconImageAsset | null>(null)
  const [editor, setEditor] = useState<IconEditorState>(createDefaultIconEditorState())

  useEffect(() => {
    return () => {
      if (assetUrlRef.current) URL.revokeObjectURL(assetUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (!asset) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void renderIconFile({ asset, editor, frameSize: CROP_SIZE })
        .then(file => {
          if (!cancelled) onChange(file)
        })
        .catch(caught => {
          if (!cancelled) {
            setError(caught instanceof Error ? caught.message : 'No se pudo preparar el icono.')
          }
        })
    }, 90)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [asset, editor, onChange])

  const baseDimensions = useMemo(() => {
    if (!asset) return null
    const scale = Math.min(CROP_SIZE / asset.width, CROP_SIZE / asset.height)
    return {
      width: asset.width * scale * ICON_SAFE_SCALE,
      height: asset.height * scale * ICON_SAFE_SCALE,
    }
  }, [asset])

  const handleFileSelection = useCallback(async (file: File) => {
    const validation = validateFile(file, maxSizeMB, allowedMimeTypes)
    if (!validation.valid) {
      setError(validation.error ?? 'Archivo inválido')
      return
    }

    try {
      if (assetUrlRef.current) URL.revokeObjectURL(assetUrlRef.current)
      const nextAsset = await loadIconImageAsset(file)
      assetUrlRef.current = nextAsset.url
      setAsset(nextAsset)
      setEditor(createDefaultIconEditorState())
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la imagen.')
    }
  }, [allowedMimeTypes, maxSizeMB])

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void handleFileSelection(file)
    if (inputRef.current) inputRef.current.value = ''
  }, [handleFileSelection])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = event.dataTransfer.files?.[0]
    if (file) void handleFileSelection(file)
  }, [disabled, handleFileSelection])

  const handleRemoveSelected = useCallback(() => {
    setAsset(null)
    setEditor(createDefaultIconEditorState())
    setError(null)
    onChange(null)
  }, [onChange])

  const applyRotationStep = useCallback((step: number) => {
    setEditor(prev => ({
      ...prev,
      rotation: prev.rotation + step,
    }))
  }, [])

  const resetFraming = useCallback(() => {
    setEditor(createDefaultIconEditorState())
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!asset || disabled) return
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: editor.offsetX,
      offsetY: editor.offsetY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [asset, disabled, editor.offsetX, editor.offsetY])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    const start = dragStartRef.current
    setEditor(prev => ({
      ...prev,
      offsetX: start.offsetX + (event.clientX - start.x),
      offsetY: start.offsetY + (event.clientY - start.y),
    }))
  }, [])

  const clearDrag = useCallback(() => {
    dragStartRef.current = null
  }, [])

  return (
    <div id={id} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-muted)]">
          {label}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          leadingIcon={<UploadIcon />}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {asset || existingUrl ? 'Reemplazar' : 'Seleccionar'}
        </Button>
      </div>

      {!asset && existingUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[var(--c-border)] bg-white/70">
            <Image src={existingUrl} alt="Icono actual" width={32} height={32} unoptimized className="h-8 w-8 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[var(--c-text)]">Icono actual</p>
            <p className="truncate text-[11px] text-[var(--c-text-muted)]">{getFileNameFromPath(existingUrl)}</p>
          </div>
          {onRemoveExisting ? (
            <button
              type="button"
              onClick={onRemoveExisting}
              className="rounded-md p-1 text-[var(--c-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
              aria-label="Eliminar icono actual"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      ) : null}

      {!asset ? (
        <div
          onDragOver={event => {
            event.preventDefault()
            if (!disabled) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-all duration-150',
            isDragging
              ? 'border-[var(--c-primary)] bg-[var(--c-primary-soft)]/60'
              : 'border-[var(--c-border)] bg-[var(--c-surface-2)] hover:border-[var(--c-border-hover)]',
            disabled ? 'cursor-not-allowed opacity-50' : '',
          ].join(' ')}
        >
          <UploadIcon />
          <p className="text-center text-[12px] text-[var(--c-text-muted)]">
            Arrastra una imagen o haz clic para elegirla
          </p>
          <p className="text-[10px] text-[var(--c-text-faint)]">
            {acceptedTypesDescription ?? `JPG, PNG, WEBP o GIF, máx ${maxSizeMB}MB`}
          </p>
        </div>
      ) : null}

      {asset && baseDimensions ? (
        <div className="rounded-xl border border-[var(--c-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,248,246,0.96))] p-4">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div
                className="relative max-w-full overflow-hidden rounded-[24px] border border-[rgba(17,24,39,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,247,245,0.98))] shadow-[0_14px_36px_rgba(31,41,55,0.08)]"
                style={{ width: FRAME_SIZE, height: FRAME_SIZE, aspectRatio: '1 / 1' }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div
                  role="presentation"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={clearDrag}
                  onPointerCancel={clearDrag}
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                >
                  <div className="absolute inset-0 grid place-items-center">
                    <Image
                      src={asset.url}
                      alt="Vista previa del icono"
                      width={Math.round(baseDimensions.width)}
                      height={Math.round(baseDimensions.height)}
                      unoptimized
                      draggable={false}
                      className="select-none object-contain"
                      style={{
                        width: `${baseDimensions.width}px`,
                        height: `${baseDimensions.height}px`,
                        transform: `translate3d(${editor.offsetX}px, ${editor.offsetY}px, 0) scale(${editor.zoom / 100}) rotate(${editor.rotation}deg)`,
                        transformOrigin: 'center center',
                        willChange: 'transform',
                      }}
                    />
                  </div>
                </div>
                <div className="pointer-events-none absolute left-0 right-0 top-0 bg-[rgba(17,24,39,0.38)]" style={{ height: CROP_MARGIN }} />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-[rgba(17,24,39,0.38)]" style={{ height: CROP_MARGIN }} />
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 bg-[rgba(17,24,39,0.38)]" style={{ width: CROP_MARGIN }} />
                <div className="pointer-events-none absolute bottom-0 right-0 top-0 bg-[rgba(17,24,39,0.38)]" style={{ width: CROP_MARGIN }} />
                <div
                  className="pointer-events-none absolute rounded-[18px] border border-white/90 shadow-[0_0_0_1px_rgba(15,23,42,0.18),0_12px_32px_rgba(15,23,42,0.12),inset_0_0_0_1px_rgba(15,23,42,0.08)]"
                  style={{
                    left: CROP_MARGIN,
                    top: CROP_MARGIN,
                    width: CROP_SIZE,
                    height: CROP_SIZE,
                  }}
                />
                <div
                  className="pointer-events-none absolute rounded-[18px]"
                  style={{
                    left: CROP_MARGIN,
                    top: CROP_MARGIN,
                    width: CROP_SIZE,
                    height: CROP_SIZE,
                    backgroundImage:
                      'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div
                  className="pointer-events-none absolute h-full w-px -translate-x-1/2 bg-[rgba(15,23,42,0.12)]"
                  style={{
                    left: FRAME_SIZE / 2,
                    top: CROP_MARGIN,
                    height: CROP_SIZE,
                  }}
                />
                <div
                  className="pointer-events-none absolute h-px w-full -translate-y-1/2 bg-[rgba(15,23,42,0.12)]"
                  style={{
                    top: FRAME_SIZE / 2,
                    left: CROP_MARGIN,
                    width: CROP_SIZE,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" size="sm" variant="secondary" leadingIcon={<RotateLeftIcon />} onClick={() => applyRotationStep(-90)}>
                  Girar -90°
                </Button>
                <Button type="button" size="sm" variant="secondary" leadingIcon={<RotateRightIcon />} onClick={() => applyRotationStep(90)}>
                  Girar +90°
                </Button>
                <Button type="button" size="sm" variant="ghost" leadingIcon={<CenterIcon />} onClick={resetFraming}>
                  Recentrar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleRemoveSelected}>
                  Quitar
                </Button>
              </div>

            <div className="grid gap-3 md:grid-cols-2">
                <RangeField
                  label="Zoom"
                  value={`${Math.round(editor.zoom)}%`}
                  min={60}
                  max={220}
                  step={1}
                  currentValue={editor.zoom}
                  onChange={next => setEditor(prev => ({ ...prev, zoom: clamp(next, 60, 220) }))}
                />
                <RangeField
                  label="Rotación"
                  value={`${Math.round(editor.rotation)}°`}
                  min={-180}
                  max={180}
                  step={1}
                  currentValue={editor.rotation}
                  onChange={next => setEditor(prev => ({ ...prev, rotation: clamp(next, -180, 180) }))}
                />
              </div>

          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-red-500">{error}</p>
      ) : null}

      {!asset && !existingUrl && value ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-[var(--c-text-muted)]">
          Icono listo para guardar.
        </div>
      ) : null}
    </div>
  )
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  currentValue,
  onChange,
}: {
  label: string
  value: string
  min: number
  max: number
  step: number
  currentValue: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-[12px] font-medium text-[var(--c-text)]">
        <span>{label}</span>
        <span className="text-[11px] text-[var(--c-text-muted)]">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={event => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--c-border)] accent-[var(--c-primary)]"
      />
    </label>
  )
}
