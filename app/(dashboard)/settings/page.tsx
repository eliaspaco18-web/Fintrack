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
import { PageLayout } from '@/components/finance/primitives'
import { Button } from '@/components/ui/Button'
import styles from '@/components/settings/SettingsWorkspace.module.css'
import { createClient } from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'

const SERVER_QUERY_TIMEOUT_MS = 4_000

type SettingsPreloadWarning = {
  title: string
  message: string
}

const PROFILE_PRELOAD_WARNING: SettingsPreloadWarning = {
  title: 'No pudimos confirmar tu perfil',
  message: 'Actualiza la página antes de guardar cambios para evitar sobrescribir información no confirmada.',
}

const ACCOUNTS_PRELOAD_WARNING: SettingsPreloadWarning = {
  title: 'No pudimos confirmar tus cuentas',
  message: 'La lista de cuentas y sus saldos no están disponibles. Actualiza la página antes de tomar decisiones.',
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
  externalProfileSave = false,
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
  externalProfileSave?: boolean
}) {
  if (activeTab === 'profile') {
    return (
      <ProfileSettingsForm
        initialProfile={profilePayload}
        accountCount={accountRows.length}
        profilePreloadWarning={profilePreloadWarning}
        accountsPreloadWarning={accountsPreloadWarning}
        externalSaveAction={externalProfileSave}
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
  return (
    <PageLayout
      className={`max-w-none !gap-0 pb-10 ${styles.workspace}`}
      header={(
        <header className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]">Configuración</h1>
            <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]">Preferencias claras, bajo tu control.</p>
          </div>
          {activeTab === 'profile' ? (
            <Button
              type="submit"
              form="settings-profile-form"
              variant="primary"
              size="sm"
              disabled={Boolean(profilePreloadWarning)}
              testId="settings-header-save"
            >
              Guardar
            </Button>
          ) : null}
        </header>
      )}
    >
      <div className="mt-2 grid min-w-0 items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6" data-testid="settings-workspace-grid">
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--topbar-height)+24px)]">
          <SettingsSidebar activeTab={activeTab} />
        </aside>

        <main id="settings-content" className="min-w-0 w-full">
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
            externalProfileSave: activeTab === 'profile',
          })}
        </main>
      </div>
    </PageLayout>
  )
}
