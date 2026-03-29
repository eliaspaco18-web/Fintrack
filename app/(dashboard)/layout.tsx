// =============================================================================
// app/(dashboard)/layout.tsx
// Layout autenticado. Server Component.
//
// Responsabilidades:
//   1. Verificar sesión — redirigir a /login si no autenticado
//   2. Cargar perfil del usuario para el sidebar/topbar
//   3. Cargar tipo de cambio actual para el CurrencyProvider
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
import { resolveUsdPenExchangeRate } from '@/lib/server/exchange-rate'

// ─── CARGA DE DATOS ───────────────────────────────────────────────────────────

async function getLayoutData(userId: string) {
  const supabase = createClient()

  const [
    { data: profile },
    exchangeRateSnapshot,
    { count: overdueInstallments },
    { count: urgentReceivables },
    { count: urgentPayables },
  ] = await Promise.all([
    // Perfil del usuario
    supabase
      .from('profiles')
      .select('email, full_name, avatar_url')
      .eq('id', userId)
      .single(),

    // Tipo de cambio USD→PEN (intenta refresh en cada carga de layout)
    resolveUsdPenExchangeRate({ refresh: true }),

    // Cuotas vencidas (badge en Créditos)
    supabase
      .from('installments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'OVERDUE'),

    // Cuentas por cobrar vencidas (badge en Por cobrar)
    supabase
      .from('accounts_receivable')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .lt('due_date', new Date().toISOString().split('T')[0]),

    // Cuentas por pagar vencidas (badge en Por pagar)
    supabase
      .from('accounts_payable')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .lt('due_date', new Date().toISOString().split('T')[0]),
  ])

  return {
    user: {
      email:  profile?.email  ?? '',
      name:   profile?.full_name ?? null,
      avatar: profile?.avatar_url ?? null,
    },
    exchangeRate: exchangeRateSnapshot.rate,
    navBadges: {
      credits:     (overdueInstallments ?? 0) > 0 ? (overdueInstallments ?? 0) : undefined,
      receivables: (urgentReceivables   ?? 0) > 0 ? (urgentReceivables   ?? 0) : undefined,
      payables:    (urgentPayables      ?? 0) > 0 ? (urgentPayables      ?? 0) : undefined,
      alerts:      ((overdueInstallments ?? 0) + (urgentReceivables ?? 0) + (urgentPayables ?? 0)) > 0
        ? (overdueInstallments ?? 0) + (urgentReceivables ?? 0) + (urgentPayables ?? 0)
        : undefined,
    } satisfies Partial<Record<string, number>>,
  }
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

  const { user: profile, exchangeRate, navBadges } =
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
      navBadges={navBadges}
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
      <div className="h-8 w-48 rounded-lg bg-white/[0.06]"/>
      {/* Cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.04]"/>
        ))}
      </div>
      {/* Content blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 h-56 rounded-xl bg-white/[0.04]"/>
        <div className="h-56 rounded-xl bg-white/[0.04]"/>
      </div>
    </div>
  )
}
