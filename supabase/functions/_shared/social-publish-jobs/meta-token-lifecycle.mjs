export const META_CONNECTION_STATES = Object.freeze([
  'active',
  'expired',
  'revoked',
  'reconnect_required',
])

const STATE_SET = new Set(META_CONNECTION_STATES)

const safeConnection = connection => ({
  connectionId: connection.id,
  connectionStatus: connection.connectionStatus,
  expiresAt: connection.expiresAt || null,
  lastValidatedAt: connection.lastValidatedAt || null,
})

const assertEncryptedConnection = connection => {
  if ('accessToken' in connection || 'pageAccessToken' in connection) {
    throw new Error('plaintext_meta_token_forbidden')
  }
}

const encryptedPageToken = connection => {
  if (!connection.pageAccessTokenCiphertext || !connection.pageAccessTokenNonce
      || !connection.pageAccessTokenAuthTag || !connection.keyVersion) {
    throw new Error('meta_reconnect_required')
  }
  return {
    algorithm: 'AES-256-GCM',
    ciphertext: connection.pageAccessTokenCiphertext,
    nonce: connection.pageAccessTokenNonce,
    authTag: connection.pageAccessTokenAuthTag,
    keyVersion: connection.keyVersion,
  }
}

const unavailableCode = status => {
  if (status === 'expired') return 'meta_connection_expired'
  if (status === 'revoked') return 'meta_connection_revoked'
  return 'meta_reconnect_required'
}

export async function withValidatedMetaConnection(input, dependencies) {
  const now = input?.now instanceof Date ? input.now : new Date()
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_validation_time')
  const connection = await dependencies.loadOwnedConnection(input.connectionId, input.authenticatedUserId)
  if (!connection) throw new Error('meta_connection_not_found')
  assertEncryptedConnection(connection)

  if (!STATE_SET.has(connection.connectionStatus)) throw new Error('invalid_meta_connection_status')
  if (connection.connectionStatus !== 'active') throw new Error(unavailableCode(connection.connectionStatus))
  const tokenEnvelope = encryptedPageToken(connection)

  const expiresAt = Date.parse(connection.expiresAt || '')
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    await dependencies.persistValidation({
      connectionId: connection.id,
      expectedStatus: 'active',
      validationStatus: 'expired',
      expiresAt: connection.expiresAt || null,
      lastValidatedAt: now.toISOString(),
      invalidateCiphertext: true,
    })
    throw new Error('meta_connection_expired')
  }

  const token = await dependencies.decryptToken(tokenEnvelope)
  const validation = await dependencies.validateRemoteToken(token)
  const validationStatus = STATE_SET.has(validation?.status) ? validation.status : 'reconnect_required'
  const validatedExpiry = validation?.expiresAt || connection.expiresAt
  await dependencies.persistValidation({
    connectionId: connection.id,
    expectedStatus: 'active',
    validationStatus,
    expiresAt: validatedExpiry,
    lastValidatedAt: now.toISOString(),
    invalidateCiphertext: validationStatus !== 'active',
  })
  dependencies.log?.('meta_connection_validated', {
    connection_id: connection.id,
    connection_status: validationStatus,
  })
  if (validationStatus !== 'active') throw new Error(unavailableCode(validationStatus))

  const value = await dependencies.runValidatedOperation({ token, connectionId: connection.id })
  return {
    ok: true,
    connection: {
      ...safeConnection({
        ...connection,
        connectionStatus: 'active',
        expiresAt: validatedExpiry,
        lastValidatedAt: now.toISOString(),
      }),
    },
    value,
  }
}

export async function disconnectMetaConnection(input, dependencies) {
  const now = input?.now instanceof Date ? input.now : new Date()
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_disconnect_time')
  const connection = await dependencies.loadOwnedConnection(input.connectionId, input.authenticatedUserId)
  if (!connection) throw new Error('meta_connection_not_found')
  assertEncryptedConnection(connection)

  let token = null
  if (connection.pageAccessTokenCiphertext) {
    token = await dependencies.decryptToken(encryptedPageToken(connection))
  }

  const local = await dependencies.blockLocallyAndInvalidate({
    connectionId: connection.id,
    authenticatedUserId: input.authenticatedUserId,
    disconnectedAt: now.toISOString(),
  })

  let remoteRevoked = false
  try {
    if (!token) throw new Error('missing_token_for_remote_revocation')
    await dependencies.revokeRemoteToken(token)
    remoteRevoked = true
  } catch {
    remoteRevoked = false
  } finally {
    token = null
  }

  await dependencies.persistRemoteRevocationOutcome({
    connectionId: connection.id,
    succeeded: remoteRevoked,
    attemptedAt: now.toISOString(),
  })
  dependencies.log?.('meta_connection_disconnected', {
    connection_id: connection.id,
    remote_revocation_succeeded: remoteRevoked,
    cancelled_job_count: local.cancelledJobCount,
    revoked_lease_count: local.revokedLeaseCount,
  })
  return {
    ok: true,
    connectionStatus: 'revoked',
    remoteRevoked,
    cancelledJobCount: local.cancelledJobCount,
    revokedLeaseCount: local.revokedLeaseCount,
  }
}
