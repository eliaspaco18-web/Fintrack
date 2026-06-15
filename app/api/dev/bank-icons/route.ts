import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const MAX_ICON_BYTES = 2 * 1024 * 1024
const MANIFEST_PATH = path.join(process.cwd(), 'lib', 'constants', 'bank-logo-presets.json')
const BANKS_DIR = path.join(process.cwd(), 'public', 'banks')

interface BankLogoPreset {
  value: string
  label: string
  imageSrc: string
}

function jsonError(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status })
}

function sanitizeLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function ensureUniqueSlug(baseSlug: string, presets: BankLogoPreset[]) {
  const usedValues = new Set(presets.map(preset => preset.value))
  const usedFiles = new Set(presets.map(preset => path.basename(preset.imageSrc, '.png')))
  let candidate = baseSlug || 'banco'
  let index = 2

  while (usedValues.has(`bank-${candidate}`) || usedFiles.has(candidate)) {
    candidate = `${baseSlug || 'banco'}-${index}`
    index += 1
  }

  return candidate
}

async function readPresets(): Promise<BankLogoPreset[]> {
  const raw = await readFile(MANIFEST_PATH, 'utf8')
  const parsed = JSON.parse(raw) as BankLogoPreset[]

  return parsed.filter(preset => (
    typeof preset.value === 'string'
    && typeof preset.label === 'string'
    && typeof preset.imageSrc === 'string'
    && preset.imageSrc.startsWith('/banks/')
    && preset.imageSrc.endsWith('.png')
  ))
}

async function writePresets(presets: BankLogoPreset[]) {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(presets, null, 2)}\n`)
}

function getPresetFileName(preset: BankLogoPreset) {
  if (!preset.imageSrc.startsWith('/banks/')) return null

  const fileName = path.basename(preset.imageSrc)
  if (!fileName.endsWith('.png')) return null

  return fileName
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return jsonError('El editor de logos predefinidos solo está disponible en desarrollo.', 403)
  }

  const presets = await readPresets()

  return Response.json({
    ok: true,
    presets,
  })
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return jsonError('El editor de logos predefinidos solo está disponible en desarrollo.', 403)
  }

  const formData = await request.formData()
  const value = String(formData.get('value') ?? '')
  const label = sanitizeLabel(String(formData.get('label') ?? ''))
  const file = formData.get('file')
  const presets = await readPresets()
  const existingIndex = presets.findIndex(preset => preset.value === value)
  const isExisting = existingIndex >= 0

  if (label.length < 2) {
    return jsonError('Escribe un nombre de banco válido.')
  }

  if (label.length > 56) {
    return jsonError('El nombre del banco debe tener 56 caracteres como máximo.')
  }

  if (!isExisting && !(file instanceof File)) {
    return jsonError('Para crear un banco nuevo debes subir y ajustar su logo.')
  }

  if (file instanceof File && file.type !== 'image/png') {
    return jsonError('El editor debe enviar un PNG final.')
  }

  if (file instanceof File && file.size > MAX_ICON_BYTES) {
    return jsonError('El icono final supera el tamaño máximo permitido.')
  }

  const nextPresets = [...presets]
  const existingPreset = isExisting ? nextPresets[existingIndex] : null

  if (isExisting && !existingPreset) {
    return jsonError('No se pudo preparar el banco seleccionado.')
  }

  const preset: BankLogoPreset = existingPreset
    ? { ...existingPreset }
    : (() => {
        const slug = ensureUniqueSlug(slugify(label), presets)
        return {
          value: `bank-${slug}`,
          label,
          imageSrc: `/banks/${slug}.png`,
        }
      })()

  preset.label = label

  const fileName = getPresetFileName(preset)
  if (!fileName) {
    return jsonError('El banco seleccionado no tiene una ruta de logo válida.')
  }

  if (file instanceof File) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const destination = path.join(BANKS_DIR, fileName)

    await mkdir(BANKS_DIR, { recursive: true })
    await writeFile(destination, bytes)
  }

  if (isExisting) {
    nextPresets[existingIndex] = preset
  } else {
    nextPresets.push(preset)
  }

  await writePresets(nextPresets)

  return Response.json({
    ok: true,
    preset,
    presets: nextPresets,
    path: preset.imageSrc,
  })
}
