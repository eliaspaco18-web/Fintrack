// =============================================================================
// app/(dashboard)/settings/page.tsx
// =============================================================================

import { redirect }      from 'next/navigation'
import type { Metadata } from 'next'
import { createClient }  from '@/lib/supabase.server'
import Link              from 'next/link'
import { ProfileSettingsForm } from '@/components/settings/ProfileSettingsForm'

export const metadata: Metadata = { title: 'Configuración' }

type SettingsTab = 'profile' | 'preferences' | 'security' | 'accounts'

function getTabValue(input?: string): SettingsTab {
  if (input === 'preferences' || input === 'security' || input === 'accounts') return input
  return 'profile'
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: accounts }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
  ])

  const activeTab = getTabValue(searchParams?.tab)
  const accountRows = accounts ?? []
  const totalPen = accountRows
    .filter(acc => acc.currency === 'PEN')
    .reduce((sum, acc) => sum + Number(acc.balance ?? 0), 0)
  const totalUsd = accountRows
    .filter(acc => acc.currency === 'USD')
    .reduce((sum, acc) => sum + Number(acc.balance ?? 0), 0)
  const email = profile?.email ?? user.email ?? '—'
  const profilePayload = {
    id: user.id,
    email,
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    default_currency: (profile?.default_currency ?? 'PEN') as 'PEN' | 'USD',
  }

  const tabClass = (tab: SettingsTab) =>
    `px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
      activeTab === tab
        ? 'bg-emerald-500/12 border-emerald-500/28 text-emerald-300'
        : 'bg-[var(--color-surface-2)] border-[color:var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)]'
    }`

  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded-2xl border border-[color:var(--color-border)] p-5 md:p-6
        bg-[linear-gradient(145deg,rgba(16,185,129,0.15),rgba(17,24,39,0.78),rgba(59,130,246,0.14))]">
        <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Centro de cuenta</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--color-text)] tracking-tight">Configuración y perfil</h1>
        <p className="text-[12px] text-[var(--color-text-muted)] mt-1.5">
          Gestiona tu información personal, seguridad, preferencias y datos financieros.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Cuentas activas</p>
            <p className="text-lg font-bold text-[var(--color-text)] tabular-nums mt-0.5">{accountRows.length}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Total PEN</p>
            <p className="text-lg font-bold text-[var(--color-text)] tabular-nums mt-0.5">
              {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(totalPen)}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Total USD</p>
            <p className="text-lg font-bold text-[var(--color-text)] tabular-nums mt-0.5">
              {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'USD' }).format(totalUsd)}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/settings?tab=profile" className={tabClass('profile')}>Perfil</Link>
        <Link href="/settings?tab=preferences" className={tabClass('preferences')}>Preferencias</Link>
        <Link href="/settings?tab=security" className={tabClass('security')}>Seguridad</Link>
        <Link href="/settings?tab=accounts" className={tabClass('accounts')}>Cuentas</Link>
      </div>

      {activeTab === 'profile' && (
        <ProfileSettingsForm
          initialProfile={profilePayload}
          accountCount={accountRows.length}
        />
      )}

      {activeTab === 'preferences' && (
        <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-4">
            Preferencias
          </h2>
          <div className="space-y-3">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Tema visual</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">Puedes alternar entre claro y oscuro desde la barra superior.</p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-1 rounded-lg">
                Dinámico
              </span>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Moneda principal</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">Define la moneda principal para reportes y tarjetas.</p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-1 rounded-lg">
                {profile?.default_currency ?? 'PEN'}
              </span>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">Notificaciones</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
                Próximamente podrás gestionar alertas por correo para cuotas vencidas y movimientos críticos.
              </p>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'security' && (
        <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-4">
            Seguridad y soporte
          </h2>
          <div className="space-y-3">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">Autenticación</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
                Cuenta protegida con credenciales de Supabase. Recomendado: contraseña única y robusta.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 flex flex-wrap items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-2 text-[12px] font-semibold text-black hover:bg-emerald-400 transition-colors"
              >
                Gestionar acceso
              </Link>
              <a
                href="mailto:soporte@fintrack.app?subject=Soporte%20FinTrack"
                className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[color:var(--color-border-hover)] transition-colors"
              >
                Contactar soporte
              </a>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'accounts' && (
        <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              Cuentas ({accountRows.length})
            </h2>
            <Link
              href="/portfolio"
              className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
            >
              Ir a portafolio →
            </Link>
          </div>
          {accountRows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Crea tu primera cuenta desde Portafolio para comenzar a registrar movimientos.
            </p>
          ) : (
            <div className="space-y-2">
              {accountRows.map(acc => (
                <div key={acc.id}
                  className="flex items-center justify-between py-2.5
                    border-b border-[color:var(--color-border)] last:border-0">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: acc.color }}
                    />
                    <div>
                      <p className="text-sm text-[var(--color-text)] font-medium">{acc.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{acc.type} · {acc.currency}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                    {new Intl.NumberFormat('es-PE', {
                      style: 'currency', currency: acc.currency,
                      minimumFractionDigits: 2,
                    }).format(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
