import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('late create query does not reset an already open credit form', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/credits/CreditsWorkspace.tsx'), 'utf8')
  const queryEffect = source.slice(source.indexOf('  useEffect(() => {\n    if (openFromQuery) {'))

  expect(queryEffect).toMatch(/if \(handledRef\.current\) return\s+handledRef\.current = true[\s\S]*?if \(isModalOpen\) return\s+setModalStep\('select_type'\)/)
  expect(queryEffect).toContain('}, [openFromQuery, isModalOpen])')
})
