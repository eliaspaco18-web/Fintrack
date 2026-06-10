export interface ProductUpdateEntry {
  id: string
  title: string
  message: string
  href?: string
  hrefLabel?: string
  startsAt: string
  endsAt: string
  badgeLabel?: string
}

// Toda mejora visible para usuarios debe agregarse aqui antes del deploy aprobado.
export const PRODUCT_UPDATES: ProductUpdateEntry[] = []

function parseDate(value: string): number | null {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function getActiveProductUpdates(now = new Date()): ProductUpdateEntry[] {
  const currentTime = now.getTime()

  return PRODUCT_UPDATES
    .filter((entry) => {
      const startsAt = parseDate(entry.startsAt)
      const endsAt = parseDate(entry.endsAt)

      if (startsAt === null || endsAt === null) return false
      return currentTime >= startsAt && currentTime <= endsAt
    })
    .sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
}
