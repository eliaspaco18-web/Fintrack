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

const MODULE_COPY = {
  'Portafolio': {
    type: 'improve',
    title: 'Gestión de cuentas más clara y estable',
    detail: 'Mejoramos las acciones de tus cuentas para que editar, revisar y operar en Portafolio sea más confiable.',
  },
  'Movimientos': {
    type: 'improve',
    title: 'Registro de movimientos más consistente',
    detail: 'Ajustamos el flujo de Movimientos para que registrar operaciones y revisar información sea más claro en el día a día.',
  },
  'Presupuestos': {
    type: 'improve',
    title: 'Control de presupuestos más fácil de seguir',
    detail: 'Refinamos el módulo de Presupuestos para que entiendas mejor tus límites, avance y acciones disponibles.',
  },
  'Créditos': {
    type: 'fix',
    title: 'Seguimiento de créditos más confiable',
    detail: 'Corregimos comportamientos del módulo Créditos para que sus acciones y detalles respondan con mayor consistencia.',
  },
  'Activos': {
    type: 'improve',
    title: 'Administración de activos más ordenada',
    detail: 'Mejoramos el módulo Activos para que registrar, revisar y dar seguimiento a tus bienes sea más fluido.',
  },
  'Por pagar': {
    type: 'fix',
    title: 'Cuentas por pagar con mejor estabilidad',
    detail: 'Ajustamos el módulo Por pagar para que las acciones y el seguimiento de pendientes sean más confiables.',
  },
  'Por cobrar': {
    type: 'fix',
    title: 'Cuentas por cobrar con seguimiento más claro',
    detail: 'Mejoramos el módulo Por cobrar para que revisar saldos pendientes y su origen sea más simple y estable.',
  },
  'Alertas': {
    type: 'improve',
    title: 'Alertas más visibles y oportunas',
    detail: 'Refinamos los avisos para que identifiques mejor recordatorios, eventos y pendientes importantes.',
  },
  'Bancos': {
    type: 'fix',
    title: 'Gestión de bancos y entidades más estable',
    detail: 'Corregimos el catálogo de entidades bancarias para que crear y usar bancos dentro de la app sea más confiable.',
  },
  'Configuración': {
    type: 'improve',
    title: 'Configuración y seguridad más comprensibles',
    detail: 'Mejoramos Configuración para que administrar tu cuenta y tus preferencias resulte más claro.',
  },
  'Importaciones': {
    type: 'new',
    title: 'Base reforzada para futuras importaciones',
    detail: 'Preparamos el módulo de Importaciones para que la migración de información sea más robusta y guiada.',
  },
  'Plataforma': {
    type: 'improve',
    title: 'Publicaciones y operación más confiables',
    detail: 'Fortalecimos la plataforma para que las actualizaciones de FinTrack sean más estables y transparentes para todos.',
  },
}

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
    ? `Actualización en ${primary.join(', ')}`
    : titleFromCommit(commitMessage) || current.title

  const summary = primary.length > 0
    ? `Esta versión trae cambios en ${primary.join(', ')} para que tus tareas diarias dentro de FinTrack sean más claras, estables y fáciles de seguir.`
    : commitMessage || current.summary || title

  const highlights = []

  for (const module of primary) {
    const copy = MODULE_COPY[module]
    if (copy) {
      highlights.push({
        module,
        type: copy.type,
        title: copy.title,
        detail: copy.detail,
      })
    }
  }

  if (highlights.length === 0) {
    highlights.push({
      module: 'General',
      type: 'improve',
      title: 'Actualización general de la plataforma',
      detail: summary,
    })
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
    output.write('Formato recomendado: Modulo | tipo(new/improve/fix) | titulo | detalle\n')
    output.write('Si escribes solo una frase, la guardaremos como mensaje general.\n\n')

    for (let index = 0; index < 3; index += 1) {
      const answer = await rl.question(`Highlight ${index + 1}${index === 0 ? ' (recomendado)' : ''}: `)
      const normalized = answer.trim()
      if (!normalized) {
        if (index === 0) {
          highlights.push({
            module: 'General',
            type: 'improve',
            title: 'Actualización de FinTrack',
            detail: summary,
          })
        }
        break
      }
      const parts = normalized.split('|').map(part => part.trim())
      if (parts.length >= 4) {
        highlights.push({
          module: parts[0] || 'General',
          type: ['new', 'improve', 'fix'].includes(parts[1]) ? parts[1] : 'improve',
          title: parts[2] || 'Actualización de FinTrack',
          detail: parts.slice(3).join(' | ') || parts[2] || 'Actualización de FinTrack',
        })
      } else {
        highlights.push({
          module: 'General',
          type: index === 0 ? 'new' : index === 1 ? 'improve' : 'fix',
          title: 'Actualización de FinTrack',
          detail: normalized,
        })
      }
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
    .map((item, index) => {
      const parts = item.split('|').map(part => part.trim())
      if (parts.length >= 4) {
        return {
          module: parts[0] || 'General',
          type: ['new', 'improve', 'fix'].includes(parts[1]) ? parts[1] : 'improve',
          title: parts[2] || 'Actualización de FinTrack',
          detail: parts.slice(3).join(' | ') || parts[2] || 'Actualización de FinTrack',
        }
      }

      return {
        module: 'General',
        type: index === 0 ? 'new' : index === 1 ? 'improve' : 'fix',
        title: 'Actualización de FinTrack',
        detail: item,
      }
    })

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
