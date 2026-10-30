#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const [, , beforePath, afterPath] = process.argv
if (!beforePath || !afterPath) {
  console.error('Usage: node scripts/db-certification/compare-snapshots.mjs BEFORE.json AFTER.json')
  process.exit(2)
}

const read = path => {
  const raw = readFileSync(path, 'utf8').trim()
  const start = raw.indexOf('{')
  if (start < 0) throw new Error(`No JSON object found in ${path}`)
  return JSON.parse(raw.slice(start))
}

const before = read(beforePath)
const after = read(afterPath)
const ignored = new Set(['captured_at', 'database'])
const changes = []

function flatten(value, prefix = '', result = new Map()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (!prefix && ignored.has(key)) continue
      flatten(child, prefix ? `${prefix}.${key}` : key, result)
    }
  } else {
    result.set(prefix, String(value))
  }
  return result
}

function decimalDelta(left, right) {
  if (!/^-?\d+(?:\.\d+)?$/.test(left) || !/^-?\d+(?:\.\d+)?$/.test(right)) return null
  const scale = Math.max((left.split('.')[1] || '').length, (right.split('.')[1] || '').length)
  const toUnits = value => {
    const negative = value.startsWith('-')
    const [whole, fraction = ''] = value.replace('-', '').split('.')
    const units = BigInt(whole + fraction.padEnd(scale, '0'))
    return negative ? -units : units
  }
  const delta = toUnits(right) - toUnits(left)
  const negative = delta < 0n
  const absolute = (negative ? -delta : delta).toString().padStart(scale + 1, '0')
  const formatted = scale ? `${absolute.slice(0, -scale)}.${absolute.slice(-scale)}` : absolute
  return `${negative ? '-' : ''}${formatted}`
}

const oldValues = flatten(before)
const newValues = flatten(after)
for (const path of [...new Set([...oldValues.keys(), ...newValues.keys()])].sort()) {
  const oldValue = oldValues.get(path) ?? '(missing)'
  const newValue = newValues.get(path) ?? '(missing)'
  if (oldValue !== newValue) {
    const delta = decimalDelta(oldValue, newValue)
    changes.push({ path, before: oldValue, after: newValue, ...(delta === null ? {} : { exact_delta: delta }) })
  }
}

console.log(JSON.stringify({ change_count: changes.length, changes }, null, 2))
if (changes.length === 0) console.log('No measured differences. Review schema and migration ledger separately.')
