'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppSelect } from '@/components/ui/AppSelect'
import { SETTINGS_NAV_ITEMS, type SettingsTab } from '@/components/settings/config'

const SETTINGS_TAB_OPTIONS = SETTINGS_NAV_ITEMS.map(item => ({ value: item.key, label: item.shortLabel }))

export function SettingsSidebar({ activeTab }: { activeTab: SettingsTab }) {
  const router = useRouter()

  return (
    <>
      <div className="lg:hidden">
        <AppSelect
          value={activeTab}
          onChange={value => router.push(`/settings?tab=${encodeURIComponent(value)}`)}
          options={SETTINGS_TAB_OPTIONS}
          compact
          ariaLabel="Sección de configuración"
          testId="settings-section-select"
        />
      </div>

      <nav aria-label="Secciones de configuración" className="hidden lg:block">
        <div className="space-y-1">
          {SETTINGS_NAV_ITEMS.map(item => {
            const isActive = activeTab === item.key
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={`/settings?tab=${item.key}`}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] font-medium transition-colors ${
                  isActive
                    ? 'border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]'
                    : 'border border-transparent text-[var(--ft-text-muted)] hover:bg-[var(--ft-surface)] hover:text-[var(--ft-text-strong)]'
                }`}
              >
                <Icon aria-hidden="true" size={15} />
                <span>{item.shortLabel}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
