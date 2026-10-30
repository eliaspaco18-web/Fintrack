'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from 'react'
import { formatPortfolioAmount } from '@/modules/portfolio/currency-display'
import type { AccountMonthlyHistory, MonthlyBalancePoint } from '@/modules/portfolio/account-monthly-history'

type CurrencyDefinition = Readonly<{
  code: string
  name: string
  symbol: string
  is_system: boolean
}>

type PlotPoint = MonthlyBalancePoint & { x: number; y: number }

function formatMonthLabel(month: string): string {
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return label.charAt(0).toLocaleUpperCase('es-PE') + label.slice(1)
}

export function AccountBalanceSparkline({
  history,
  currency,
  currencies,
  loading,
  unavailable,
}: {
  history: AccountMonthlyHistory | undefined
  currency: string
  currencies: readonly CurrencyDefinition[]
  loading: boolean
  unavailable: boolean
}) {
  if (!history || history.status !== 'available' || history.points.length === 0) {
    let label = 'Historial no verificable'
    if (loading) label = 'Cargando cierres mensuales'
    else if (unavailable) label = 'Historial no disponible'
    else if (!history) label = 'Cierres mensuales no disponibles'
    else if (history.status === 'unavailable' && history.reason === 'INSUFFICIENT_CLOSED_MONTHS') label = 'Aún no hay cierres suficientes'
    return <p className="account-history-sparkline-status">{label}</p>
  }

  return (
    <AccountBalanceSparklineChart
      points={history.points}
      currency={currency}
      currencies={currencies}
    />
  )
}

function AccountBalanceSparklineChart({
  points,
  currency,
  currencies,
}: {
  points: Extract<AccountMonthlyHistory, { status: 'available' }>['points']
  currency: string
  currencies: readonly CurrencyDefinition[]
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const tooltipId = useId()
  const activeSourceRef = useRef<'pointer' | 'keyboard' | 'touch' | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const coordinates = useMemo<PlotPoint[]>(() => {
    const values = points.map(point => point.balance)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const spread = max - min
    return points.map((point, index) => ({
      ...point,
      x: points.length === 1 ? 56 : 3 + (index * 106) / (points.length - 1),
      y: spread === 0 ? 14 : 3 + ((max - point.balance) / spread) * 22,
    }))
  }, [points])

  const pointDescription = useMemo(() => points.map(point =>
    `${formatMonthLabel(point.month)}: ${formatPortfolioAmount(point.balance, currency, currencies)}`,
  ).join('; '), [currency, currencies, points])

  const updateTooltipPosition = useCallback((index: number) => {
    const chart = chartRef.current
    const point = coordinates[index]
    if (!chart || !point) return
    const rect = chart.getBoundingClientRect()
    const tooltipWidth = Math.min(220, Math.max(0, window.innerWidth - 16))
    const tooltipHeight = 54
    const pointCenter = rect.left + (point.x / 112) * rect.width
    const left = Math.max(8, Math.min(pointCenter - tooltipWidth / 2, window.innerWidth - tooltipWidth - 8))
    const top = Math.max(8, rect.top - tooltipHeight - 8)
    setTooltipStyle({ position: 'fixed', left, top, width: tooltipWidth, visibility: 'visible' })
  }, [coordinates])

  const activatePoint = useCallback((index: number, source: 'pointer' | 'keyboard' | 'touch') => {
    const point = coordinates[index]
    if (!point) return
    if (activeIndex === index && activeSourceRef.current === source) return
    activeSourceRef.current = source
    setActiveIndex(index)
    updateTooltipPosition(index)
    if (source !== 'pointer') {
      setAnnouncement(`${formatMonthLabel(point.month)}. Saldo al cierre: ${formatPortfolioAmount(point.balance, currency, currencies)}.`)
    }
  }, [activeIndex, coordinates, currencies, currency, updateTooltipPosition])

  const dismissTooltip = useCallback(() => {
    activeSourceRef.current = null
    setActiveIndex(null)
    setAnnouncement('')
    setTooltipStyle({ visibility: 'hidden' })
  }, [])

  useEffect(() => {
    if (activeIndex === null || activeSourceRef.current !== 'touch') return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!chartRef.current?.contains(event.target as Node)) dismissTooltip()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [activeIndex, dismissTooltip])

  useEffect(() => {
    if (activeIndex === null) return
    const reposition = () => updateTooltipPosition(activeIndex)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    window.visualViewport?.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      window.visualViewport?.removeEventListener('resize', reposition)
    }
  }, [activeIndex, updateTooltipPosition])

  const indexAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect || coordinates.length === 0) return 0
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 112
    return coordinates.reduce((nearestIndex, point, index) => {
      const nearest = coordinates[nearestIndex]
      return nearest && Math.abs(point.x - x) < Math.abs(nearest.x - x) ? index : nearestIndex
    }, 0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (activeIndex !== null) {
        event.preventDefault()
        dismissTooltip()
      }
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = activeIndex ?? 0
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? coordinates.length - 1
        : Math.max(0, Math.min(coordinates.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))
    activatePoint(next, 'keyboard')
  }

  const activePoint = activeIndex === null ? null : coordinates[activeIndex] ?? null
  return (
    <div className="account-history-sparkline-row">
      <span className="account-history-sparkline-label">Cierres mensuales</span>
      <div
        ref={chartRef}
        className="account-history-sparkline-plot"
        role="group"
        aria-label={`Cierres mensuales. ${pointDescription}. Usa las flechas izquierda y derecha para consultar cada mes.`}
        aria-describedby={activePoint ? tooltipId : undefined}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End Escape"
        tabIndex={0}
        onFocus={() => activatePoint(activeIndex ?? 0, 'keyboard')}
        onBlur={dismissTooltip}
        onKeyDown={handleKeyDown}
        onPointerMove={event => {
          if (event.pointerType === 'touch') return
          activatePoint(indexAtPointer(event), 'pointer')
        }}
        onPointerLeave={() => {
          if (activeSourceRef.current === 'pointer') dismissTooltip()
        }}
        onPointerDown={event => {
          if (event.pointerType === 'touch') {
            activatePoint(indexAtPointer(event), 'touch')
            return
          }
          activatePoint(indexAtPointer(event), 'pointer')
        }}
      >
        <svg viewBox="0 0 112 28" className="account-history-sparkline-svg" aria-hidden="true">
          <polyline
            points={coordinates.map(point => `${point.x},${point.y}`).join(' ')}
            pathLength="1"
            className="account-history-sparkline-line"
          />
          {coordinates.map((point, index) => (
            <circle
              key={point.month}
              cx={point.x}
              cy={point.y}
              r={activeIndex === index ? 3 : 1.8}
              className={`account-history-sparkline-point${activeIndex === index ? ' is-active' : ''}`}
            />
          ))}
        </svg>
      </div>
      <span className="account-history-sparkline-sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
      {activePoint && typeof document !== 'undefined' && createPortal(
        <div id={tooltipId} role="tooltip" className="account-history-sparkline-tooltip" style={tooltipStyle}>
          <span>{formatMonthLabel(activePoint.month)}</span>
          <strong>Saldo al cierre: {formatPortfolioAmount(activePoint.balance, currency, currencies)}</strong>
        </div>,
        document.body,
      )}
    </div>
  )
}
