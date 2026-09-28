const COMMON_FIELDS = Object.freeze([
  'professionalName',
  'displayName',
  'companyName',
  'state',
  'phone',
  'email',
  'instagram',
  'facebook',
  'linkedin',
])

const COMMON_FIELD_MAP = Object.freeze({
  professionalName: 'nome',
  displayName: 'display_name',
  companyName: 'imobiliaria',
  state: 'estado',
  phone: 'telefone',
  email: 'email',
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
})

const MARKET_EXTENSIONS = Object.freeze({
  BR: Object.freeze({
    fields: Object.freeze(['creciNumber', 'creciType', 'whatsapp']),
    fieldMap: Object.freeze({ creciNumber: 'creci', creciType: 'creci_type', whatsapp: 'whatsapp' }),
    requiredFields: Object.freeze(['professionalName', 'creciNumber', 'creciType', 'state', 'phone', 'email']),
    identity: Object.freeze({ credentialKey: 'creciNumber', credentialPrefix: 'CRECI', stateSeparator: '/' }),
  }),
  US: Object.freeze({
    fields: Object.freeze(['brokerage', 'role', 'licenseNumber', 'sms']),
    fieldMap: Object.freeze({ brokerage: 'imobiliaria', role: 'professional_role', licenseNumber: 'license_number', sms: 'sms' }),
    requiredFields: Object.freeze(['professionalName', 'role', 'licenseNumber', 'state', 'phone', 'email']),
    identity: Object.freeze({ credentialKey: 'licenseNumber', credentialPrefix: 'License', stateSeparator: ', ' }),
  }),
})

export const PROFESSIONAL_PROFILE_CONFIG = Object.freeze({
  BR: Object.freeze({ market: 'BR', ...MARKET_EXTENSIONS.BR, fieldMap: Object.freeze({ ...COMMON_FIELD_MAP, ...MARKET_EXTENSIONS.BR.fieldMap }), fields: Object.freeze([...COMMON_FIELDS, ...MARKET_EXTENSIONS.BR.fields]) }),
  US: Object.freeze({ market: 'US', ...MARKET_EXTENSIONS.US, fieldMap: Object.freeze({ ...COMMON_FIELD_MAP, ...MARKET_EXTENSIONS.US.fieldMap }), fields: Object.freeze([...COMMON_FIELDS, ...MARKET_EXTENSIONS.US.fields]) }),
})

export const PROFESSIONAL_ROLES = Object.freeze(['agent', 'realtor', 'broker'])

export function getProfessionalProfileConfig(market = 'BR') {
  return PROFESSIONAL_PROFILE_CONFIG[market] || PROFESSIONAL_PROFILE_CONFIG.BR
}

export function getRequiredProfessionalFields(market = 'BR') {
  return getProfessionalProfileConfig(market).requiredFields
}

export function getProfessionalProfileFieldMap(market = 'BR') {
  return getProfessionalProfileConfig(market).fieldMap
}

function readProfileField(profile, config, field) {
  const column = config.fieldMap[field] || field
  return profile[column] ?? profile[field]
}

export function formatProfessionalIdentity(profile = {}, market = 'BR') {
  const config = getProfessionalProfileConfig(market)
  const name = [
    readProfileField(profile, config, 'displayName'),
    readProfileField(profile, config, 'professionalName'),
    profile.full_name,
  ].map(value => String(value || '').trim()).find(Boolean) || ''
  const state = String(readProfileField(profile, config, 'state') || '').trim().toUpperCase()
  const credentialNumber = String(readProfileField(profile, config, config.identity.credentialKey) || '').trim()

  if (!credentialNumber) return [name, state].filter(Boolean).join(' — ')

  const credentialType = config.market === 'BR' ? String(readProfileField(profile, config, 'creciType') || '').trim().toUpperCase() : ''
  const credential = [config.identity.credentialPrefix, credentialType, credentialNumber].filter(Boolean).join(' ')
  const qualifiedCredential = state ? `${credential}${config.identity.stateSeparator}${state}` : credential

  return [name, qualifiedCredential].filter(Boolean).join(' — ')
}
