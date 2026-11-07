import { expect, test } from '@playwright/test'
import { resolveConfiguredAppUrl } from '@/lib/server/app-url'

test('Preview auth links prefer the deployment URL over Vercel Production URL', () => {
  expect(resolveConfiguredAppUrl({
    NODE_ENV: 'test',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'fintrack-pr-64-preview.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'fintrack-eta-silk.vercel.app',
  })).toBe('https://fintrack-pr-64-preview.vercel.app')
})

test('Preview refuses Production domains and falls through to a safe Preview candidate', () => {
  expect(resolveConfiguredAppUrl({
    NODE_ENV: 'test',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'fintrack-eta-silk.vercel.app',
    NEXT_PUBLIC_APP_URL: 'https://fintrack-pr-64-preview.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'fintrack-eta-silk.vercel.app',
  })).toBe('https://fintrack-pr-64-preview.vercel.app')

  expect(resolveConfiguredAppUrl({
    NODE_ENV: 'test',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_APP_URL: 'https://fintrack-eta-silk.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'fintrack-eta-silk.vercel.app',
  })).toBeNull()
})

test('Production URL precedence remains unchanged outside Preview', () => {
  expect(resolveConfiguredAppUrl({
    NODE_ENV: 'test',
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_PRODUCTION_URL: 'fintrack-eta-silk.vercel.app',
    VERCEL_URL: 'fintrack-pr-64-preview.vercel.app',
  })).toBe('https://fintrack-eta-silk.vercel.app')
})
