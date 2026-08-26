import { requireAuthenticatedQaTarget } from './qa-target'

export default function authenticatedGlobalSetup() {
  const target = requireAuthenticatedQaTarget()

  console.log(`Authenticated QA preflight passed for Preview host: ${target.hostname}`)
}
