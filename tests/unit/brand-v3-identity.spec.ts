import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const legacyBrandPaths = [
  '/brand/fintrack-mark.png',
  '/brand/fintrack-tab-icon.png',
  '/brand/logo-fintrack.png',
  '/logo.png',
]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(?:tsx?|css|html)$/.test(name) ? [path] : []
  })
}

function pngDimensions(relativePath: string): [number, number] {
  const png = readFileSync(join(root, relativePath))
  expect(png.toString('hex', 0, 8)).toBe('89504e470d0a1a0a')
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

test('active application source uses only the approved V3 identity resources', () => {
  const activeSource = sourceFiles(join(root, 'app'))
    .concat(sourceFiles(join(root, 'components')))
    .concat(sourceFiles(join(root, 'lib')))
    .concat(sourceFiles(join(root, 'supabase', 'email-templates')))
    .map(path => readFileSync(path, 'utf8'))
    .join('\n')

  for (const legacyPath of legacyBrandPaths) {
    expect(activeSource).not.toContain(legacyPath)
  }

  const metadata = readFileSync(join(root, 'app/layout.tsx'), 'utf8')
  expect(metadata).toContain("'/brand/v3/ft-favicon.svg'")
  expect(metadata).toContain("'/brand/v3/ft-favicon-16.png'")
  expect(metadata).toContain("'/brand/v3/ft-favicon-32.png'")
  expect(metadata).toContain("'/brand/v3/ft-favicon-48.png'")
  expect(metadata).toContain("'/brand/v3/ft-apple-touch-icon.png'")

  const brand = readFileSync(join(root, 'components/layout/Brand.tsx'), 'utf8')
  expect(brand).toContain("'/brand/v3/ft-ligature.svg'")
  expect(brand).toContain("'/brand/v3/ft-ligature-dark.svg'")
})

test('V3 favicon and touch icon PNG fallbacks have the declared native sizes', () => {
  expect(pngDimensions('public/brand/v3/ft-favicon-16.png')).toEqual([16, 16])
  expect(pngDimensions('public/brand/v3/ft-favicon-32.png')).toEqual([32, 32])
  expect(pngDimensions('public/brand/v3/ft-favicon-48.png')).toEqual([48, 48])
  expect(pngDimensions('public/brand/v3/ft-apple-touch-icon.png')).toEqual([180, 180])
  expect(pngDimensions('public/brand/v3/ft-ligature.png')).toEqual([256, 256])
})
