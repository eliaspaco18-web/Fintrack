#!/usr/bin/env node
/**
 * Before/after PostgREST authorization regression for SECURITY DEFINER RPCs.
 * Use only against the dedicated disposable local stacks documented in
 * docs/database-certification/rpc-security-rehearsal.md.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const phase = process.env.RPC_SECURITY_PHASE
const expectedTarget = 'fintrack-rpc-security-rehearsal'
if (!['before', 'after'].includes(phase) || process.env.FINTRACK_RPC_SECURITY_TARGET !== expectedTarget) {
  throw new Error(`Set RPC_SECURITY_PHASE=before|after and FINTRACK_RPC_SECURITY_TARGET=${expectedTarget} only for the isolated stack`)
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

async function removeSyntheticCategory(userId, name) {
  const { data, error } = await admin
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .eq('scope', 'EXPENSE')
    .maybeSingle()
  if (error || !data) throw new Error(`Synthetic seed category ${name} was not found: ${error?.message ?? 'missing row'}`)
  const removed = await admin.from('categories').delete().eq('id', data.id)
  if (removed.error) throw new Error(`Could not prepare synthetic category test: ${removed.error.message}`)
  return categorySnapshot(userId)
}

async function expectDenied(label, result) {
  assert(result.error, `${label}: RPC unexpectedly succeeded`)
  assert(result.error.code === '42501', `${label}: expected SQLSTATE 42501, received ${result.error.code ?? 'no code'}`)
}

async function assertDashboardContainsSyntheticAccount(result, expectedName, label) {
  assert(!result.error, `${label}: RPC failed: ${result.error?.message ?? 'unknown error'}`)
  assert(Array.isArray(result.data?.accounts), `${label}: dashboard JSON has no accounts array`)
  assert(result.data.accounts.some(account => account.name === expectedName), `${label}: did not return user B's synthetic account`)
}

async function observeSeeder(actingClient, label, userBId, categoryName) {
  const before = await removeSyntheticCategory(userBId, categoryName)
  const result = await actingClient.rpc('fn_seed_default_categories', { p_user_id: userBId })
  const after = await categorySnapshot(userBId)
  if (result.error) {
    assert(after === before, `${label}: denied call changed user B categories`)
    console.log(`${label}: denied (${result.error.code ?? 'no SQLSTATE'}); B's category snapshot unchanged`)
    return false
  }
  assert(after !== before, `${label}: RPC returned success but did not restore the deleted synthetic category`)
  console.log(`${label}: execution allowed and restored a synthetic category for B`)
  return true
}

try {
  const userA = await createSyntheticUser('a')
  const userB = await createSyntheticUser('b')
  clientA = userA.client
  clientB = userB.client

  // The Auth trigger itself must continue to seed each new synthetic profile.
  for (const [label, userId] of [['A', userA.id], ['B', userB.id]]) {
    const { count, error } = await admin
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (error) throw new Error(`Could not check ${label}'s registration categories: ${error.message}`)
    assert((count ?? 0) > 0, `Registration trigger did not seed categories for synthetic user ${label}`)
  }

  const accountName = `SYNTHETIC-RPC-B-${suffix}`
  const createdAccount = await admin.from('accounts').insert({
    user_id: userB.id,
    name: accountName,
    currency: 'PEN',
    balance: 4321.98,
    initial_balance: 4321.98,
  })
  if (createdAccount.error) throw new Error(`Could not create synthetic dashboard fixture: ${createdAccount.error.message}`)

  const ownDashboard = await clientA.rpc('fn_dashboard_summary', { p_user_id: userA.id })
  assert(!ownDashboard.error && ownDashboard.data && typeof ownDashboard.data === 'object',
    `Authenticated user could not read their own dashboard: ${ownDashboard.error?.message ?? 'empty result'}`)

  const crossUserDashboard = await clientA.rpc('fn_dashboard_summary', { p_user_id: userB.id })
  const anonymousDashboard = await anonymous.rpc('fn_dashboard_summary', { p_user_id: userB.id })

  if (phase === 'before') {
    await assertDashboardContainsSyntheticAccount(crossUserDashboard, accountName, 'Baseline A -> B dashboard')
    console.log('BASELINE VULNERABILITY: authenticated user A received user B synthetic account data')
    if (!anonymousDashboard.error) {
      await assertDashboardContainsSyntheticAccount(anonymousDashboard, accountName, 'Baseline anon dashboard')
      console.log('BASELINE EXPOSURE: anonymous RPC returned user B synthetic account data')
    } else {
      console.log(`Baseline anon dashboard denied by its effective ACL (${anonymousDashboard.error.code ?? 'no SQLSTATE'})`)
    }
    await observeSeeder(anonymous, 'Baseline anon seeder', userB.id, 'Comida')
    await observeSeeder(clientA, 'Baseline A -> B seeder', userB.id, 'Salud')
  } else {
    await expectDenied('Anonymous dashboard RPC', anonymousDashboard)
    await expectDenied('User A reading user B dashboard', crossUserDashboard)
    await expectDenied('Authenticated dashboard call with null user id', await clientA.rpc('fn_dashboard_summary', { p_user_id: null }))
    console.log('PASS: own dashboard succeeds; anonymous, null-id, and cross-user calls fail with 42501')
    await observeSeeder(anonymous, 'Post-migration anon seeder', userB.id, 'Comida').then(allowed => assert(!allowed, 'anon executed category seeder'))
    await observeSeeder(clientA, 'Post-migration A -> B seeder', userB.id, 'Salud').then(allowed => assert(!allowed, 'user A executed category seeder for B'))
    await observeSeeder(admin, 'Post-migration service_role seeder', userB.id, 'Mascotas').then(allowed => assert(!allowed, 'service_role executed category seeder'))
    await expectDenied('service_role dashboard RPC', await admin.rpc('fn_dashboard_summary', { p_user_id: userB.id }))
    console.log('PASS: service_role cannot call the user-scoped dashboard RPC')
  }

  console.log(`PASS (${phase}): synthetic registration trigger, dashboard own-user call, and RPC authorization observations`)
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
