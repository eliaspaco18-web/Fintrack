// =============================================================================
// app/(auth)/login/page.tsx
// Página de login con Supabase Auth nativo.
// =============================================================================

import type { Metadata } from 'next'
import { LoginForm }     from './LoginForm'
import { BrandMark, BrandWordmark } from '@/components/layout/Brand'

export const metadata: Metadata = {
  title: 'Iniciar sesión — FinTrack',
}

export default function LoginPage() {
  return (
    <div className="fin-auth-bg min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <BrandMark size={42}/>
          <BrandWordmark
            titleClassName="text-[34px]"
            subtitleClassName="text-[10px]"
            subtitle="Money OS"
          />
        </div>

        {/* Card */}
        <div className="fin-auth-card rounded-2xl p-7">
          <h1 className="text-lg font-bold text-[var(--color-text)] mb-1">Bienvenido</h1>
          <p className="text-[13px] text-[var(--color-text-muted)] mb-6">
            Ingresa para acceder a tu panel financiero
          </p>
          <LoginForm/>
        </div>
      </div>
    </div>
  )
}
