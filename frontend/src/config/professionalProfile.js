const COMMON_FIELDS = Object.freeze([
  'professionalName',
  'companyName',
  'state',
  'phone',
  'email',
  'instagram',
  'facebook',
  'linkedin',
])

const MARKET_EXTENSIONS = Object.freeze({
  BR: Object.freeze({
    fields: Object.freeze(['creciNumber', 'creciType', 'whatsapp']),
    requiredFields: Object.freeze(['professionalName', 'creciNumber', 'creciType', 'state', 'phone', 'email']),
    identity: Object.freeze({ credentialKey: 'creciNumber', credentialPrefix: 'CRECI', stateSeparator: '/' }),
  }),
  US: Object.freeze({
    fields: Object.freeze(['brokerage', 'role', 'licenseNumber', 'sms']),
    requiredFields: Object.freeze(['professionalName', 'role', 'licenseNumber', 'state', 'phone', 'email']),
    identity: Object.freeze({ credentialKey: 'licenseNumber', credentialPrefix: 'License', stateSeparator: ', ' }),
  }),
})

export const PROFESSIONAL_PROFILE_CONFIG = Object.freeze({
  BR: Object.freeze({ market: 'BR', ...MARKET_EXTENSIONS.BR, fields: Object.freeze([...COMMON_FIELDS, ...MARKET_EXTENSIONS.BR.fields]) }),
  US: Object.freeze({ market: 'US', ...MARKET_EXTENSIONS.US, fields: Object.freeze([...COMMON_FIELDS, ...MARKET_EXTENSIONS.US.fields]) }),
})

export const PROFESSIONAL_ROLES = Object.freeze(['agent', 'realtor', 'broker'])

export function getProfessionalProfileConfig(market = 'BR') {
  return PROFESSIONAL_PROFILE_CONFIG[market] || PROFESSIONAL_PROFILE_CONFIG.BR
}

export function getRequiredProfessionalFields(market = 'BR') {
  return getProfessionalProfileConfig(market).requiredFields
}

export function formatProfessionalIdentity(profile = {}, market = 'BR') {
  const config = getProfessionalProfileConfig(market)
  const name = String(profile.professionalName || '').trim()
  const state = String(profile.state || '').trim().toUpperCase()
  const credentialNumber = String(profile[config.identity.credentialKey] || '').trim()

  if (!credentialNumber) return [name, state].filter(Boolean).join(' — ')

  const credentialType = config.market === 'BR' ? String(profile.creciType || '').trim().toUpperCase() : ''
  const credential = [config.identity.credentialPrefix, credentialType, credentialNumber].filter(Boolean).join(' ')
  const qualifiedCredential = state ? `${credential}${config.identity.stateSeparator}${state}` : credential

  return [name, qualifiedCredential].filter(Boolean).join(' — ')
}
