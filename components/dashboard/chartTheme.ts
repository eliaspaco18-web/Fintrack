import type { CSSProperties } from 'react'

export const chartTheme = {
  grid: 'color-mix(in srgb, var(--ft-border) 74%, transparent)',
  axis: 'var(--ft-text-muted)',
  axisLine: 'color-mix(in srgb, var(--ft-border) 88%, transparent)',
  tooltipBg: 'var(--ft-surface)',
  tooltipBorder: 'var(--ft-border)',
  positive: 'var(--ft-primary)',
  negative: 'var(--ft-danger)',
  warning: 'var(--ft-warning)',
  info: 'var(--ft-info)',
} as const

export const chartTransition = 'cubic-bezier(0.32,0.72,0,1)' as const

export const chartRadius = {
  bar: [4, 4, 0, 0],
  pill: [8, 8, 8, 8],
} as const

export const chartAxisTick = {
  fontSize: 11,
  fill: chartTheme.axis,
} as const

export const chartAxisLine = {
  stroke: chartTheme.axisLine,
} as const

export const chartCursor = {
  stroke: 'var(--ft-border-strong)',
  strokeDasharray: '4 4',
} as const

export const chartTooltipStyle: CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${chartTheme.tooltipBorder}`,
  background: chartTheme.tooltipBg,
  color: 'var(--ft-text)',
  boxShadow: '0 18px 48px color-mix(in srgb, var(--ft-shadow) 68%, transparent)',
}
