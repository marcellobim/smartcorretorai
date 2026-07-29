export const FURNISH_RENOVATE_JOURNEY_ID = 'furnish-renovate'
export const FURNISH_RENOVATE_MAX_IMAGES = 5

export const FURNISH_RENOVATE_COPY = Object.freeze({
  uploadQuestion: 'Envie de 1 a 5 fotos dos ambientes que deseja reimaginar.',
  uploadHint: 'Podem ser ambientes vazios ou já mobiliados. As fotos serão utilizadas na ordem escolhida.',
  reviewNotice: 'A IA criará uma nova apresentação visual do imóvel. Cada geração é única e pode reinterpretar parcialmente a composição para criar um resultado mais atraente.',
})

export const FURNISH_RENOVATE_QUESTIONS = Object.freeze([
  ['images', 1, FURNISH_RENOVATE_COPY.uploadQuestion],
  ['purpose', 2, 'Qual é a finalidade do imóvel?'],
  ['type', 2, 'Qual é o tipo do imóvel?'],
  ['bedrooms', 3, 'Quantos dormitórios o imóvel possui?'],
  ['suites', 3, 'Quantas suítes o imóvel possui?'],
  ['parkingSpaces', 3, 'Quantas vagas de garagem o imóvel possui?'],
  ['area', 3, 'Qual é a área do imóvel?'],
  ['state', 3, 'Em qual Estado fica o imóvel?'],
  ['city', 3, 'Em qual cidade fica o imóvel?'],
  ['neighborhood', 3, 'Em qual bairro fica o imóvel?'],
  ['highlights', 3, 'Quais destaques deseja incluir na narração?'],
  ['review', 4, 'Tudo pronto. Revise os dados antes de criar sua apresentação.'],
])

export const FURNISH_RENOVATE_PROPERTY_TYPES = Object.freeze([
  'Apartamento',
  'Casa',
  'Sobrado',
  'Studio',
  'Loft',
  'Cobertura',
  'Kitnet',
])

export const FURNISH_RENOVATE_HIGHLIGHT_GROUPS = Object.freeze([
  { title: 'Lazer', items: Object.freeze(['Lazer completo', 'Piscina', 'Academia', 'Espaço gourmet']) },
  { title: 'Região e localização', items: Object.freeze(['Próximo ao metrô', 'Próximo ao comércio', 'Bairro valorizado', 'Fácil acesso']) },
  { title: 'Diferenciais residenciais', items: Object.freeze(['Varanda gourmet', 'Vista livre', 'Reformado', 'Alto padrão', 'Condomínio clube', 'Portaria 24 horas']) },
])
export const FURNISH_RENOVATE_MAX_HIGHLIGHTS = 3

export function canAddFurnishRenovateImages(currentCount, addedCount) {
  return currentCount >= 0 && addedCount >= 0 && currentCount + addedCount <= FURNISH_RENOVATE_MAX_IMAGES
}

export function buildFurnishRenovatePayload({ imagePaths, property, language = 'pt-BR' }) {
  return {
    module: FURNISH_RENOVATE_JOURNEY_ID,
    property_images: { image_paths: [...imagePaths], image_order: [...imagePaths] },
    property: {
      purpose: property.purpose,
      type: property.type,
      bedrooms: property.bedrooms,
      suites: property.suites,
      parkingSpaces: property.parkingSpaces,
      area: property.area,
      state: property.state,
      city: property.city,
      neighborhood: property.neighborhood,
      highlights: [...property.highlights].slice(0, FURNISH_RENOVATE_MAX_HIGHLIGHTS),
    },
    language,
  }
}

export function buildFurnishRenovateReviewItems({ imagesCount, property }) {
  return [
    { id: 'images', label: imagesCount && `${imagesCount} fotografia${imagesCount > 1 ? 's' : ''}` },
    { id: 'purpose', label: property.purpose && (property.purpose === 'sale' ? 'Venda' : 'Locação') },
    { id: 'type', label: property.type },
    { id: 'bedrooms', displayLabel: 'Dormitórios', label: property.bedrooms },
    { id: 'suites', displayLabel: 'Suítes', label: property.suites },
    { id: 'parkingSpaces', displayLabel: 'Vagas', label: property.parkingSpaces },
    { id: 'area', displayLabel: 'Área', label: property.area && `${property.area} m²` },
    { id: 'state', displayLabel: 'Estado', label: property.state },
    { id: 'city', displayLabel: 'Cidade', label: property.city },
    { id: 'neighborhood', displayLabel: 'Bairro', label: property.neighborhood },
    { id: 'highlights', label: property.highlights.length ? property.highlights.join(' · ') : 'Nenhum destaque adicional' },
  ].filter(item => Boolean(item.label))
}
