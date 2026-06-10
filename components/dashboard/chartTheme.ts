import type { CSSProperties } from 'react'

export const chartTheme = {
  grid: 'color-mix(in srgb, var(--c-border) 74%, transparent)',
  axis: 'var(--c-text-muted)',
  axisLine: 'color-mix(in srgb, var(--c-border) 88%, transparent)',
  tooltipBg: 'var(--c-surface)',
  tooltipBorder: 'var(--c-border)',
  positive: 'var(--c-primary)',
  negative: 'var(--c-danger)',
  warning: 'var(--c-warning)',
  info: 'var(--c-accent-landing)',
} as const

export const chartAxisTick = {
  fontSize: 11,
  fill: chartTheme.axis,
} as const

export const chartAxisLine = {
  stroke: chartTheme.axisLine,
} as const

export const chartCursor = {
  stroke: 'var(--c-border-hover)',
  strokeDasharray: '4 4',
} as const

export const chartTooltipStyle: CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${chartTheme.tooltipBorder}`,
  background: chartTheme.tooltipBg,
  color: 'var(--c-text)',
  boxShadow: 'var(--shadow-md)',
}
