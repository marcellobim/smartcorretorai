import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  AdminAuthorizationError,
  isAuthorizedAdmin,
  requireAuthorizedAdmin,
} from '../admin-authorization.ts'

const adminId = '11111111-1111-4111-8111-111111111111'

function client(result: { data: { user_id?: string } | null; error: { message: string } | null }) {
  const calls: Array<[string, string?]> = []
  return {
    calls,
    from(table: string) {
      calls.push(['from', table])
      return {
        select(columns: string) {
          calls.push(['select', columns])
          return {
            eq(column: string, value: string) {
              calls.push([column, value])
              return { maybeSingle: async () => result }
            },
          }
        },
      }
    },
  }
}

test('recognizes only a matching admin_users row', async () => {
  const db = client({ data: { user_id: adminId }, error: null })
  assert.equal(await isAuthorizedAdmin(db, adminId), true)
  assert.deepEqual(db.calls, [
    ['from', 'admin_users'],
    ['select', 'user_id'],
    ['user_id', adminId],
  ])
})

test('fails closed for missing rows, query errors and invalid or anonymous ids', async () => {
  assert.equal(await isAuthorizedAdmin(client({ data: null, error: null }), adminId), false)
  assert.equal(await isAuthorizedAdmin(client({ data: null, error: { message: 'denied' } }), adminId), false)
  assert.equal(await isAuthorizedAdmin(client({ data: { user_id: adminId }, error: null }), ''), false)
  assert.equal(await isAuthorizedAdmin(client({ data: { user_id: adminId }, error: null }), 'not-a-uuid'), false)
})

test('user metadata, profile roles and email cannot influence authorization', async () => {
  const db = client({ data: null, error: null })
  const attacker = {
    id: adminId,
    email: 'admin@example.test',
    user_metadata: { role: 'admin' },
    profile: { role: 'admin' },
  }
  assert.equal(await isAuthorizedAdmin(db, attacker.id), false)
})

test('requireAuthorizedAdmin rejects non-admin callers with a safe 403 error', async () => {
  await assert.rejects(
    requireAuthorizedAdmin(client({ data: null, error: null }), adminId),
    (error: unknown) => error instanceof AdminAuthorizationError && error.status === 403,
  )
})

test('testimonial bonus action remains behind the mandatory admin gate', () => {
  const source = readFileSync(new URL('../../admin-api/index.ts', import.meta.url), 'utf8')
  const gate = source.indexOf('await requireAuthorizedAdmin(supabase, user.id)')
  const action = source.indexOf("action === 'approve_testimonial_and_grant_bonus'")
  assert.ok(gate >= 0)
  assert.ok(action > gate)
})
