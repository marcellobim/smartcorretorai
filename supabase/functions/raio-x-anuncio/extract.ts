import type { CandidateSource, ListingXrayFieldKey } from './contract.ts'

export type RawCandidate = { field: ListingXrayFieldKey | 'detectedImageCount' | 'videoDetected'; value: unknown; source: CandidateSource; locator: string; confidence: number }
export type ListingExtraction = {
  sourceUrl: string
  sourceDomain: string
  adapter: 'quintoandar' | 'zap_vivareal' | 'imovelweb' | 'generic'
  candidates: RawCandidate[]
  title: string | null
  description: string | null
  evidenceSnippets: string[]
  visibleText: string
}

const clean = (value: unknown, maximum = 20_000) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, maximum)

const decodeEntities = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const stripTags = (html: string) => clean(decodeEntities(html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')))

function attributes(tag: string) {
  const result: Record<string, string> = {}
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  return result
}

function adapterFor(domain: string): ListingExtraction['adapter'] {
  if (/(^|\.)quintoandar\.com\.br$/.test(domain)) return 'quintoandar'
  if (/(^|\.)(zapimoveis|vivareal)\.com\.br$/.test(domain)) return 'zap_vivareal'
  if (/(^|\.)imovelweb\.com\.br$/.test(domain)) return 'imovelweb'
  return 'generic'
}

const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = clean(value, 100).replace(/R\$\s*/i, '').replace(/\s/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  const amount = match ? Number(match[0]) : Number.NaN
  return Number.isFinite(amount) ? amount : null
}

const add = (list: RawCandidate[], field: RawCandidate['field'], value: unknown, source: CandidateSource, locator: string, confidence: number) => {
  if (value === null || value === undefined || value === '') return
  list.push({ field, value, source, locator: clean(locator, 120), confidence })
}

const keyMap: Record<string, ListingXrayFieldKey> = {
  name: 'title', headline: 'title', title: 'title', description: 'description',
  price: 'price', pricevalue: 'price', condominiumfee: 'condominiumFee', condo: 'condominiumFee', iptu: 'propertyTax', propertytax: 'propertyTax',
  floorsize: 'area', area: 'area', usablearea: 'area', numberofrooms: 'bedrooms', numberofbedrooms: 'bedrooms', bedrooms: 'bedrooms', quartos: 'bedrooms',
  numberofsuites: 'suites', suites: 'suites', numberofbathroomstotal: 'bathrooms', numberoffullbathrooms: 'bathrooms', bathrooms: 'bathrooms', banheiros: 'bathrooms',
  numberofparkingspaces: 'parkingSpaces', parkingspaces: 'parkingSpaces', parking: 'parkingSpaces', vagas: 'parkingSpaces',
  addresslocality: 'city', city: 'city', addressregion: 'state', state: 'state', address: 'address', streetaddress: 'address', neighborhood: 'district', district: 'district', bairro: 'district',
  amenities: 'amenities', amenityfeature: 'amenities', highlights: 'highlights', developmentname: 'developmentName', builder: 'builder', stage: 'stage', propertystatus: 'stage',
}

function scalar(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const input = value as Record<string, unknown>
    return input.value ?? input.name ?? input.addressLocality ?? null
  }
  return value
}

function visitStructured(value: unknown, source: CandidateSource, locator: string, candidates: RawCandidate[], depth = 0, budget = { count: 0 }) {
  if (depth > 12 || budget.count++ > 8_000 || value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.slice(0, 300).forEach((item, index) => visitStructured(item, source, `${locator}[${index}]`, candidates, depth + 1, budget))
    return
  }
  if (typeof value !== 'object') return
  const input = value as Record<string, unknown>
  const type = clean(input['@type'], 80).toLowerCase()
  if (/house|apartment|residence|accommodation|product|offer|realestate/.test(type)) {
    if (/apartment/.test(type)) add(candidates, 'propertyType', 'Apartamento', source, `${locator}.@type`, 0.9)
    if (/house|residence/.test(type)) add(candidates, 'propertyType', 'Casa', source, `${locator}.@type`, 0.85)
  }
  if (/videoobject/.test(type)) add(candidates, 'videoDetected', true, source, `${locator}.@type`, 0.95)
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const compact = rawKey.replace(/[^a-z0-9]/gi, '').toLowerCase()
    const mapped = keyMap[compact]
    if (mapped) {
      if (mapped === 'amenities' || mapped === 'highlights') {
        const values = (Array.isArray(rawValue) ? rawValue : [rawValue]).map(item => clean(scalar(item), 160)).filter(Boolean)
        if (values.length) add(candidates, mapped, values, source, `${locator}.${rawKey}`, source === 'json_ld' ? 0.9 : 0.72)
      } else {
        const valueToAdd = ['price', 'condominiumFee', 'propertyTax', 'area', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces'].includes(mapped) ? asNumber(scalar(rawValue)) : scalar(rawValue)
        add(candidates, mapped, valueToAdd, source, `${locator}.${rawKey}`, source === 'json_ld' ? 0.92 : 0.72)
      }
    }
    if (compact === 'offers') visitStructured(rawValue, source, `${locator}.${rawKey}`, candidates, depth + 1, budget)
    else if (rawValue && typeof rawValue === 'object') visitStructured(rawValue, source, `${locator}.${rawKey}`, candidates, depth + 1, budget)
  }
}

function parseJsonScripts(html: string, candidates: RawCandidate[]) {
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = attributes(match[1])
    const body = match[2].trim()
    if (!body || body.length > 2_500_000) continue
    const isLd = /application\/ld\+json/i.test(attrs.type || '')
    const isEmbedded = attrs.id === '__NEXT_DATA__' || /application\/json/i.test(attrs.type || '') || /__APOLLO_STATE__|__INITIAL_STATE__/i.test(body.slice(0, 300))
    if (!isLd && !isEmbedded) continue
    const jsonText = body.replace(/^\s*window\.__\w+__\s*=\s*/, '').replace(/;\s*$/, '')
    try { visitStructured(JSON.parse(jsonText), isLd ? 'json_ld' : 'embedded_data', isLd ? 'jsonld' : `script#${attrs.id || 'embedded'}`, candidates) } catch { /* malformed external data is ignored */ }
  }
}

function parseMetadata(html: string, candidates: RawCandidate[]) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0])
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase()
    const content = clean(attrs.content, 10_000)
    if (!key || !content) continue
    const source: CandidateSource = key.startsWith('og:') ? 'open_graph' : 'metadata'
    const confidence = source === 'open_graph' ? 0.82 : 0.75
    if (['og:title', 'twitter:title', 'title'].includes(key)) add(candidates, 'title', content, source, `meta:${key}`, confidence)
    if (['og:description', 'twitter:description', 'description'].includes(key)) add(candidates, 'description', content, source, `meta:${key}`, confidence)
    if (['product:price:amount', 'price'].includes(key)) add(candidates, 'price', asNumber(content), source, `meta:${key}`, confidence)
  }
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  if (title) add(candidates, 'title', clean(decodeEntities(title), 300), 'metadata', 'title', 0.72)
}

function addVisibleMatches(textValue: string, candidates: RawCandidate[]) {
  const patterns: Array<[ListingXrayFieldKey, RegExp, number]> = [
    ['bedrooms', /(\d+)\s*(?:quartos?|dormit[oó]rios?)/gi, 0.68],
    ['suites', /(\d+)\s*su[ií]tes?/gi, 0.7],
    ['bathrooms', /(\d+)\s*banheiros?/gi, 0.68],
    ['parkingSpaces', /(\d+)\s*(?:vagas?(?:\s+de\s+garagem)?|garagens?)/gi, 0.7],
    ['area', /(\d+(?:[.,]\d+)?)\s*m(?:²|2|\s*quadrados?)/gi, 0.66],
    ['price', /R\$\s*([\d.]+(?:,\d{1,2})?)/gi, 0.64],
    ['condominiumFee', /condom[ií]nio\s*(?:de|:)?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/gi, 0.7],
    ['propertyTax', /IPTU\s*(?:de|:)?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/gi, 0.7],
  ]
  for (const [field, regex, confidence] of patterns) {
    let index = 0
    for (const match of textValue.matchAll(regex)) {
      add(candidates, field, asNumber(match[1]), 'visible_text', `text:${field}:${index++}`, confidence)
      if (index >= 12) break
    }
  }
  // Full portal pages contain menus and recommended listings. These weak
  // matches are useful only as supporting evidence; title/description matches
  // below identify the current listing with much stronger confidence.
  if (/\b(?:à venda|a venda|venda)\b/i.test(textValue)) add(candidates, 'purpose', 'sale', 'visible_text', 'text:purpose:page-sale', 0.45)
  if (/\b(?:para alugar|aluguel|loca[cç][aã]o)\b/i.test(textValue)) add(candidates, 'purpose', 'rent', 'visible_text', 'text:purpose:page-rent', 0.45)
  const propertyTypes = [['Apartamento', /\bapartamento\b/i], ['Casa', /\bcasa\b/i], ['Cobertura', /\bcobertura\b/i], ['Studio / Loft', /\b(?:studio|loft)\b/i], ['Terreno / Lote', /\b(?:terreno|lote)\b/i], ['Comercial', /\b(?:sala comercial|im[oó]vel comercial)\b/i]] as const
  for (const [label, regex] of propertyTypes) if (regex.test(textValue)) { add(candidates, 'propertyType', label, 'visible_text', 'text:propertyType', 0.62); break }
}

export function extractListing(html: string, sourceUrl: string): ListingExtraction {
  const url = new URL(sourceUrl)
  const domain = url.hostname.toLowerCase().replace(/\.$/, '')
  const candidates: RawCandidate[] = []
  parseJsonScripts(html, candidates)
  parseMetadata(html, candidates)
  const visibleText = stripTags(html).slice(0, 20_000)
  addVisibleMatches(visibleText, candidates)

  const imageUrls = new Set<string>()
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = attributes(match[0])
    const src = attrs.src || attrs['data-src'] || attrs.srcset?.split(',')[0]?.trim().split(/\s+/)[0]
    if (src && !/^data:/i.test(src) && !/sprite|icon|logo/i.test(src)) imageUrls.add(src)
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0])
    if ((attrs.property || '').toLowerCase() === 'og:image' && attrs.content) imageUrls.add(attrs.content)
  }
  if (imageUrls.size) add(candidates, 'detectedImageCount', imageUrls.size, 'visible_text', 'html:media:image', 0.7)
  if (/<video\b|"@type"\s*:\s*"VideoObject"|og:video/gi.test(html)) add(candidates, 'videoDetected', true, 'visible_text', 'html:media:video', 0.8)

  const best = (field: ListingXrayFieldKey) => candidates.filter(candidate => candidate.field === field).sort((a, b) => b.confidence - a.confidence || clean(b.value).length - clean(a.value).length)[0]
  const title = best('title') ? clean(best('title')?.value, 300) : null
  const description = best('description') ? clean(best('description')?.value, 8_000) : null
  const primaryText = `${title || ''} ${description || ''}`
  if (/\b(?:à venda|a venda|para venda)\b/i.test(primaryText)) add(candidates, 'purpose', 'sale', 'visible_text', 'primary:purpose:sale', 0.95)
  if (/\b(?:para alugar|aluguel|loca[cç][aã]o)\b/i.test(primaryText)) add(candidates, 'purpose', 'rent', 'visible_text', 'primary:purpose:rent', 0.95)
  const evidenceSnippets = [title, description, ...visibleText.split(/(?<=[.!?])\s+/).filter(part => /\d|R\$|dormit|vaga|su[ií]te|m²|condom[ií]nio|IPTU/i.test(part)).slice(0, 12)].filter(Boolean).map(value => clean(value, 700))

  return { sourceUrl, sourceDomain: domain, adapter: adapterFor(domain), candidates, title, description, evidenceSnippets: [...new Set(evidenceSnippets)].slice(0, 14), visibleText }
}
