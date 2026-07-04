'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import {
  SettingsBadge,
  SettingsPanel,
  SettingsRow,
  SettingsSubsection,
  settingsInputClassName,
} from '@/components/settings/primitives'
import { useToast } from '@/lib/toast/toast'
import {
  AVATAR_PRESETS,
  isAvatarPreset,
} from '@/lib/constants/avatar-presets'

type CurrencyCode = 'PEN' | 'USD'

interface ProfilePayload {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  default_currency: CurrencyCode
}

interface ProfileSettingsFormProps {
  initialProfile: ProfilePayload
  accountCount: number
  profilePreloadWarning?: SettingsPreloadWarning | null
  accountsPreloadWarning?: SettingsPreloadWarning | null
}

type SettingsPreloadWarning = {
  title: string
  message: string
}

type ApiSuccess<T> = { ok: true; data: T }
type ApiFailure = { ok: false; error: { message?: string } }
type ApiResult<T> = ApiSuccess<T> | ApiFailure

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

function createAlias(source: string): string {
  const alias = source
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')

  return alias.length > 0 ? alias : 'usuario'
}

function createInitials(source: string): string {
  const parts = source
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return 'FT'

  return parts
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  try {
    const body = await response.json()
    return body as ApiResult<T>
  } catch {
    return { ok: false, error: { message: 'Respuesta inválida del servidor' } }
  }
}

function PreloadWarningBox({ warning }: { warning: SettingsPreloadWarning }) {
  return (
    <div role="alert" className="rounded-[20px] border border-[color:rgba(169,120,47,0.28)] bg-[var(--c-warning-soft)]/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <SettingsBadge tone="warning">Carga incompleta</SettingsBadge>
        <p className="text-[13px] font-semibold text-[var(--c-text)]">{warning.title}</p>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-[var(--c-text-muted)]">
        {warning.message}
      </p>
    </div>
  )
}

export function ProfileSettingsForm({
  initialProfile,
  accountCount,
  profilePreloadWarning,
  accountsPreloadWarning,
}: ProfileSettingsFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(
    initialProfile.full_name ?? initialProfile.email.split('@')[0] ?? 'Usuario',
  )
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(
    initialProfile.default_currency ?? 'PEN',
  )
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile.avatar_url)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)

  const displayAvatarUrl = previewUrl ?? avatarUrl
  const alias = useMemo(() => createAlias(fullName), [fullName])
  const initials = useMemo(() => createInitials(fullName || initialProfile.email), [fullName, initialProfile.email])
  const selectedPreset = useMemo(
    () => (isAvatarPreset(avatarUrl) ? avatarUrl : null),
    [avatarUrl],
  )
  const profileLocked = Boolean(profilePreloadWarning)

  const showProfileLockedWarning = () => {
    toast.warning(
      'Carga incompleta',
      'Actualiza la pagina antes de guardar cambios de perfil para evitar usar datos temporales.',
    )
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (profileLocked) {
      showProfileLockedWarning()
      return
    }

    const cleanName = fullName.trim()
    if (cleanName.length < 2) {
      toast.warning('Nombre muy corto', 'Usa al menos 2 caracteres para el usuario visible.')
      return
    }

    setSavingProfile(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: cleanName,
          default_currency: defaultCurrency,
          avatar_url: avatarUrl,
        }),
      })

      const result = await parseResponse<ProfilePayload>(response)
      if (!response.ok || !result.ok) {
        const message = result.ok
          ? 'No se pudo guardar el perfil'
          : (result.error.message ?? 'No se pudo guardar el perfil')
        toast.error('No se pudo actualizar el perfil', message)
        return
      }

      setFullName(result.data.full_name ?? cleanName)
      setDefaultCurrency(result.data.default_currency)
      toast.success('Perfil actualizado', 'Tus cambios ya están activos en la app.')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('No se pudo actualizar el perfil', message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleOpenPicker = () => {
    if (profileLocked) {
      showProfileLockedWarning()
      return
    }
    if (uploadingAvatar || removingAvatar) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (profileLocked) {
      showProfileLockedWarning()
      event.target.value = ''
      return
    }

    const file = event.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato no permitido', 'Usa PNG, JPG, WEBP o GIF.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('Archivo muy pesado', 'La foto de perfil debe ser menor a 5 MB.')
      event.target.value = ''
      return
    }

    const tempUrl = URL.createObjectURL(file)
    setPreviewUrl(tempUrl)
    setUploadingAvatar(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })

      const result = await parseResponse<{ avatar_url: string | null }>(response)
      if (!response.ok || !result.ok) {
        const message = result.ok
          ? 'No se pudo subir la foto'
          : (result.error.message ?? 'No se pudo subir la foto')
        toast.error('No se pudo subir la foto', message)
        setPreviewUrl(null)
        return
      }

      setAvatarUrl(result.data.avatar_url)
      setPreviewUrl(null)
      toast.success('Foto actualizada', 'Tu foto de perfil se guardó correctamente.')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('No se pudo subir la foto', message)
      setPreviewUrl(null)
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (profileLocked) {
      showProfileLockedWarning()
      return
    }

    if (!avatarUrl || removingAvatar || uploadingAvatar) return

    setRemovingAvatar(true)
    try {
      const response = await fetch('/api/profile/avatar', { method: 'DELETE' })
      const result = await parseResponse<{ avatar_url: null }>(response)

      if (!response.ok || !result.ok) {
        const message = result.ok
          ? 'No se pudo eliminar la foto'
          : (result.error.message ?? 'No se pudo eliminar la foto')
        toast.error('No se pudo eliminar la foto', message)
        return
      }

      setAvatarUrl(null)
      setPreviewUrl(null)
      toast.success('Foto eliminada', 'Regresaste al avatar inicial.')
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error('No se pudo eliminar la foto', message)
    } finally {
      setRemovingAvatar(false)
    }
  }

  const handleSelectPreset = (preset: string) => {
    if (profileLocked) {
      showProfileLockedWarning()
      return
    }

    if (uploadingAvatar || removingAvatar) return
    setPreviewUrl(null)
    setAvatarUrl(preset)
  }

  return (
    <SettingsPanel
      eyebrow="Identidad"
      title="Perfil"
      description="Actualiza tu nombre y avatar. La moneda base se gestiona en Preferencias."
      density="compact"
      className="mx-auto max-w-[920px]"
      action={
        accountsPreloadWarning ? (
          <SettingsBadge tone="warning">Cuentas sin confirmar</SettingsBadge>
        ) : (
          <SettingsBadge tone="accent">
            {accountCount} cuenta{accountCount === 1 ? '' : 's'} activa{accountCount === 1 ? '' : 's'}
          </SettingsBadge>
        )
      }
    >
      <form onSubmit={handleSaveProfile} className="space-y-4">
        {profilePreloadWarning ? <PreloadWarningBox warning={profilePreloadWarning} /> : null}
        {accountsPreloadWarning ? <PreloadWarningBox warning={accountsPreloadWarning} /> : null}

        <section className="ft-profile-identity-card">
          <div className="ft-profile-identity-main">
            <div className="ft-profile-avatar-shell">
              <div className="ft-profile-avatar-frame">
                {displayAvatarUrl ? (
                  <Image
                    src={displayAvatarUrl}
                    alt="Foto de perfil"
                    width={88}
                    height={88}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="ft-profile-avatar-fallback">{initials}</span>
                )}
              </div>
              <span
                className={`ft-profile-avatar-status ${
                  avatarUrl || previewUrl ? 'is-active' : 'is-idle'
                }`}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="ft-profile-identity-name">{fullName.trim() || 'Usuario'}</p>
                <SettingsBadge tone={avatarUrl || previewUrl ? 'success' : 'warning'}>
                  {avatarUrl || previewUrl ? 'Avatar activo' : 'Sin foto'}
                </SettingsBadge>
              </div>
              <p className="ft-profile-identity-email">{initialProfile.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--c-text-muted)]">
                <span>@{alias}</span>
                <span>Moneda base: {defaultCurrency}</span>
                <span>PNG, JPG, WEBP o GIF hasta 5 MB.</span>
              </div>
            </div>

            <div className="ft-profile-identity-actions">
              <Button
                type="button"
                onClick={handleOpenPicker}
                loading={uploadingAvatar}
                disabled={profileLocked || removingAvatar}
                size="sm"
              >
                Cambiar foto
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRemoveAvatar}
                loading={removingAvatar}
                disabled={profileLocked || !avatarUrl || uploadingAvatar}
                size="sm"
              >
                Quitar
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarChange}
            disabled={profileLocked}
          />

          <details className="ft-profile-presets">
            <summary className="ft-profile-presets-summary">
              Elegir avatar sugerido
            </summary>
            <div className="ft-profile-presets-grid">
              {AVATAR_PRESETS.map((preset, index) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  disabled={profileLocked || uploadingAvatar || removingAvatar}
                  aria-label={`Seleccionar avatar sugerido ${index + 1}`}
                  aria-pressed={selectedPreset === preset}
                  className={`ft-profile-preset-button ${
                    selectedPreset === preset ? 'is-selected' : ''
                  }`}
                >
                  <Image
                    src={preset}
                    alt="Avatar sugerido"
                    width={52}
                    height={52}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </details>
        </section>

        <SettingsSubsection
          title="Datos visibles"
          description="Nombre y correo que identifican tu cuenta dentro de FinTrack."
          density="compact"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                Usuario visible
              </span>
              <input
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                maxLength={80}
                placeholder="Ej. Elías P."
                className={settingsInputClassName()}
              />
              <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
                Este nombre aparece en navegación, dashboard y registros internos.
              </p>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                Correo
              </span>
              <input
                value={initialProfile.email}
                readOnly
                className={settingsInputClassName('bg-[var(--c-surface-2)] text-[var(--c-text-muted)]')}
              />
            </label>
          </div>
        </SettingsSubsection>

        <SettingsSubsection
          title="Configuración financiera"
          description="La moneda base vive en Preferencias para evitar duplicación dentro de tu cuenta."
          density="compact"
        >
          <SettingsRow
            variant="compact"
            title="Moneda base"
            description="Se usa en reportes y vistas consolidadas."
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--c-text)]">
                {defaultCurrency}
              </span>
              <Button
                href="/settings?tab=preferences"
                variant="ghost"
                size="sm"
              >
                Cambiar en Preferencias
              </Button>
            </div>
          </SettingsRow>
        </SettingsSubsection>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="submit"
            loading={savingProfile}
            disabled={profileLocked || uploadingAvatar || removingAvatar}
          >
            Guardar cambios
          </Button>
          <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
            Los cambios se reflejan inmediatamente en toda la app.
          </p>
        </div>
      </form>
    </SettingsPanel>
  )
}
