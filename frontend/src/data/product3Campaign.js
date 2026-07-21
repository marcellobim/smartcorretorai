const RESIDENTIAL_TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Sobrado']

export const PRODUCT_3_PROPERTY_TYPES = [
  ...RESIDENTIAL_TYPES,
  'Terreno / Lote',
  'Sala comercial',
  'Conjunto comercial',
  'Loja',
  'Laje corporativa',
  'Galpão',
]

export const isProduct3CommercialType = (type) => /(sala|conjunto|loja|laje|comercial|galp[aã]o)/i.test(String(type || ''))

const COMMON_RESIDENTIAL = [
  'Piscina', 'Academia', 'Churrasqueira', 'Varanda gourmet', 'Lazer completo', 'Vista livre',
  'Próximo ao metrô', 'Próximo ao comércio', 'Boa localização', 'Condomínio completo',
  'Portaria 24 horas', 'Segurança 24 horas', 'Reformado', 'Andar alto', 'Área verde',
  'Pet friendly', 'Vaga coberta',
]

const SALE_RESIDENTIAL = [
  ...COMMON_RESIDENTIAL,
  'Aceita financiamento', 'Documentação em ordem', 'Pronto para morar', 'Condições facilitadas',
  'Ótimo para investir', 'Alto padrão', 'Iluminado', 'Bem ventilado', 'Vagas para visitantes',
  'Quintal', 'Jardim', 'Piscina privativa', 'Edícula', 'Condomínio fechado',
]

const RENTAL_RESIDENTIAL = [
  'Mobiliado', 'Semimobiliado', 'Vazio', 'Pronto para mudar', 'Disponível agora', 'Entrada imediata',
  'Aceita pet', 'Garantia facilitada', 'Condomínio incluso', 'IPTU incluso', 'Água inclusa',
  'Gás incluso', 'Internet inclusa', 'Armários planejados', 'Eletrodomésticos', 'Ar-condicionado',
  ...COMMON_RESIDENTIAL,
]

const COMMON_COMMERCIAL = [
  'Excelente localização', 'Próximo ao transporte público', 'Recepção', 'Salas de reunião', 'Copa',
  'Banheiros', 'Ar-condicionado', 'Piso elevado', 'Forro modular', 'Cabeamento estruturado', 'Gerador',
  'Estacionamento', 'Vagas para clientes', 'Portaria', 'Segurança 24 horas', 'Controle de acesso',
  'Elevador', 'Elevadores', 'Acessibilidade', 'Fachada comercial', 'Vitrine', 'Esquina', 'Alta visibilidade', 'Fluxo de pedestres',
  'Pé-direito alto', 'Área para estoque', 'Doca', 'Pátio', 'Acesso para caminhões',
  'Fácil acesso a rodovias', 'Área livre',
]

const SALE_COMMERCIAL = ['Pronto para uso', ...COMMON_COMMERCIAL, 'Ótimo para investir']
const RENTAL_COMMERCIAL = [
  'Disponível agora', 'Pronto para ocupação', 'Entrada imediata', 'Mobiliado', 'Semimobiliado', 'Vazio',
  ...COMMON_COMMERCIAL, 'Condomínio incluso', 'IPTU incluso', 'Espaço para adaptação',
]

const TYPE_PRIORITY = {
  Apartamento: ['Varanda gourmet', 'Lazer completo', 'Portaria 24 horas', 'Academia', 'Mobiliado', 'Andar alto'],
  Casa: ['Quintal', 'Jardim', 'Piscina privativa', 'Churrasqueira', 'Edícula', 'Condomínio fechado'],
  'Sala comercial': ['Recepção', 'Piso elevado', 'Ar-condicionado', 'Estacionamento', 'Segurança 24 horas'],
  'Conjunto comercial': ['Recepção', 'Piso elevado', 'Ar-condicionado', 'Estacionamento', 'Segurança 24 horas'],
  Loja: ['Fachada comercial', 'Vitrine', 'Alta visibilidade', 'Fluxo de pedestres', 'Esquina', 'Estacionamento', 'Pé-direito alto'],
  'Laje corporativa': ['Área livre', 'Piso elevado', 'Gerador', 'Elevadores', 'Controle de acesso', 'Espaço para adaptação'],
  Galpão: ['Doca', 'Pé-direito alto', 'Pátio', 'Acesso para caminhões', 'Área para estoque', 'Fácil acesso a rodovias'],
}

export function getProduct3Highlights(purpose, propertyType) {
  const commercial = isProduct3CommercialType(propertyType)
  const base = purpose === 'rental'
    ? (commercial ? RENTAL_COMMERCIAL : RENTAL_RESIDENTIAL)
    : (commercial ? SALE_COMMERCIAL : SALE_RESIDENTIAL)
  const priority = TYPE_PRIORITY[propertyType] || []
  const sameSegmentTypes = commercial
    ? ['Sala comercial', 'Conjunto comercial', 'Loja', 'Laje corporativa', 'Galpão']
    : ['Apartamento', 'Casa']
  const specialized = new Set(sameSegmentTypes.flatMap(type => TYPE_PRIORITY[type] || []))
  const filtered = base.filter(item => !specialized.has(item) || priority.includes(item))
  return [...new Set([...priority.filter(item => base.includes(item)), ...filtered])]
}
