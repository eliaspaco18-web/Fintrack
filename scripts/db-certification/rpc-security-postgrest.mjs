#!/usr/bin/env node
/**
 * PostgREST authorization regression for SECURITY DEFINER RPCs.
 * Use only against the dedicated disposable local stack documented in
 * docs/database-certification/rpc-security-rehearsal.md.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const expectedMarker = 'fintrack-rpc-security-disposable'
if (process.env.FINTRACK_RPC_SECURITY_TARGET !== expectedMarker) {
  throw new Error(`Refusing to run: set FINTRACK_RPC_SECURITY_TARGET=${expectedMarker} only for the disposable local stack`)
}

const urlText = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!urlText || !anonKey || !serviceKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required')
}

const url = new URL(urlText)
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== '55321' || url.username || url.password || url.search || url.hash) {
  throw new Error('Refusing non-local target: expected plain HTTP loopback on dedicated API port 55321')
}

function jwtPayload(token) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Expected a local JWT-shaped API key')
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
}
if (jwtPayload(anonKey).role !== 'anon' || jwtPayload(serviceKey).role !== 'service_role') {
  throw new Error('The supplied local keys do not have the expected anon/service_role claims')
}

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
const admin = createClient(urlText, serviceKey, { auth: authOptions })
const anonymous = createClient(urlText, anonKey, { auth: authOptions })
const suffix = randomUUID()
const password = `${randomUUID()}Aa9!`
const users = []
let clientA
let clientB
let testFailed = false

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function createSyntheticUser(label) {
  const email = `ft-rpc-security-${label}-${suffix}@example.test`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RPC Security ${label}` },
  })
  if (data.user) users.push(data.user.id)
  if (error || !data.user) throw new Error(`Could not create synthetic user ${label}: ${error?.message ?? 'missing user'}`)
  const client = createClient(urlText, anonKey, { auth: authOptions })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error || !signedIn.data.user) throw new Error(`Could not authenticate synthetic user ${label}: ${signedIn.error?.message ?? 'missing user'}`)
  return { id: data.user.id, client }
}

async function categorySnapshot(userId) {
  const { data, error } = await admin
    .from('categories')
    .select('id,name,scope,is_system,system_key,sort_order')
    .eq('user_id', userId)
    .order('id')
  if (error) throw new Error(`Could not inspect synthetic categories: ${error.message}`)
  return JSON.stringify(data ?? [])
}

async function expectDenied(label, result) {
  assert(result.error, `${label}: RPC unexpectedly succeeded`)
  assert(result.error.code === '42501', `${label}: expected SQLSTATE 42501, received ${result.error.code ?? 'no code'}`)
}

try {
  const userA = await createSyntheticUser('a')
  const userB = await createSyntheticUser('b')
  clientA = userA.client
  clientB = userB.client

  // Registration trigger must continue to seed each newly created profile.
  for (const [label, userId] of [['A', userA.id], ['B', userB.id]]) {
    const { count, error } = await admin
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (error) throw new Error(`Could not check ${label}'s registration categories: ${error.message}`)
    assert((count ?? 0) > 0, `Registration trigger did not seed categories for synthetic user ${label}`)
  }

  const ownDashboard = await clientA.rpc('fn_dashboard_summary', { p_user_id: userA.id })
  assert(!ownDashboard.error && ownDashboard.data && typeof ownDashboard.data === 'object',
    `Authenticated user could not read their own dashboard: ${ownDashboard.error?.message ?? 'empty result'}`)

  await expectDenied('Anonymous dashboard RPC', await anonymous.rpc('fn_dashboard_summary', { p_user_id: userB.id }))
  await expectDenied('User A reading user B dashboard', await clientA.rpc('fn_dashboard_summary', { p_user_id: userB.id }))

  // Use the service key only for snapshots and cleanup, never for the tested RPC.
  const before = await categorySnapshot(userB.id)
  await expectDenied('Anonymous category seeder RPC', await anonymous.rpc('fn_seed_default_categories', { p_user_id: userB.id }))
  assert((await categorySnapshot(userB.id)) === before, 'Anonymous seeder attempt changed user B categories')
  await expectDenied('User A seeding user B categories', await clientA.rpc('fn_seed_default_categories', { p_user_id: userB.id }))
  assert((await categorySnapshot(userB.id)) === before, 'User A seeder attempt changed user B categories')
  await expectDenied('service_role category seeder RPC', await admin.rpc('fn_seed_default_categories', { p_user_id: userB.id }))
  assert((await categorySnapshot(userB.id)) === before, 'service_role seeder attempt changed user B categories')
  await expectDenied('service_role dashboard RPC', await admin.rpc('fn_dashboard_summary', { p_user_id: userB.id }))

  console.log('PASS: own dashboard, anonymous/cross-user denials, private seeder ACL, unchanged foreign categories, and registration trigger')
} catch (error) {
  testFailed = true
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  await clientA?.auth.signOut().catch(() => {})
  await clientB?.auth.signOut().catch(() => {})
  for (const userId of users.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      testFailed = true
      console.error(`CLEANUP REQUIRED: synthetic auth user could not be deleted (${error.code ?? 'unknown error'}); inspect only the disposable local stack`)
    }
  }
}

if (testFailed) process.exitCode = 1
