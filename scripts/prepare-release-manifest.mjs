#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const manifestPath = path.join(rootDir, 'lib', 'release', 'current-release.json')
const commitMessage = process.argv.slice(2).join(' ').trim()
const interactiveMode = process.env.RELEASE_INTERACTIVE === 'true'

function normalizeSeries(value) {
  const trimmed = String(value ?? '').trim().replace(/^V/i, '')
  if (!/^\d+\.\d+\.\d+$/.test(trimmed)) {
    throw new Error('La serie de versión debe verse como 1.1.1')
  }
  return trimmed
}

function normalizeText(value, fallback) {
  const trimmed = String(value ?? '').trim()
  return trimmed || fallback
}

function titleFromCommit(message) {
  if (!message) return 'Actualización de producto'
  return message
    .replace(/^release:\s*/i, '')
    .replace(/^feat:\s*/i, '')
    .replace(/^fix:\s*/i, '')
    .trim() || 'Actualización de producto'
}

function currentChangedFiles() {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: rootDir,
      encoding: 'utf8',
    })

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.slice(3).trim())
  } catch {
    return []
  }
}

function detectModules(files) {
  const modules = new Set()

  for (const file of files) {
    const normalized = file.toLowerCase()
    if (normalized.includes('/portfolio') || normalized.includes('/accounts')) modules.add('Portafolio')
    if (normalized.includes('/transactions')) modules.add('Movimientos')
    if (normalized.includes('/budgets')) modules.add('Presupuestos')
    if (normalized.includes('/credits')) modules.add('Créditos')
    if (normalized.includes('/assets')) modules.add('Activos')
    if (normalized.includes('/payables')) modules.add('Por pagar')
    if (normalized.includes('/receivables')) modules.add('Por cobrar')
    if (normalized.includes('/alerts') || normalized.includes('/notifications')) modules.add('Alertas')
    if (normalized.includes('/bank-entities')) modules.add('Bancos')
    if (normalized.includes('/settings') || normalized.includes('/profile')) modules.add('Configuración')
    if (normalized.includes('/imports')) modules.add('Importaciones')
    if (normalized.includes('/release') || normalized.includes('production-release')) modules.add('Plataforma')
  }

  return Array.from(modules)
}

function buildAutomaticCopy({ files, commitMessage, current }) {
  const modules = detectModules(files)
  const primary = modules.slice(0, 3)
  const title = primary.length > 0
    ? `Mejoras en ${primary.join(', ')}`
    : titleFromCommit(commitMessage) || current.title

  const summary = primary.length > 0
    ? `Esta versión mejora ${primary.join(', ').toLowerCase()} para dejar la operación más estable y fluida en producción.`
    : commitMessage || current.summary || title

  const highlights = []

  for (const module of primary) {
    if (module === 'Portafolio') highlights.push('Correcciones y mejoras operativas en Portafolio y cuentas.')
    else if (module === 'Movimientos') highlights.push('Ajustes en Movimientos para un registro más estable y consistente.')
    else if (module === 'Presupuestos') highlights.push('Mejoras en Presupuestos para revisar y controlar tus límites con más claridad.')
    else if (module === 'Créditos') highlights.push('Optimización en Créditos para acciones y seguimiento más confiables.')
    else if (module === 'Activos') highlights.push('Ajustes en Activos para una gestión más clara y sin fricciones.')
    else if (module === 'Por pagar') highlights.push('Mejoras en Por pagar para seguimiento y acciones más estables.')
    else if (module === 'Por cobrar') highlights.push('Mejoras en Por cobrar para un control más confiable del flujo pendiente.')
    else if (module === 'Alertas') highlights.push('Refuerzo en Alertas y avisos para que la información importante sea más visible.')
    else if (module === 'Bancos') highlights.push('Ajustes en Bancos y entidades para un manejo más estable del catálogo financiero.')
    else if (module === 'Configuración') highlights.push('Mejoras en Configuración y seguridad para una administración más clara.')
    else if (module === 'Importaciones') highlights.push('Mejoras en Importaciones para preparar una migración de datos más robusta.')
    else if (module === 'Plataforma') highlights.push('Mejoras internas de plataforma para hacer más confiable el despliegue y la operación.')
  }

  if (highlights.length === 0) {
    highlights.push(summary)
  }

  return {
    title,
    summary,
    highlights: highlights.slice(0, 3),
  }
}

async function readCurrentManifest() {
  const raw = await fs.readFile(manifestPath, 'utf8')
  return JSON.parse(raw)
}

async function promptInteractive(current) {
  const rl = readline.createInterface({ input, output })

  try {
    const requestedSeries = await rl.question(`Serie de versión [${current.series}]: `)
    const series = normalizeSeries(requestedSeries || current.series)
    const build = series === current.series ? Number(current.build ?? 0) + 1 : 1
    const version = `V${series}.${build}`

    const defaultTitle = titleFromCommit(commitMessage) || current.title
    const title = normalizeText(
      await rl.question(`Título visible para usuarios [${defaultTitle}]: `),
      defaultTitle,
    )

    const defaultSummary = commitMessage || current.summary || title
    const summary = normalizeText(
      await rl.question(`Resumen corto del release [${defaultSummary}]: `),
      defaultSummary,
    )

    const highlights = []
    output.write('\nIngresa hasta 3 mejoras o correcciones clave.\n')
    output.write('Deja vacío y presiona Enter para terminar.\n\n')

    for (let index = 0; index < 3; index += 1) {
      const answer = await rl.question(`Highlight ${index + 1}${index === 0 ? ' (recomendado)' : ''}: `)
      const normalized = answer.trim()
      if (!normalized) {
        if (index === 0) {
          highlights.push(summary)
        }
        break
      }
      highlights.push(normalized)
    }

    return {
      version,
      series,
      build,
      title,
      summary,
      highlights,
      releasedAt: new Date().toISOString(),
    }
  } finally {
    rl.close()
  }
}

function buildNonInteractive(current) {
  const files = currentChangedFiles()
  const autoCopy = buildAutomaticCopy({ files, commitMessage, current })
  const series = normalizeSeries(process.env.RELEASE_SERIES || current.series)
  const build = series === current.series ? Number(current.build ?? 0) + 1 : 1
  const version = `V${series}.${build}`
  const title = normalizeText(process.env.RELEASE_TITLE, autoCopy.title)
  const summary = normalizeText(process.env.RELEASE_SUMMARY, autoCopy.summary)
  const highlightsFromEnv = String(process.env.RELEASE_HIGHLIGHTS ?? '')
    .split('||')
    .map(item => item.trim())
    .filter(Boolean)

  const highlights = highlightsFromEnv.length > 0 ? highlightsFromEnv.slice(0, 3) : autoCopy.highlights

  return {
    version,
    series,
    build,
    title,
    summary,
    highlights,
    releasedAt: new Date().toISOString(),
  }
}

async function main() {
  const current = await readCurrentManifest()
  const nextManifest = interactiveMode && process.stdin.isTTY
    ? await promptInteractive(current)
    : buildNonInteractive(current)

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    'utf8',
  )

  output.write(`\nVersión preparada: ${nextManifest.version}\n`)
  output.write(`Título: ${nextManifest.title}\n`)
}

main().catch((error) => {
  console.error('[prepare-release-manifest] error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
