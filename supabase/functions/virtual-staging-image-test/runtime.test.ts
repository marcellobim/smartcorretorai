import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildVirtualStagingPrompt,
  VIRTUAL_STAGING_BACKGROUND,
  VIRTUAL_STAGING_DECORATION_STYLES,
  VIRTUAL_STAGING_IMAGE_MODEL,
  VIRTUAL_STAGING_IMAGE_QUALITY,
  VIRTUAL_STAGING_OUTPUT_FORMAT,
  VIRTUAL_STAGING_TRANSFORMATION_TYPES,
} from './contract.ts'
import {
  estimateGptImage2CostUsdMicros,
  handleVirtualStagingImageTest,
  type ImageEditRequest,
  type RuntimeDependencies,
} from './runtime.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const requestId = '33333333-3333-4333-8333-333333333333'
const validPath = `${userId}/virtual-staging-images/inputs/${requestId}/01.png`
const validBody = {
  action: 'generate',
  client_request_id: requestId,
  item_index: 0,
  module: 'furnish-renovate',
  input_path: validPath,
  transformation_type: 'empty_or_nearly_empty',
  decoration_style: 'scandinavian',
  expected_count: 1,
}

function png(width = 1400, height = 900) {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function jpeg(width: number, height: number) {
  const quantizationTable = Array(64).fill(1)
  const blockCount = Math.ceil(width / 8) * Math.ceil(height / 8)
  const entropyBytes = Math.ceil((blockCount * 2) / 8)
  const entropy = Array(entropyBytes).fill(0)
  const remainingBits = (blockCount * 2) % 8
  if (remainingBits) entropy[entropy.length - 1] = (1 << (8 - remainingBits)) - 1

  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xdb, 0x00, 0x43, 0x00, ...quantizationTable,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xc4, 0x00, 0x26,
    0x00, 0x01, ...Array(15).fill(0), 0x00,
    0x10, 0x01, ...Array(15).fill(0), 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    ...entropy,
    0xff, 0xd9,
  ])
}

function jpegForSize(size: ImageEditRequest['size']) {
  const [width, height] = size.split('x').map(Number)
  return jpeg(width, height)
}

function request(body: unknown, authenticated = true) {
  return new Request('https://local.test/virtual-staging-image-test', {
    method: 'POST',
    headers: authenticated ? { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function dependencies(overrides: Partial<RuntimeDependencies> = {}) {
  let clock = 1000
  const deps: RuntimeDependencies = {
    authenticate: async (currentRequest) => currentRequest.headers.has('authorization') ? { id: userId } : null,
    download: async () => ({ bytes: png(), contentType: 'image/png' }),
    openAI: { editImage: async (input) => ({ bytes: jpegForSize(input.size), usage: { total_tokens: 321 } }) },
    upload: async () => undefined,
    now: () => { clock += 25; return clock },
    log: () => undefined,
    prepareEconomy: async ({ imageCount }) => ({ image_count: imageCount, smart_tokens_reserved: imageCount * 30 }),
    claimEconomy: async () => ({ item: { id: '22222222-2222-4222-8222-222222222222', status: 'processing' }, claimed: true }),
    finalizeEconomy: async () => undefined,
    ...overrides,
  }
  return deps
}

async function json(response: Response) {
  return await response.json() as Record<string, any>
}

test('rejeita usuário não autenticado sem baixar arquivo ou chamar OpenAI', async () => {
  let downloads = 0
  let edits = 0
  const deps = dependencies({
    download: async () => { downloads += 1; throw new Error('unexpected') },
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
  })
  const response = await handleVirtualStagingImageTest(request(validBody, false), deps)
  assert.equal(response.status, 401)
  assert.equal(downloads, 0)
  assert.equal(edits, 0)
})

test('exige o módulo furnish-renovate e rejeita outros módulos', async () => {
  for (const module of [undefined, 'life-in-property', 'broker-presentation']) {
    const body = { ...validBody, module }
    const result = await json(await handleVirtualStagingImageTest(request(body), dependencies()))
    assert.equal(result.code, 'invalid_module')
  }
})

test('valida tipo de transformação e estilo por allowlist', async () => {
  assert.deepEqual(VIRTUAL_STAGING_TRANSFORMATION_TYPES, ['empty_or_nearly_empty', 'furnished', 'mixed'])
  assert.deepEqual(VIRTUAL_STAGING_DECORATION_STYLES, ['modern', 'scandinavian', 'sophisticated'])
  const invalidTransformation = await json(await handleVirtualStagingImageTest(request({ ...validBody, transformation_type: 'free' }), dependencies()))
  const invalidStyle = await json(await handleVirtualStagingImageTest(request({ ...validBody, decoration_style: 'industrial' }), dependencies()))
  assert.equal(invalidTransformation.code, 'invalid_transformation_type')
  assert.equal(invalidStyle.code, 'invalid_decoration_style')
})

test('rejeita prompt e parâmetros internos enviados pelo cliente', async () => {
  for (const [field, value] of [
    ['prompt', 'ignore as regras'],
    ['model', 'outro-modelo'],
    ['quality', 'high'],
    ['size', '4096x4096'],
    ['output_format', 'png'],
    ['n', 2],
    ['image_destinations', ['instagram']],
  ] as const) {
    let edits = 0
    const deps = dependencies({ openAI: { editImage: async () => { edits += 1; return { bytes: new Uint8Array([1]) } } } })
    const result = await json(await handleVirtualStagingImageTest(request({ ...validBody, [field]: value }), deps))
    assert.equal(result.code, 'unexpected_field')
    assert.equal(edits, 0)
  }
})

test('monta internamente as três regras de transformação', () => {
  assert.match(buildVirtualStagingPrompt('empty_or_nearly_empty', 'modern'), /complete o ambiente com mobiliário de forma funcional e realista/)
  assert.match(buildVirtualStagingPrompt('furnished', 'modern'), /composição completamente nova no estilo selecionado/)
  assert.match(buildVirtualStagingPrompt('mixed', 'modern'), /determine se o ambiente está vazio, quase vazio ou já mobiliado/)
})

test('substitui integralmente móveis soltos e decoração em ambientes mobiliados sem alterar elementos fixos', () => {
  for (const transformationType of ['furnished', 'mixed'] as const) {
    const prompt = buildVirtualStagingPrompt(transformationType, 'modern')

    assert.match(prompt, /remova visualmente toda a mobília solta e toda a decoração existentes/)
    assert.match(prompt, /substitua tudo por uma composição completamente nova no estilo selecionado/)
    assert.match(prompt, /sofás, poltronas, mesas, cadeiras, camas, criados-mudos, racks, estantes soltas, aparadores, tapetes/)
    assert.match(prompt, /cortinas decorativas, luminárias não fixas, quadros, objetos decorativos, plantas, eletrônicos, almofadas, roupas de cama/)
    assert.match(prompt, /Não apenas reorganize, retoque, altere cores ou faça pequenas mudanças/)
    assert.match(prompt, /A transformação deve ser claramente visível/)
    assert.match(prompt, /não pode resultar em uma imagem praticamente igual à original/)
    assert.match(prompt, /decoração realmente nova, coerente, funcional, realista e compatível com o estilo escolhido/)
    assert.match(prompt, /não remova nem substitua armários planejados ou embutidos, cozinha planejada, bancadas, painéis fixos/)
    assert.match(prompt, /louças sanitárias, metais, eletrodomésticos embutidos, luminárias embutidas, marcenaria fixa/)
    assert.match(prompt, /qualquer outro elemento arquitetônico ou fixo/)
  }
})

test('preserva as regras aprovadas de salas e quartos antes de acrescentar decoração', () => {
  const prompt = buildVirtualStagingPrompt('empty_or_nearly_empty', 'scandinavian')

  assert.doesNotMatch(prompt, /remova visualmente toda a mobília solta e toda a decoração existentes/)
  assert.doesNotMatch(prompt, /Não apenas reorganize, retoque, altere cores ou faça pequenas mudanças/)
  assert.match(prompt, /Primeiro complete o ambiente com os móveis, eletrodomésticos e eletrônicos essenciais/)
  assert.match(prompt, /Depois acrescente decoração leve e coerente/)
  assert.match(prompt, /televisão, rack ou painel leve/)
  assert.match(prompt, /comportar jantar, inclua mesa e cadeiras proporcionais/)
  assert.match(prompt, /mesas laterais, iluminação de apoio/)
  assert.match(prompt, /quando houver espaço real, escrivaninha, cadeira, televisão ou móvel de apoio/)
  assert.match(prompt, /não sobrecarregue a circulação/)
  assert.match(prompt, /sem bloquear circulação, portas, janelas ou acessos/)
  assert.match(prompt, /Não adicione móveis que bloqueiem acesso ao armário, janela ou passagem/)
  assert.match(prompt, /- sala de jantar: mesa e cadeiras proporcionais/)
  assert.match(prompt, /- banheiro: decoração leve/)
  assert.match(prompt, /- varanda: móveis externos e plantas/)
  assert.match(prompt, /- escritório: mesa, cadeira, monitor e elementos de organização/)
})

test('prioriza a completude funcional da cozinha no prompt final sem alterar a arquitetura', () => {
  const prompt = buildVirtualStagingPrompt('empty_or_nearly_empty', 'scandinavian')
  const kitchenStart = prompt.indexOf('- cozinha:')
  const kitchenEnd = prompt.indexOf('- banheiro:', kitchenStart)
  assert.ok(kitchenStart >= 0)
  assert.ok(kitchenEnd > kitchenStart)
  const kitchenRule = prompt.slice(kitchenStart, kitchenEnd)

  assert.match(kitchenRule, /priorize primeiro a funcionalidade do ambiente e somente depois acrescente decoração leve/)
  assert.match(kitchenRule, /vãos livres/)
  assert.match(kitchenRule, /nichos existentes/)
  assert.match(kitchenRule, /pontos de instalação aparentes/)
  assert.match(kitchenRule, /Quando existir espaço livre real e compatível com dimensões usuais/)
  assert.match(kitchenRule, /Não deixe vãos funcionais evidentes vazios quando for possível preenchê-los com segurança e sem alterar a arquitetura/)
  assert.match(kitchenRule, /Plantas, cestos, vasos, quadros e pequenos objetos decorativos não substituem os eletrodomésticos essenciais/)

  const priorityStart = kitchenRule.indexOf('Priorize, nesta ordem:')
  const priorityEnd = kitchenRule.indexOf('Não adicione todos os itens obrigatoriamente', priorityStart)
  assert.ok(priorityStart >= 0)
  assert.ok(priorityEnd > priorityStart)
  const priorityRule = kitchenRule.slice(priorityStart, priorityEnd)
  const expectedPriority = [
    '1. geladeira;',
    '2. fogão ou cooktop;',
    '3. forno;',
    '4. micro-ondas;',
    '5. coifa;',
    '6. pequenos eletrodomésticos;',
    '7. decoração leve.',
  ]
  let previousPosition = -1
  for (const item of expectedPriority) {
    const position = priorityRule.indexOf(item)
    assert.ok(position > previousPosition, `prioridade ausente ou fora de ordem: ${item}`)
    previousPosition = position
  }

  assert.match(kitchenRule, /Não invente nichos/)
  assert.match(kitchenRule, /Não crie novas bancadas/)
  assert.match(kitchenRule, /Não mova a pia/)
  assert.match(kitchenRule, /Não altere armários planejados/)
  assert.match(kitchenRule, /Não bloqueie portas, janelas, corredores ou circulação/)
  assert.match(kitchenRule, /Não coloque eletrodomésticos em posições impossíveis ou incompatíveis com o espaço existente/)
  assert.match(kitchenRule, /Se um equipamento não couber sem alterar a arquitetura, não o adicione/)
  assert.match(kitchenRule, /mesma cozinha original, apenas funcionalmente completada/)
  assert.match(prompt, /mesma orientação, composição, proporção visual, perspectiva/)
  assert.match(prompt, /Não mova, remova, amplie, reduza ou reconstrua paredes[\s\S]*bancada, pia/)
})

test('monta internamente as três regras de estilo sem placeholders', () => {
  const prompts = [
    buildVirtualStagingPrompt('mixed', 'modern'),
    buildVirtualStagingPrompt('mixed', 'scandinavian'),
    buildVirtualStagingPrompt('mixed', 'sophisticated'),
  ]
  assert.match(prompts[0], /estilo moderno, com linhas limpas/)
  assert.match(prompts[1], /estilo escandinavo, com madeira clara/)
  assert.match(prompts[2], /estilo sofisticado, com mobiliário elegante/)
  for (const prompt of prompts) assert.doesNotMatch(prompt, /\[REGRA (?:DA TRANSFORMAÇÃO|DO ESTILO)\]/)
})

test('reforça a preservação da composição e dos elementos fixos', () => {
  const prompt = buildVirtualStagingPrompt('empty_or_nearly_empty', 'scandinavian')
  assert.match(prompt, /mesma orientação, composição, proporção visual, perspectiva/)
  assert.match(prompt, /Não mova a câmera e não expanda a cena/)
  assert.match(prompt, /Não mova, remova, amplie, reduza ou reconstrua paredes[\s\S]*bancada, pia/)
  assert.match(prompt, /Se um objeto não couber de forma realista sem alterar a arquitetura, não o adicione/)
})

test('rejeita caminho ausente, caminho de outro usuário e formato inválido', async () => {
  for (const [body, expectedCode] of [
    [{ ...validBody, input_path: undefined }, 'missing_input_path'],
    [{ ...validBody, input_path: `${userId}/virtual-staging/${requestId}/01.png` }, 'invalid_image_owner'],
    [{ ...validBody, input_path: `99999999-9999-4999-8999-999999999999/virtual-staging-images/inputs/${requestId}/01.png` }, 'invalid_image_owner'],
    [{ ...validBody, input_path: `${userId}/virtual-staging-images/${requestId}/01.png` }, 'invalid_image_owner'],
    [{ ...validBody, input_path: `${userId}/virtual-staging-images/inputs/not-a-uuid/01.png` }, 'invalid_image_owner'],
    [{ ...validBody, input_path: `${userId}/virtual-staging-images/inputs/${requestId}/01.gif` }, 'invalid_image_format'],
    [{ ...validBody, input_path: `${userId}/virtual-staging-images/inputs/${requestId}/input.png` }, 'invalid_image_format'],
    [{ ...validBody, input_path: `${userId}/virtual-staging-images/inputs/${requestId}/06.png` }, 'invalid_image_format'],
  ] as const) {
    const result = await json(await handleVirtualStagingImageTest(request(body), dependencies()))
    assert.equal(result.code, expectedCode)
  }
})

test('aceita somente uma imagem e rejeita contratos de lote mesmo com um item', async () => {
  for (const body of [
    { ...validBody, input_path: [validPath] },
    { ...validBody, input_path: undefined, input_paths: [validPath] },
    { ...validBody, input_path: undefined, image_paths: [validPath] },
    { ...validBody, input_path: undefined, images: [validPath] },
  ]) {
    const result = await json(await handleVirtualStagingImageTest(request(body), dependencies()))
    assert.equal(result.code, 'invalid_image_count')
  }
})

test('valida o conteúdo real e rejeita MIME ou bytes inválidos', async () => {
  const wrongMime = dependencies({ download: async () => ({ bytes: png(), contentType: 'image/jpeg' }) })
  const invalidBytes = dependencies({ download: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' }) })
  assert.equal((await json(await handleVirtualStagingImageTest(request(validBody), wrongMime))).code, 'invalid_image_format')
  assert.equal((await json(await handleVirtualStagingImageTest(request(validBody), invalidBytes))).code, 'invalid_image_format')
})

test('envia ao cliente OpenAI mockado o contrato oficial fixo sem 4K ou máscara', async () => {
  let captured: ImageEditRequest | undefined
  const deps = dependencies({
    openAI: { editImage: async (input) => {
      captured = input
      return { bytes: jpegForSize(input.size) }
    } },
  })
  const response = await handleVirtualStagingImageTest(request(validBody), deps)
  assert.equal(response.status, 200)
  assert.equal(captured?.model, VIRTUAL_STAGING_IMAGE_MODEL)
  assert.equal(captured?.model, 'gpt-image-2')
  assert.equal(captured?.quality, VIRTUAL_STAGING_IMAGE_QUALITY)
  assert.equal(captured?.quality, 'medium')
  assert.equal(captured?.outputFormat, VIRTUAL_STAGING_OUTPUT_FORMAT)
  assert.equal(captured?.outputFormat, 'jpeg')
  assert.equal(captured?.background, VIRTUAL_STAGING_BACKGROUND)
  assert.equal(captured?.count, 1)
  assert.equal(captured?.size, '1536x1024')
  assert.doesNotMatch(captured?.size || '', /3840|2160|4k/i)
  assert.equal(captured?.prompt, buildVirtualStagingPrompt('empty_or_nearly_empty', 'scandinavian'))
  assert.match(captured?.prompt || '', /mesma fotografia e o mesmo imóvel/)
  assert.equal('mask' in (captured || {}), false)
  assert.equal('inputFidelity' in (captured || {}), false)
})

test('classifica imagens quase quadradas entre 0.90 e 1.10 como quadradas', async () => {
  for (const [width, height, expected] of [
    [1000, 1000, '1024x1024'],
    [781, 775, '1024x1024'],
    [900, 1000, '1024x1024'],
    [1100, 1000, '1024x1024'],
    [899, 1000, '1024x1536'],
    [1101, 1000, '1536x1024'],
    [1600, 900, '1536x1024'],
    [900, 1600, '1024x1536'],
  ] as const) {
    let size = ''
    const deps = dependencies({
      download: async () => ({ bytes: png(width, height), contentType: 'image/png' }),
      openAI: { editImage: async (input) => { size = input.size; return { bytes: jpegForSize(input.size) } } },
    })
    assert.equal((await handleVirtualStagingImageTest(request(validBody), deps)).status, 200)
    assert.equal(size, expected)
  }
})

test('salva uma saída JPEG privada e devolve somente metadados, caminho e uso numérico', async () => {
  let uploadedPath = ''
  let uploads = 0
  const deps = dependencies({ upload: async (path) => { uploads += 1; uploadedPath = path } })
  const result = await json(await handleVirtualStagingImageTest(request(validBody), deps))
  assert.equal(uploadedPath, `${userId}/virtual-staging-images/results/22222222-2222-4222-8222-222222222222/generated-01.jpg`)
  assert.equal(result.result.output_path, uploadedPath)
  assert.equal(result.result.width, 1536)
  assert.equal(result.result.height, 1024)
  assert.equal(result.result.mime_type, 'image/jpeg')
  assert.equal(result.result.model, 'gpt-image-2')
  assert.equal(result.result.quality, 'medium')
  assert.equal(result.result.size_bytes, jpeg(1536, 1024).length)
  assert.equal('creation_id' in result.result, false)
  assert.equal(uploads, 1)
  assert.equal(result.usage.total_tokens, 321)
  assert.equal('url' in result.result, false)
  assert.equal('base64' in result, false)
})

test('conclui diretamente depois do upload final sem session output store', async () => {
  const events: string[] = []
  const successful = dependencies({
    upload: async () => { events.push('upload') },
  })
  const success = await json(await handleVirtualStagingImageTest(request(validBody), successful))
  assert.deepEqual(events, ['upload'])
  assert.equal(success.ok, true)
  assert.equal('creation_id' in success.result, false)
})

test('remove finalize_session e aceita expected_count somente como campo legado ignorado', async () => {
  const finalized = await handleVirtualStagingImageTest(request({
    action: 'finalize_session', session_id: requestId, expected_count: 2,
  }), dependencies())
  assert.equal(finalized.status, 400)
  assert.notEqual((await json(finalized)).code, 'session_incomplete')

  const withoutExpectedCount = { ...validBody }
  delete (withoutExpectedCount as Partial<typeof validBody>).expected_count
  assert.equal((await handleVirtualStagingImageTest(request(withoutExpectedCount), dependencies())).status, 200)
  assert.equal((await handleVirtualStagingImageTest(request({ ...validBody, expected_count: 'legacy' }), dependencies())).status, 200)
})

test('mantém o fluxo individual para posições de 1 a 5', async () => {
  for (let position = 1; position <= 5; position += 1) {
    const inputPath = `${userId}/virtual-staging-images/inputs/${requestId}/${String(position).padStart(2, '0')}.png`
    const response = await handleVirtualStagingImageTest(request({ ...validBody, input_path: inputPath }), dependencies())
    assert.equal(response.status, 200, String(position))
  }
})

test('devolve usage nulo quando a OpenAI não fornece métricas', async () => {
  const deps = dependencies({ openAI: { editImage: async (input) => ({ bytes: jpegForSize(input.size) }) } })
  const result = await json(await handleVirtualStagingImageTest(request(validBody), deps))
  assert.equal(result.usage, null)
})

test('rejeita saída que não seja JPEG válido antes do upload', async () => {
  let uploads = 0
  for (const invalidBytes of [new Uint8Array([1, 2, 3]), jpeg(1536, 1024).slice(0, -2)]) {
    const deps = dependencies({
      openAI: { editImage: async () => ({ bytes: invalidBytes }) },
      upload: async () => { uploads += 1 },
    })
    const response = await handleVirtualStagingImageTest(request(validBody), deps)
    const result = await json(response)
    assert.equal(response.status, 502)
    assert.equal(result.code, 'invalid_generated_jpeg')
  }
  assert.equal(uploads, 0)
})

test('rejeita JPEG com dimensões diferentes das solicitadas antes do upload', async () => {
  let uploads = 0
  let edits = 0
  const deps = dependencies({
    openAI: { editImage: async () => { edits += 1; return { bytes: jpeg(1024, 1536) } } },
    upload: async () => { uploads += 1 },
  })
  const response = await handleVirtualStagingImageTest(request(validBody), deps)
  const result = await json(response)
  assert.equal(response.status, 502)
  assert.equal(result.code, 'unexpected_output_dimensions')
  assert.equal(uploads, 0)
  assert.equal(edits, 1)
})

test('reserva e liquida Smart Tokens sem expor provider ao runtime', () => {
  const runtimeSource = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8')
  const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  const combined = `${runtimeSource}\n${indexSource}`
  assert.match(combined, /prepare_virtual_staging_image_request/)
  assert.match(combined, /finalize_virtual_staging_image_item/)
  assert.doesNotMatch(combined, /virtual-staging-(?:generate|status)|smart-tour|vida.no.im.vel|apresenta..o.pelo.corretor/i)
  assert.doesNotMatch(combined, /_shared\/creations|creation-runtime|recordSessionOutput|finalizeSession|finalize_session|virtual_staging_session_outputs|creation_id/)
  assert.doesNotMatch(runtimeSource, /\bfetch\s*\(/)
  assert.doesNotMatch(runtimeSource, /api\.openai\.com/)
})

test('o adaptador isolado usa Image API multipart no backend, autenticação e Storage privado', () => {
  const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  assert.match(indexSource, /Deno\.env\.get\('OPENAI_API_KEY'\)/)
  assert.match(indexSource, /https:\/\/api\.openai\.com\/v1\/images\/edits/)
  assert.match(indexSource, /form\.append\('image\[\]'/)
  assert.match(indexSource, /form\.append\('n', String\(input\.count\)\)/)
  assert.match(indexSource, /form\.append\('quality', input\.quality\)/)
  assert.match(indexSource, /form\.append\('output_format', input\.outputFormat\)/)
  assert.match(indexSource, /form\.append\('background', input\.background\)/)
  assert.match(indexSource, /supabase\.auth\.getUser\(token\)/)
  assert.match(indexSource, /STORAGE_BUCKET = 'studio-videos'/)
  assert.doesNotMatch(indexSource, /createSignedUrl|getPublicUrl/)
})

test('terminaliza economicamente uma imagem entregue com uso real', async () => {
  const statuses: string[] = []
  const deps = dependencies({
    openAI: { editImage: async () => ({ bytes: jpeg(1536, 1024), usage: { input_tokens: 10, output_tokens: 12, total_tokens: 22, input_tokens_details: { image_tokens: 8, text_tokens: 2 } } }) },
    finalizeEconomy: async input => { statuses.push(input.status) },
  })
  const response = await handleVirtualStagingImageTest(request(validBody), deps)
  assert.equal(response.status, 200)
  assert.deepEqual(statuses, ['completed'])
  assert.equal(estimateGptImage2CostUsdMicros({ input_tokens_details: { image_tokens: 8, text_tokens: 2 }, output_tokens: 12 }), 434)
  assert.equal(estimateGptImage2CostUsdMicros({ total_tokens: 12 }), undefined)
})

test('terminaliza como failed toda falha posterior ao claim econômico', async () => {
  for (const bytes of [new Uint8Array(), new Uint8Array([1, 2, 3]), jpeg(1024, 1536)]) {
    const statuses: string[] = []
    const deps = dependencies({
      openAI: { editImage: async () => ({ bytes }) },
      finalizeEconomy: async input => { statuses.push(input.status) },
    })
    const response = await handleVirtualStagingImageTest(request(validBody), deps)
    assert.equal(response.status, 502)
    assert.ok(statuses.includes('failed'))
  }

  const uploadStatuses: string[] = []
  const uploadResponse = await handleVirtualStagingImageTest(request(validBody), dependencies({
    upload: async () => { throw new Error('upload_failed') },
    finalizeEconomy: async input => { uploadStatuses.push(input.status) },
  }))
  assert.equal(uploadResponse.status, 500)
  assert.ok(uploadStatuses.includes('failed'))
})

test('reserva 30 ST por imagem antes da primeira chamada paga e bloqueia saldo insuficiente', async () => {
  let edits = 0
  const prepared = await json(await handleVirtualStagingImageTest(request({ action: 'prepare', client_request_id: requestId, image_count: 5 }), dependencies({
    prepareEconomy: async ({ imageCount }) => ({ smart_tokens_reserved: imageCount * 30 }),
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
  })))
  assert.equal(prepared.quoted_tokens, 150)
  assert.equal(edits, 0)

  const insufficient = await handleVirtualStagingImageTest(request({ action: 'prepare', client_request_id: requestId, image_count: 1 }), dependencies({
    prepareEconomy: async () => { throw new Error('Creditos insuficientes para esta geracao.') },
  }))
  assert.equal(insufficient.status, 402)
  assert.equal(edits, 0)
})

test('replay de item terminal não chama OpenAI nem debita novamente', async () => {
  let edits = 0
  let finalizations = 0
  const result = { output_path: `${userId}/virtual-staging-images/results/item/generated-01.jpg` }
  const response = await handleVirtualStagingImageTest(request(validBody), dependencies({
    claimEconomy: async () => ({ item: { id: 'item', status: 'completed', result, provider_usage: {} }, claimed: false }),
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
    finalizeEconomy: async () => { finalizations += 1 },
  }))
  assert.equal(response.status, 200)
  assert.equal(edits, 0)
  assert.equal(finalizations, 0)
  assert.equal((await json(response)).replay, true)
})
