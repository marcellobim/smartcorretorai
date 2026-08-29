import type { ListingExtraction } from '../extract.ts'

const candidate = (field: ListingExtraction['candidates'][number]['field'], value: unknown, source: ListingExtraction['candidates'][number]['source'], locator: string, confidence: number): ListingExtraction['candidates'][number] => ({ field, value, source, locator, confidence })

// Fixture sanitizado do padrão observado no canário: valores reais convivem com
// números auxiliares, endereço complementar e navegação sale/rent.
export const LISTING_XRAY_V5_CANARY_EXTRACTION: ListingExtraction = {
  sourceUrl: 'https://portal.example/imovel/fixture', sourceDomain: 'portal.example', adapter: 'generic',
  title: 'Apartamento para alugar na Rua das Flores',
  description: 'Apartamento para alugar com dois dormitórios e elevador.',
  visibleText: 'Apartamento para alugar na Rua das Flores. Aluguel R$ 2.200. Elevador.',
  evidenceSnippets: ['Apartamento para alugar', 'Aluguel R$ 2.200', 'Elevador'],
  candidates: [
    candidate('title', 'Apartamento para alugar na Rua das Flores', 'visible_text', 'primary:title', .95),
    candidate('description', 'Apartamento para alugar com dois dormitórios e elevador.', 'visible_text', 'primary:description', .92),
    candidate('price', 2200, 'visible_text', 'primary:price:aluguel', .96),
    candidate('price', 'R$ 2.200', 'json_ld', 'jsonld:offers:price', .95),
    candidate('price', 2.2, 'embedded_data', 'analytics:rating', .62),
    candidate('price', 2.384, 'embedded_data', 'analytics:coordinate', .62),
    candidate('price', 5.96, 'embedded_data', 'analytics:score', .62),
    candidate('purpose', 'rent', 'visible_text', 'primary:purpose:rent', .95),
    candidate('purpose', 'sale', 'visible_text', 'text:purpose:page-sale', .45),
    candidate('address', 'Rua das Flores', 'visible_text', 'primary:address', .91),
    candidate('address', 'Rua das Flores, Centro', 'json_ld', 'jsonld:address', .90),
    candidate('address', 'Rua das Flores, Centro, São Paulo', 'metadata', 'meta:address', .82),
    candidate('amenities', ['true', 'NAO', 'SIM', 'Elevador'], 'embedded_data', 'embedded:amenities', .75),
    candidate('suites', 0, 'embedded_data', 'analytics:suites', .60),
    candidate('parkingSpaces', 0, 'json_ld', 'jsonld:parkingSpaces', .90),
    candidate('detectedImageCount', 30, 'metadata', 'meta:images', .90),
  ],
}
