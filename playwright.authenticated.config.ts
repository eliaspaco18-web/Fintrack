import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

export default defineConfig({
  ...baseConfig,
  testMatch: /authenticated-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/helpers/authenticated-global-setup.ts',
  // Authenticated QA is remote-only. The global setup rejects a missing or
  // unsafe Preview target before a browser can authenticate or mutate data.
  webServer: undefined,
})
