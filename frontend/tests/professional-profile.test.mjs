import test from 'node:test'
import assert from 'node:assert/strict'
import { formatProfessionalIdentity, hasCompleteProfessionalIdentity } from '../src/config/professionalProfile.js'

test('formats a complete Brazilian identity with display name and never puts it in narration', () => {
  const profile = { nome: 'Marcello Bim', display_name: 'Riccieri', creci: '12345', creci_type: 'F', estado: 'SC' }
  assert.equal(formatProfessionalIdentity(profile, 'BR'), 'Riccieri — CRECI F 12345/SC')
  assert.equal(hasCompleteProfessionalIdentity(profile, 'BR'), true)
})

test('falls back to registered name only when display name is blank', () => {
  assert.equal(formatProfessionalIdentity({ nome: 'Marcello Bim', display_name: '  ', creci: '12345', creci_type: 'J', estado: 'SP' }, 'BR'), 'Marcello Bim — CRECI J 12345/SP')
})

test('formats the equivalent complete United States identity', () => {
  const profile = { nome: 'Marcello Bim', display_name: 'Rick', license_number: '123456', estado: 'FL' }
  assert.equal(formatProfessionalIdentity(profile, 'US'), 'Rick — License 123456, FL')
  assert.equal(hasCompleteProfessionalIdentity(profile, 'US'), true)
})

test('does not consider incomplete professional data displayable', () => {
  assert.equal(hasCompleteProfessionalIdentity({ nome: 'Marcello Bim', creci: '12345', estado: 'SC' }, 'BR'), false)
  assert.equal(hasCompleteProfessionalIdentity({ creci: '12345', creci_type: 'F', estado: 'SC' }, 'BR'), false)
  assert.equal(hasCompleteProfessionalIdentity({ full_name: 'Rick', license_number: '123456', estado: 'FL' }, 'US'), true)
  assert.equal(formatProfessionalIdentity({ full_name: 'Rick', license_number: '123456', estado: 'FL' }, 'US'), 'Rick — License 123456, FL')
})
