import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { createAlertBulkRouteHandlers, deleteUserAlerts, markAllUnreadAlertsRead } from '@/modules/alerts/bulk-notifications'

interface FixtureAlert {
  id: string
  user_id: string
  is_read: boolean
  read_at: string | null
}

type Operation = 'select' | 'update' | 'delete'
type Filter = { column: 'user_id' | 'is_read'; value: string | boolean }
interface QueryResult {
  count: number | null
  error: { message: string } | null
  data: FixtureAlert[] | null
}

class FixtureDatabase {
  readonly rows: FixtureAlert[]
  readonly tables: string[] = []
  failNext: Operation | null = null
  afterMutation: ((operation: Operation, database: FixtureDatabase) => void) | null = null

  constructor(rows: FixtureAlert[]) {
    this.rows = rows
  }

  from(table: string) {
    this.tables.push(table)
    return new FixtureQuery(this)
  }

  execute(query: FixtureQuery): QueryResult {
    if (this.failNext === query.operation) {
      this.failNext = null
      return { count: null, error: { message: `synthetic ${query.operation} failure` }, data: null }
    }

    const matches = (row: FixtureAlert) => query.filters.every(filter => row[filter.column] === filter.value)

    if (query.operation === 'select') {
      return { count: this.rows.filter(matches).length, error: null, data: query.head ? null : this.rows.filter(matches) }
    }

    const affected = this.rows.filter(matches)
    if (query.operation === 'delete') {
      const affectedIds = new Set(affected.map(row => row.id))
      for (let index = this.rows.length - 1; index >= 0; index -= 1) {
        const row = this.rows[index]
        if (row && affectedIds.has(row.id)) this.rows.splice(index, 1)
      }
    } else {
      affected.forEach(row => {
        row.is_read = true
        row.read_at = query.readAt ?? null
      })
    }

    this.afterMutation?.(query.operation, this)
    return { count: affected.length, error: null, data: null }
  }
}

class FixtureQuery implements PromiseLike<QueryResult> {
  operation: Operation = 'select'
  filters: Filter[] = []
  head = false
  readAt: string | null = null

  constructor(private readonly database: FixtureDatabase) {}

  select(_columns: string, options?: { head?: boolean }) {
    this.operation = 'select'
    this.head = options?.head ?? false
    return this
  }

  update(values: { is_read: boolean; read_at: string | null }) {
    this.operation = 'update'
    this.readAt = values.read_at
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  eq(column: Filter['column'], value: Filter['value']) {
    this.filters.push({ column, value })
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.database.execute(this)).then(onfulfilled ?? undefined, onrejected ?? undefined)
  }
}

function makeAlerts(userId: string, count: number, offset = 0): FixtureAlert[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${userId}-${offset + index}`,
    user_id: userId,
    is_read: (index + offset) % 3 === 0,
    read_at: (index + offset) % 3 === 0 ? '2026-10-01T00:00:00.000Z' : null,
  }))
}

function asSupabase(database: FixtureDatabase) {
  return database as unknown as SupabaseClient<Database>
}

function handlersFor(database: FixtureDatabase, authenticatedUserId: string | null) {
  return createAlertBulkRouteHandlers({
    createClient: async () => asSupabase(database),
    getSessionUserId: async () => authenticatedUserId,
  })
}

test.describe('authenticated bulk operations for app_notifications', () => {
  test('marks more than 1,000 notices read with one user-scoped update and preserves already-read and other-user records', async () => {
    const userA = makeAlerts('user-a', 1_205)
    const userB = makeAlerts('user-b', 29)
    const previouslyRead = userA.filter(row => row.is_read).length
    const userBUnread = userB.filter(row => !row.is_read).length
    const database = new FixtureDatabase([...userA, ...userB])
    const readAt = '2026-11-05T12:00:00.000Z'

    const result = await markAllUnreadAlertsRead(asSupabase(database), 'user-a', readAt)

    expect(result).toEqual({ ok: true, affectedCount: 803, remainingCount: 0 })
    expect(database.rows.filter(row => row.user_id === 'user-a' && !row.is_read)).toHaveLength(0)
    expect(database.rows.filter(row => row.user_id === 'user-a' && row.read_at === readAt)).toHaveLength(803)
    expect(database.rows.filter(row => row.user_id === 'user-a' && row.is_read && row.read_at !== readAt)).toHaveLength(previouslyRead)
    expect(database.rows.filter(row => row.user_id === 'user-b' && !row.is_read)).toHaveLength(userBUnread)
    expect(database.tables).toEqual(['app_notifications', 'app_notifications'])
  })

  test('DELETE scope=all trusts only the authenticated server identity and empties 1,500+ mixed-state notices', async () => {
    const userA = makeAlerts('user-a', 1_507)
    const userB = makeAlerts('user-b', 41)
    const database = new FixtureDatabase([...userA, ...userB])
    const routes = handlersFor(database, 'user-a')
    const request = new Request('https://fintrack.test/api/alerts?scope=all&user_id=user-b', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'user-b', ids: userB.map(row => row.id) }),
    })

    const response = await routes.DELETE(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ ok: true, data: { deletedCount: 1_507, scope: 'all', remainingCount: 0 } })
    expect(database.rows).toEqual(userB)
    expect(database.tables).toEqual(['app_notifications', 'app_notifications'])
  })

  test('the legacy read-only delete scope deletes only read notices and verifies none remain in that scope', async () => {
    const database = new FixtureDatabase([...makeAlerts('user-a', 1_205), ...makeAlerts('user-b', 18)])
    const beforeUnread = database.rows.filter(row => row.user_id === 'user-a' && !row.is_read).length

    const result = await deleteUserAlerts(asSupabase(database), 'user-a', 'read')

    expect(result).toEqual({ ok: true, affectedCount: 402, remainingCount: 0 })
    expect(database.rows.filter(row => row.user_id === 'user-a')).toHaveLength(beforeUnread)
    expect(database.rows.filter(row => row.user_id === 'user-a' && row.is_read)).toHaveLength(0)
    expect(database.rows.filter(row => row.user_id === 'user-b')).toHaveLength(18)
  })

  test('returns a partial result when a new notice appears before post-delete verification', async () => {
    const database = new FixtureDatabase(makeAlerts('user-a', 1_001))
    database.afterMutation = operation => {
      if (operation === 'delete') database.rows.push({ id: 'concurrent-new', user_id: 'user-a', is_read: false, read_at: null })
    }
    const routes = handlersFor(database, 'user-a')

    const response = await routes.DELETE(new Request('https://fintrack.test/api/alerts?scope=all', { method: 'DELETE' }))
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.ok).toBe(false)
    expect(json.data).toEqual({ deletedCount: 1_001, scope: 'all', remainingCount: 1 })
    expect(json.error.message).toContain('quedan 1 aviso')
    expect(database.rows).toEqual([{ id: 'concurrent-new', user_id: 'user-a', is_read: false, read_at: null }])
  })

  test('does not report success when the mutation fails or its result cannot be verified', async () => {
    const mutationFailure = new FixtureDatabase(makeAlerts('user-a', 4))
    mutationFailure.failNext = 'delete'
    const mutationResponse = await handlersFor(mutationFailure, 'user-a').DELETE(
      new Request('https://fintrack.test/api/alerts?scope=all', { method: 'DELETE' }),
    )
    expect(mutationResponse.status).toBe(500)
    expect((await mutationResponse.json()).ok).toBe(false)
    expect(mutationFailure.rows).toHaveLength(4)

    const verificationFailure = new FixtureDatabase(makeAlerts('user-a', 4))
    verificationFailure.failNext = 'select'
    const verificationResponse = await handlersFor(verificationFailure, 'user-a').DELETE(
      new Request('https://fintrack.test/api/alerts?scope=all', { method: 'DELETE' }),
    )
    expect(verificationResponse.status).toBe(500)
    expect((await verificationResponse.json()).ok).toBe(false)
    expect(verificationFailure.rows).toHaveLength(0)
  })

  test('bulk mark-read reports failures when the update or its verification cannot be confirmed', async () => {
    const mutationFailure = new FixtureDatabase(makeAlerts('user-a', 5))
    mutationFailure.failNext = 'update'
    const mutationResponse = await handlersFor(mutationFailure, 'user-a').PATCH()
    expect(mutationResponse.status).toBe(500)
    expect((await mutationResponse.json()).ok).toBe(false)
    expect(mutationFailure.rows.filter(row => !row.is_read)).toHaveLength(3)

    const verificationFailure = new FixtureDatabase(makeAlerts('user-a', 5))
    verificationFailure.failNext = 'select'
    const verificationResponse = await handlersFor(verificationFailure, 'user-a').PATCH()
    expect(verificationResponse.status).toBe(500)
    expect((await verificationResponse.json()).ok).toBe(false)
    expect(verificationFailure.rows.filter(row => !row.is_read)).toHaveLength(0)
  })

  test('a PATCH whose verification still finds unread notices is partial, never successful', async () => {
    const database = new FixtureDatabase(makeAlerts('user-a', 1_001))
    database.afterMutation = operation => {
      if (operation === 'update') database.rows.push({ id: 'concurrent-unread', user_id: 'user-a', is_read: false, read_at: null })
    }
    const response = await handlersFor(database, 'user-a').PATCH()
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.ok).toBe(false)
    expect(json.data).toEqual({ updatedCount: 667, remainingUnreadCount: 1 })
  })

  test('rejects unauthenticated requests and invalid deletion scopes without touching the table', async () => {
    const database = new FixtureDatabase(makeAlerts('user-a', 3))
    const unauthenticated = handlersFor(database, null)
    const unauthorizedResponse = await unauthenticated.DELETE(
      new Request('https://fintrack.test/api/alerts?scope=all', { method: 'DELETE' }),
    )
    expect(unauthorizedResponse.status).toBe(401)
    const unauthorizedMarkReadResponse = await unauthenticated.PATCH()
    expect(unauthorizedMarkReadResponse.status).toBe(401)
    expect(database.tables).toHaveLength(0)

    const invalidScopeResponse = await handlersFor(database, 'user-a').DELETE(
      new Request('https://fintrack.test/api/alerts?scope=transactions', { method: 'DELETE' }),
    )
    expect(invalidScopeResponse.status).toBe(422)
    expect(database.tables).toHaveLength(0)
    expect(database.rows).toHaveLength(3)
  })
})
