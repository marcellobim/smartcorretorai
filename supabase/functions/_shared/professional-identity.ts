export type ProfessionalProfile = Record<string, unknown>

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

// Server-side counterpart of frontend/src/config/professionalProfile.js.
// Returns nothing unless the credential is complete, so a name alone is never injected.
export function formatProfessionalIdentity(profile: ProfessionalProfile | null | undefined, market: 'BR' | 'US') {
  const source = profile || {}
  const name = [source.display_name, source.nome, source.name, source.full_name].map(text).find(Boolean) || ''
  const state = text(source.estado || source.state).toUpperCase()
  if (market === 'US') {
    const license = text(source.license_number)
    return name && license && state ? `${name} — License ${license}, ${state}` : ''
  }
  const creci = text(source.creci)
  const type = text(source.creci_type).toUpperCase()
  return name && creci && state && ['F', 'J'].includes(type) ? `${name} — CRECI ${type} ${creci}/${state}` : ''
}
