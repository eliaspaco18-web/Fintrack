import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const source = readFileSync(join(process.cwd(), 'lib/flags/v3-shell.ts'), 'utf8')
const dashboardSource = readFileSync(join(process.cwd(), 'app/(dashboard)/dashboard/page.tsx'), 'utf8')
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

test('dashboard renders Round 07 in each explicitly enabled environment and falls back when disabled', () => {
  const parsed = ts.createSourceFile('dashboard/page.tsx', dashboardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const importRanges = parsed.statements
    .filter(ts.isImportDeclaration)
    .map(statement => ({ start: statement.getStart(parsed), end: statement.end }))
  let pageWithoutImports = parsed.text
  importRanges.sort((a, b) => b.start - a.start).forEach(range => {
    pageWithoutImports = `${pageWithoutImports.slice(0, range.start)}${pageWithoutImports.slice(range.end)}`
  })
  const dashboardCompiled = ts.transpileModule(pageWithoutImports, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText
  const dashboardExports: Record<string, unknown> = {}
  const React = { createElement: (type: unknown) => ({ type }) }
  const DashboardClient = () => null
  const DashboardRound07 = () => null
  const buildPage = (env: Record<string, string | undefined>) => {
    new Function('exports', 'React', 'DashboardClient', 'DashboardRound07', 'isV3ShellEnabled', dashboardCompiled)(
      dashboardExports,
      React,
      DashboardClient,
      DashboardRound07,
      () => isV3ShellEnabled(env),
    )
    return (dashboardExports.default as () => { type: unknown })()
  }

  expect(buildPage({ NODE_ENV: 'production', VERCEL_ENV: 'production' }).type).toBe(DashboardClient)
  expect(buildPage({ NODE_ENV: 'production', VERCEL_ENV: 'production', FINTRACK_V3_SHELL_PRODUCTION: '1' }).type).toBe(DashboardRound07)
  expect(buildPage({ NODE_ENV: 'production', VERCEL_ENV: 'preview', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' }).type).toBe(DashboardRound07)
  expect(buildPage({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }).type).toBe(DashboardClient)
  expect(buildPage({ NODE_ENV: 'development', NEXT_PUBLIC_FINTRACK_V3_SHELL: '1' }).type).toBe(DashboardRound07)
})
