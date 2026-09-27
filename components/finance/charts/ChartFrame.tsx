'use client'

import { useId, useState, type ReactNode } from 'react'
import { DataBoundary } from '@/components/finance/DataBoundary'

type Ready = {
  state: 'ready' | 'stale' | 'partial'
  chart: ReactNode
  dataTable: ReactNode
  message?: string
  lastSuccess?: string
  unavailableSources?: readonly string[]
  onRetry?: () => void
}

type Loading = {
  state: 'initial' | 'slow'
  skeleton: ReactNode
}

type Error = {
  state: 'error'
  message: string
  onRetry?: () => void
  reference?: string
}

type Empty = {
  state: 'empty'
  message: string
  action?: ReactNode
}

export type ChartFrameProps = {
  title: string
  unit: string
  interval: string
  summary: string
  controls?: ReactNode
  className?: string
} & (Ready | Loading | Error | Empty)

/** Owns only chart presentation, never a series, query, tooltip value or financial aggregate. */
export function ChartFrame(props: ChartFrameProps) {
  const titleId = useId()
  const contentId = useId()
  const [showData, setShowData] = useState(false)
  const hasData = 'chart' in props

  let content: ReactNode
  if (props.state === 'initial' || props.state === 'slow') {
    content = <DataBoundary state={props.state} label={`Cargando ${props.title}`} skeleton={props.skeleton} className="ft-v3-chart-boundary" />
  } else if (props.state === 'error') {
    content = <DataBoundary state="error" message={props.message} onRetry={props.onRetry} reference={props.reference} className="ft-v3-chart-boundary" />
  } else if (props.state === 'empty') {
    content = <DataBoundary state="empty" message={props.message} action={props.action} className="ft-v3-chart-boundary" />
  } else if ('chart' in props) {
    content = (
      <DataBoundary
        state={props.state}
        message={props.message}
        lastSuccess={props.lastSuccess}
        unavailableSources={props.unavailableSources}
        onRetry={props.onRetry}
        className="ft-v3-chart-boundary"
      >
        <div id={contentId} className="ft-v3-chart-content" data-view={showData ? 'table' : 'chart'}>
          {showData ? props.dataTable : props.chart}
        </div>
      </DataBoundary>
    )
  } else {
    content = null
  }

  return (
    <section data-ft-v3="" className={`ft-v3-chart-frame ${props.className ?? ''}`.trim()} aria-labelledby={titleId}>
      <div className="ft-v3-chart-heading">
        <div className="ft-v3-chart-heading-copy">
          <h3 id={titleId}>{props.title}</h3>
          <p className="ft-v3-chart-scope">{props.interval} · {props.unit}</p>
        </div>
        <div className="ft-v3-chart-controls">
          {props.controls}
          {hasData ? (
            <button
              type="button"
              className="ft-v3-chart-data-toggle"
              aria-controls={contentId}
              aria-expanded={showData}
              onClick={() => setShowData(previous => !previous)}
            >
              {showData ? 'Ver gráfico' : 'Ver datos'}
            </button>
          ) : null}
        </div>
      </div>
      <p className="ft-v3-chart-summary">{props.summary}</p>
      {content}
    </section>
  )
}
