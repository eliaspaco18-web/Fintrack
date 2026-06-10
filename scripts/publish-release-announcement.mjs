#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const { loadEnvConfig } = nextEnv

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const manifestPath = path.join(rootDir, 'lib', 'release', 'current-release.json')

loadEnvConfig(rootDir)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.RESEND_FROM_EMAIL ?? 'FinTrack <noreply@fintrack.app>'
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fintrack.app'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[publish-release-announcement] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!resendApiKey) {
  console.error('[publish-release-announcement] Falta RESEND_API_KEY para enviar correos de release')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const resend = new Resend(resendApiKey)

const HIGHLIGHT_TONES = {
  new: {
    label: 'Nuevo',
    icon: '&#10024;',
    chipBg: '#ecfeff',
    chipText: '#155e75',
    iconBg: '#ccfbf1',
    iconText: '#0f766e',
  },
  improve: {
    label: 'Mejorado',
    icon: '&#9881;',
    chipBg: '#eff6ff',
    chipText: '#1d4ed8',
    iconBg: '#dbeafe',
    iconText: '#1e40af',
  },
  fix: {
    label: 'Corregido',
    icon: '&#10003;',
    chipBg: '#f0fdf4',
    chipText: '#166534',
    iconBg: '#dcfce7',
    iconText: '#15803d',
  },
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function subjectForRelease(release) {
  return `FinTrack ${release.version} ya está disponible`
}

function normalizeHighlight(item, index) {
  if (typeof item === 'string') {
    const detail = item.trim()
    if (!detail) return null
    return {
      module: 'General',
      type: index === 0 ? 'new' : index === 1 ? 'improve' : 'fix',
      title: 'Actualización de FinTrack',
      detail,
    }
  }

  if (!item || typeof item !== 'object') return null

  const module = typeof item.module === 'string' && item.module.trim() ? item.module.trim() : 'General'
  const type = item.type === 'new' || item.type === 'improve' || item.type === 'fix' ? item.type : 'improve'
  const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Actualización de FinTrack'
  const detail = typeof item.detail === 'string' && item.detail.trim()
    ? item.detail.trim()
    : (typeof item.summary === 'string' && item.summary.trim() ? item.summary.trim() : title)

  return { module, type, title, detail }
}

function normalizeHighlights(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((item, index) => normalizeHighlight(item, index))
    .filter(Boolean)
}

function htmlForRelease({ fullName, release }) {
  const safeName = escapeHtml(fullName || 'Hola')
  const safeTitle = escapeHtml(release.title)
  const safeSummary = escapeHtml(release.summary)
  const safeVersion = escapeHtml(release.version)
  const highlightsData = normalizeHighlights(release.highlights)
  const modules = Array.from(new Set(highlightsData.map(item => item.module))).slice(0, 4)
  const moduleChips = modules
    .map((module) => `
      <span style="display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;background:#f8fafc;margin:0 8px 8px 0;">
        ${escapeHtml(module)}
      </span>
    `)
    .join('')
  const highlights = release.highlights
    .map((item, index) => {
      const normalized = normalizeHighlight(item, index)
      if (!normalized) return ''
      const tone = HIGHLIGHT_TONES[normalized.type]
      return `
      <tr>
        <td style="padding:0 0 12px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;">
            <tr>
              <td style="padding:14px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:44px;vertical-align:top;">
                      <div style="height:36px;width:36px;border-radius:12px;background:${tone.iconBg};color:${tone.iconText};font-size:18px;line-height:36px;text-align:center;font-weight:700;">
                        ${tone.icon}
                      </div>
                    </td>
                    <td style="vertical-align:top;">
                      <div style="margin-bottom:8px;">
                        <span style="display:inline-block;border-radius:999px;background:${tone.chipBg};color:${tone.chipText};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;margin:0 8px 6px 0;">
                          ${tone.label}
                        </span>
                        <span style="display:inline-block;border-radius:999px;background:#f8fafc;color:#475569;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;margin-bottom:6px;border:1px solid #dbe1e8;">
                          ${escapeHtml(normalized.module)}
                        </span>
                      </div>
                      <div style="font-size:15px;line-height:1.5;color:#111827;font-weight:700;margin-bottom:4px;">
                        ${escapeHtml(normalized.title)}
                      </div>
                      <div style="font-size:14px;line-height:1.7;color:#475569;">
                        ${escapeHtml(normalized.detail)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    })
    .join('')

  return `
  <div style="background:#f3f5f8;padding:36px 16px;font-family:Inter,Arial,sans-serif;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px -48px rgba(15,23,42,.35);">
      <div style="padding:28px 30px;background:linear-gradient(135deg,#0f766e 0%,#0f766e 30%,#134e4a 100%);color:#ffffff;">
        <div style="display:inline-flex;align-items:center;border-radius:999px;background:rgba(255,255,255,.14);padding:7px 12px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">
          &#128640; Nueva versión
        </div>
        <h1 style="margin:16px 0 10px 0;font-size:30px;line-height:1.1;color:#ffffff;">${safeTitle}</h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:rgba(255,255,255,.88);">${safeSummary}</p>
      </div>
      <div style="padding:28px 30px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0;">
          <tr>
            <td style="padding:0 12px 0 0;">
              <div style="border:1px solid #d1d5db;border-radius:16px;padding:12px 14px;background:#f8fafc;">
                <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;">Versión</div>
                <div style="margin-top:6px;font-size:18px;font-weight:700;color:#111827;">${safeVersion}</div>
              </div>
            </td>
            <td>
              <div style="border:1px solid #d1d5db;border-radius:16px;padding:12px 14px;background:#f8fafc;">
                <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;">Disponible ahora</div>
                <div style="margin-top:6px;font-size:14px;font-weight:600;color:#111827;">FinTrack en producción</div>
              </div>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#374151;">
          ${safeName}, ya publicamos una nueva actualización de FinTrack. Aquí te resumimos, en lenguaje simple, qué mejoró y en qué módulos lo vas a notar.
        </p>

        ${moduleChips ? `<div style="margin:0 0 18px 0;">${moduleChips}</div>` : ''}

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
          ${highlights}
        </table>

        <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 18px;border-radius:14px;">Abrir FinTrack</a>
        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
          Además de este correo, verás un mensaje destacado dentro de la app la primera vez que ingreses después de esta actualización.
        </p>
      </div>
    </div>
  </div>`
}

async function readManifest() {
  const raw = await fs.readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(raw)
  return {
    ...manifest,
    highlights: normalizeHighlights(manifest.highlights),
  }
}

async function upsertRelease(release) {
  const payload = {
    version: release.version,
    series: release.series,
    build_number: release.build,
    title: release.title,
    summary: release.summary,
    highlights: release.highlights,
    commit_sha: process.env.GITHUB_SHA ?? null,
    deployed_at: release.releasedAt,
  }

  const { data, error } = await supabase
    .from('app_releases')
    .upsert(payload, { onConflict: 'version' })
    .select('id, version, title, summary, highlights, deployed_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo registrar la versión publicada')
  }

  return data
}

async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

async function seedUserState(releaseId, userIds) {
  if (userIds.length === 0) return

  const payload = userIds.map((userId) => ({
    release_id: releaseId,
    user_id: userId,
  }))

  const { error } = await supabase
    .from('app_release_user_state')
    .upsert(payload, { onConflict: 'release_id,user_id' })

  if (error) throw new Error(error.message)
}

async function fetchPendingEmails(releaseId) {
  const { data, error } = await supabase
    .from('app_release_user_state')
    .select('id, user_id, email_sent_at')
    .eq('release_id', releaseId)
    .is('email_sent_at', null)

  if (error) throw new Error(error.message)
  return data ?? []
}

async function markReleaseEmailsSent(releaseId) {
  const { error } = await supabase
    .from('app_releases')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', releaseId)

  if (error) throw new Error(error.message)
}

async function sendEmails({ release, releaseId, profilesById }) {
  const pending = await fetchPendingEmails(releaseId)
  if (pending.length === 0) return { sent: 0, skipped: 0, failed: 0, failures: [] }

  let sent = 0
  let skipped = 0
  const failures = []

  for (const row of pending) {
    const profile = profilesById.get(row.user_id)
    const email = profile?.email?.trim()
    if (!email) {
      skipped += 1
      continue
    }

    try {
      const { error } = await resend.emails.send({
        from: emailFrom,
        to: email,
        subject: subjectForRelease(release),
        html: htmlForRelease({
          fullName: profile?.full_name?.trim() || email.split('@')[0] || 'Hola',
          release,
        }),
      })

      if (error) {
        failures.push(`${email}: ${error.message ?? 'send error'}`)
        continue
      }

      sent += 1
      const { error: updateError } = await supabase
        .from('app_release_user_state')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', row.id)

      if (updateError) {
        failures.push(`${email}: ${updateError.message}`)
      }
    } catch (error) {
      failures.push(`${email}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (failures.length === 0) {
    await markReleaseEmailsSent(releaseId)
  }

  return { sent, skipped, failed: failures.length, failures }
}

async function main() {
  const release = await readManifest()
  const releaseRow = await upsertRelease(release)
  const profiles = await fetchProfiles()
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]))

  await seedUserState(releaseRow.id, profiles.map(profile => profile.id))
  const result = await sendEmails({
    release,
    releaseId: releaseRow.id,
    profilesById,
  })

  console.log(
    `[publish-release-announcement] ${release.version} publicado. Correos enviados: ${result.sent}. Omitidos: ${result.skipped}. Fallidos: ${result.failed}.`,
  )

  if (result.failures.length > 0) {
    console.warn(
      `[publish-release-announcement] Advertencia: quedaron correos pendientes para reintento. Detalle: ${result.failures.join(' | ')}`,
    )
  }
}

main().catch((error) => {
  console.error('[publish-release-announcement] error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
