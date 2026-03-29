'use client'

import Image from 'next/image'
import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/toast/toast'
import {
  AVATAR_PRESETS,
  isAvatarPreset,
  resolveUserAvatar,
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

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  try {
    const body = await response.json()
    return body as ApiResult<T>
  } catch {
    return { ok: false, error: { message: 'Respuesta inválida del servidor' } }
  }
}

export function ProfileSettingsForm({ initialProfile, accountCount }: ProfileSettingsFormProps) {
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

  const displayAvatarUrl = previewUrl ?? resolveUserAvatar(
    avatarUrl,
    initialProfile.id || initialProfile.email
  )
  const alias = useMemo(() => createAlias(fullName), [fullName])
  const selectedPreset = useMemo(
    () => (isAvatarPreset(avatarUrl) ? avatarUrl : null),
    [avatarUrl]
  )

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

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
        const message = result.ok ? 'No se pudo guardar el perfil' : (result.error.message ?? 'No se pudo guardar el perfil')
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
    if (uploadingAvatar || removingAvatar) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        const message = result.ok ? 'No se pudo subir la foto' : (result.error.message ?? 'No se pudo subir la foto')
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
    if (!avatarUrl || removingAvatar || uploadingAvatar) return

    setRemovingAvatar(true)
    try {
      const response = await fetch('/api/profile/avatar', { method: 'DELETE' })
      const result = await parseResponse<{ avatar_url: null }>(response)

      if (!response.ok || !result.ok) {
        const message = result.ok ? 'No se pudo eliminar la foto' : (result.error.message ?? 'No se pudo eliminar la foto')
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
    if (uploadingAvatar || removingAvatar) return
    setPreviewUrl(null)
    setAvatarUrl(preset)
  }

  return (
    <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            Perfil y cuenta
          </h2>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
            Personaliza tu usuario visible, moneda principal y foto de perfil.
          </p>
        </div>
        <span className="inline-flex items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
          {accountCount} cuenta{accountCount === 1 ? '' : 's'} activa{accountCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[linear-gradient(155deg,rgba(16,185,129,0.2),rgba(59,130,246,0.12),rgba(15,23,42,0.72))] p-4">
          <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--color-text-muted)]">Avatar</p>

          <div className="mt-3 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-[color:var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center">
              <Image
                src={displayAvatarUrl}
                alt="Foto de perfil"
                width={96}
                height={96}
                unoptimized
                className="w-full h-full object-cover"
              />
            </div>

            <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">@{alias}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Se mostrará en panel, menú y perfil.</p>
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={handleOpenPicker}
              disabled={uploadingAvatar || removingAvatar}
              className="w-full inline-flex items-center justify-center rounded-xl px-3 py-2
                bg-emerald-500 text-black text-[12px] font-semibold hover:bg-emerald-400
                disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingAvatar ? 'Subiendo foto...' : 'Subir foto'}
            </button>

            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={!avatarUrl || removingAvatar || uploadingAvatar}
              className="w-full inline-flex items-center justify-center rounded-xl px-3 py-2
                border border-[color:var(--color-border)] text-[var(--color-text-muted)] text-[12px] font-semibold
                hover:border-[color:var(--color-border-hover)] hover:text-[var(--color-text)] transition-colors
                disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {removingAvatar ? 'Eliminando...' : 'Quitar foto'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              Avatares sugeridos
            </p>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`relative h-12 w-12 overflow-hidden rounded-lg border transition-colors ${
                    selectedPreset === preset
                      ? 'border-emerald-300 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]'
                      : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)]'
                  }`}
                  title="Seleccionar avatar"
                >
                  <Image
                    src={preset}
                    alt="Avatar sugerido"
                    width={48}
                    height={48}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[10px] text-[var(--color-text-muted)] leading-relaxed">
            Formatos: PNG, JPG, WEBP o GIF. Máximo 5 MB.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Usuario visible
              </span>
              <input
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                maxLength={80}
                placeholder="Ej. Elías P."
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-emerald-400/45"
              />
              <p className="text-[11px] text-[var(--color-text-faint)]">
                Este nombre aparece en el dashboard y menú de usuario.
              </p>
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Correo
              </span>
              <input
                value={initialProfile.email}
                readOnly
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text-muted)] cursor-not-allowed"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Moneda por defecto
              </span>
              <select
                value={defaultCurrency}
                onChange={event => setDefaultCurrency(event.target.value as CurrencyCode)}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-emerald-400/45"
              >
                <option value="PEN">PEN (S/)</option>
                <option value="USD">USD ($)</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">Alias sugerido</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">@{alias}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={savingProfile || uploadingAvatar || removingAvatar}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5
                bg-emerald-500 text-black text-[13px] font-bold hover:bg-emerald-400
                disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Los cambios se reflejan inmediatamente en toda la app.
            </span>
          </div>
        </form>
      </div>
    </section>
  )
}
