import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProfessionalIdentity, formatProfessionalIdentity, hasCompleteProfessionalIdentity, professionalIdentityProfilePatch } from '../src/config/professionalProfile.js'

test('formats a complete Brazilian identity with display name and never puts it in narration', () => {
  const profile = { nome: 'Marcello Bim', display_name: 'Riccieri', creci: '12345', creci_type: 'F', estado: 'SC' }
  assert.equal(formatProfessionalIdentity(profile, 'BR'), 'Riccieri — CRECI F 12345/SC')
  assert.equal(hasCompleteProfessionalIdentity(profile, 'BR'), true)
})

test('falls back to registered name only when display name is blank', () => {
  assert.equal(formatProfessionalIdentity({ nome: 'Marcello Bim', display_name: '  ', creci: '12345', creci_type: 'J', estado: 'SP' }, 'BR'), 'Marcello Bim — CRECI J 12345/SP')
})

test('formats the equivalent complete United States identity', () => {
  const profile = { nome: 'Marcello Bim', display_name: 'Rick', license_number: '123456', license_state: 'FL' }
  assert.equal(formatProfessionalIdentity(profile, 'US'), 'Rick — License 123456, FL')
  assert.equal(hasCompleteProfessionalIdentity(profile, 'US'), true)
})

test('does not consider incomplete professional data displayable', () => {
  assert.equal(hasCompleteProfessionalIdentity({ nome: 'Marcello Bim', creci: '12345', estado: 'SC' }, 'BR'), false)
  assert.equal(hasCompleteProfessionalIdentity({ creci: '12345', creci_type: 'F', estado: 'SC' }, 'BR'), false)
  assert.equal(hasCompleteProfessionalIdentity({ full_name: 'Rick', license_number: '123456', license_state: 'FL' }, 'US'), true)
  assert.equal(formatProfessionalIdentity({ full_name: 'Rick', license_number: '123456', license_state: 'FL' }, 'US'), 'Rick — License 123456, FL')
})

test('a Brazilian UF is never used as a US licence state', () => {
  const mixedProfile = { market: 'BR', nome: 'Riccieri', license_number: '123456', estado: 'SP', creci: '0000000', creci_type: 'F' }
  assert.equal(hasCompleteProfessionalIdentity(mixedProfile, 'US'), false)
  assert.equal(formatProfessionalIdentity(mixedProfile, 'US'), '')
})

test('a multi-market profile retains both credentials through independent edits and reload', () => {
  let profile = { nome: 'Riccieri', display_name: 'Riccieri', creci: '12345', creci_type: 'F', estado: 'SP' }
  profile = { ...profile, ...professionalIdentityProfilePatch(profile, { licenseNumber: 'US-999', state: 'FL' }, 'us_license') }
  assert.deepEqual({ creci: profile.creci, creci_type: profile.creci_type, estado: profile.estado, license_number: profile.license_number, license_state: profile.license_state }, { creci: '12345', creci_type: 'F', estado: 'SP', license_number: 'US-999', license_state: 'FL' })
  profile = { ...profile, ...professionalIdentityProfilePatch(profile, { creciNumber: '54321', creciType: 'J', state: 'RJ' }, 'br_creci') }
  // Existing profile values are never overwritten by the guided completion patch.
  assert.equal(profile.creci, '12345')
  assert.equal(profile.license_number, 'US-999')
  assert.equal(buildProfessionalIdentity(profile, { enabled: true, name_source: 'display', credential_source: 'br_creci' }, 'US').formatted, 'Riccieri · CRECI-F 12345/SP')
  assert.equal(buildProfessionalIdentity(profile, { enabled: true, name_source: 'real', credential_source: 'us_license' }, 'BR').formatted, 'Riccieri · License #US-999 · FL')
})
