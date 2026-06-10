import releaseManifest from '@/lib/release/current-release.json'

export interface ReleaseManifest {
  version: string
  series: string
  build: number
  title: string
  summary: string
  highlights: string[]
  releasedAt: string
}

export const CURRENT_RELEASE = releaseManifest as ReleaseManifest

export function releaseHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}
