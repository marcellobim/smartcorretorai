import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSmartTourProfessionalIdentity } from '../index.ts'

test('uses the stored Brazilian display name when present', () => {
  assert.equal(
    formatSmartTourProfessionalIdentity({ market: 'BR', nome: 'Marcello Bim', display_name: 'Riccieri', creci: '12345', creci_type: 'F', estado: 'sc' }),
    'Riccieri — CRECI F 12345/SC',
  )
})

test('falls back to stored registered name and supports US identity', () => {
  assert.equal(
    formatSmartTourProfessionalIdentity({ market: 'US', nome: 'Marcello Bim', display_name: ' ', license_number: '123456', estado: 'fl' }),
    'Marcello Bim — License 123456, FL',
  )
})

test('omits incomplete or invalid stored professional data without blocking a job', () => {
  assert.equal(formatSmartTourProfessionalIdentity({ market: 'BR', nome: 'Marcello Bim', creci: '12345', creci_type: 'X', estado: 'SC' }), '')
  assert.equal(formatSmartTourProfessionalIdentity({ market: 'US', nome: 'Rick', license_number: '', estado: 'FL' }), '')
})
