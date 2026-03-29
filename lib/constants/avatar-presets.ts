export const AVATAR_PRESETS = [
  '/avatars/preset-01.svg',
  '/avatars/preset-02.svg',
  '/avatars/preset-03.svg',
  '/avatars/preset-04.svg',
  '/avatars/preset-05.svg',
  '/avatars/preset-06.svg',
  '/avatars/preset-07.svg',
  '/avatars/preset-08.svg',
] as const

export type AvatarPresetPath = (typeof AVATAR_PRESETS)[number]

function hashSeed(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

export function resolveDefaultAvatar(seed?: string | null): AvatarPresetPath {
  const safeSeed = (seed ?? '').trim() || 'fintrack-user'
  const index = hashSeed(safeSeed) % AVATAR_PRESETS.length
  return AVATAR_PRESETS[index] ?? AVATAR_PRESETS[0]
}

export function isAvatarPreset(path: string | null | undefined): path is AvatarPresetPath {
  if (!path) return false
  return AVATAR_PRESETS.includes(path as AvatarPresetPath)
}

export function resolveUserAvatar(
  avatarUrl: string | null | undefined,
  seed?: string | null
): string {
  const custom = avatarUrl?.trim()
  if (custom) return custom
  return resolveDefaultAvatar(seed)
}
