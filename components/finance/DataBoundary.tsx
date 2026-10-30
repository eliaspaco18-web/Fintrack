'use client'

import type { ReactNode } from 'react'

type LoadingBoundary = {
  state: 'initial' | 'slow'
  skeleton: ReactNode
  label?: string
}

type ErrorBoundary = {
  state: 'error'
  message: string
  onRetry?: () => void
  reference?: string
}

type EmptyBoundary = {
  state: 'empty' | 'filtered'
  message: string
  action?: ReactNode
}

type ContentBoundary = {
  state: 'ready' | 'stale' | 'partial'
  children: ReactNode
  message?: string
  lastSuccess?: string
  unavailableSources?: readonly string[]
  onRetry?: () => void
}

export type DataBoundaryProps = (LoadingBoundary | ErrorBoundary | EmptyBoundary | ContentBoundary) & {
  className?: string
}

/** Availability belongs to the owning source. This component never fetches. */
export function DataBoundary(props: DataBoundaryProps) {
  const className = props.className ?? ''
  if (props.state === 'initial' || props.state === 'slow') {
    return (
      <section aria-busy="true" aria-label={props.label ?? 'Cargando datos'} className={className}>
        {props.skeleton}
        {props.state === 'slow' ? (
          <p className="mt-2 text-[12px] text-[var(--ft-text-muted)]">Está tardando más de lo habitual</p>
        ) : null}
      </section>
    )
  }

  if (props.state === 'error') {
    return (
      <section role="alert" className={`rounded-[var(--ft-radius-surface)] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-4 ${className}`}>
        <p className="text-[13px] font-semibold text-[var(--ft-text-strong)]">No se pudo cargar esta sección</p>
        <p className="mt-1 text-[12px] text-[var(--ft-text-muted)]">{props.message}</p>
        {props.reference ? <p className="mt-1 text-[11px] text-[var(--ft-text-subtle)]">Referencia: {props.reference}</p> : null}
        {props.onRetry ? (
          <button type="button" onClick={props.onRetry} className="mt-3 min-h-11 rounded-[var(--ft-radius-control)] border border-[var(--ft-control-border)] px-3 text-[12px] font-semibold text-[var(--ft-primary)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ft-primary)]">
            Reintentar
          </button>
        ) : null}
      </section>
    )
  }

  if (props.state === 'empty' || props.state === 'filtered') {
    return (
      <section className={`rounded-[var(--ft-radius-surface)] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-5 ${className}`}>
        <p className="text-[13px] text-[var(--ft-text-muted)]">{props.message}</p>
        {props.action ? <div className="mt-3">{props.action}</div> : null}
      </section>
    )
  }

  if (props.state === 'ready' || props.state === 'stale' || props.state === 'partial') {
    return (
      <section className={className} data-availability={props.state}>
        {props.state !== 'ready' ? (
          <div role="status" className="mb-3 rounded-[var(--ft-radius-menu)] border border-[var(--ft-border)] bg-[var(--ft-surface-muted)] px-3 py-2 text-[12px] text-[var(--ft-text-strong)]">
            <span className="font-semibold">{props.state === 'stale' ? 'No actualizado' : 'Información parcial'}</span>
            {props.message ? ` · ${props.message}` : null}
            {props.lastSuccess ? ` · Última lectura: ${props.lastSuccess}` : null}
            {props.unavailableSources?.length ? ` · No disponible: ${props.unavailableSources.join(', ')}` : null}
            {props.onRetry ? (
              <button type="button" onClick={props.onRetry} className="ml-2 min-h-11 rounded-[var(--ft-radius-control)] px-2 font-semibold text-[var(--ft-primary)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ft-primary)]">Reintentar lectura</button>
            ) : null}
          </div>
        ) : null}
        {props.children}
      </section>
    )
  }

  return null
}
