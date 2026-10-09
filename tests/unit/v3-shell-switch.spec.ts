import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const source = readFileSync(join(process.cwd(), 'lib/flags/v3-shell.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const moduleExports: Record<string, unknown> = {}
new Function('exports', compiled)(moduleExports)
const isV3ShellEnabled = moduleExports.isV3ShellEnabled as (env: Record<string, string | undefined>) => boolean

test('V3 shell keeps Preview opt-in and Production off by default', () => {
  expect(isV3ShellEnabled({ NODE_ENV: 'development' })).toBe(false)
  expect(isV3ShellEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(true)
  expect(isV3ShellEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'preview', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(true)
  expect(isV3ShellEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'production', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(false)
  expect(isV3ShellEnabled({ NODE_ENV: 'development', VERCEL_ENV: 'production', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(false)
  expect(isV3ShellEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(false)
})

test('Production requires its own explicit server-side switch and fails closed', () => {
  expect(isV3ShellEnabled({ VERCEL_ENV: 'production', FINTRACK_V3_SHELL_PRODUCTION: '1' })).toBe(true)
  expect(isV3ShellEnabled({ VERCEL_ENV: 'production', FINTRACK_V3_SHELL_PRODUCTION: '0' })).toBe(false)
  expect(isV3ShellEnabled({ VERCEL_ENV: 'production', FINTRACK_V3_SHELL_PRODUCTION: 'yes' })).toBe(false)
  expect(isV3ShellEnabled({ VERCEL_ENV: 'production', FINTRACK_V3_SHELL_PRODUCTION: '' })).toBe(false)
  expect(isV3ShellEnabled({ VERCEL_ENV: 'production', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1', FINTRACK_V3_SHELL_PRODUCTION: 'invalid' })).toBe(false)
})
