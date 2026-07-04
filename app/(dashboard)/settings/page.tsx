import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AccountsPanel } from '@/components/settings/AccountsPanel'
import {
  getSettingsTabValue,
  type SettingsTab,
} from '@/components/settings/config'
import { ExportPanel } from '@/components/settings/ExportPanel'
import { NotificationsPanel } from '@/components/settings/NotificationsPanel'
import { PreferencesPanel } from '@/components/settings/PreferencesPanel'
import { ProfileSettingsForm } from '@/components/settings/ProfileSettingsForm'
import { SecuritySettingsPanel } from '@/components/settings/SecuritySettingsPanel'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SupportPanel } from '@/components/settings/SupportPanel'
import {
  ModuleHeader,
  PageLayout,
} from '@/components/finance/primitives'
import { createClient } from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'

const SERVER_QUERY_TIMEOUT_MS = 4_000

type SettingsPreloadWarning = {
  title: string
  message: string
}

const PROFILE_PRELOAD_WARNING: SettingsPreloadWarning = {
  title: 'No pudimos confirmar tu perfil',
  message: 'Mostramos datos temporales para que Configuracion siga disponible. Actualiza la pagina antes de guardar cambios.',
}

const ACCOUNTS_PRELOAD_WARNING: SettingsPreloadWarning = {
  title: 'No pudimos confirmar tus cuentas',
  message: 'La lista de cuentas y balances puede estar incompleta. Actualiza la pagina antes de tomar decisiones con esta informacion.',
}

export const metadata: Metadata = {
  title: 'Configuración | FinTrack',
  description: 'Perfil, seguridad, notificaciones y preferencias de la cuenta.',
}

function renderPanel({
  activeTab,
  profilePayload,
  accountRows,
  totalPen,
  totalUsd,
  email,
  currentTheme,
  profilePreloadWarning,
  accountsPreloadWarning,
}: {
  activeTab: SettingsTab
  profilePayload: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    default_currency: 'PEN' | 'USD'
  }
  accountRows: Array<{
    id: string
    name: string
    type: string
    currency: string
    balance: number
    color?: string | null
    icon?: string | null
  }>
  totalPen: number
  totalUsd: number
  email: string
  currentTheme: 'dark' | 'light'
  profilePreloadWarning: SettingsPreloadWarning | null
  accountsPreloadWarning: SettingsPreloadWarning | null
}) {
  if (activeTab === 'profile') {
    return (
      <ProfileSettingsForm
        initialProfile={profilePayload}
        accountCount={accountRows.length}
        profilePreloadWarning={profilePreloadWarning}
        accountsPreloadWarning={accountsPreloadWarning}
      />
    )
  }

  if (activeTab === 'security') {
    return <SecuritySettingsPanel email={email} />
  }

  if (activeTab === 'preferences') {
    return (
      <PreferencesPanel
        initialTheme={currentTheme}
        initialCurrency={profilePayload.default_currency}
        initialPrivateMode={false}
        profilePreloadWarning={profilePreloadWarning}
      />
    )
  }

  if (activeTab === 'notifications') {
    return <NotificationsPanel />
  }

  if (activeTab === 'accounts') {
    return (
      <AccountsPanel
        accounts={accountRows}
        totalPen={totalPen}
        totalUsd={totalUsd}
        accountsPreloadWarning={accountsPreloadWarning}
      />
    )
  }

  if (activeTab === 'export') {
    return <ExportPanel />
  }

  return <SupportPanel />
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { tab?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, accountsResult] = await Promise.allSettled([
    withTimeout(supabase.from('profiles').select('*').eq('id', user.id).single(), SERVER_QUERY_TIMEOUT_MS),
    withTimeout(supabase.from('accounts').select('*').eq('user_id', user.id).order('name'), SERVER_QUERY_TIMEOUT_MS),
  ])

  const profile =
    profileResult.status === 'fulfilled' && !profileResult.value.error
      ? profileResult.value.data
      : null
  const accounts =
    accountsResult.status === 'fulfilled' && !accountsResult.value.error
      ? accountsResult.value.data
      : []

  const profilePreloadWarning =
    profileResult.status === 'fulfilled' && !profileResult.value.error
      ? null
      : PROFILE_PRELOAD_WARNING
  const accountsPreloadWarning =
    accountsResult.status === 'fulfilled' && !accountsResult.value.error
      ? null
      : ACCOUNTS_PRELOAD_WARNING

  const activeTab = getSettingsTabValue(searchParams?.tab)
  const accountRows = accounts ?? []

  const totalPen = accountRows
    .filter(account => account.currency === 'PEN')
    .reduce((sum, account) => sum + Number(account.balance ?? 0), 0)
  const totalUsd = accountRows
    .filter(account => account.currency === 'USD')
    .reduce((sum, account) => sum + Number(account.balance ?? 0), 0)

  const email = profile?.email ?? user.email ?? '—'
  const profilePayload = {
    id: user.id,
    email,
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    default_currency: (profile?.default_currency ?? 'PEN') as 'PEN' | 'USD',
  }

  const currentTheme = (profile as { theme?: string } | null)?.theme === 'light' ? 'light' : 'dark'
  const profileState = profilePreloadWarning
    ? 'Carga parcial'
    : profilePayload.full_name && profilePayload.avatar_url
      ? 'Completo'
      : 'En revisión'

  return (
    <PageLayout
      className="max-w-[1440px] gap-5 pb-12"
      header={(
        <ModuleHeader
          eyebrow="Cuenta y acceso"
          title="Configuración"
          description="Perfil, seguridad, preferencias y datos de FinTrack en un solo flujo operativo."
          mode="content"
          actions={(
            <div className="min-w-0 text-left md:text-right">
              <p className="text-[11px] font-medium text-[var(--c-text-faint)]">
                Cuenta activa
              </p>
              <p
                className="mt-1 truncate text-sm font-medium text-[var(--c-text)]"
                title={email}
              >
                {email}
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-[12px] text-[var(--c-text-muted)] md:justify-end">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    profileState === 'Completo'
                      ? 'bg-[var(--c-success)]'
                      : 'bg-[var(--c-warning)]'
                  }`}
                />
                Perfil {profileState.toLowerCase()}
              </p>
            </div>
          )}
        />
      )}
    >
      <div className="border-b border-[var(--c-border)] pb-4 lg:hidden">
        <SettingsSidebar activeTab={activeTab} mode="mobile" />
      </div>

      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--topbar-height)+24px)]">
            <SettingsSidebar activeTab={activeTab} mode="desktop" />
          </div>
        </aside>

        <main id="settings-content" className="min-w-0">
          {renderPanel({
            activeTab,
            profilePayload,
            accountRows,
            totalPen,
            totalUsd,
            email,
            currentTheme,
            profilePreloadWarning,
            accountsPreloadWarning,
          })}
        </main>
      </div>
    </PageLayout>
  )
}
