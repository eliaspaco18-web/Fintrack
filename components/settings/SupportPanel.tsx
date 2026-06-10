'use client'

import { Button } from '@/components/ui/Button'
import {
  SettingsBadge,
  SettingsPanel,
  SettingsRow,
  SettingsSubsection,
} from '@/components/settings/primitives'

function IconMail({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m5 7 7 5 7-5" />
    </svg>
  )
}

function IconBook({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H19" />
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

function IconInfo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V16" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

const APP_VERSION = '1.0.0'

export function SupportPanel() {
  return (
    <SettingsPanel
      eyebrow="Ayuda"
      title="Soporte"
      description="Contacto disponible, estado legal visible y referencia rápida del producto."
      density="compact"
      className="mx-auto max-w-[880px]"
      action={<SettingsBadge tone="accent">Correo disponible</SettingsBadge>}
    >
      <div className="space-y-4">
        <SettingsSubsection
          title="Contacto"
          description="Canales disponibles hoy para resolver incidencias, consultas operativas o feedback del producto."
          density="compact"
        >
          <SettingsRow
            icon={<IconMail size={15} />}
            title="Soporte por correo"
            description="Escríbenos directamente cuando tengas un problema operativo o una solicitud concreta."
            variant="compact"
          >
            <Button href="mailto:soporte@fintrack.app?subject=Soporte%20FinTrack%20v1" size="sm">
              Escribir
            </Button>
          </SettingsRow>
          <SettingsRow
            icon={<IconBook size={15} />}
            title="Centro de ayuda"
            description="La documentación pública estará disponible en una próxima actualización."
            variant="compact"
          >
            <SettingsBadge tone="warning">Próximamente</SettingsBadge>
          </SettingsRow>
        </SettingsSubsection>

        <SettingsSubsection
          title="Recursos legales"
          description="Mientras se publican los recursos legales, dejamos su estado visible aquí."
          density="compact"
        >
          <SettingsRow
            icon={<IconShield size={15} />}
            title="Política de privacidad"
            description="Disponible próximamente."
            variant="compact"
          >
            <SettingsBadge tone="warning">Pendiente</SettingsBadge>
          </SettingsRow>
          <SettingsRow
            icon={<IconBook size={15} />}
            title="Términos de servicio"
            description="Disponible próximamente."
            variant="compact"
          >
            <SettingsBadge tone="warning">Pendiente</SettingsBadge>
          </SettingsRow>
        </SettingsSubsection>

        <SettingsSubsection
          title="Estado del producto"
          description="Referencia compacta de versión y stack actual."
          density="compact"
          action={<SettingsBadge tone="neutral">{`v${APP_VERSION}`}</SettingsBadge>}
        >
          <SettingsRow
            icon={<IconInfo size={15} />}
            title="Build activa"
            description="FinTrack corre hoy sobre Next.js + Supabase."
            variant="compact"
          />
        </SettingsSubsection>
      </div>
    </SettingsPanel>
  )
}
