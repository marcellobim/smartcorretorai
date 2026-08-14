export const VIRTUAL_STAGING_IMAGE_MODEL = 'gpt-image-2'
export const VIRTUAL_STAGING_IMAGE_QUALITY = 'medium'
export const VIRTUAL_STAGING_OUTPUT_FORMAT = 'jpeg'
export const VIRTUAL_STAGING_BACKGROUND = 'opaque'
export const VIRTUAL_STAGING_OUTPUT_MIME = 'image/jpeg'
export const VIRTUAL_STAGING_INPUT_MAX_BYTES = 20 * 1024 * 1024
export const VIRTUAL_STAGING_OPENAI_TIMEOUT_MS = 120_000
export const VIRTUAL_STAGING_SQUARE_RATIO_MIN = 0.90
export const VIRTUAL_STAGING_SQUARE_RATIO_MAX = 1.10

export const VIRTUAL_STAGING_PROMPT_BASE = `Edite esta fotografia imobiliária realizando Virtual Staging estrito.

Use a fotografia original como base visual e arquitetônica obrigatória.

Mantenha inalterados:

- geometria e dimensões aparentes;
- paredes, teto e piso;
- portas, janelas, passagens e corredores;
- tomadas, interruptores, pilares, bancadas e elementos fixos;
- posição, tamanho e proporção dos elementos arquitetônicos;
- perspectiva, lente, enquadramento e posição da câmera;
- iluminação natural e identidade visual do imóvel.

É proibido criar outro imóvel, outro ambiente, outro ângulo, outra perspectiva ou outra versão arquitetônica do espaço.

Em todos os casos, a intervenção deve acontecer dentro do mesmo ambiente original, sem criar outro ambiente, outro ângulo, outra perspectiva ou outra versão arquitetônica do imóvel. Preserve integralmente a geometria, a estrutura física, os elementos fixos, o enquadramento e a posição da câmera.

Altere SOMENTE os móveis soltos, eletrodomésticos, eletrônicos e elementos decorativos que possam ser inseridos em espaços fisicamente livres e reais. Mantenha todo o restante inalterado.

A saída deve manter exatamente a mesma orientação, composição, proporção visual, perspectiva, posição da câmera, distância focal, enquadramento e campo de visão da fotografia de entrada.

Não mova a câmera e não expanda a cena para cima, para baixo ou para os lados.

Não crie áreas que não existam na fotografia original e não recorte elementos existentes para adaptar a imagem a outra proporção.

Não mova, remova, amplie, reduza ou reconstrua paredes, teto, vigas, pilares, portas, janelas, passagens, corredores, piso, bancada, pia, armários planejados, louças, metais, tomadas, interruptores ou revestimentos.

Se um objeto não couber de forma realista sem alterar a arquitetura, não o adicione.

O resultado deve parecer a mesma fotografia original após a colocação ou substituição pontual de mobiliário e decoração, e nunca uma nova composição arquitetônica.

[REGRA DA TRANSFORMAÇÃO]

[REGRA DO ESTILO]

Não inclua pessoas, textos, logotipos, marcas-d’água ou elementos publicitários.

O resultado deve permanecer claramente reconhecível como a mesma fotografia e o mesmo imóvel, apenas mobiliado ou redecorado profissionalmente.`

export const VIRTUAL_STAGING_TRANSFORMATION_TYPES = [
  'empty_or_nearly_empty',
  'furnished',
  'mixed',
] as const

export const VIRTUAL_STAGING_DECORATION_STYLES = [
  'modern',
  'scandinavian',
  'sophisticated',
] as const

export type VirtualStagingTransformationType = typeof VIRTUAL_STAGING_TRANSFORMATION_TYPES[number]
export type VirtualStagingDecorationStyle = typeof VIRTUAL_STAGING_DECORATION_STYLES[number]

export const VIRTUAL_STAGING_TRANSFORMATION_RULES: Record<VirtualStagingTransformationType, string> = {
  empty_or_nearly_empty: `Se o ambiente estiver vazio ou quase vazio, complete o ambiente com mobiliário de forma funcional e realista, incluindo móveis, eletrodomésticos e eletrônicos adequados ao cômodo, quando houver espaço disponível.

Analise o tipo de ambiente e use somente elementos compatíveis e proporcionais.

Não limite a transformação a plantas, quadros ou pequenos objetos decorativos quando o ambiente ainda estiver funcionalmente incompleto.

Primeiro complete o ambiente com os móveis, eletrodomésticos e eletrônicos essenciais e proporcionais ao espaço.

Depois acrescente decoração leve e coerente.

Evite ambientes vazios demais, mas também não sobrecarregue a circulação.

Exemplos:

- sala: em salas de estar, complete o ambiente com sofá proporcional, poltrona quando houver espaço, mesa de centro ou apoio, tapete, televisão, rack ou painel leve e iluminação decorativa coerente. Quando o ambiente também comportar jantar, inclua mesa e cadeiras proporcionais sem bloquear circulação, portas, janelas ou acessos. Não deixe a sala apenas com sofá e plantas quando houver espaço funcional para uma composição mais completa;
- quarto: em quartos, complete o ambiente com cama proporcional, mesas laterais, iluminação de apoio, roupa de cama, tapete ou apoio decorativo e, quando houver espaço real, escrivaninha, cadeira, televisão ou móvel de apoio. Preserve armários planejados, portas, janelas e circulação. Não adicione móveis que bloqueiem acesso ao armário, janela ou passagem. Não deixe o quarto apenas com cama quando houver espaço funcional para uma composição mais completa;
- sala de jantar: mesa e cadeiras proporcionais;
- cozinha: Em cozinhas vazias, quase vazias ou parcialmente equipadas, priorize primeiro a funcionalidade do ambiente e somente depois acrescente decoração leve.

Analise cuidadosamente:

- vãos livres;
- nichos existentes;
- áreas sob bancadas;
- espaços altos compatíveis;
- pontos de instalação aparentes;
- tomadas;
- áreas de circulação;
- posição da pia;
- posição dos armários;
- dimensões aparentes disponíveis.

Quando existir espaço livre real e compatível com dimensões usuais, complete a cozinha com os eletrodomésticos essenciais adequados.

Considere, quando houver espaço funcional:

- geladeira em vão alto ou área lateral compatível;
- fogão ou cooktop em bancada ou área apropriada;
- forno em nicho existente ou espaço compatível;
- micro-ondas em nicho, prateleira ou bancada adequada;
- coifa somente quando houver posição compatível sobre fogão ou cooktop;
- pequenos eletrodomésticos em bancadas livres, sem sobrecarregar o ambiente.

Não deixe vãos funcionais evidentes vazios quando for possível preenchê-los com segurança e sem alterar a arquitetura.

Plantas, cestos, vasos, quadros e pequenos objetos decorativos não substituem os eletrodomésticos essenciais quando a cozinha ainda estiver funcionalmente incompleta.

Priorize, nesta ordem:

1. geladeira;
2. fogão ou cooktop;
3. forno;
4. micro-ondas;
5. coifa;
6. pequenos eletrodomésticos;
7. decoração leve.

Não adicione todos os itens obrigatoriamente quando não houver espaço.

Não invente nichos.

Não crie novas bancadas.

Não mova a pia.

Não altere armários planejados.

Não bloqueie portas, janelas, corredores ou circulação.

Não coloque eletrodomésticos em posições impossíveis ou incompatíveis com o espaço existente.

Se um equipamento não couber sem alterar a arquitetura, não o adicione.

O resultado deve parecer a mesma cozinha original, apenas funcionalmente completada com eletrodomésticos compatíveis com os espaços já existentes;
- banheiro: decoração leve;
- varanda: móveis externos e plantas;
- escritório: mesa, cadeira, monitor e elementos de organização.

Não force objetos quando não houver espaço real ou posição funcional adequada.`,
  furnished: `Se o ambiente já estiver mobiliado, remova visualmente toda a mobília solta e toda a decoração existentes e substitua tudo por uma composição completamente nova no estilo selecionado.

Substitua integralmente, quando presentes: sofás, poltronas, mesas, cadeiras, camas, criados-mudos, racks, estantes soltas, aparadores, tapetes, cortinas decorativas, luminárias não fixas, quadros, objetos decorativos, plantas, eletrônicos, almofadas, roupas de cama e quaisquer outros elementos móveis ou decorativos.

Não apenas reorganize, retoque, altere cores ou faça pequenas mudanças nos itens existentes. A transformação deve ser claramente visível e não pode resultar em uma imagem praticamente igual à original.

Crie uma decoração realmente nova, coerente, funcional, realista e compatível com o estilo escolhido.

Preserve integralmente e não remova nem substitua armários planejados ou embutidos, cozinha planejada, bancadas, painéis fixos, louças sanitárias, metais, eletrodomésticos embutidos, luminárias embutidas, marcenaria fixa, revestimentos, portas, janelas, paredes, pisos, tetos ou qualquer outro elemento arquitetônico ou fixo.`,
  mixed: `Analise a fotografia e determine se o ambiente está vazio, quase vazio ou já mobiliado.

Se estiver vazio ou quase vazio, complete o ambiente com mobiliário funcional e realista, incluindo móveis, eletrodomésticos e eletrônicos adequados quando houver espaço.

Se já estiver mobiliado, remova visualmente toda a mobília solta e toda a decoração existentes e substitua tudo por uma composição completamente nova no estilo selecionado. Substitua integralmente, quando presentes: sofás, poltronas, mesas, cadeiras, camas, criados-mudos, racks, estantes soltas, aparadores, tapetes, cortinas decorativas, luminárias não fixas, quadros, objetos decorativos, plantas, eletrônicos, almofadas, roupas de cama e quaisquer outros elementos móveis ou decorativos. Não apenas reorganize, retoque, altere cores ou faça pequenas mudanças nos itens existentes. A transformação deve ser claramente visível e não pode resultar em uma imagem praticamente igual à original. Crie uma decoração realmente nova, coerente, funcional, realista e compatível com o estilo escolhido. Preserve integralmente e não remova nem substitua armários planejados ou embutidos, cozinha planejada, bancadas, painéis fixos, louças sanitárias, metais, eletrodomésticos embutidos, luminárias embutidas, marcenaria fixa, revestimentos, portas, janelas, paredes, pisos, tetos ou qualquer outro elemento arquitetônico ou fixo.

Nunca altere elementos arquitetônicos ou fixos.`,
}

export const VIRTUAL_STAGING_STYLE_RULES: Record<VirtualStagingDecorationStyle, string> = {
  modern: 'Aplique estilo moderno, com linhas limpas, móveis atuais, cores neutras e sensação de amplitude.',
  scandinavian: 'Aplique estilo escandinavo, com madeira clara, tons suaves, iluminação natural e composição acolhedora.',
  sophisticated: 'Aplique estilo sofisticado, com mobiliário elegante, materiais refinados e composição premium, sem exageros.',
}

export function buildVirtualStagingPrompt(
  transformationType: VirtualStagingTransformationType,
  decorationStyle: VirtualStagingDecorationStyle,
) {
  return VIRTUAL_STAGING_PROMPT_BASE
    .replace('[REGRA DA TRANSFORMAÇÃO]', VIRTUAL_STAGING_TRANSFORMATION_RULES[transformationType])
    .replace('[REGRA DO ESTILO]', VIRTUAL_STAGING_STYLE_RULES[decorationStyle])
}

export const ALLOWED_INPUT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export type ImageDimensions = { width: number; height: number }
export type VirtualStagingOutputSize = '1024x1024' | '1536x1024' | '1024x1536'
export type VirtualStagingImageInput = {
  module: 'furnish-renovate'
  inputPath: string
  transformationType: VirtualStagingTransformationType
  decorationStyle: VirtualStagingDecorationStyle
}

export class VirtualStagingTestError extends Error {
  readonly code: string
  readonly status: number
  readonly publicMessage: string

  constructor(
    code: string,
    status: number,
    publicMessage: string,
  ) {
    super(code)
    this.name = 'VirtualStagingTestError'
    this.code = code
    this.status = status
    this.publicMessage = publicMessage
  }
}

function invalidInput(code: string, message: string) {
  return new VirtualStagingTestError(code, 400, message)
}

export function parseSingleImageInput(value: unknown): VirtualStagingImageInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidInput('invalid_body', 'Envie uma solicitação válida.')
  }

  const input = value as Record<string, unknown>
  if (
    input.input_paths !== undefined
    || input.image_paths !== undefined
    || input.images !== undefined
    || Array.isArray(input.input_path)
  ) {
    throw invalidInput('invalid_image_count', 'Envie exatamente uma imagem.')
  }

  const allowedFields = new Set(['module', 'input_path', 'transformation_type', 'decoration_style', 'expected_count'])
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw invalidInput('unexpected_field', 'A solicitação contém campos não permitidos.')
  }

  if (input.module !== 'furnish-renovate') {
    throw invalidInput('invalid_module', 'O módulo informado é inválido.')
  }

  if (typeof input.input_path !== 'string' || !input.input_path.trim()) {
    throw invalidInput('missing_input_path', 'Informe o caminho privado da imagem.')
  }

  if (!VIRTUAL_STAGING_TRANSFORMATION_TYPES.includes(input.transformation_type as VirtualStagingTransformationType)) {
    throw invalidInput('invalid_transformation_type', 'O tipo de transformação é inválido.')
  }

  if (!VIRTUAL_STAGING_DECORATION_STYLES.includes(input.decoration_style as VirtualStagingDecorationStyle)) {
    throw invalidInput('invalid_decoration_style', 'O estilo de decoração é inválido.')
  }

  return {
    module: 'furnish-renovate',
    inputPath: input.input_path.trim(),
    transformationType: input.transformation_type as VirtualStagingTransformationType,
    decorationStyle: input.decoration_style as VirtualStagingDecorationStyle,
  }
}

export function validateOwnedInputPath(inputPath: string, userId: string) {
  const segments = inputPath.split('/')
  const requestId = segments[3] || ''
  const filename = segments[4] || ''
  if (
    inputPath.includes('\\')
    || inputPath.includes('\0')
    || inputPath.startsWith('/')
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
    || segments.length !== 5
    || segments[0] !== userId
    || segments[1] !== 'virtual-staging-images'
    || segments[2] !== 'inputs'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    throw invalidInput('invalid_image_owner', 'A imagem informada não pertence à sua conta.')
  }

  if (!/^0[1-5]\.(?:jpg|png)$/i.test(filename)) {
    throw invalidInput('invalid_image_format', 'Use uma imagem JPG ou PNG válida.')
  }

  return {
    sessionId: requestId,
    position: Number.parseInt(filename.slice(0, 2), 10),
  }
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) >>> 0)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16)
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
  let offset = 2

  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue
    if (offset + 1 >= bytes.length) break
    const segmentLength = (bytes[offset] << 8) + bytes[offset + 1]
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break
    if (startOfFrame.has(marker) && segmentLength >= 7) {
      const height = (bytes[offset + 3] << 8) + bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) + bytes[offset + 6]
      return width > 0 && height > 0 ? { width, height } : null
    }
    offset += segmentLength
  }
  return null
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null
  const width = readUint32BigEndian(bytes, 16)
  const height = readUint32BigEndian(bytes, 20)
  return width > 0 && height > 0 ? { width, height } : null
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8X') {
    return {
      width: readUint24LittleEndian(bytes, 24) + 1,
      height: readUint24LittleEndian(bytes, 27) + 1,
    }
  }
  if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26] + (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] + (bytes[29] << 8)) & 0x3fff,
    }
  }
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    }
  }
  return null
}

export function inspectImage(bytes: Uint8Array, declaredMimeType: string) {
  if (!bytes.length || bytes.length > VIRTUAL_STAGING_INPUT_MAX_BYTES) {
    throw invalidInput('invalid_image_size', 'A imagem deve ter no máximo 20 MB.')
  }

  const dimensions = readPngDimensions(bytes) ?? readJpegDimensions(bytes) ?? readWebpDimensions(bytes)
  const detectedMimeType = readPngDimensions(bytes)
    ? 'image/png'
    : readJpegDimensions(bytes)
      ? 'image/jpeg'
      : readWebpDimensions(bytes)
        ? 'image/webp'
        : ''
  const normalizedDeclaredMime = declaredMimeType.toLowerCase().split(';')[0].trim()

  if (
    !dimensions
    || !ALLOWED_INPUT_MIME_TYPES.has(detectedMimeType)
    || (normalizedDeclaredMime && normalizedDeclaredMime !== detectedMimeType)
  ) {
    throw invalidInput('invalid_image_format', 'Use uma imagem JPEG, PNG ou WebP válida.')
  }

  return { dimensions, mimeType: detectedMimeType }
}

export function resolveOutputSize({ width, height }: ImageDimensions): VirtualStagingOutputSize {
  const ratio = width / height
  if (ratio >= VIRTUAL_STAGING_SQUARE_RATIO_MIN && ratio <= VIRTUAL_STAGING_SQUARE_RATIO_MAX) return '1024x1024'
  return ratio > VIRTUAL_STAGING_SQUARE_RATIO_MAX ? '1536x1024' : '1024x1536'
}

export function resolveOutputDimensions(size: VirtualStagingOutputSize): ImageDimensions {
  const [width, height] = size.split('x').map(Number)
  return { width, height }
}

export function validateGeneratedJpeg(bytes: Uint8Array, expected: ImageDimensions): ImageDimensions {
  const dimensions = readJpegDimensions(bytes)
  const hasValidEnvelope = bytes.length >= 4
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[bytes.length - 2] === 0xff
    && bytes[bytes.length - 1] === 0xd9
  if (
    !hasValidEnvelope
    || !dimensions
    || !Number.isSafeInteger(dimensions.width)
    || !Number.isSafeInteger(dimensions.height)
    || dimensions.width <= 0
    || dimensions.height <= 0
  ) {
    throw new VirtualStagingTestError('invalid_generated_jpeg', 502, 'A edição não retornou um JPEG válido.')
  }
  if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
    throw new VirtualStagingTestError('unexpected_output_dimensions', 502, 'A imagem editada retornou dimensões inesperadas.')
  }
  return dimensions
}
