'use client'

import type { ReactNode } from 'react'
import {
  ControlsBar,
  DetailDrawer,
  ModuleHeader,
  type ModuleHeaderMode,
  PageLayout,
  StatCard,
  StatGrid,
} from './primitives'
import { DataErrorBanner } from './data-table'

type LedgerKind = 'receivable' | 'payable'
type LedgerTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

interface LedgerStat {
  label: string
  value: ReactNode
  detail?: ReactNode
  caption?: ReactNode
  tone?: LedgerTone
}

interface LedgerDetailConfig {
  open: boolean
  title: string
  description?: ReactNode
  onClose: () => void
  content: ReactNode
  footer?: ReactNode
  width?: number
  inset?: boolean
}

interface LedgerModuleProps {
  kind: LedgerKind
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
  headerMode?: ModuleHeaderMode
  stats: LedgerStat[]
  presets?: ReactNode
  search?: ReactNode
  filters?: ReactNode
  viewToggle?: ReactNode
  controlsMeta?: ReactNode
  error?: string | null
  onRetry?: () => void
  children: ReactNode
  detail?: LedgerDetailConfig | null
  className?: string
}

const DEFAULT_EYEBROW: Record<LedgerKind, string> = {
  receivable: 'Libro de cobranzas',
  payable: 'Libro de pagos',
}

export function LedgerModule({
  kind,
  eyebrow,
  title,
  description,
  actions,
  headerMode = 'full',
  stats,
  presets,
  search,
  filters,
  viewToggle,
  controlsMeta,
  error,
  onRetry,
  children,
  detail,
  className = '',
}: LedgerModuleProps) {
  return (
    <>
      <PageLayout
        className={`max-w-[1320px] gap-5 ${className}`.trim()}
        header={(
          <ModuleHeader
            eyebrow={eyebrow ?? DEFAULT_EYEBROW[kind]}
            title={title}
            description={description}
            actions={actions}
            mode={headerMode}
          />
        )}
        stats={(
          <StatGrid>
            {stats.map(stat => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                detail={stat.detail}
                caption={stat.caption}
                tone={stat.tone}
              />
            ))}
          </StatGrid>
        )}
        controls={(
          <ControlsBar
            presets={presets}
            search={search}
            filters={filters}
            viewToggle={viewToggle}
            actions={controlsMeta}
          />
        )}
      >
        {error && onRetry ? <DataErrorBanner message={error} onRetry={onRetry} /> : null}
        {children}
      </PageLayout>

      {detail ? (
        <DetailDrawer
          open={detail.open}
          title={detail.title}
          description={detail.description}
          onClose={detail.onClose}
          footer={detail.footer}
          width={detail.width ?? 640}
          inset={detail.inset ?? false}
        >
          {detail.content}
        </DetailDrawer>
      ) : null}
    </>
  )
}
