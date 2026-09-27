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

test('V3 shell requires an explicit flag and never activates on production', () => {
  expect(isV3ShellEnabled({ NODE_ENV: 'development' })).toBe(false)
  expect(isV3ShellEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(true)
  expect(isV3ShellEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'preview', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(true)
  expect(isV3ShellEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'production', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(false)
  expect(isV3ShellEnabled({ NODE_ENV: 'development', VERCEL_ENV: 'production', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(false)
  expect(isV3ShellEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' })).toBe(false)
})
