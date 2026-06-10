'use client'

import Link from 'next/link'
import {
  type SettingsTab,
  SETTINGS_NAV_GROUPS,
} from '@/components/settings/config'

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function SettingsSidebar({
  activeTab,
  mode = 'all',
}: {
  activeTab: SettingsTab
  mode?: 'all' | 'mobile' | 'desktop'
}) {
  const showMobile = mode !== 'desktop'
  const showDesktop = mode !== 'mobile'

  return (
    <div className="space-y-3">
      {showMobile ? (
        <nav aria-label="Configuración móvil" className="lg:hidden">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2">
              {SETTINGS_NAV_GROUPS.flatMap(group => group.items).map(item => {
                const isActive = activeTab === item.key
                const Icon = item.icon

                return (
                  <Link
                    key={item.key}
                    href={`/settings?tab=${item.key}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={joinClasses(
                      'inline-flex min-h-11 min-w-max items-center gap-2 rounded-[14px] border px-3 py-2 text-[13px] font-medium',
                      'transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]',
                      isActive
                        ? 'border-[var(--c-primary-border)] bg-[var(--c-primary-soft)] text-[var(--c-primary)]'
                        : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-muted)] hover:border-[var(--c-border-hover)] hover:text-[var(--c-text)]',
                    )}
                  >
                    <Icon size={15} />
                    <span>{item.shortLabel}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      ) : null}

      {showDesktop ? (
        <nav aria-label="Configuración" className="hidden lg:block">
          <div className="space-y-4">
            {SETTINGS_NAV_GROUPS.map(group => (
              <section key={group.label} className="space-y-1.5">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--c-text-faint)]">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map(item => {
                    const isActive = activeTab === item.key
                    const Icon = item.icon

                    return (
                      <Link
                        key={item.key}
                        href={`/settings?tab=${item.key}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={joinClasses(
                          'group relative flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left',
                          'transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99]',
                          isActive
                            ? 'bg-[var(--c-primary-soft)] text-[var(--c-text)]'
                            : 'text-[var(--c-text-muted)] hover:bg-[var(--c-surface)] hover:text-[var(--c-text)]',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={joinClasses(
                            'absolute bottom-2 left-0 top-2 w-0.5 rounded-full transition-opacity duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                            isActive ? 'bg-[var(--c-primary)] opacity-100' : 'opacity-0',
                          )}
                        />
                        <span
                          className={joinClasses(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
                            isActive
                              ? 'border-[var(--c-primary-border)] bg-[var(--c-surface)] text-[var(--c-primary)]'
                              : 'border-transparent bg-transparent text-[var(--c-text-faint)] group-hover:border-[var(--c-border)] group-hover:bg-[var(--c-surface)] group-hover:text-[var(--c-text-muted)]',
                          )}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">
                            {item.shortLabel}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-[var(--c-text-faint)]">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
