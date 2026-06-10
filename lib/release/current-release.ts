import releaseManifest from '@/lib/release/current-release.json'

export type ReleaseHighlightType = 'new' | 'improve' | 'fix'

export interface ReleaseHighlight {
  module: string
  type: ReleaseHighlightType
  title: string
  detail: string
}

export interface ReleaseManifest {
  version: string
  series: string
  build: number
  title: string
  summary: string
  highlights: ReleaseHighlight[]
  releasedAt: string
}

const FALLBACK_TITLES: Record<ReleaseHighlightType, string> = {
  new: 'Nueva capacidad disponible',
  improve: 'Mejora de experiencia',
  fix: 'Corrección operativa',
}

function normalizeType(value: unknown): ReleaseHighlightType {
  return value === 'new' || value === 'improve' || value === 'fix' ? value : 'improve'
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHighlightObject(value: Record<string, unknown>) {
  const moduleName = cleanText(value.module) || 'General'
  const type = normalizeType(value.type)
  const title = cleanText(value.title) || FALLBACK_TITLES[type]
  const detail = cleanText(value.detail) || cleanText(value.summary) || title

  return {
    module: moduleName,
    type,
    title,
    detail,
  } satisfies ReleaseHighlight
}

export function normalizeReleaseHighlights(value: unknown): ReleaseHighlight[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const detail = item.trim()
        if (!detail) return null
        return {
          module: 'General',
          type: 'improve' as const,
          title: 'Actualización de la plataforma',
          detail,
        }
      }

      if (item && typeof item === 'object') {
        return normalizeHighlightObject(item as Record<string, unknown>)
      }

      return null
    })
    .filter((item): item is ReleaseHighlight => item !== null)
}

export const CURRENT_RELEASE = {
  ...releaseManifest,
  highlights: normalizeReleaseHighlights(releaseManifest.highlights),
} as ReleaseManifest
