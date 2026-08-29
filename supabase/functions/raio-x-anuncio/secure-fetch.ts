export const LISTING_XRAY_FETCH_TIMEOUT_MS = 12_000
export const LISTING_XRAY_MAX_REDIRECTS = 5
export const LISTING_XRAY_MAX_HTML_BYTES = 5 * 1024 * 1024

export class ListingXrayFetchError extends Error {
  readonly code: string
  constructor(code: string) { super(code); this.code = code }
}

export type DnsResolver = (hostname: string, type: 'A' | 'AAAA', signal?: AbortSignal) => Promise<string[]>
export type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type SecureFetchDependencies = {
  fetcher?: Fetcher
  resolveDns?: DnsResolver
  timeoutMs?: number
  maxRedirects?: number
  maxBytes?: number
  now?: () => number
}

export type SecureHtmlResult = {
  html: string
  finalUrl: string
  sourceDomain: string
  redirects: number
  bytes: number
  contentType: string
  status: number
  durationMs: number
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home', '.lan', '.corp']
const BLOCKED_HOSTS = new Set([
  'localhost', 'localhost.localdomain', 'metadata', 'metadata.google.internal',
  'instance-data', 'instance-data.ec2.internal', '169.254.169.254', '100.100.100.200',
])

const isIpv4 = (value: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)

function parseIpv4(value: string) {
  if (!isIpv4(value)) return null
  const octets = value.split('.').map(Number)
  if (octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null
  return octets
}

function expandIpv6(input: string) {
  let value = input.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0]
  if (!value.includes(':')) return null
  const ipv4Match = value.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (ipv4Match) {
    const octets = parseIpv4(ipv4Match[1])
    if (!octets) return null
    value = value.slice(0, value.length - ipv4Match[1].length) + `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`
  }
  const halves = value.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  if (halves.length === 1 && left.length !== 8) return null
  const missing = 8 - left.length - right.length
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null
  const parts = [...left, ...Array.from({ length: missing }, () => '0'), ...right]
  if (parts.length !== 8 || parts.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return null
  return parts.map(part => Number.parseInt(part, 16))
}

function ipv4In(octets: number[], first: number, prefix: number, secondMin = 0, secondMax = 255) {
  if (prefix === 8) return octets[0] === first
  if (prefix === 16) return octets[0] === first && octets[1] >= secondMin && octets[1] <= secondMax
  return false
}

export function isPublicIpAddress(value: string) {
  const ipv4 = parseIpv4(value)
  if (ipv4) {
    const [a, b] = ipv4
    if (
      ipv4In(ipv4, 0, 8) || ipv4In(ipv4, 10, 8) || ipv4In(ipv4, 127, 8)
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0) || (a === 192 && b === 168)
      || (a === 192 && b === 88 && ipv4[2] === 99)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && ipv4[2] === 100)
      || (a === 203 && b === 0 && ipv4[2] === 113)
      || a >= 224
    ) return false
    return true
  }

  const ipv6 = expandIpv6(value)
  if (!ipv6) return false
  if (ipv6.every(part => part === 0) || ipv6.slice(0, 7).every(part => part === 0) && ipv6[7] === 1) return false
  const first = ipv6[0]
  const nat64WellKnown = first === 0x0064 && ipv6[1] === 0xff9b && (ipv6[2] === 0 || ipv6[2] === 1)
  const documentation = first === 0x2001 && ipv6[1] === 0x0db8
  const orchidOrBenchmark = first === 0x2001 && (ipv6[1] === 0x0002 || (ipv6[1] & 0xfff0) === 0x0010 || (ipv6[1] & 0xfff0) === 0x0020)
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00 || nat64WellKnown || documentation || orchidOrBenchmark) return false
  const mapped = ipv6.slice(0, 5).every(part => part === 0) && ipv6[5] === 0xffff
  if (mapped) return isPublicIpAddress(`${ipv6[6] >> 8}.${ipv6[6] & 255}.${ipv6[7] >> 8}.${ipv6[7] & 255}`)
  const compatible = ipv6.slice(0, 6).every(part => part === 0)
  if (compatible) return isPublicIpAddress(`${ipv6[6] >> 8}.${ipv6[6] & 255}.${ipv6[7] >> 8}.${ipv6[7] & 255}`)
  return true
}

function normalizeHostname(value: string) {
  return value.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

export function parseListingUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) throw new ListingXrayFetchError('invalid_url')
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new ListingXrayFetchError('invalid_url') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new ListingXrayFetchError('invalid_url')
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) throw new ListingXrayFetchError('blocked_port')
  url.hash = ''
  return url
}

const defaultResolver: DnsResolver = async (hostname, type, signal) => {
  const deno = (globalThis as unknown as { Deno?: { resolveDns?: (hostname: string, type: 'A' | 'AAAA', options?: { signal?: AbortSignal }) => Promise<string[]> } }).Deno
  if (!deno?.resolveDns) throw new ListingXrayFetchError('dns_unavailable')
  try { return await deno.resolveDns(hostname, type, { signal }) } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return []
  }
}

export async function validatePublicListingUrl(value: string | URL, resolveDns: DnsResolver = defaultResolver, signal?: AbortSignal) {
  const url = value instanceof URL ? parseListingUrl(value.toString()) : parseListingUrl(value)
  const hostname = normalizeHostname(url.hostname)
  if (!hostname || BLOCKED_HOSTS.has(hostname) || BLOCKED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))) throw new ListingXrayFetchError('blocked_host')

  if (isIpv4(hostname) || hostname.includes(':')) {
    if (!isPublicIpAddress(hostname)) throw new ListingXrayFetchError('blocked_ip')
    return url
  }

  const [ipv4, ipv6] = await Promise.all([resolveDns(hostname, 'A', signal), resolveDns(hostname, 'AAAA', signal)])
  const addresses = [...ipv4, ...ipv6]
  if (!addresses.length) throw new ListingXrayFetchError('dns_empty')
  if (addresses.some(address => !isPublicIpAddress(address))) throw new ListingXrayFetchError('blocked_dns_target')
  return url
}

async function readLimitedText(response: Response, maximum: number) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximum) throw new ListingXrayFetchError('response_too_large')
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maximum) {
      await reader.cancel().catch(() => undefined)
      throw new ListingXrayFetchError('response_too_large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export async function secureFetchListingHtml(inputUrl: string, dependencies: SecureFetchDependencies = {}): Promise<SecureHtmlResult> {
  const fetcher = dependencies.fetcher || fetch
  const resolver = dependencies.resolveDns || defaultResolver
  const timeoutMs = dependencies.timeoutMs ?? LISTING_XRAY_FETCH_TIMEOUT_MS
  const maxRedirects = dependencies.maxRedirects ?? LISTING_XRAY_MAX_REDIRECTS
  const maxBytes = dependencies.maxBytes ?? LISTING_XRAY_MAX_HTML_BYTES
  const startedAt = (dependencies.now || Date.now)()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let current = parseListingUrl(inputUrl)
  let redirects = 0
  try {
    while (true) {
      current = await validatePublicListingUrl(current, resolver, controller.signal)
      const response = await fetcher(current, {
        method: 'GET', redirect: 'manual', signal: controller.signal, credentials: 'omit',
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'SmartCorretorAI-ListingXRay/1.0',
        },
      })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= maxRedirects) throw new ListingXrayFetchError('too_many_redirects')
        const location = response.headers.get('location')
        if (!location) throw new ListingXrayFetchError('redirect_without_location')
        current = parseListingUrl(new URL(location, current).toString())
        redirects += 1
        continue
      }
      if (!response.ok) throw new ListingXrayFetchError(`upstream_http_${response.status}`)
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (!['text/html', 'application/xhtml+xml'].includes(contentType)) throw new ListingXrayFetchError('invalid_content_type')
      const html = await readLimitedText(response, maxBytes)
      if (!html.trim()) throw new ListingXrayFetchError('empty_html')
      return {
        html, finalUrl: current.toString(), sourceDomain: normalizeHostname(current.hostname), redirects,
        bytes: new TextEncoder().encode(html).byteLength, contentType, status: response.status,
        durationMs: Math.max(0, (dependencies.now || Date.now)() - startedAt),
      }
    }
  } catch (error) {
    if (error instanceof ListingXrayFetchError) throw error
    if (controller.signal.aborted) throw new ListingXrayFetchError('fetch_timeout')
    throw new ListingXrayFetchError('fetch_failed')
  } finally {
    clearTimeout(timeout)
  }
}
