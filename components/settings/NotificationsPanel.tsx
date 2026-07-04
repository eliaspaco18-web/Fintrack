'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  SettingsBadge,
  SettingsPanel,
  SettingsRow,
  SettingsSubsection,
  SettingsToggle,
} from '@/components/settings/primitives'
import { useToast } from '@/lib/toast/toast'

type NotifPrefs = {
  overdueInstallments: boolean
  overdueReceivables: boolean
  overduePayables: boolean
  unusualActivity: boolean
  budgetAlerts: boolean
  weeklySummary: boolean
  newTransaction: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  overdueInstallments: true,
  overdueReceivables: true,
  overduePayables: true,
  unusualActivity: true,
  budgetAlerts: false,
  weeklySummary: false,
  newTransaction: false,
}

function IconCreditCard({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
    </svg>
  )
}

function IconTrendingUp({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16 10 10l4 4 6-6" />
      <path d="M15 8h5v5" />
    </svg>
  )
}

function IconAlertOctagon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" />
      <path d="M12 8v4.5" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconCalendar({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function IconPieChart({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 3a9 9 0 1 0 9 9h-9z" />
      <path d="M13 3a8 8 0 0 1 8 8h-8z" />
    </svg>
  )
}

function IconMail({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m5 7 7 5 7-5" />
    </svg>
  )
}

function IconDollarSign({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M16.5 6.5H9.75a3.25 3.25 0 0 0 0 6.5h4.5a3.25 3.25 0 0 1 0 6.5H7.5" />
    </svg>
  )
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-4 border-b border-[var(--c-border)] py-3.5 last:border-b-0">
      <div className="h-9 w-9 rounded-[14px] bg-[var(--c-border)]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 rounded-full bg-[var(--c-border)]" />
        <div className="h-2 w-3/5 rounded-full bg-[var(--c-border)]" />
      </div>
      <div className="h-6 w-11 rounded-full bg-[var(--c-border)]" />
    </div>
  )
}

function NotificationsRow({
  icon,
  title,
  description,
  enabled,
  onChange,
  badge,
}: {
  icon: ReactNode
  title: string
  description: string
  enabled: boolean
  onChange: (value: boolean) => void
  badge?: string
}) {
  return (
    <SettingsRow icon={icon} title={title} description={description} variant="compact">
      <div className="flex items-center gap-2">
        {badge ? <SettingsBadge tone="accent">{badge}</SettingsBadge> : null}
        <SettingsToggle checked={enabled} onChange={onChange} ariaLabel={title} />
      </div>
    </SettingsRow>
  )
}

export function NotificationsPanel() {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [loadWarning, setLoadWarning] = useState(false)
  const [saving, setSaving] = useState(false)
  const savedPrefs = useRef<NotifPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/profile/notifications')
        if (response.ok) {
          const data = await response.json()
          const merged = { ...DEFAULT_PREFS, ...(data.data ?? data) }
          setPrefs(merged)
          savedPrefs.current = merged
        } else {
          setLoadWarning(true)
        }
      } catch {
        setLoadWarning(true)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs(current => ({ ...current, [key]: !current[key] }))
  }

  const enabledCount = Object.values(prefs).filter(Boolean).length
  const changed = JSON.stringify(savedPrefs.current) !== JSON.stringify(prefs)

  const handleSave = async () => {
    if (loadWarning) {
      toast.warning(
        'Carga incompleta',
        'Actualiza la pagina antes de guardar alertas para evitar usar preferencias temporales.',
      )
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/profile/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        toast.error('No se pudieron guardar las alertas', data?.error?.message ?? 'Inténtalo de nuevo.')
        return
      }

      savedPrefs.current = prefs
      toast.success('Alertas guardadas', 'Tus reglas de aviso ya están activas.')
    } catch {
      toast.error('Error de red', 'No se pudo conectar con el servidor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPanel
      eyebrow="Alertas"
      title="Alertas"
      description="Decide qué eventos financieros deben interrumpirte primero y cuáles solo merecen seguimiento."
      density="compact"
      className="mx-auto max-w-[900px]"
      action={
        loadWarning ? (
          <SettingsBadge tone="warning">Carga incompleta</SettingsBadge>
        ) : (
          <SettingsBadge tone="accent">{enabledCount} activas</SettingsBadge>
        )
      }
    >
      <div className="space-y-4">
        {loadWarning ? (
          <div role="alert" className="rounded-[20px] border border-[color:rgba(169,120,47,0.28)] bg-[var(--c-warning-soft)]/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <SettingsBadge tone="warning">Carga incompleta</SettingsBadge>
              <p className="text-[13px] font-semibold text-[var(--c-text)]">No pudimos confirmar tus alertas</p>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[var(--c-text-muted)]">
              Mostramos reglas temporales para que la pantalla siga disponible. Actualiza la pagina antes de guardar cambios.
            </p>
          </div>
        ) : null}

        <SettingsSubsection
          title="Alertas críticas"
          description="Liquidez, cobranza y riesgo operativo. Estas reglas deben verse primero."
          density="compact"
        >
          {loading ? (
            <>
              {[1, 2, 3, 4].map(index => (
                <SkeletonRow key={index} />
              ))}
            </>
          ) : (
            <>
              <NotificationsRow
                icon={<IconCreditCard />}
                title="Cuotas vencidas"
                description="Aviso cuando una cuota de crédito vence o ya quedó en atraso."
                enabled={prefs.overdueInstallments}
                onChange={() => toggle('overdueInstallments')}
                badge="recomendado"
              />
              <NotificationsRow
                icon={<IconDollarSign />}
                title="Cuentas por cobrar"
                description="Recordatorio cuando un cobro pendiente se acerca al vencimiento o ya expiró."
                enabled={prefs.overdueReceivables}
                onChange={() => toggle('overdueReceivables')}
                badge="recomendado"
              />
              <NotificationsRow
                icon={<IconCalendar />}
                title="Cuentas por pagar"
                description="Aviso antes y después del vencimiento de pagos comprometidos."
                enabled={prefs.overduePayables}
                onChange={() => toggle('overduePayables')}
                badge="recomendado"
              />
              <NotificationsRow
                icon={<IconAlertOctagon />}
                title="Actividad inusual"
                description="Cuando detectamos movimientos poco frecuentes o fuera de patrón."
                enabled={prefs.unusualActivity}
                onChange={() => toggle('unusualActivity')}
              />
            </>
          )}
        </SettingsSubsection>

        <SettingsSubsection
          title="Seguimiento"
          description="Reglas tácticas para presupuesto, resúmenes y confirmaciones de actividad."
          density="compact"
          action={changed ? <SettingsBadge tone="warning">Cambios pendientes</SettingsBadge> : null}
        >
          {loading ? (
            <>
              {[1, 2, 3].map(index => (
                <SkeletonRow key={index} />
              ))}
            </>
          ) : (
            <>
              <NotificationsRow
                icon={<IconPieChart />}
                title="Alertas de presupuesto"
                description="Se activa cuando superas el 80% de un presupuesto mensual."
                enabled={prefs.budgetAlerts}
                onChange={() => toggle('budgetAlerts')}
              />
              <NotificationsRow
                icon={<IconTrendingUp />}
                title="Resumen semanal"
                description="Recibe una síntesis semanal de ingresos, gastos y balance."
                enabled={prefs.weeklySummary}
                onChange={() => toggle('weeklySummary')}
              />
              <NotificationsRow
                icon={<IconMail />}
                title="Nueva transacción registrada"
                description="Confirmación por correo cada vez que se registra un nuevo movimiento."
                enabled={prefs.newTransaction}
                onChange={() => toggle('newTransaction')}
              />
            </>
          )}
        </SettingsSubsection>
      </div>

      <div className="mt-5 rounded-[22px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SettingsBadge tone={changed ? 'warning' : 'success'}>
                {changed ? 'Cambios pendientes' : 'Sin cambios'}
              </SettingsBadge>
              <SettingsBadge tone="neutral">
                {prefs.newTransaction || prefs.weeklySummary ? 'Correo activo' : 'Correo en pausa'}
              </SettingsBadge>
            </div>
            <p className="max-w-[48ch] text-[12px] leading-5 text-[var(--c-text-muted)]">
              Guarda solo cuando termines de ajustar las reglas. Las alertas críticas quedan arriba para revisar primero.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <span className="text-[12px] font-medium text-[var(--c-text-muted)]">
              {enabledCount} de 7 activas
            </span>
            <Button onClick={handleSave} loading={saving} disabled={loading || loadWarning || !changed}>
              Guardar alertas
            </Button>
          </div>
        </div>
      </div>
    </SettingsPanel>
  )
}
