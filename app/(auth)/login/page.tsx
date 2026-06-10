// =============================================================================
// app/(auth)/login/page.tsx
// Entrada de autenticación premium (login + registro + recuperación)
// =============================================================================

import type { Metadata } from 'next'
import { LoginForm, type AuthMode, type AuthNotice } from './LoginForm'
import { PremiumShowcaseCarousel } from './PremiumShowcaseCarousel'
import { BrandMark, BrandWordmark } from '@/components/layout/Brand'

export const metadata: Metadata = {
  title: 'Acceso seguro — FinTrack',
}

interface LoginPageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function sanitizeRelativePath(value: string | undefined): string {
  if (!value) return '/dashboard'
  if (!value.startsWith('/')) return '/dashboard'
  if (value.startsWith('//')) return '/dashboard'
  return value
}

function resolveInitialMode(value: string | undefined): AuthMode {
  if (value === 'signup') return 'signup'
  if (value === 'recovery') return 'recovery'
  return 'login'
}

function resolveInitialNotice(searchParams: LoginPageProps['searchParams']): AuthNotice | null {
  const authMessage = firstValue(searchParams?.authMessage)
  const authError = firstValue(searchParams?.authError)

  if (authError === 'callback') {
    return {
      kind: 'error',
      message: 'No se pudo completar la autenticación desde el enlace. Vuelve a intentarlo.',
    }
  }

  if (authMessage === 'verified') {
    return {
      kind: 'success',
      message: 'Correo verificado correctamente. Ya puedes iniciar sesión.',
    }
  }

  if (authMessage === 'recovery_ready') {
    return {
      kind: 'info',
      message: 'Enlace de recuperación validado. Cambia tu contraseña en Seguridad.',
    }
  }

  return null
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const initialMode = resolveInitialMode(firstValue(searchParams?.mode))
  const nextPath = sanitizeRelativePath(firstValue(searchParams?.next))
  const initialNotice = resolveInitialNotice(searchParams)

  return (
    <main className="fin-auth-scene">
      <div className="fin-auth-grid">
        <section className="fin-auth-entry">
          <div className="fin-auth-entry-shell">
            <div className="fin-auth-brand-row">
              <BrandMark size={56} className="fin-auth-brand-mark" />
              <BrandWordmark titleClassName="fin-auth-brand-wordmark" />
            </div>

            <p className="fin-auth-kicker">Centro de acceso</p>
            <h1 className="fin-auth-title">
              La operación financiera empieza con un acceso claro.
            </h1>
            <p className="fin-auth-subtitle">
              Ingresa, crea tu espacio o recupera tu acceso desde un entorno sobrio,
              verificable y listo para trabajar en equipo.
            </p>

            <div className="fin-auth-context-strip" aria-label="Principios de acceso">
              <span className="fin-auth-context-chip">Sesiones seguras</span>
              <span className="fin-auth-context-chip">Verificación por correo</span>
              <span className="fin-auth-context-chip">Listo para equipos</span>
            </div>

            <LoginForm
              initialMode={initialMode}
              nextPath={nextPath}
              initialNotice={initialNotice}
            />

            <p className="fin-auth-legal-note">
              Al continuar aceptas los términos de uso y la política de tratamiento
              de datos de FinTrack.
            </p>
          </div>
        </section>

        <PremiumShowcaseCarousel />
      </div>
    </main>
  )
}
