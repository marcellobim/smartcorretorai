import assert from 'node:assert/strict'
import test from 'node:test'
import { loadGuestBannerMetrics } from './guest-metrics.ts'

function database(rows: Record<string, any[]>, failure?: string) {
  const calls: any[] = []
  return {
    calls,
    from(table: string) {
      const call: any = { table, filters: [] }
      calls.push(call)
      const query = {
        select(columns: string, options: any) { call.columns = columns; call.options = options; return query },
        eq(column: string, value: string) { call.filters.push((row: any) => row[column] === value); return query },
        gte(column: string, value: string) { call.filters.push((row: any) => row[column] >= value); return query },
        then(resolve: any, reject: any) {
          if (failure === 'throw') return Promise.reject(new Error('offline')).then(resolve, reject)
          const result = table === failure ? { count: null, error: { code: '42P01' } } : {
            count: (rows[table] || []).filter(row => call.filters.every((filter: any) => filter(row))).length,
            error: null,
          }
          return Promise.resolve(result).then(resolve, reject)
        },
      }
      return query
    },
  }
}

test('counts persisted events and request states within creation period; no row data returned', async () => {
  const db = database({
    guest_banner_events: [
      { event_type: 'guest_banner_started', created_at: '2026-09-10' },
      { event_type: 'guest_banner_started', created_at: '2026-09-10' },
      { event_type: 'guest_landing_started', created_at: '2026-09-01' },
    ],
    guest_banner_requests: [
      { status: 'completed', created_at: '2026-09-10', session_id: 'private' },
      { status: 'failed', created_at: '2026-09-11' },
      { status: 'unknown', created_at: '2026-09-12' },
      { status: 'completed', created_at: '2026-09-01' },
    ],
  })
  const result = await loadGuestBannerMetrics(db, '2026-09-05')
  assert.deepEqual(result.metrics, { landingStarts: 0, bannerStarts: 2, requests: 3, completed: 1, failed: 1, reserved: 0, dispatching: 0, unknown: 1, cancelled: 0 })
  assert.ok(db.calls.every(call => call.options.head === true && call.options.count === 'exact'))
  assert.equal(JSON.stringify(result).includes('private'), false)
  const all = await loadGuestBannerMetrics(db, null)
  assert.equal(all.metrics.requests, 4)
  assert.equal(all.metrics.landingStarts, 1)
})

test('missing event schema leaves requests usable and does not invent zero', async () => {
  const result = await loadGuestBannerMetrics(database({}, 'guest_banner_events'), null)
  assert.equal(result.metrics.landingStarts, null)
  assert.equal(result.metrics.bannerStarts, null)
  assert.equal(result.metrics.requests, 0)
})

test('network failure and absent count are unavailable', async () => {
  const result = await loadGuestBannerMetrics(database({}, 'throw'), null)
  assert.ok(Object.values(result.metrics).every(value => value === null))
  const absent = { from: () => ({ select: () => Promise.resolve({ count: null, error: null }) }) }
  assert.ok(Object.values((await loadGuestBannerMetrics(absent, null)).metrics).every(value => value === null))
})
