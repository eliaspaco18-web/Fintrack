export interface SvgPoint {
  x: number
  y: number
}

export type PreferredCurrency = 'PEN' | 'USD'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function controlPoint(
  current: SvgPoint,
  previous: SvgPoint = current,
  next: SvgPoint = current,
  reverse = false,
): SvgPoint {
  const smoothing = 0.18
  const angle = Math.atan2(next.y - previous.y, next.x - previous.x) + (reverse ? Math.PI : 0)
  const length = Math.hypot(next.x - previous.x, next.y - previous.y) * smoothing

  return {
    x: current.x + Math.cos(angle) * length,
    y: current.y + Math.sin(angle) * length,
  }
}

export function smoothPath(points: SvgPoint[]): string {
  const first = points[0]
  if (!first || points.length < 2) return ''

  let d = `M ${first.x} ${first.y}`

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!
    const current = points[i]!
    const previous2 = points[i - 2] ?? previous
    const next = points[i + 1] ?? current

    const cp1 = controlPoint(previous, previous2, current)
    const cp2 = controlPoint(current, previous, next, true)

    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${current.x} ${current.y}`
  }

  return d
}

export function formatAxisValue(value: number, preferred: PreferredCurrency): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const symbol = preferred === 'PEN' ? 'S/' : '$'

  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}k`

  return `${sign}${symbol}${abs.toFixed(0)}`
}

export function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): SvgPoint {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180

  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  }
}

export function hexagonPoints(cx: number, cy: number, radius: number, values: number[], maxValue: number): string {
  const safeMax = maxValue || 1

  return values
    .slice(0, 6)
    .map((value, index) => {
      const normalized = clamp(value, 0, safeMax) / safeMax
      const point = polarToCartesian(cx, cy, radius * normalized, index * 60)

      return `${point.x},${point.y}`
    })
    .join(' ')
}
