// Server-only orchestration of the existing PostgreSQL promotional slot.
// No authenticated economy, retries of dispatch, or client-supplied eligibility.
export async function startGuestPromotion(input, deps) {
  const { sessionHash, networkHash, clientRequestId } = input
  const allowed = await deps.rpc('guest_banner_rate_take', {
    p_scope: 'generation_attempt', p_hash: sessionHash,
  })
  if (allowed !== true) return { error: 'rate_limited' }
  // Validate/prepare before reserving. This function must perform no paid I/O.
  const prepared = await deps.prepare(input.banner)
  const reservation = await deps.rpc('guest_banner_reserve', {
    p_session_hash: sessionHash, p_network_hash: networkHash,
    p_client_request_id: clientRequestId,
  })
  if (reservation.error) return reservation
  if (reservation.replayed || reservation.status !== 'reserved') {
    return { requestId: reservation.requestId, status: reservation.status, replayed: true }
  }
  const requestId = reservation.requestId
  try {
    // Persist recovery material before dispatch. No provider I/O is allowed here.
    await deps.persistPrepared(requestId, prepared)
  } catch {
    // This is the ONLY refundable failure: dispatch has not been attempted.
    const cancelled = await deps.rpc('guest_banner_cancel_preprovider', {
      p_session_hash: sessionHash, p_request_id: requestId,
    })
    return { requestId, error: cancelled.cancelled ? 'preprovider_cancelled' : 'dispatch_or_state_uncertain' }
  }
  // An exception or lost response here is uncertain: NEVER cancel the slot.
  const dispatchAllowed = await deps.rpc('guest_banner_take_dispatch', { p_request_id: requestId })
  if (dispatchAllowed !== true) return { requestId, status: 'processing', replayed: true }
  try {
    const result = await deps.dispatch(prepared, requestId)
    await deps.persistDispatched(requestId, result)
    return { requestId, status: 'processing' }
  } catch {
    // Includes provider timeout and failure to persist its response. No refund,
    // no retry, no fabricated zero-cost completion. Reconciliation remains safe.
    return { requestId, status: 'unknown', error: 'dispatch_or_state_uncertain' }
  }
}
