export type ProfessionalProfile = Record<string, unknown>

export type ProfessionalIdentitySelection = {
  enabled?: unknown
  name_source?: unknown
  credential_source?: unknown
  market?: unknown
}

export type StructuredProfessionalIdentity = {
  enabled: true
  name_source: 'real' | 'display'
  market: 'BR' | 'US'
  name: string
  creci_type: string
  creci_number: string
  creci_state: string
  license_number: string
  license_state: string
  formatted: string
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
])

function usLicenseState(source: ProfessionalProfile) {
  const state = text(source.license_state).toUpperCase()
  return US_STATES.has(state) ? state : ''
}

function selectedCredentialMarket(selection: ProfessionalIdentitySelection) {
  if (selection.credential_source === 'br_creci') return 'BR'
  if (selection.credential_source === 'us_license') return 'US'
  return null
}

// Server-side counterpart of frontend/src/config/professionalProfile.js.
// Returns nothing unless the credential is complete, so a name alone is never injected.
export function formatProfessionalIdentity(profile: ProfessionalProfile | null | undefined, market: 'BR' | 'US') {
  const source = profile || {}
  const name = [source.display_name, source.nome, source.name, source.full_name].map(text).find(Boolean) || ''
  const state = text(source.estado || source.state).toUpperCase()
  if (market === 'US') {
    const license = text(source.license_number)
    const licenseState = usLicenseState(source)
    return name && license && licenseState ? `${name} — License ${license}, ${licenseState}` : ''
  }
  const creci = text(source.creci)
  const type = text(source.creci_type).toUpperCase()
  return name && creci && state && ['F', 'J'].includes(type) ? `${name} — CRECI ${type} ${creci}/${state}` : ''
}

// Never trust names or credentials supplied by a browser request.  The
// selection only says whether this particular creation opted in and which
// profile name to use; values are re-read from the authenticated profile.
export function resolveProfessionalIdentity(profile: ProfessionalProfile | null | undefined, selection: ProfessionalIdentitySelection | null | undefined, _creationMarket: 'BR' | 'US'): StructuredProfessionalIdentity | null {
  if (!selection || selection.enabled !== true || (selection.name_source !== 'real' && selection.name_source !== 'display')) return null
  const source = profile || {}
  // Creation locale controls the content, never the selected credential.  An
  // enabled legacy draft without credential_source is deliberately omitted;
  // the product UI asks the user to select it before a new request is sent.
  const resolvedMarket = selectedCredentialMarket(selection)
  if (!resolvedMarket) return null
  const legalName = text(source.nome || source.full_name || source.name)
  const displayName = text(source.display_name)
  const chosenName = selection.name_source === 'display' ? displayName : legalName
  if (resolvedMarket === 'US') {
    const license = text(source.license_number)
    const licenseState = usLicenseState(source)
    if (!chosenName || !license || !licenseState) return null
    return { enabled: true, name_source: selection.name_source, market: 'US', name: chosenName, creci_type: '', creci_number: '', creci_state: '', license_number: license, license_state: licenseState, formatted: `${chosenName} · License #${license} · ${licenseState}` }
  }
  const state = text(source.estado || source.state).toUpperCase()
  const creci = text(source.creci)
  const type = text(source.creci_type).toUpperCase()
  if (!chosenName || !creci || !state || !['F', 'J'].includes(type)) return null
  return { enabled: true, name_source: selection.name_source, market: 'BR', name: chosenName, creci_type: type, creci_number: creci, creci_state: state, license_number: '', license_state: '', formatted: `${chosenName} · CRECI-${type} ${creci}/${state}` }
}
