'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface MonthlyFlowDatum {
  id: string
  label: string
  periodLabel: string
  income: number | null
  expense: number | null
  incomeLabel: string
  expenseLabel: string
  resultLabel: string
  partial?: boolean
}

function valid(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

function niceCeiling(value: number): number {
  if (value <= 0) return 0
  const power = 10 ** Math.floor(Math.log10(value))
  const scaled = value / power
  const factor = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return factor * power
}

export function flowDomain(points: readonly MonthlyFlowDatum[]): { minimum: number; maximum: number; ticks: number[] } {
  const values = points.flatMap(point => [point.income, point.expense]).filter(valid)
  if (values.length === 0 || values.every(value => value === 0)) return { minimum: 0, maximum: 0, ticks: [0] }
  const maxPositive = Math.max(0, ...values)
  const high = niceCeiling(maxPositive)
  const low = -niceCeiling(Math.abs(Math.min(0, ...values)))
  if (low < 0 && high > 0) return { minimum: low, maximum: high, ticks: [low, 0, high] }
  if (low < 0) return { minimum: low, maximum: 0, ticks: [low, low / 2, 0] }
  const step = niceCeiling(maxPositive / 3)
  return { minimum: 0, maximum: step * 3, ticks: [0, step, step * 2, step * 3] }
}

function axisLabel(value: number, unit: string): string {
  const abs = Math.abs(value)
  const compact = abs >= 1_000_000
    ? `${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`
    : abs >= 1_000
      ? `${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(abs)
  return `${value < 0 ? '−' : ''}${unit}${compact}`
}

function positiveBarPath(x: number, top: number, width: number, baseline: number): string {
  const height = Math.max(0, baseline - top)
  if (height === 0) return ''
  const radius = Math.min(4, height)
  return `M${x} ${baseline}V${top + radius}Q${x} ${top} ${x + radius} ${top}H${x + width - radius}Q${x + width} ${top} ${x + width} ${top + radius}V${baseline}Z`
}

export function MonthlyFlowDataTable({ points }: { points: readonly MonthlyFlowDatum[] }) {
  return (
    <div className="ft-v3-flow-table-wrap" role="region" aria-label="Datos mensuales exactos">
      <table className="ft-v3-flow-table">
        <thead><tr><th scope="col">Mes</th><th scope="col">Ingresos</th><th scope="col">Egresos</th><th scope="col">Resultado</th></tr></thead>
        <tbody>
          {points.map(point => (
            <tr key={point.id}>
              <th scope="row">{point.periodLabel}{point.partial ? ' · parcial' : ''}</th>
              <td>{point.incomeLabel}</td>
              <td>{point.expenseLabel}</td>
              <td>{point.resultLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Read-only paired magnitudes. The caller supplies exact labels and does not infer a year from a localized month. */
export function MonthlyFlowBars({
  points,
  requestedMonths = 6,
  axisUnit = 'S/ ',
}: {
  points: readonly MonthlyFlowDatum[]
  requestedMonths?: 3 | 6
  axisUnit?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const tooltipDomId = useId()
  const groupRefs = useRef(new Map<string, SVGGElement>())
  const [width, setWidth] = useState(560)
  const [narrowScreen, setNarrowScreen] = useState(false)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [tooltipId, setTooltipId] = useState<string | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width
      if (measured && Number.isFinite(measured)) setWidth(Math.max(280, Math.round(measured)))
    })
    observer.observe(root)
    const media = window.matchMedia('(max-width: 599px)')
    const update = () => setNarrowScreen(media.matches)
    update()
    media.addEventListener('change', update)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])

  const allPoints = useMemo(() => points.slice(-6), [points])
  const visibleCount = narrowScreen || (width - 56) / Math.min(requestedMonths, allPoints.length || 1) < 44
    ? 3 : requestedMonths
  const visible = allPoints.slice(-visibleCount)
  const available = visible.filter(point => valid(point.income) || valid(point.expense))
  const latestId = available.at(-1)?.id ?? null
  const selectedId = focusedId && available.some(point => point.id === focusedId)
    ? focusedId
    : pinnedId && available.some(point => point.id === pinnedId)
      ? pinnedId : latestId
  const selectedPoint = allPoints.find(point => point.id === selectedId) ?? null
  const tooltipPoint = allPoints.find(point => point.id === tooltipId) ?? null
  const domain = flowDomain(visible)
  const plotTop = 32
  const plotBottom = 192
  const plotStart = 68
  const plotEnd = width - 34
  const zeroY = domain.maximum === domain.minimum ? plotBottom
    : plotTop + (domain.maximum / (domain.maximum - domain.minimum)) * (plotBottom - plotTop)
  const yOf = (value: number) => domain.maximum === domain.minimum ? zeroY
    : plotTop + (domain.maximum - value) / (domain.maximum - domain.minimum) * (plotBottom - plotTop)
  const centerOf = (index: number) => visible.length === 1 ? (plotStart + plotEnd) / 2
    : plotStart + index * (plotEnd - plotStart) / (visible.length - 1)
  const tooltipIndex = visible.findIndex(point => point.id === tooltipId)
  const tooltipCenter = tooltipIndex >= 0 ? centerOf(tooltipIndex) : 0
  const tooltipWidth = width < 400 ? 224 : 230

  useEffect(() => {
    if (!tooltipId) return
    const closeOutside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setTooltipId(null)
        setFocusedId(null)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [tooltipId])

  const moveFocus = (current: string, step: number) => {
    const ids = visible.filter(point => available.some(candidate => candidate.id === point.id)).map(point => point.id)
    const index = ids.indexOf(current)
    if (index < 0 || ids.length === 0) return
    const next = ids[Math.max(0, Math.min(ids.length - 1, index + step))]
    if (!next) return
    setFocusedId(next)
    setTooltipId(next)
    groupRefs.current.get(next)?.focus()
  }

  return (
    <div ref={rootRef} className="ft-v3-flow-root" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setFocusedId(null)
        setTooltipId(null)
      }
    }}>
      <svg className="ft-v3-flow-svg" viewBox={`0 0 ${width} 232`} role="group" aria-label="Ingresos y egresos mensuales comparados desde cero; valores exactos en la tabla alternativa">
        {domain.ticks.map((tick, index) => {
          const y = yOf(tick)
          return (
            <g key={`${tick}:${index}`}>
              <line x1={plotStart - 7} x2={plotEnd + 8} y1={y} y2={y} className={tick === 0 ? 'ft-v3-flow-zero' : 'ft-v3-flow-grid'} />
              <text x={plotStart - 30} y={y + 4} textAnchor="end" className="ft-v3-flow-axis">{axisLabel(tick, axisUnit)}</text>
            </g>
          )
        })}
        {visible.map((point, index) => {
          const center = centerOf(index)
          const selected = point.id === selectedId
          const incomeY = valid(point.income) ? yOf(point.income) : zeroY
          const expenseY = valid(point.expense) ? yOf(point.expense) : zeroY
          const incomeTop = Math.min(incomeY, zeroY)
          const expenseTop = Math.min(expenseY, zeroY)
          return (
            <g
              key={point.id}
              ref={element => { if (element) groupRefs.current.set(point.id, element); else groupRefs.current.delete(point.id) }}
              role="button"
              tabIndex={selected ? 0 : -1}
              aria-describedby={tooltipId === point.id ? tooltipDomId : undefined}
              aria-label={`${point.periodLabel}${point.partial ? ', parcial' : ''}: ingresos ${point.incomeLabel}, egresos ${point.expenseLabel}, resultado ${point.resultLabel}`}
              onPointerEnter={() => { setFocusedId(point.id); setTooltipId(point.id) }}
              onPointerLeave={event => {
                if (event.pointerType === 'touch') return
                setFocusedId(null)
                setTooltipId(null)
              }}
              onFocus={() => { setFocusedId(point.id); setTooltipId(point.id) }}
              onClick={() => { setPinnedId(point.id); setFocusedId(null); setTooltipId(point.id) }}
              onKeyDown={event => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault()
                  moveFocus(point.id, event.key === 'ArrowRight' ? 1 : -1)
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setPinnedId(point.id)
                  setTooltipId(point.id)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setTooltipId(null)
                }
              }}
            >
              {selected ? <rect x={center - 30} y={plotTop - 8} width="60" height={plotBottom - plotTop + 16} rx="10" className="ft-v3-flow-selection" /> : null}
              {valid(point.income) && point.income > 0 ? <path d={positiveBarPath(center - 23, incomeTop, 20, zeroY)} className="ft-v3-flow-income" /> : null}
              {valid(point.income) && point.income < 0 ? <rect x={center - 23} y={zeroY} width="20" height={incomeY - zeroY} className="ft-v3-flow-income" /> : null}
              {valid(point.expense) && point.expense > 0 ? <path d={positiveBarPath(center + 3, expenseTop, 20, zeroY)} className="ft-v3-flow-expense" /> : null}
              {valid(point.expense) && point.expense < 0 ? <rect x={center + 3} y={zeroY} width="20" height={expenseY - zeroY} className="ft-v3-flow-expense" /> : null}
              {selected && valid(point.income) && valid(point.expense) ? (
                <path d={`M${center} ${incomeY}h-3 M${center} ${incomeY}V${expenseY} M${center} ${expenseY}h3`} className="ft-v3-flow-bracket" />
              ) : null}
              <text x={center} y="216" textAnchor="middle" className={selected ? 'ft-v3-flow-month selected' : 'ft-v3-flow-month'}>
                {point.label}{point.partial ? '*' : ''}
              </text>
              {selected ? <rect x={center - 10} y="224" width="20" height="2" rx="1" className="ft-v3-flow-anchor" /> : null}
              <rect x={center - 30} y={plotTop - 8} width="60" height="207" fill="transparent" className="ft-v3-flow-hit" />
            </g>
          )
        })}
      </svg>
      {selectedPoint ? (
        <p className="ft-v3-flow-result"><span>Resultado · {selectedPoint.periodLabel}{selectedPoint.partial ? ' (parcial)' : ''}</span><strong>{selectedPoint.resultLabel}</strong></p>
      ) : <p className="ft-v3-flow-result">Sin meses con importes verificados</p>}
      {domain.ticks.length === 1 && available.length > 0 ? <p className="ft-v3-flow-zero-note">Todos los importes consultados son cero</p> : null}
      {tooltipPoint && tooltipIndex >= 0 ? (
        <div
          id={tooltipDomId}
          className="ft-v3-flow-tooltip"
          role="tooltip"
          style={{ left: Math.max(0, Math.min(width - tooltipWidth, tooltipCenter - tooltipWidth / 2)) }}
        >
          <strong>{tooltipPoint.periodLabel}{tooltipPoint.partial ? ' · parcial' : ''}</strong>
          <span>Ingresos <b>{tooltipPoint.incomeLabel}</b></span>
          <span>Egresos <b>{tooltipPoint.expenseLabel}</b></span>
          <span>Resultado <b>{tooltipPoint.resultLabel}</b></span>
        </div>
      ) : null}
    </div>
  )
}
