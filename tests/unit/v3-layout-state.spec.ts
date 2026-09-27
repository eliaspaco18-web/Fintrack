import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const source = readFileSync(join(process.cwd(), 'lib/hooks/layout-state.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const moduleExports: Record<string, unknown> = {}
new Function('exports', compiled)(moduleExports)

const resolveSidebarMode = moduleExports.resolveSidebarMode as (width: number, collapsed: boolean) => string
const workspaceFlipOffset = moduleExports.workspaceFlipOffset as (previousWidth: number, nextWidth: number, currentTranslation?: number) => number
const readSidebarPreference = moduleExports.readSidebarPreference as (storage: { getItem: (key: string) => string | null }) => boolean
const writeSidebarPreference = moduleExports.writeSidebarPreference as (storage: { setItem: (key: string, value: string) => void }, value: boolean) => void

test('desktop preference does not alter mobile or tablet shell mode', () => {
  expect(resolveSidebarMode(320, true)).toBe('hidden')
  expect(resolveSidebarMode(767, false)).toBe('hidden')
  expect(resolveSidebarMode(768, false)).toBe('collapsed')
  expect(resolveSidebarMode(1199, true)).toBe('collapsed')
  expect(resolveSidebarMode(1200, false)).toBe('expanded')
  expect(resolveSidebarMode(1200, true)).toBe('collapsed')
})

test('preference keeps the legacy key and string boolean without blocking denied storage', () => {
  let stored = ''
  const storage = {
    getItem: (key: string) => key === 'sidebar-collapsed' ? stored : null,
    setItem: (key: string, value: string) => {
      expect(key).toBe('sidebar-collapsed')
      stored = value
    },
  }
  writeSidebarPreference(storage, true)
  expect(stored).toBe('true')
  expect(readSidebarPreference(storage)).toBe(true)
  writeSidebarPreference(storage, false)
  expect(readSidebarPreference(storage)).toBe(false)
  expect(readSidebarPreference({ getItem: () => { throw new Error('denied') } })).toBe(false)
  expect(() => writeSidebarPreference({ setItem: () => { throw new Error('denied') } }, true)).not.toThrow()
})

test('workspace FLIP starts from the current visible pose, including an interrupted reversal', () => {
  expect(workspaceFlipOffset(208, 68)).toBe(140)
  expect(workspaceFlipOffset(68, 208)).toBe(-140)
  expect(workspaceFlipOffset(68, 208, 82)).toBe(-58)
})
