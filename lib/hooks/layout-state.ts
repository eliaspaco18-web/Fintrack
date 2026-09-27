/** Viewport-only shell state. Desktop preference is deliberately ignored on tablet/mobile. */
export const LAYOUT_MOBILE_MAX = 767
export const LAYOUT_TABLET_MAX = 1199

export type SidebarMode = 'expanded' | 'collapsed' | 'hidden'

export function resolveSidebarMode(width: number, desktopCollapsed: boolean): SidebarMode {
  if (width > 0 && width <= LAYOUT_MOBILE_MAX) return 'hidden'
  if (width > LAYOUT_MOBILE_MAX && width <= LAYOUT_TABLET_MAX) return 'collapsed'
  return desktopCollapsed ? 'collapsed' : 'expanded'
}

/** Preserve the workspace's visible X when the rail layout commits immediately. */
export function workspaceFlipOffset(previousWidth: number, nextWidth: number, currentTranslation = 0): number {
  return previousWidth + currentTranslation - nextWidth
}

export function readSidebarPreference(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem('sidebar-collapsed') === 'true'
  } catch {
    return false
  }
}

export function writeSidebarPreference(storage: Pick<Storage, 'setItem'>, collapsed: boolean): void {
  try {
    storage.setItem('sidebar-collapsed', String(collapsed))
  } catch {
    // Private or disabled storage must not block navigation.
  }
}
