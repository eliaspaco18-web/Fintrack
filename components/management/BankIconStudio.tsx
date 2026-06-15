'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconImageUpload } from '@/components/ui/IconImageUpload'
import { ModuleHeader, PageLayout, StatusBadge } from '@/components/finance'
import { DeveloperEnvironmentBanner } from '@/components/developer/DeveloperEnvironmentBanner'
import { BANK_ENTITY_LOGO_PRESETS, type VisualIconOption } from '@/lib/constants/visual-options'
import { ATTACHMENT_IMAGE_MIME_TYPES } from '@/lib/utils/file-upload'

const NEW_BANK_VALUE = '__new_bank__'

function cacheBust(src: string, version: number) {
  return `${src}?v=${version}`
}

function normalizeBankName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function BankIconStudio() {
  const [presets, setPresets] = useState<readonly VisualIconOption[]>(BANK_ENTITY_LOGO_PRESETS)
  const [selectedValue, setSelectedValue] = useState(BANK_ENTITY_LOGO_PRESETS[0]?.value ?? NEW_BANK_VALUE)
  const [bankName, setBankName] = useState(BANK_ENTITY_LOGO_PRESETS[0]?.label ?? '')
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [assetVersion, setAssetVersion] = useState(Date.now())
  const [editorKey, setEditorKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedPreset = useMemo(() => (
    presets.find(option => option.value === selectedValue) ?? null
  ), [presets, selectedValue])

  const isCreating = selectedValue === NEW_BANK_VALUE
  const normalizedBankName = normalizeBankName(bankName)
  const nameChanged = Boolean(selectedPreset && normalizedBankName !== selectedPreset.label)
  const hasPendingChanges = Boolean(iconFile || nameChanged || isCreating)
  const canSave = isCreating
    ? normalizedBankName.length >= 2 && Boolean(iconFile)
    : normalizedBankName.length >= 2 && Boolean(iconFile || nameChanged)
  const currentImageSrc = !isCreating && selectedPreset?.imageSrc
    ? cacheBust(selectedPreset.imageSrc, assetVersion)
    : null

  const loadPresets = useCallback(async () => {
    const response = await fetch('/api/dev/bank-icons', { cache: 'no-store' })
    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload?.ok || !Array.isArray(payload.presets)) {
      throw new Error(payload?.error ?? 'No se pudieron cargar los bancos predefinidos.')
    }

    return payload.presets as VisualIconOption[]
  }, [])

  useEffect(() => {
    let cancelled = false

    void loadPresets()
      .then(nextPresets => {
        if (cancelled) return
        setPresets(nextPresets)
        setSelectedValue(current => {
          if (current === NEW_BANK_VALUE) return current
          return nextPresets.some(preset => preset.value === current)
            ? current
            : nextPresets[0]?.value ?? NEW_BANK_VALUE
        })
      })
      .catch(caught => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los bancos predefinidos.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadPresets])

  useEffect(() => {
    if (isCreating) {
      setBankName('')
      return
    }

    if (selectedPreset) {
      setBankName(selectedPreset.label)
    }
  }, [isCreating, selectedPreset])

  async function handleSave() {
    if (!canSave) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('value', isCreating ? '' : selectedPreset?.value ?? '')
      formData.append('label', normalizedBankName)
      if (iconFile) {
        formData.append('file', iconFile, `${selectedPreset?.value ?? normalizedBankName}.png`)
      }

      const response = await fetch('/api/dev/bank-icons', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'No se pudo guardar el banco predefinido.')
      }

      const nextVersion = Date.now()
      if (Array.isArray(payload.presets)) {
        setPresets(payload.presets)
      }
      if (payload.preset?.value) {
        setSelectedValue(payload.preset.value)
        setBankName(payload.preset.label ?? normalizedBankName)
      }
      setAssetVersion(nextVersion)
      setEditorKey(prev => prev + 1)
      setIconFile(null)
      setSuccess(isCreating
        ? `Banco creado: ${payload.preset?.label ?? normalizedBankName}`
        : `Banco actualizado: ${payload.preset?.label ?? normalizedBankName}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el banco predefinido.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageLayout
      className="developer-page max-w-[980px] gap-5"
      header={(
        <ModuleHeader
          eyebrow="Admin local"
          title="Editor de bancos predefinidos"
          description="Crea bancos, cambia su nombre visible y guarda el PNG ajustado como logo oficial incluido en la app."
          actions={(
            <>
              <Button href="/developer" variant="secondary" size="md">Volver a Developer</Button>
              <Button href="/admin" variant="ghost" size="md">Ver bancos</Button>
            </>
          )}
        />
      )}
    >
      <DeveloperEnvironmentBanner />

      <section className="overflow-hidden rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-[0_1px_2px_rgba(25,25,23,0.04)]">
        <div className="border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[var(--c-text)]">Preparar logo del sistema</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                Los cambios actualizan el manifiesto de bancos y los archivos usados por el selector de logos.
              </p>
            </div>
            <StatusBadge tone={hasPendingChanges ? 'warning' : 'muted'}>
              {hasPendingChanges ? 'Cambios sin guardar' : 'Sin cambios'}
            </StatusBadge>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
                Banco
              </span>
              <select
                value={selectedValue}
                onChange={event => {
                  setSelectedValue(event.target.value)
                  setEditorKey(prev => prev + 1)
                  setIconFile(null)
                  setError(null)
                  setSuccess(null)
                }}
                className="field-base ft-form-input h-10 w-full rounded-[var(--ft-radius-control)]"
              >
                <option value={NEW_BANK_VALUE}>+ Crear nuevo banco</option>
                {presets.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
                Nombre visible
              </span>
              <input
                type="text"
                value={bankName}
                onChange={event => {
                  setBankName(event.target.value)
                  setError(null)
                  setSuccess(null)
                }}
                maxLength={56}
                placeholder="Ej. Banco Pichincha"
                className="field-base ft-form-input h-10 w-full rounded-[var(--ft-radius-control)]"
              />
              <p className="text-[11px] leading-5 text-[var(--c-text-muted)]">
                Este nombre aparecerá en el selector de logos predefinidos.
              </p>
            </label>

            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--c-text-muted)]">
                Logo actual
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[var(--c-border)] bg-white/80 shadow-[0_1px_2px_rgba(25,25,23,0.04)]">
                  {currentImageSrc ? (
                    <Image
                      src={currentImageSrc}
                      alt={`Logo actual de ${selectedPreset?.label ?? 'banco'}`}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-text-faint)]">
                      Nuevo
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--c-text)]">
                    {isCreating ? (normalizedBankName || 'Banco nuevo') : selectedPreset?.label ?? 'Banco'}
                  </p>
                  <p className="truncate text-[11px] text-[var(--c-text-muted)]">
                    {isCreating ? 'Se creará un PNG nuevo al guardar' : selectedPreset?.imageSrc ?? 'Sin archivo'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(13,107,94,0.16)] bg-[var(--c-primary-soft)] px-4 py-3">
              <p className="text-[12px] font-medium text-[var(--c-primary)]">Uso pensado</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--c-text-muted)]">
                Crea y ajusta aquí los bancos oficiales antes de publicar una nueva versión.
              </p>
            </div>
          </aside>

          <div className="space-y-4">
            <IconImageUpload
              key={`${selectedValue}-${editorKey}`}
              value={iconFile}
              existingUrl={currentImageSrc}
              onChange={setIconFile}
              label="Nuevo logo ajustado"
              allowedMimeTypes={ATTACHMENT_IMAGE_MIME_TYPES}
              accept=".jpg,.jpeg,.png,.webp,.gif"
              acceptedTypesDescription="JPG, PNG, WEBP o GIF — el editor guardará PNG cuadrado"
            />

            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-600">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-700">
                {success}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--c-border)] pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setEditorKey(prev => prev + 1)
                  setIconFile(null)
                  setBankName(isCreating ? '' : selectedPreset?.label ?? '')
                  setError(null)
                  setSuccess(null)
                }}
                disabled={saving || !hasPendingChanges}
              >
                Descartar cambios
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={saving}
                disabled={!canSave}
                onClick={() => void handleSave()}
              >
                {isCreating ? 'Crear banco predefinido' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
