// Delivery/claim adapter. All dependencies are server-side and refer to an
// already-created artifact; this module has no generation/provider operation.
export async function claimGuestResult({sessionHash, claimHash, accessToken}, deps) {
  // The user is obtained from Auth, never from a request user_id.
  const user = await deps.getUser(accessToken)
  if (!user?.id) return {error:'authentication_required'}
  const resultId = await deps.claim({sessionHash,claimHash,accessToken})
  if (!resultId) return {error:'claim_unavailable'}
  const result = await deps.readOwnedResult(resultId,user.id)
  if (!result || result.owner_id !== user.id) return {error:'claim_unavailable'}
  // Idempotent promotion of the existing artifact into official Banner delivery.
  // A failure here is retryable: the SQL claim already belongs to this same user.
  const generation = await deps.attachExistingArtifact(result.artifact_ref,user.id)
  return {status:'completed',generation}
}
