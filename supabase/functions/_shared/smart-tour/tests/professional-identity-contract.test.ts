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

test('photo Real Estate Video requires its explicit credential source', () => {
  assert.deepEqual(validateSmartTourRequest(photoRequest({ enabled: false })).professional_identity, { enabled: false })
  assert.deepEqual(validateSmartTourRequest(photoRequest({ enabled: true, name_source: 'real', credential_source: 'br_creci' })).professional_identity, { enabled: true, name_source: 'real', credential_source: 'br_creci' })
  assert.deepEqual(validateSmartTourRequest(photoRequest({ enabled: true, name_source: 'display', credential_source: 'us_license' })).professional_identity, { enabled: true, name_source: 'display', credential_source: 'us_license' })
  assert.throws(() => validateSmartTourRequest(photoRequest(undefined)), /invalid_professional_identity/)
  assert.throws(() => validateSmartTourRequest(photoRequest({ enabled: true })), /invalid_professional_identity/)
})

test('the server resolves the selected credential independently of creation market', () => {
  const profile = { nome: 'Alex Legal', display_name: 'Alex Homes', license_number: 'FL-123', license_state: 'FL', creci: '9999', creci_type: 'F', estado: 'SP', telefone: '5559991234' }
  assert.equal(resolveProfessionalIdentity(profile, { enabled: true, name_source: 'real', credential_source: 'us_license' }, 'BR')?.formatted, 'Alex Legal · License #FL-123 · FL')
  assert.equal(resolveProfessionalIdentity(profile, { enabled: true, name_source: 'display', credential_source: 'br_creci' }, 'US')?.formatted, 'Alex Homes · CRECI-F 9999/SP')
  assert.equal(resolveProfessionalIdentity(profile, { enabled: true, name_source: 'real' }, 'US'), null)
  assert.equal(resolveProfessionalIdentity(profile, { enabled: false }, 'US'), null)
})
