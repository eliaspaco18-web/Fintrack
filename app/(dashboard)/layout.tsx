// =============================================================================
// app/(dashboard)/layout.tsx
// Layout autenticado. Server Component.
//
// Responsabilidades:
//   1. Verificar sesión — redirigir a /login si no autenticado
//   2. Cargar perfil del usuario para el sidebar/topbar
//   3. Cargar tasa viva cacheada para equivalencias del dashboard
//   4. Calcular badges de alertas (cuotas vencidas, items urgentes)
//   5. Pasar todo al AppShell (Client Component)
//
// Por qué Server Component: los datos del usuario y tipo de cambio
// deben estar disponibles en el primer render sin flash.
// =============================================================================

import { redirect }              from 'next/navigation'
import { Suspense }              from 'react'
import { createClient }          from '@/lib/supabase.server'
import { AppShell }              from '@/components/layout/AppShell'
import {
  ensureAccountingUsdPenExchangeRate,
  resolveLiveUsdPenExchangeRate,
} from '@/lib/server/exchange-rate'
import { withTimeout } from '@/lib/server/promise-timeout'
import { measureServerOperation } from '@/lib/server/observability'

const SERVER_QUERY_TIMEOUT_MS = 4_000

// ─── CARGA DE DATOS ───────────────────────────────────────────────────────────

async function getLayoutData(userId: string) {
  return measureServerOperation('dashboard.layout-data', async () => {
    const supabase = createClient()
    const [profileResult, exchangeRateResult] = await Promise.allSettled([
      withTimeout(
        supabase
          .from('profiles')
          .select('email, full_name, avatar_url')
          .eq('id', userId)
          .single(),
        SERVER_QUERY_TIMEOUT_MS,
      ),
      withTimeout(
        Promise.all([
          ensureAccountingUsdPenExchangeRate(),
          resolveLiveUsdPenExchangeRate(),
        ]).then(([, liveSnapshot]) => liveSnapshot),
        SERVER_QUERY_TIMEOUT_MS,
      ),
    ])

    const profile =
      profileResult.status === 'fulfilled' && !profileResult.value.error
        ? profileResult.value.data
        : null

    const exchangeRateSnapshot =
      exchangeRateResult.status === 'fulfilled'
        ? exchangeRateResult.value
        : { rate: 3.75 }

    return {
      user: {
        email:  profile?.email  ?? '',
        name:   profile?.full_name ?? null,
        avatar: profile?.avatar_url ?? null,
      },
      exchangeRate: exchangeRateSnapshot.rate,
    }
  }, { warnAtMs: 350, meta: { user_id: userId } })
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { user: profile, exchangeRate } =
    await getLayoutData(user.id)

  const metadataName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : null
  const fallbackName = 'Usuario'

  return (
    <AppShell
      user={{
        ...profile,
        name: profile.name ?? metadataName ?? fallbackName,
      }}
      exchangeRate={Number(exchangeRate)}
    >
      {/* Suspense permite que las páginas hijas usen loading.tsx */}
      <Suspense fallback={<PageSkeleton/>}>
        {children}
      </Suspense>
    </AppShell>
  )
}

// ─── PAGE SKELETON ────────────────────────────────────────────────────────────
// Fallback mientras carga la primera página. Evita flash de contenido vacío.

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Título */}
      <div className="h-8 w-48 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 26%, transparent)' }}/>
      {/* Cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 18%, transparent)' }}/>
        ))}
      </div>
      {/* Content blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 h-56 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 18%, transparent)' }}/>
        <div className="h-56 rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text-faint) 18%, transparent)' }}/>
      </div>
    </div>
  )
}
