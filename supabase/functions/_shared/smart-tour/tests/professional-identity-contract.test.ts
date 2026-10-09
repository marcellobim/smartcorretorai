import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSmartTourRequest } from '../validation.ts'
import { resolveProfessionalIdentity } from '../../professional-identity.ts'

const photoRequest = (professional_identity: unknown) => ({
  clientRequestId: '123e4567-e89b-12d3-a456-426614174000',
  imagePaths: ['owner/smart-tour/request/01.jpg'],
  imageOrder: ['owner/smart-tour/request/01.jpg'],
  property: { purpose: 'sale', type: 'Condo', bedrooms: '3', bathrooms: '2' },
  generation: { mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'en-US' },
  selectedCta: 'Schedule a visit',
  includeProfessionalPhone: false,
  professional_identity,
  language: 'en-US',
  market: 'US',
})

test('photo Real Estate Video requires its structured professional_identity selection', () => {
  assert.deepEqual(validateSmartTourRequest(photoRequest({ enabled: false })).professional_identity, { enabled: false })
  assert.deepEqual(validateSmartTourRequest(photoRequest({ enabled: true, name_source: 'real' })).professional_identity, { enabled: true, name_source: 'real' })
  assert.deepEqual(validateSmartTourRequest(photoRequest({ enabled: true, name_source: 'display' })).professional_identity, { enabled: true, name_source: 'display' })
  assert.throws(() => validateSmartTourRequest(photoRequest(undefined)), /invalid_professional_identity/)
  assert.throws(() => validateSmartTourRequest(photoRequest({ enabled: true })), /invalid_professional_identity/)
})

test('the server resolves only the chosen identity and market credential', () => {
  const profile = { nome: 'Alex Legal', display_name: 'Alex Homes', license_number: 'FL-123', creci: '9999', creci_type: 'F', estado: 'FL', telefone: '5559991234' }
  assert.deepEqual(resolveProfessionalIdentity(profile, { enabled: true, name_source: 'real' }, 'US'), {
    enabled: true, name_source: 'real', market: 'US', name: 'Alex Legal', creci_type: '', creci_number: '', creci_state: '', license_number: 'FL-123', license_state: 'FL', formatted: 'Alex Legal · License #FL-123 · FL',
  })
  assert.equal(resolveProfessionalIdentity(profile, { enabled: false }, 'US'), null)
})
