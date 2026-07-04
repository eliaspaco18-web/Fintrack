'use client'

import { useState } from 'react'
import { AppSelect } from '@/components/ui/AppSelect'
import { Button } from '@/components/ui/Button'
import {
  SettingsBadge,
  SettingsPanel,
  SettingsRow,
  SettingsSubsection,
  SettingsToggle,
} from '@/components/settings/primitives'
import { useTheme } from '@/lib/hooks/useTheme'
import { useToast } from '@/lib/toast/toast'

function IconSun({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </svg>
  )
}

function IconMoon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5 7 7 0 0 0 20.5 14.5Z" />
    </svg>
  )
}

function IconGlobe({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z" />
    </svg>
  )
}

function IconEye({ size = 16, off = false }: { size?: number; off?: boolean }) {
  if (off) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c7 0 10 8 10 8a16.4 16.4 0 0 1-4.1 4.8" />
        <path d="M6 6.3A17.2 17.2 0 0 0 2 12s3 8 10 8a9.8 9.8 0 0 0 3.1-.5" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconDollarSign({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M16.5 6.5H9.75a3.25 3.25 0 0 0 0 6.5h4.5a3.25 3.25 0 0 1 0 6.5H7.5" />
    </svg>
  )
}

interface PreferencesPanelProps {
  initialTheme: 'dark' | 'light'
  initialCurrency: 'PEN' | 'USD'
  initialPrivateMode: boolean
  profilePreloadWarning?: SettingsPreloadWarning | null
}

type SettingsPreloadWarning = {
  title: string
  message: string
}

const TIMEZONES = [
  { value: 'America/Lima', label: 'Lima, Perú (PET -5)' },
  { value: 'America/Bogota', label: 'Bogotá, Colombia (COT -5)' },
  { value: 'America/Santiago', label: 'Santiago, Chile (CLT)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (CST -6)' },
  { value: 'America/New_York', label: 'Nueva York (ET)' },
  { value: 'Europe/Madrid', label: 'Madrid, España (CET)' },
  { value: 'UTC', label: 'UTC (Tiempo Universal)' },
]

export function PreferencesPanel({
  initialTheme,
  initialCurrency,
  initialPrivateMode,
  profilePreloadWarning,
}: PreferencesPanelProps) {
  const { toast } = useToast()
  const { theme, mounted, setTheme } = useTheme()

  const effectiveTheme = mounted ? theme : initialTheme
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(initialCurrency)
  const [privateMode, setPrivateMode] = useState(initialPrivateMode)
  const [timezone] = useState('America/Lima')
  const [saving, setSaving] = useState(false)
  const profileLocked = Boolean(profilePreloadWarning)

  const handleThemeChange = (nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme)
  }

  const handleSave = async () => {
    if (profileLocked) {
      toast.warning(
        'Carga incompleta',
        'Actualiza la pagina antes de guardar la moneda base para evitar usar datos temporales.',
      )
      return
    }

    setSaving(true)
    try {
      const profileResponse = await fetch('/api/profile')
      const profileData = await profileResponse.json()
      const fullName =
        profileData?.data?.full_name ??
        profileData?.data?.email?.split('@')[0] ??
        'Usuario'

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          default_currency: currency,
        }),
      })

      if (!response.ok) {
        toast.error('Error', 'No se pudieron guardar las preferencias.')
        return
      }

      toast.success('Preferencias guardadas', 'Tus cambios están activos.')
    } catch {
      toast.error('Error', 'No se pudieron guardar las preferencias.')
    } finally {
      setSaving(false)
    }
  }

  const currentTimezoneLabel =
    TIMEZONES.find(option => option.value === timezone)?.label ?? timezone

  return (
    <SettingsPanel
      eyebrow="Experiencia"
      title="Preferencias"
      description="Apariencia, privacidad y región se ordenan por impacto real en tu trabajo diario."
      density="compact"
      className="mx-auto max-w-[860px]"
      action={<SettingsBadge tone="accent">Tema {effectiveTheme === 'dark' ? 'oscuro' : 'claro'}</SettingsBadge>}
    >
      <div className="space-y-4">
        {profilePreloadWarning ? (
          <div role="alert" className="rounded-[20px] border border-[color:rgba(169,120,47,0.28)] bg-[var(--c-warning-soft)]/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <SettingsBadge tone="warning">Carga incompleta</SettingsBadge>
              <p className="text-[13px] font-semibold text-[var(--c-text)]">{profilePreloadWarning.title}</p>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[var(--c-text-muted)]">
              {profilePreloadWarning.message}
            </p>
          </div>
        ) : null}

        <SettingsSubsection
          title="Apariencia"
          description="El tema se aplica al instante y se mantiene en tu dispositivo."
          density="compact"
        >
          <div
            role="group"
            aria-label="Tema de la interfaz"
            className="grid gap-2 sm:grid-cols-2"
          >
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              aria-pressed={effectiveTheme === 'dark'}
              className={`flex min-h-[76px] items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99] ${
                effectiveTheme === 'dark'
                  ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] shadow-[0_0_0_3px_rgba(13,107,94,0.12)]'
                  : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-2)]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-[#151514] text-white">
                  <IconMoon size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--c-text)]">Oscuro</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                    Más enfoque para sesiones largas.
                  </p>
                </div>
              </div>
              {effectiveTheme === 'dark' ? <SettingsBadge tone="accent">Activo</SettingsBadge> : null}
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              aria-pressed={effectiveTheme === 'light'}
              className={`flex min-h-[76px] items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99] ${
                effectiveTheme === 'light'
                  ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] shadow-[0_0_0_3px_rgba(13,107,94,0.12)]'
                  : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:border-[var(--c-border-hover)] hover:bg-[var(--c-surface-2)]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text)]">
                  <IconSun size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--c-text)]">Claro</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
                    Más aire visual para revisión rápida.
                  </p>
                </div>
              </div>
              {effectiveTheme === 'light' ? <SettingsBadge tone="accent">Activo</SettingsBadge> : null}
            </button>
          </div>
        </SettingsSubsection>

        <SettingsSubsection
          title="Privacidad"
          description="Oculta montos cuando compartes pantalla o trabajas en espacios públicos."
          density="compact"
          action={<SettingsBadge tone="warning">Temporal</SettingsBadge>}
          className="border-[color:rgba(169,120,47,0.16)]"
        >
          <SettingsRow
            icon={<IconEye size={15} off={privateMode} />}
            title="Modo privado"
            description="Este cambio solo afecta la vista actual y no se guarda en tu cuenta desde esta pantalla."
            variant="compact"
          >
            <SettingsToggle
              checked={privateMode}
              onChange={setPrivateMode}
              ariaLabel="Alternar modo privado"
            />
          </SettingsRow>
        </SettingsSubsection>

        <SettingsSubsection
          title="Región financiera"
          description="La moneda base se guarda en tu cuenta. La zona horaria se muestra como referencia de contexto."
          density="compact"
          action={<SettingsBadge tone="accent">Persistente</SettingsBadge>}
        >
          <div className="space-y-3">
            <SettingsRow
              icon={<IconDollarSign size={15} />}
              title="Moneda base"
              description="Usada por defecto en reportes y vistas consolidadas."
              variant="compact"
            >
              <AppSelect
                value={currency}
                onChange={value => setCurrency(value as 'PEN' | 'USD')}
                ariaLabel="Seleccionar moneda base"
                compact
                disabled={profileLocked}
                searchable={false}
                options={[
                  { value: 'PEN', label: 'S/ (PEN)' },
                  { value: 'USD', label: '$ (USD)' },
                ]}
              />
            </SettingsRow>

            <SettingsRow
              icon={<IconGlobe size={15} />}
              title="Zona horaria"
              description="Todavía no se guarda en la cuenta desde esta pantalla."
              variant="compact"
            >
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-right text-[13px] font-medium text-[var(--c-text-muted)]">
                  {currentTimezoneLabel}
                </span>
                <SettingsBadge tone="neutral">Referencia</SettingsBadge>
              </div>
            </SettingsRow>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--c-border)] pt-4">
            <p className="text-[12px] leading-5 text-[var(--c-text-muted)]">
              El tema se aplica al instante. Aquí solo guardas datos persistentes de tu cuenta.
            </p>
            <Button onClick={handleSave} loading={saving} disabled={profileLocked}>
              Guardar moneda base
            </Button>
          </div>
        </SettingsSubsection>
      </div>
    </SettingsPanel>
  )
}
