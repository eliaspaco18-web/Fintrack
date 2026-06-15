import appControlData from '@/lib/constants/app-control.json'

export type AppModuleStatus = 'live' | 'maintenance' | 'coming-soon' | 'launch'

export interface AppControlMaintenance {
  enabled: boolean
  title: string
  message: string
}

export interface AppControlModule {
  key: string
  label: string
  href: string
  section: string
  objective: string
  status: AppModuleStatus
  note: string
}

export interface AppControlConfig {
  maintenance: AppControlMaintenance
  modules: AppControlModule[]
}

export const APP_CONTROL_CONFIG = appControlData as AppControlConfig

export function findControlledModuleByKey(key: string) {
  return APP_CONTROL_CONFIG.modules.find(module => module.key === key) ?? null
}

export function findControlledModuleByPath(pathname: string) {
  return (
    [...APP_CONTROL_CONFIG.modules]
      .sort((a, b) => b.href.length - a.href.length)
      .find(module => pathname === module.href || pathname.startsWith(`${module.href}/`))
    ?? null
  )
}

export function countModulesByStatus(status: AppModuleStatus) {
  return APP_CONTROL_CONFIG.modules.filter(module => module.status === status).length
}

export function isSystemMessageRoute(pathname: string) {
  return pathname === '/maintenance' || pathname.startsWith('/module-status/')
}

export function isDeveloperBypassRoute(pathname: string) {
  return pathname.startsWith('/developer') || pathname.startsWith('/api/dev/')
}
