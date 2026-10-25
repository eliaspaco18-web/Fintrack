import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('app control uses the approved module names without implying automatic templates', () => {
  const control = JSON.parse(readFileSync(resolve(process.cwd(), 'lib/constants/app-control.json'), 'utf8')) as {
    modules: Array<{ key: string; label: string; href: string; objective: string }>
  }
  const modules = new Map(control.modules.map(module => [module.key, module]))

  expect(modules.get('recurring')).toMatchObject({
    label: 'Plantillas',
    href: '/recurring',
    objective: 'Plantillas para reutilizar movimientos de forma manual.',
  })
  expect(modules.get('alerts')).toMatchObject({ label: 'Avisos', href: '/alerts' })
  expect(modules.get('admin')).toMatchObject({ label: 'Catálogos', href: '/admin' })
})
