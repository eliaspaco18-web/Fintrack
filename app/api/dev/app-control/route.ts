import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import type { AppControlConfig, AppControlModule, AppControlMaintenance, AppModuleStatus } from '@/lib/constants/app-control'

export const runtime = 'nodejs'

const APP_CONTROL_PATH = path.join(process.cwd(), 'lib', 'constants', 'app-control.json')
const MODULE_STATUSES: AppModuleStatus[] = ['live', 'maintenance', 'coming-soon', 'launch']

function jsonError(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status })
}

async function readConfig(): Promise<AppControlConfig> {
  const raw = await readFile(APP_CONTROL_PATH, 'utf8')
  return JSON.parse(raw) as AppControlConfig
}

function sanitizeText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.trim().replace(/\s+/g, ' ')
}

function validateMaintenance(input: unknown): AppControlMaintenance | null {
  if (!input || typeof input !== 'object') return null

  const maintenance = input as Partial<AppControlMaintenance>
  const title = sanitizeText(maintenance.title)
  const message = sanitizeText(maintenance.message)

  if (typeof maintenance.enabled !== 'boolean') return null
  if (title.length < 4 || title.length > 80) return null
  if (message.length < 12 || message.length > 220) return null

  return {
    enabled: maintenance.enabled,
    title,
    message,
  }
}

function validateModules(input: unknown): AppControlModule[] | null {
  if (!Array.isArray(input)) return null

  const validated: AppControlModule[] = []

  for (const item of input) {
    if (!item || typeof item !== 'object') return null

    const moduleInfo = item as Partial<AppControlModule>
    const key = sanitizeText(moduleInfo.key)
    const label = sanitizeText(moduleInfo.label)
    const href = sanitizeText(moduleInfo.href)
    const section = sanitizeText(moduleInfo.section)
    const objective = sanitizeText(moduleInfo.objective)
    const note = sanitizeText(moduleInfo.note)

    if (!MODULE_STATUSES.includes(moduleInfo.status as AppModuleStatus)) return null
    if (!key || !label || !href.startsWith('/') || !section || objective.length < 8) return null
    if (note.length > 160) return null

    validated.push({
      key,
      label,
      href,
      section,
      objective,
      status: moduleInfo.status as AppModuleStatus,
      note,
    })
  }

  return validated
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return jsonError('El centro de control solo está disponible en desarrollo.', 403)
  }

  const config = await readConfig()

  return Response.json({
    ok: true,
    config,
  })
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return jsonError('El centro de control solo está disponible en desarrollo.', 403)
  }

  const payload = await request.json().catch(() => null)
  const maintenance = validateMaintenance(payload?.maintenance)
  const modules = validateModules(payload?.modules)

  if (!maintenance || !modules) {
    return jsonError('La configuración del centro de control no es válida.')
  }

  const config: AppControlConfig = {
    maintenance,
    modules,
  }

  await writeFile(APP_CONTROL_PATH, `${JSON.stringify(config, null, 2)}\n`)

  return Response.json({
    ok: true,
    config,
  })
}
