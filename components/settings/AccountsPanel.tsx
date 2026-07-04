'use client'

import { Button } from '@/components/ui/Button'
import {
  SettingsBadge,
  SettingsPanel,
  SettingsSubsection,
} from '@/components/settings/primitives'

type AccountRow = {
  id: string
  name: string
  type: string
  currency: string
  balance: number
  color?: string | null
  icon?: string | null
}

interface AccountsPanelProps {
  accounts: AccountRow[]
  totalPen: number
  totalUsd: number
  accountsPreloadWarning?: SettingsPreloadWarning | null
}

type SettingsPreloadWarning = {
  title: string
  message: string
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Cuenta corriente',
  savings: 'Ahorros',
  credit: 'Crédito',
  investment: 'Inversión',
  cash: 'Efectivo',
  other: 'Otro',
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function AccountsPanel({
  accounts,
  totalPen,
  totalUsd,
  accountsPreloadWarning,
}: AccountsPanelProps) {
  return (
    <SettingsPanel
      eyebrow="Datos"
      title="Cuentas"
      description="Lectura rápida de tus cuentas registradas. La edición completa sigue ocurriendo en Portafolio."
      density="compact"
      className="mx-auto max-w-[920px]"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {accountsPreloadWarning ? (
            <SettingsBadge tone="warning">Carga incompleta</SettingsBadge>
          ) : (
            <SettingsBadge tone="accent">{accounts.length} registradas</SettingsBadge>
          )}
          <Button href="/portfolio" variant="secondary" size="sm">
            Abrir Portafolio
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {accountsPreloadWarning ? (
          <div role="alert" className="rounded-[20px] border border-[color:rgba(169,120,47,0.28)] bg-[var(--c-warning-soft)]/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <SettingsBadge tone="warning">Carga incompleta</SettingsBadge>
              <p className="text-[13px] font-semibold text-[var(--c-text)]">{accountsPreloadWarning.title}</p>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[var(--c-text-muted)]">
              {accountsPreloadWarning.message}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
              Total PEN
            </p>
            <p className="mt-2 text-[16px] font-semibold tabular-nums text-[var(--c-text)]">
              {formatAmount(totalPen, 'PEN')}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
              {accountsPreloadWarning ? 'Saldo temporal hasta recargar las cuentas.' : 'Saldo consolidado en moneda local.'}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
              Total USD
            </p>
            <p className="mt-2 text-[16px] font-semibold tabular-nums text-[var(--c-text)]">
              {formatAmount(totalUsd, 'USD')}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--c-text-muted)]">
              {accountsPreloadWarning ? 'Saldo temporal hasta recargar las cuentas.' : 'Saldo consolidado en moneda extranjera.'}
            </p>
          </div>
        </div>

        <SettingsSubsection
          title="Inventario de cuentas"
          description="Lista densa para revisar institución, tipo, moneda y balance sin salir de Configuración."
          density="compact"
        >
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-faint)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H19v4H6.5A2.5 2.5 0 0 1 4 7.5z" />
                  <path d="M4 8v9.5A2.5 2.5 0 0 0 6.5 20H20v-6h-4a2 2 0 1 1 0-4h4V6" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-semibold text-[var(--c-text)]">
                {accountsPreloadWarning ? 'No pudimos cargar tus cuentas' : 'Aún no tienes cuentas registradas'}
              </p>
              <p className="mt-2 max-w-md text-[12px] leading-5 text-[var(--c-text-muted)]">
                {accountsPreloadWarning
                  ? 'Actualiza la pagina para volver a intentar. No asumimos que tu inventario este vacio cuando la carga fallo.'
                  : 'Crea tu primera cuenta desde Portafolio para empezar a registrar movimientos, balances y conciliaciones.'}
              </p>
              <div className="mt-5">
                <Button href="/portfolio">Abrir Portafolio</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface)]">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] gap-4 border-b border-[var(--c-border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)] md:grid">
                <span>Cuenta</span>
                <span>Tipo y moneda</span>
                <span className="text-right">Balance</span>
              </div>
              {accounts.map(account => (
                <div key={account.id} className="grid gap-3 border-b border-[var(--c-border)] px-4 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] md:items-center">
                  <div
                    className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[var(--c-border)] bg-[var(--c-surface)] md:flex"
                    style={{ backgroundColor: account.color ? `${account.color}18` : undefined }}
                  >
                    <span
                      className="block h-3 w-3 rounded-full"
                      style={{ backgroundColor: account.color ?? 'var(--c-primary)' }}
                    />
                  </div>

                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-[var(--c-border)] bg-[var(--c-surface)] md:hidden"
                      style={{ backgroundColor: account.color ? `${account.color}18` : undefined }}
                    >
                      <span
                        className="block h-3 w-3 rounded-full"
                        style={{ backgroundColor: account.color ?? 'var(--c-primary)' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--c-text)]">{account.name}</p>
                      <p className="mt-1 text-[12px] text-[var(--c-text-muted)] md:hidden">
                        {ACCOUNT_TYPE_LABELS[account.type] ?? account.type} · {account.currency}
                      </p>
                    </div>
                  </div>

                  <div className="hidden min-w-0 md:block">
                    <p className="truncate text-[12px] text-[var(--c-text-muted)]">
                      {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--c-text-faint)]">
                      {account.currency}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-[13px] font-semibold tabular-nums text-[var(--c-text)]">
                      {formatAmount(account.balance, account.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSubsection>
      </div>
    </SettingsPanel>
  )
}
