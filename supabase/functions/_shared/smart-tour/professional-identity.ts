type ProfessionalProfile = Record<string, unknown>

const text = (value: unknown) => String(value ?? '').trim()
const firstText = (...values: unknown[]) => values.map(text).find(Boolean) || ''

/**
 * Formats only complete, stored profile data for the deterministic video overlay.
 * This mirrors the portable frontend profile contract without accepting a client
 * supplied identity string as authoritative data.
 */
export function formatSmartTourProfessionalIdentity(profile: ProfessionalProfile | null | undefined) {
  const source = profile || {}
  const market = text(source.market).toUpperCase() === 'US' ? 'US' : 'BR'
  const name = firstText(source.display_name, source.nome, source.full_name)
  const state = text(source.estado).toUpperCase()

  if (market === 'US') {
    const licenseNumber = text(source.license_number)
    return name && licenseNumber && state ? `${name} — License ${licenseNumber}, ${state}` : ''
  }

  const creciNumber = text(source.creci)
  const creciType = text(source.creci_type).toUpperCase()
  return name && creciNumber && state && ['F', 'J'].includes(creciType)
    ? `${name} — CRECI ${creciType} ${creciNumber}/${state}`
    : ''
}
