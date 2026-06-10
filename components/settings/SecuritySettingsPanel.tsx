'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { RecordModal } from '@/components/ui/RecordModal'
import {
  SettingsBadge,
  SettingsPanel,
  SettingsRow,
  SettingsSubsection,
  settingsInputClassName,
} from '@/components/settings/primitives'
import { useToast } from '@/lib/toast/toast'

function IconLock({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  )
}

function IconMail({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m5 7 7 5 7-5" />
    </svg>
  )
}

function IconShield({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5.5 6v5.5c0 4.5 2.9 7.7 6.5 9.5 3.6-1.8 6.5-5 6.5-9.5V6z" />
    </svg>
  )
}

function IconLogOut({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H4.5" />
      <path d="M13 4h5a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-5" />
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

function IconAlertTriangle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 3.5 19h17Z" />
      <path d="M12 9v4.5" />
      <circle cx="12" cy="17.25" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  )
}

function getPasswordStrength(password: string): { score: number; label: string; tone: 'danger' | 'warning' | 'accent' | 'success' } {
  if (!password) return { score: 0, label: '', tone: 'danger' }

  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 1) return { score, label: 'Muy débil', tone: 'danger' }
  if (score === 2) return { score, label: 'Débil', tone: 'warning' }
  if (score === 3) return { score, label: 'Moderada', tone: 'accent' }
  return { score, label: score === 4 ? 'Fuerte' : 'Muy fuerte', tone: 'success' }
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  toggleLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  toggleLabel: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={settingsInputClassName('pr-11')}
      />
      <button
        type="button"
        onClick={() => setShow(current => !current)}
        aria-label={show ? `Ocultar ${toggleLabel}` : `Mostrar ${toggleLabel}`}
        aria-pressed={show}
        className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-[var(--c-text-faint)] transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text-muted)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-primary-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-surface)]"
      >
        <IconEye size={15} off={show} />
      </button>
    </div>
  )
}

interface SecuritySettingsPanelProps {
  email: string
}

export function SecuritySettingsPanel({ email }: SecuritySettingsPanelProps) {
  const { toast } = useToast()
  const router = useRouter()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const strength = getPasswordStrength(newPassword)

  const [sendingReset, setSendingReset] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)
  const [resetSent, setResetSent] = useState(false)

  const [signingOut, setSigningOut] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')

  useEffect(() => {
    if (resetCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResetCooldown(current => current - 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resetCooldown])

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (newPassword.length < 8) {
      toast.warning('Contraseña muy corta', 'Debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.')
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        toast.error('No se pudo cambiar la contraseña', data?.error?.message ?? 'Inténtalo de nuevo.')
        return
      }

      toast.success('Contraseña actualizada', 'Tu nueva contraseña ya está activa.')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSendReset = async () => {
    setSendingReset(true)
    try {
      const response = await fetch('/api/profile/send-reset-email', { method: 'POST' })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        toast.error('No se pudo enviar el correo', data?.error?.message ?? 'Inténtalo de nuevo.')
        return
      }

      toast.success('Correo enviado', `Revisa tu bandeja de entrada en ${email}.`)
      setResetSent(true)
      setResetCooldown(60)
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setSendingReset(false)
    }
  }

  const handleSignOutAll = useCallback(async () => {
    setSigningOut(true)
    try {
      const { createClient } = await import('@/lib/supabase.client')
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'global' })
      router.push('/login')
    } catch {
      toast.error('Error', 'No se pudo cerrar todas las sesiones.')
      setSigningOut(false)
    }
  }, [router, toast])

  const handleDeleteAccount = useCallback(async () => {
    if (deletingAccount) return

    setDeletingAccount(true)
    try {
      const response = await fetch('/api/profile', { method: 'DELETE' })

      if (response.status !== 204) {
        let message = 'No se pudo eliminar la cuenta.'
        try {
          const data = await response.json()
          message = data?.error?.message ?? message
        } catch {
          // noop
        }
        toast.error('No se pudo eliminar la cuenta', message)
        return
      }

      toast.success('Cuenta eliminada', 'Tu cuenta y la sesión actual fueron cerradas.')
      setShowDeleteModal(false)
      setDeleteConfirmEmail('')
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setDeletingAccount(false)
    }
  }, [deletingAccount, router, toast])

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword
  const passwordsMismatch = newPassword && confirmPassword && newPassword !== confirmPassword
  const normalizedEmail = email.trim().toLowerCase()
  const deleteConfirmed = deleteConfirmEmail.trim().toLowerCase() === normalizedEmail

  return (
    <>
      <SettingsPanel
        eyebrow="Acceso"
        title="Seguridad"
        description="Contraseña, recuperación y sesiones de tu cuenta."
        density="compact"
        className="mx-auto max-w-[860px]"
        action={<SettingsBadge tone="accent">Protección activa</SettingsBadge>}
      >
        <div className="space-y-4">
          <SettingsSubsection
            title="Cambiar contraseña"
            description="Usa una contraseña única y suficientemente larga para proteger tu acceso."
            density="compact"
          >
            <form onSubmit={handleChangePassword} className="space-y-4 py-1">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                    Nueva contraseña
                  </span>
                  <PasswordInput
                    id="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Mínimo 8 caracteres"
                    disabled={changingPassword}
                    toggleLabel="la nueva contraseña"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                    Confirmar contraseña
                  </span>
                  <PasswordInput
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Repite la nueva contraseña"
                    disabled={changingPassword}
                    toggleLabel="la confirmación de contraseña"
                  />
                </label>
              </div>

              {newPassword ? (
                <div className="rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-[var(--c-text)]">Fortaleza de la contraseña</p>
                    <SettingsBadge tone={strength.tone}>{strength.label}</SettingsBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map(index => (
                      <div
                        key={index}
                        className={`h-1.5 rounded-full ${
                          index <= strength.score
                            ? strength.tone === 'danger'
                              ? 'bg-[var(--c-danger)]'
                              : strength.tone === 'warning'
                                ? 'bg-[var(--c-warning)]'
                                : strength.tone === 'accent'
                                  ? 'bg-[var(--c-primary)]'
                                  : 'bg-[var(--c-success)]'
                            : 'bg-[var(--c-border)]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: 'Mínimo 8 caracteres', ok: newPassword.length >= 8 },
                      { label: 'Una mayúscula', ok: /[A-Z]/.test(newPassword) },
                      { label: 'Un número', ok: /[0-9]/.test(newPassword) },
                      { label: 'Un símbolo', ok: /[^A-Za-z0-9]/.test(newPassword) },
                    ].map(rule => (
                      <div key={rule.label} className="flex items-center gap-2 text-[12px] text-[var(--c-text-muted)]">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                            rule.ok
                              ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
                              : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-text-faint)]'
                          }`}
                        >
                          {rule.ok ? <IconCheck size={11} /> : null}
                        </span>
                        {rule.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {confirmPassword ? (
                <p
                  className={`text-[12px] ${
                    passwordsMatch ? 'text-[var(--c-success)]' : 'text-[var(--c-danger)]'
                  }`}
                >
                  {passwordsMatch ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.'}
                </p>
              ) : null}

              <Button
                type="submit"
                loading={changingPassword}
                disabled={!newPassword || !confirmPassword || !!passwordsMismatch}
              >
                Actualizar contraseña
              </Button>
            </form>
          </SettingsSubsection>

          <SettingsSubsection
            title="Recuperación y sesiones"
            description="Acciones rápidas para recuperar acceso o cerrar la cuenta en otros dispositivos."
            density="compact"
          >
            <SettingsRow
              variant="compact"
              icon={<IconMail size={15} />}
              title="Restablecer por correo"
              description={`Envía un enlace seguro a ${email}. Expira en 1 hora.`}
            >
              <div className="flex items-center gap-2">
                {resetSent ? <SettingsBadge tone="success">Correo enviado</SettingsBadge> : null}
                <Button
                  variant="secondary"
                  onClick={handleSendReset}
                  loading={sendingReset}
                  disabled={resetCooldown > 0}
                  size="sm"
                >
                  {resetCooldown > 0 ? `Reenviar en ${resetCooldown}s` : 'Enviar enlace'}
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow
              variant="compact"
              icon={<IconLogOut size={15} />}
              title="Sesiones activas"
              description="Cierra el acceso en todos los dispositivos si terminaste una sesión compartida."
            >
              <Button
                variant="secondary"
                onClick={handleSignOutAll}
                loading={signingOut}
                size="sm"
              >
                Cerrar todas las sesiones
              </Button>
            </SettingsRow>
          </SettingsSubsection>

          <SettingsSubsection
            title="Zona sensible"
            description="Estas acciones no se pueden deshacer."
            density="compact"
            action={<SettingsBadge tone="danger">Irreversible</SettingsBadge>}
            className="border-[color:rgba(184,74,74,0.18)]"
          >
            <SettingsRow
              variant="danger"
              icon={<IconAlertTriangle size={15} />}
              title="Eliminar cuenta"
              description="Se eliminarán permanentemente tu cuenta, movimientos, balances, configuraciones y datos asociados."
            >
              <Button
                variant="danger"
                onClick={() => setShowDeleteModal(true)}
                size="sm"
              >
                Eliminar mi cuenta
              </Button>
            </SettingsRow>
          </SettingsSubsection>
        </div>
      </SettingsPanel>

      <RecordModal
        open={showDeleteModal}
        onClose={() => {
          if (deletingAccount) return
          setShowDeleteModal(false)
          setDeleteConfirmEmail('')
        }}
        title="Confirma la eliminación de tu cuenta"
        subtitle="Para continuar, escribe tu correo exactamente como aparece abajo. Esta acción no se puede deshacer."
        eyebrow="Zona sensible"
        widthClassName="w-[calc(100vw-32px)] max-w-[640px]"
        bodyClassName="space-y-5"
        footer={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              disabled={deletingAccount}
              onClick={() => {
                setShowDeleteModal(false)
                setDeleteConfirmEmail('')
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!deleteConfirmed || deletingAccount}
              loading={deletingAccount}
              onClick={handleDeleteAccount}
            >
              Confirmar eliminación
            </Button>
          </div>
        )}
      >
        <div className="flex items-start gap-4 rounded-[20px] border border-[color:rgba(184,74,74,0.18)] bg-[var(--c-danger-soft)]/60 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:rgba(184,74,74,0.22)] bg-[var(--c-danger-soft)] text-[var(--c-danger)]">
            <IconAlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--c-text)]">Confirmación irreversible</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
              Esta acción eliminará permanentemente tu cuenta y toda la información asociada.
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
            Correo de confirmación
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--c-text)]">{email}</p>
        </div>

        <label className="block space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
            Escribe tu correo para continuar
          </span>
          <input
            value={deleteConfirmEmail}
            onChange={event => setDeleteConfirmEmail(event.target.value)}
            placeholder={email}
            className={settingsInputClassName()}
          />
        </label>
      </RecordModal>
    </>
  )
}
