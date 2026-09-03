import test from 'node:test'
import assert from 'node:assert/strict'
import {
  disconnectMetaConnection,
  withValidatedMetaConnection,
} from './meta-token-lifecycle.mjs'

const NOW = new Date('2026-08-30T12:00:00.000Z')
const PRIVATE_TOKEN = 'private-meta-token-never-log'

const fixture = overrides => {
  const order = []
  const events = []
  const state = {
    connection: {
      id: 'connection-1', userId: 'user-1', connectionStatus: 'active',
      expiresAt: '2026-09-30T12:00:00.000Z', lastValidatedAt: null,
      pageAccessTokenCiphertext: 'ciphertext-v1', pageAccessTokenNonce: 'nonce-v1',
      pageAccessTokenAuthTag: 'tag-v1', keyVersion: 'v1',
      ...(overrides?.connection || {}),
    },
    localBlocked: false,
  }
  const calls = { decrypt: 0, validate: 0, operation: 0, remoteRevoke: 0, validation: [], remoteOutcome: [] }
  const dependencies = {
    loadOwnedConnection: async (id, userId) => (
      state.connection.id === id && state.connection.userId === userId ? { ...state.connection } : null
    ),
    decryptToken: async () => { calls.decrypt += 1; return PRIVATE_TOKEN },
    validateRemoteToken: async () => {
      order.push('validate')
      calls.validate += 1
      return overrides?.remoteValidation || { status: 'active', expiresAt: '2026-09-30T12:00:00.000Z' }
    },
    persistValidation: async input => {
      order.push('persist_validation')
      calls.validation.push(input)
      state.connection.connectionStatus = input.validationStatus
      state.connection.lastValidatedAt = input.lastValidatedAt
      if (input.invalidateCiphertext) state.connection.pageAccessTokenCiphertext = null
    },
    runValidatedOperation: async ({ token }) => {
      order.push('operation')
      calls.operation += 1
      assert.equal(token, PRIVATE_TOKEN)
      return { accepted: true }
    },
    blockLocallyAndInvalidate: async () => {
      order.push('local_block')
      state.localBlocked = true
      state.connection.connectionStatus = 'revoked'
      state.connection.pageAccessTokenCiphertext = null
      return overrides?.localResult || { cancelledJobCount: 2, revokedLeaseCount: 1 }
    },
    revokeRemoteToken: async token => {
      order.push('remote_revoke')
      calls.remoteRevoke += 1
      assert.equal(token, PRIVATE_TOKEN)
      if (overrides?.remoteRevokeError) throw overrides.remoteRevokeError
    },
    persistRemoteRevocationOutcome: async input => { calls.remoteOutcome.push(input) },
    log: (event, details) => events.push({ event, details }),
  }
  return { state, calls, dependencies, order, events }
}

test('active token is remotely validated and used only inside the validated operation', async () => {
  const { dependencies, calls } = fixture()
  const result = await withValidatedMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies)
  assert.equal(result.ok, true)
  assert.equal(result.connection.connectionStatus, 'active')
  assert.equal(JSON.stringify(result).includes(PRIVATE_TOKEN), false)
  assert.deepEqual({ validate: calls.validate, operation: calls.operation }, { validate: 1, operation: 1 })
})

test('expired token is invalidated without decrypt or use', async () => {
  const { dependencies, calls } = fixture({ connection: { expiresAt: '2026-08-30T11:59:59.000Z' } })
  await assert.rejects(withValidatedMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies), /meta_connection_expired/)
  assert.equal(calls.decrypt, 0)
  assert.equal(calls.operation, 0)
  assert.equal(calls.validation[0].validationStatus, 'expired')
})

test('revoked connection never decrypts or uses its token', async () => {
  const { dependencies, calls } = fixture({ connection: { connectionStatus: 'revoked', pageAccessTokenCiphertext: null } })
  await assert.rejects(withValidatedMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies), /meta_connection_revoked/)
  assert.equal(calls.decrypt, 0)
  assert.equal(calls.operation, 0)
})

test('reconnect_required connection cannot be used', async () => {
  const { dependencies, calls } = fixture({ connection: { connectionStatus: 'reconnect_required', pageAccessTokenCiphertext: null } })
  await assert.rejects(withValidatedMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies), /meta_reconnect_required/)
  assert.equal(calls.operation, 0)
})

test('remote validation is persisted before future publish operation', async () => {
  const { dependencies, order } = fixture()
  await withValidatedMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies)
  assert.deepEqual(order.slice(0, 3), ['validate', 'persist_validation', 'operation'])
})

test('normal disconnect blocks locally before mocked remote revocation', async () => {
  const { dependencies, order, state, calls } = fixture()
  const result = await disconnectMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies)
  assert.equal(result.connectionStatus, 'revoked')
  assert.equal(result.remoteRevoked, true)
  assert.equal(state.localBlocked, true)
  assert.ok(order.indexOf('local_block') < order.indexOf('remote_revoke'))
  assert.equal(calls.remoteOutcome[0].succeeded, true)
})

test('remote revocation failure leaves local connection blocked', async () => {
  const { dependencies, state, calls } = fixture({ remoteRevokeError: new Error('mock remote failure') })
  const result = await disconnectMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies)
  assert.equal(result.remoteRevoked, false)
  assert.equal(state.localBlocked, true)
  assert.equal(state.connection.connectionStatus, 'revoked')
  assert.equal(state.connection.pageAccessTokenCiphertext, null)
  assert.equal(calls.remoteOutcome[0].succeeded, false)
})

test('disconnect reports cancellable jobs and safely revoked leases', async () => {
  const { dependencies } = fixture({ localResult: { cancelledJobCount: 3, revokedLeaseCount: 2 } })
  const result = await disconnectMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies)
  assert.deepEqual(
    { jobs: result.cancelledJobCount, leases: result.revokedLeaseCount },
    { jobs: 3, leases: 2 },
  )
})

test('token cannot be reused after disconnect', async () => {
  const { dependencies, state, calls } = fixture()
  await disconnectMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies)
  await assert.rejects(withValidatedMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies), /meta_connection_revoked/)
  assert.equal(state.connection.pageAccessTokenCiphertext, null)
  assert.equal(calls.operation, 0)
})

test('owner isolation blocks disconnect and logs never contain token', async () => {
  const { dependencies, state, events } = fixture()
  await assert.rejects(disconnectMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-2', now: NOW }, dependencies), /meta_connection_not_found/)
  assert.equal(state.localBlocked, false)
  await disconnectMetaConnection({ connectionId: 'connection-1', authenticatedUserId: 'user-1', now: NOW }, dependencies)
  assert.equal(JSON.stringify(events).includes(PRIVATE_TOKEN), false)
  assert.equal(JSON.stringify(events).includes('ciphertext-v1'), false)
})
