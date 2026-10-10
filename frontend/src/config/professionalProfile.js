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
  // `estado` remains the Brazilian CRECI UF. US licensing has its own field so
  // a BR profile can create US material without turning e.g. SP into a licence state.
  US: Object.freeze({ market: 'US', ...MARKET_EXTENSIONS.US, fieldMap: Object.freeze({ ...COMMON_FIELD_MAP, state: 'license_state', ...MARKET_EXTENSIONS.US.fieldMap }), fields: Object.freeze([...COMMON_FIELDS, ...MARKET_EXTENSIONS.US.fields]) }),
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

  // A partial credential must never become a visual identity or a fallback
  // signature.  The guided question can collect it, otherwise creation goes on
  // without professional information.
  if (!name || !credentialNumber || !state) return ''

  const credentialType = config.market === 'BR' ? String(readProfileField(profile, config, 'creciType') || '').trim().toUpperCase() : ''
  const credential = [config.identity.credentialPrefix, credentialType, credentialNumber].filter(Boolean).join(' ')
  const qualifiedCredential = state ? `${credential}${config.identity.stateSeparator}${state}` : credential

  return [name, qualifiedCredential].filter(Boolean).join(' — ')
}

export function hasCompleteProfessionalIdentity(profile = {}, market = 'BR') {
  const config = getProfessionalProfileConfig(market)
  const name = [
    readProfileField(profile, config, 'displayName'),
    readProfileField(profile, config, 'professionalName'),
    profile.full_name,
  ].map(value => String(value || '').trim()).find(Boolean)
  const state = String(readProfileField(profile, config, 'state') || '').trim()
  const credentialNumber = String(readProfileField(profile, config, config.identity.credentialKey) || '').trim()
  if (!name || !state || !credentialNumber) return false
  if (config.market !== 'BR') return true
  return ['F', 'J'].includes(String(readProfileField(profile, config, 'creciType') || '').trim().toUpperCase())
}

// Creation-scoped contract.  A formatted string is deliberately derived only
// at the edge (a caption or a provider prompt); drafts and persisted jobs keep
// this object so the selected name source is never lost or guessed later.
export function normalizeProfessionalIdentity(selection = {}, market = 'BR') {
  const enabled = selection?.enabled === true
  // `legal` was used by an early local draft.  Read it only for migration;
  // every newly written contract uses the product-wide `real | display` pair.
  const nameSource = selection?.name_source === 'display' ? 'display' : (selection?.name_source === 'real' || selection?.name_source === 'legal') ? 'real' : null
  const credentialSource = selection?.credential_source === 'br_creci' || selection?.credential_source === 'us_license'
    ? selection.credential_source
    : null
  return { enabled, name_source: enabled ? nameSource : null, credential_source: enabled ? credentialSource : 'none' }
}

export function professionalIdentityMissingFields(profile = {}, selection = {}, market = 'BR') {
  const normalized = normalizeProfessionalIdentity(selection, market)
  if (!normalized.enabled || !normalized.name_source) return []
  const credentialMarket = normalized.credential_source === 'us_license' ? 'US' : normalized.credential_source === 'br_creci' ? 'BR' : null
  if (!credentialMarket) return ['credentialSource']
  const config = getProfessionalProfileConfig(credentialMarket)
  const nameField = normalized.name_source === 'display' ? 'displayName' : 'professionalName'
  const missing = []
  if (!String(readProfileField(profile, config, nameField) || profile.full_name || '').trim()) missing.push(nameField)
  if (!String(readProfileField(profile, config, config.identity.credentialKey) || '').trim()) missing.push(config.identity.credentialKey)
  if (!String(readProfileField(profile, config, 'state') || '').trim()) missing.push('state')
  if (credentialMarket === 'BR' && !['F', 'J'].includes(String(readProfileField(profile, config, 'creciType') || '').trim().toUpperCase())) missing.push('creciType')
  return missing
}

export function buildProfessionalIdentity(profile = {}, selection = {}, market = 'BR') {
  const normalized = normalizeProfessionalIdentity(selection, market)
  const credentialMarket = normalized.credential_source === 'us_license' ? 'US' : normalized.credential_source === 'br_creci' ? 'BR' : null
  if (!credentialMarket || !normalized.enabled || !normalized.name_source || professionalIdentityMissingFields(profile, normalized, credentialMarket).length) return null
  const config = getProfessionalProfileConfig(credentialMarket)
  const legalName = String(readProfileField(profile, config, 'professionalName') || profile.full_name || '').trim()
  const displayName = String(readProfileField(profile, config, 'displayName') || '').trim()
  const state = String(readProfileField(profile, config, 'state') || '').trim().toUpperCase()
  const identity = {
    ...normalized,
    legal_name: legalName,
    display_name: displayName,
    creci_type: credentialMarket === 'BR' ? String(readProfileField(profile, config, 'creciType') || '').trim().toUpperCase() : '',
    creci_number: credentialMarket === 'BR' ? String(readProfileField(profile, config, 'creciNumber') || '').trim() : '',
    creci_state: credentialMarket === 'BR' ? state : '',
    license_number: credentialMarket === 'US' ? String(readProfileField(profile, config, 'licenseNumber') || '').trim() : '',
    license_state: credentialMarket === 'US' ? state : '',
  }
  const chosenName = normalized.name_source === 'display' ? displayName : legalName
  return {
    ...identity,
    formatted: credentialMarket === 'US'
      ? `${chosenName} · License #${identity.license_number} · ${identity.license_state}`
      : `${chosenName} · CRECI-${identity.creci_type} ${identity.creci_number}/${identity.creci_state}`,
  }
}

export function professionalIdentityProfilePatch(profile = {}, pending = {}, credentialSource = 'br_creci') {
  const config = getProfessionalProfileConfig(credentialSource === 'us_license' ? 'US' : 'BR')
  const patch = {}
  const entries = Object.entries(pending || {})
  for (const [field, value] of entries) {
    const text = String(value || '').trim()
    if (!text || String(readProfileField(profile, config, field) || '').trim()) continue
    const column = config.fieldMap[field]
    if (column) patch[column] = field === 'creciType' ? text.toUpperCase() : field === 'state' ? text.toUpperCase() : text
  }
  return patch
}
