import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

async function loadRuntime() {
  const vite = await import('vite')
  const server = await vite.createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try { return await server.ssrLoadModule('/src/components/location/StudioUsLocation.jsx') } finally { await server.close() }
}

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('StudioUsLocation uses the real request state machine for loading, empty, retry and stale responses', async () => {
  const { startStudioUsCityRequest, selectStudioUsCounty } = await loadRuntime()
  const events = [], requestRef = { current: 0 }, requests = []
  const loadCities = (state, county) => {
    const item = { state, county, ...deferred() }
    requests.push(item)
    return item.promise
  }
  const publish = next => events.push(next)
  const draft = { state: 'FL', county: 'Hillsborough County', city: 'Tampa', zipCode: '33602', neighborhoodCommunity: 'Downtown', brief: 'Preserve this briefing' }
  startStudioUsCityRequest({ state: 'FL', county: 'Hillsborough County', loadCities, requestRef, onState: publish })
  assert.deepEqual(events.at(-1), { cities: [], status: 'loading', error: '' })
  const changed = selectStudioUsCounty(draft, 'Orange County')
  assert.deepEqual(changed, { ...draft, county: 'Orange County', city: '', zipCode: '', neighborhoodCommunity: '' })
  startStudioUsCityRequest({ state: 'FL', county: 'Orange County', loadCities, requestRef, onState: publish })
  requests[0].resolve(['Tampa'])
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(events.some(event => event.cities.includes('Tampa')), false)
  requests[1].resolve(['Orlando'])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events.at(-1), { cities: ['Orlando'], status: 'ready', error: '' })
  startStudioUsCityRequest({ state: 'FL', county: 'Orange County', loadCities, requestRef, onState: publish })
  requests[2].resolve([])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events.at(-1), { cities: [], status: 'ready', error: '' })
  startStudioUsCityRequest({ state: 'FL', county: 'Orange County', loadCities, requestRef, onState: publish })
  requests[3].reject(new Error('network'))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events.at(-1), { cities: [], status: 'error', error: 'We could not load cities for this county.' })
  startStudioUsCityRequest({ state: 'FL', county: 'Orange County', loadCities, requestRef, onState: publish })
  assert.equal(requests.length, 5)
  requests[4].resolve(['Orlando'])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(events.at(-1), { cities: ['Orlando'], status: 'ready', error: '' })
})
