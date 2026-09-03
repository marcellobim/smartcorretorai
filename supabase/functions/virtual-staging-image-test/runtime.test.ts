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
  decoration_style: 'cozy',
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
    recoverEconomy: async () => ({ request: null, items: [] }),
    claimStage: async ({ stage }) => ({ item: { id: '22222222-2222-4222-8222-222222222222', status: 'processing', stage_state: stage === 'redecorate' ? 'redecorating' : 'removing' }, claimed: true, claimToken: crypto.randomUUID() }),
    checkpointEconomy: async () => undefined,
    checkpointFinalEconomy: async () => undefined,
    reconcileFinalEconomy: async () => ({}),
    finalizeEconomy: async () => undefined,
    failBeforeProvider: async () => undefined,
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
  assert.deepEqual(VIRTUAL_STAGING_TRANSFORMATION_TYPES, ['furnish', 'remove_furniture', 'remove_and_redecorate', 'clear_area'])
  assert.deepEqual(VIRTUAL_STAGING_DECORATION_STYLES, ['cozy', 'contemporary'])
  const invalidTransformation = await json(await handleVirtualStagingImageTest(request({ ...validBody, transformation_type: 'free' }), dependencies()))
  const invalidStyle = await json(await handleVirtualStagingImageTest(request({ ...validBody, decoration_style: 'industrial' }), dependencies()))
  assert.equal(invalidTransformation.code, 'invalid_transformation_type')
  assert.equal(invalidStyle.code, 'invalid_decoration_style')
})

test('não exige nem aceita estilo nas ações de remoção e limpeza', async () => {
  for (const transformation_type of ['remove_furniture', 'clear_area']) {
    const withoutStyle = { ...validBody, transformation_type }
    delete (withoutStyle as Partial<typeof validBody>).decoration_style
    assert.equal((await handleVirtualStagingImageTest(request(withoutStyle), dependencies())).status, 200)
    const withStyle = await json(await handleVirtualStagingImageTest(request({ ...withoutStyle, decoration_style: 'cozy' }), dependencies()))
    assert.equal(withStyle.code, 'unexpected_decoration_style')
  }
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

test('monta internamente as duas regras de transformação da criação nova', () => {
  assert.match(buildVirtualStagingPrompt('empty_or_nearly_empty', 'cozy'), /composição completa, funcional, realista e pronta para morar/)
  assert.match(buildVirtualStagingPrompt('mixed', 'contemporary'), /determine se o ambiente está vazio, quase vazio ou já mobiliado/)
})

test('trata ambientes mobiliados de modo conservador no modo misto', () => {
  const prompt = buildVirtualStagingPrompt('mixed', 'contemporary')
  assert.match(prompt, /Se já estiver mobiliado, seja conservador/)
  assert.match(prompt, /Faça somente adições, substituições ou refinamentos pontuais de elementos soltos quando houver ganho visual claro/)
  assert.match(prompt, /não exige nem promete uma reformulação completa/)
  assert.match(prompt, /Não remova integralmente a mobília/)
  assert.doesNotMatch(prompt, /remova visualmente toda a mobília solta e toda a decoração existentes/)
})

test('preserva as regras aprovadas de salas e quartos antes de acrescentar decoração', () => {
  const prompt = buildVirtualStagingPrompt('empty_or_nearly_empty', 'cozy')

  assert.doesNotMatch(prompt, /remova visualmente toda a mobília solta e toda a decoração existentes/)
  assert.doesNotMatch(prompt, /Não apenas reorganize, retoque, altere cores ou faça pequenas mudanças/)
  assert.match(prompt, /Primeiro complete o ambiente com os móveis, eletrodomésticos e eletrônicos essenciais/)
  assert.match(prompt, /Depois acrescente decoração leve e coerente/)
  assert.match(prompt, /televisão, rack ou painel leve/)
  assert.match(prompt, /comportar jantar, inclua mesa e cadeiras proporcionais/)
  assert.match(prompt, /mesas laterais, iluminação de apoio/)
  assert.match(prompt, /quando houver espaço real, escrivaninha, cadeira, televisão, guarda-roupa ou móvel de apoio/)
  assert.match(prompt, /não sobrecarregue a circulação/)
  assert.match(prompt, /sem bloquear circulação, portas, janelas ou acessos/)
  assert.match(prompt, /Não adicione móveis que bloqueiem acesso ao armário, janela ou passagem/)
  assert.match(prompt, /- sala de jantar: mesa e cadeiras proporcionais/)
  assert.match(prompt, /- banheiro: decoração leve/)
  assert.match(prompt, /- varanda: móveis externos, iluminação de apoio e plantas/)
  assert.match(prompt, /- escritório: mesa, cadeira, monitor, iluminação de tarefa, armazenamento solto e elementos de organização/)
})

test('prioriza a completude funcional da cozinha no prompt final sem alterar a arquitetura', () => {
  const prompt = buildVirtualStagingPrompt('empty_or_nearly_empty', 'cozy')
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
  assert.match(kitchenRule, /armários, gabinetes, módulos de armazenamento/)
  assert.match(kitchenRule, /somente uma proposta visual gerada pela IA/)

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
  assert.match(kitchenRule, /Não crie nem altere bancadas fixas/)
  assert.match(kitchenRule, /ilha móvel ou bancada complementar visual/)
  assert.match(kitchenRule, /Não mova a pia/)
  assert.match(kitchenRule, /Não altere armários planejados/)
  assert.match(kitchenRule, /Não bloqueie portas, janelas, corredores ou circulação/)
  assert.match(kitchenRule, /Não coloque eletrodomésticos em posições impossíveis ou incompatíveis com o espaço existente/)
  assert.match(kitchenRule, /Se um equipamento não couber sem alterar a arquitetura, não o adicione/)
  assert.match(kitchenRule, /mesma cozinha original, apenas funcionalmente completada/)
  assert.match(prompt, /mesma orientação, composição, proporção visual, perspectiva/)
  assert.match(prompt, /Não mova, remova, amplie, reduza ou reconstrua paredes[\s\S]*bancada, pia/)
})

test('monta duas direções de estilo claramente distintas sem mudar a intensidade de mobiliário', () => {
  const prompts = [
    buildVirtualStagingPrompt('empty_or_nearly_empty', 'cozy'),
    buildVirtualStagingPrompt('empty_or_nearly_empty', 'contemporary'),
  ]
  assert.match(prompts[0], /direção ACONCHEGANTE/)
  assert.match(prompts[0], /neutros quentes, madeira clara ou média, tecidos e texturas táteis/)
  assert.match(prompts[1], /direção CONTEMPORÂNEA/)
  assert.match(prompts[1], /contraste mais marcante e coerente, acabamentos refinados/)
  for (const prompt of prompts) assert.match(prompt, /composição completa, funcional, realista e pronta para morar/)
  for (const prompt of prompts) assert.doesNotMatch(prompt, /\[REGRA (?:DA TRANSFORMAÇÃO|DO ESTILO)\]/)
})

test('inclui ambientação, armazenamento e equipamentos funcionais sem economizar nem exagerar', () => {
  const prompt = buildVirtualStagingPrompt('empty_or_nearly_empty', 'cozy')
  assert.match(prompt, /guarda-roupa ou móvel de apoio/)
  assert.match(prompt, /máquina de lavar, secadora quando houver espaço/)
  assert.match(prompt, /área gourmet: equipamentos/)
  assert.match(prompt, /Adicione cortinas somente quando forem visualmente apropriadas/)
  assert.match(prompt, /A composição deve ser COMPLETA, não EXAGERADA/)
  assert.match(prompt, /novas propostas visuais de armazenamento em áreas livres/)
  assert.match(prompt, /sem apagar, mover ou redesenhar qualquer elemento fixo real/)
})

test('aplica no vazio do modo misto a mesma regra completa do modo vazio', () => {
  const prompt = buildVirtualStagingPrompt('mixed', 'contemporary')
  assert.match(prompt, /siga integralmente esta mesma regra de completude/)
  assert.match(prompt, /composição completa, funcional, realista e pronta para morar/)
  assert.match(prompt, /armários, gabinetes, módulos de armazenamento/)
  assert.match(prompt, /A composição deve ser COMPLETA, não EXAGERADA/)
})

test('aceita valores legados para leitura e repetição segura sem expô-los na criação nova', () => {
  assert.match(buildVirtualStagingPrompt('furnished', 'scandinavian'), /Compatibilidade legada/)
  assert.match(buildVirtualStagingPrompt('mixed', 'modern'), /Compatibilidade legada/)
})

test('reforça a preservação da composição e dos elementos fixos', () => {
  const prompt = buildVirtualStagingPrompt('empty_or_nearly_empty', 'cozy')
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
  assert.equal(captured?.prompt, buildVirtualStagingPrompt('empty_or_nearly_empty', 'cozy'))
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
  assert.match(combined, /prepare_smart_space_request/)
  assert.match(combined, /claim_smart_space_stage/)
  assert.match(combined, /checkpoint_smart_space_free_space/)
  assert.match(combined, /finalize_smart_space_item/)
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
  assert.doesNotMatch(indexSource.slice(0, indexSource.indexOf('video: {')), /createSignedUrl|getPublicUrl/)
  assert.doesNotMatch(indexSource, /getPublicUrl/)
})

test('terminaliza economicamente uma imagem entregue com uso real', async () => {
  const statuses: string[] = []
  const deps = dependencies({
    openAI: { editImage: async () => ({ bytes: jpeg(1536, 1024), usage: { input_tokens: 10, output_tokens: 12, total_tokens: 22, input_tokens_details: { image_tokens: 8, text_tokens: 2 } } }) },
    finalizeEconomy: async input => { statuses.push(input.outcome) },
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
      finalizeEconomy: async input => { statuses.push(input.outcome) },
    })
    const response = await handleVirtualStagingImageTest(request(validBody), deps)
    assert.equal(response.status, 502)
    assert.ok(statuses.includes('failed'))
  }

  const uploadStatuses: string[] = []
  const uploadResponse = await handleVirtualStagingImageTest(request(validBody), dependencies({
    upload: async () => { throw new Error('upload_failed') },
    finalizeEconomy: async input => { uploadStatuses.push(input.outcome) },
  }))
  assert.equal(uploadResponse.status, 500)
  assert.ok(uploadStatuses.includes('failed'))
})

test('reserva 30 ST por imagem antes da primeira chamada paga e bloqueia saldo insuficiente', async () => {
  let edits = 0
  const prepared = await json(await handleVirtualStagingImageTest(request({ action: 'prepare', client_request_id: requestId, image_count: 5, transformation_type: 'furnish', decoration_style: 'cozy' }), dependencies({
    prepareEconomy: async ({ imageCount }) => ({ smart_tokens_reserved: imageCount * 30 }),
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
  })))
  assert.equal(prepared.quoted_tokens, 150)
  assert.equal(edits, 0)

  const insufficient = await handleVirtualStagingImageTest(request({ action: 'prepare', client_request_id: requestId, image_count: 1, transformation_type: 'furnish', decoration_style: 'cozy' }), dependencies({
    prepareEconomy: async () => { throw new Error('Creditos insuficientes para esta geracao.') },
  }))
  assert.equal(insufficient.status, 402)
  assert.equal(edits, 0)
})

test('reserva 60 ST por imagem somente em remover e redecorar', async () => {
  let preparedInput: Record<string, unknown> | undefined
  const prepared = await json(await handleVirtualStagingImageTest(request({
    action: 'prepare', client_request_id: requestId, image_count: 3,
    transformation_type: 'remove_and_redecorate', decoration_style: 'contemporary',
  }), dependencies({
    prepareEconomy: async input => { preparedInput = input; return { status: 'processing' } },
  })))
  assert.equal(prepared.unit_cost, 60)
  assert.equal(prepared.quoted_tokens, 180)
  assert.equal(preparedInput?.transformationType, 'remove_and_redecorate')
})

test('replay de item terminal não chama OpenAI nem debita novamente', async () => {
  let edits = 0
  let finalizations = 0
  const result = { output_path: `${userId}/virtual-staging-images/results/item/generated-01.jpg` }
  const response = await handleVirtualStagingImageTest(request(validBody), dependencies({
    claimStage: async () => ({ item: { id: 'item', status: 'completed', stage_state: 'completed', result, provider_usage: {} }, claimed: false, claimToken: null }),
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
    finalizeEconomy: async () => { finalizations += 1 },
  }))
  assert.equal(response.status, 200)
  assert.equal(edits, 0)
  assert.equal(finalizations, 0)
  assert.equal((await json(response)).replay, true)
})

test('Remover e redecorar usa exatamente a saída da etapa 1 como entrada da etapa 2', async () => {
  const firstBytes = jpeg(1536, 1024)
  const secondBytes = jpeg(1536, 1024)
  const inputs: Uint8Array[] = []
  const prompts: string[] = []
  const uploads: string[] = []
  const events: string[] = []
  let call = 0
  const body = { ...validBody, transformation_type: 'remove_and_redecorate', decoration_style: 'contemporary' }
  const result = await json(await handleVirtualStagingImageTest(request(body), dependencies({
    openAI: { editImage: async input => {
      events.push(call === 0 ? 'edit_stage_1' : 'edit_stage_2')
      inputs.push(input.bytes)
      prompts.push(input.prompt)
      call += 1
      return { bytes: call === 1 ? firstBytes : secondBytes, usage: { total_tokens: call * 10 } }
    } },
    upload: async path => { uploads.push(path); events.push(path.endsWith('free-space.jpg') ? 'upload_stage_1' : 'upload_stage_2') },
    checkpointEconomy: async input => {
      assert.equal(input.result.delivery_status, 'stage_1_completed')
      assert.equal(input.result.output_path, `${userId}/virtual-staging-images/results/22222222-2222-4222-8222-222222222222/free-space.jpg`)
      assert.equal(input.result.free_space_path, input.result.output_path)
      events.push('checkpoint_stage_1')
    },
  })))
  assert.equal(result.ok, true)
  assert.equal(call, 2)
  assert.deepEqual(inputs[1], firstBytes)
  assert.match(prompts[0], /ESPAÇO LIVRE/)
  assert.match(prompts[1], /composição completa, funcional, realista e pronta para morar/)
  assert.deepEqual(uploads.map(path => path.split('/').at(-1)), ['free-space.jpg', 'new-decoration.jpg'])
  assert.deepEqual(events, ['edit_stage_1', 'upload_stage_1', 'checkpoint_stage_1', 'edit_stage_2', 'upload_stage_2'])
  assert.deepEqual(result.result.stages.map((stage: Record<string, unknown>) => stage.kind), ['free_space', 'new_decoration'])
})

test('checkpoint do espaço livre define output_path uma única vez e sem spread ambíguo', () => {
  const runtimeSource = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8')
  const checkpointStart = runtimeSource.indexOf('const checkpointResult = {')
  const checkpointEnd = runtimeSource.indexOf('const checkpointClaim =', checkpointStart)
  assert.ok(checkpointStart >= 0 && checkpointEnd > checkpointStart)
  const checkpointSource = runtimeSource.slice(checkpointStart, checkpointEnd)
  assert.equal(checkpointSource.match(/\boutput_path\s*:/g)?.length, 1)
  assert.doesNotMatch(checkpointSource, /\.\.\.freeSpace\.result/)
  assert.match(checkpointSource, /output_path: freeSpacePath/)
})

test('falha na etapa 2 preserva Espaço livre como entrega parcial e não liquida duas vezes', async () => {
  let edits = 0
  const finalizations: Array<Record<string, any>> = []
  const body = { ...validBody, transformation_type: 'remove_and_redecorate', decoration_style: 'cozy' }
  const response = await handleVirtualStagingImageTest(request(body), dependencies({
    openAI: { editImage: async input => {
      edits += 1
      if (edits === 2) throw new Error('stage_two_failed')
      return { bytes: jpegForSize(input.size), usage: { total_tokens: 11 } }
    } },
    finalizeEconomy: async input => { finalizations.push(input) },
  }))
  const result = await json(response)
  assert.equal(response.status, 200)
  assert.equal(result.partial, true)
  assert.equal(result.result.delivery_status, 'partial')
  assert.equal(result.result.stages.length, 1)
  assert.equal(result.result.stages[0].kind, 'free_space')
  assert.equal(finalizations.length, 1)
  assert.equal(finalizations[0].outcome, 'partial')
})

test('recovery read-only devolve estados e resultados sem claim, provider ou settlement', async () => {
  let claims = 0
  let edits = 0
  let finalizations = 0
  const response = await handleVirtualStagingImageTest(request({ action: 'recover', client_request_id: requestId }), dependencies({
    recoverEconomy: async () => ({
      request: { status: 'completed', image_count: 1, completed_count: 1, failed_count: 0 },
      items: [{ item_index: 0, status: 'completed', result: { output_path: 'private/result.jpg' } }],
    }),
    claimStage: async () => { claims += 1; throw new Error('unexpected') },
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
    finalizeEconomy: async () => { finalizations += 1 },
  }))
  const result = await json(response)
  assert.equal(response.status, 200)
  assert.equal(result.items[0].result.output_path, 'private/result.jpg')
  assert.deepEqual([claims, edits, finalizations], [0, 0, 0])
})

test('recovery após etapa 1 expõe o checkpoint sem repetir nenhuma geração', async () => {
  let edits = 0
  const response = await handleVirtualStagingImageTest(request({ action: 'recover', client_request_id: requestId }), dependencies({
    recoverEconomy: async () => ({
      request: { status: 'processing', image_count: 1, completed_count: 0, failed_count: 0 },
      items: [{ item_index: 0, status: 'processing', result: { delivery_status: 'stage_1_completed', stages: [{ kind: 'free_space', output_path: 'private/free-space.jpg' }] } }],
    }),
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
  }))
  const result = await json(response)
  assert.equal(result.request.status, 'processing')
  assert.equal(result.items[0].result.delivery_status, 'stage_1_completed')
  assert.equal(edits, 0)
})

test('retomada reconcilia output final persistido sem nova chamada ao provider', async () => {
  let claims = 0
  let edits = 0
  let reconciliations = 0
  const finalResult = { delivery_status: 'completed', final_output_path: 'private/new-decoration.jpg', output_path: 'private/new-decoration.jpg' }
  const response = await handleVirtualStagingImageTest(request({ action: 'resume', client_request_id: requestId, item_index: 0 }), dependencies({
    recoverEconomy: async () => ({
      request: { transformation_type: 'remove_and_redecorate', decoration_style: 'cozy' },
      items: [{ item_index: 0, stage_state: 'redecorating', result: finalResult }],
    }),
    claimStage: async () => { claims += 1; throw new Error('unexpected') },
    openAI: { editImage: async () => { edits += 1; throw new Error('unexpected') } },
    reconcileFinalEconomy: async () => { reconciliations += 1; return { result: finalResult, provider_usage: { total_tokens: 22 } } },
  }))
  const result = await json(response)
  assert.equal(response.status, 200)
  assert.equal(result.replay, true)
  assert.equal(result.result.output_path, finalResult.output_path)
  assert.deepEqual([claims, edits, reconciliations], [0, 0, 1])
})

test('duas retomadas concorrentes da etapa 2 permitem somente uma chamada ao provider', async () => {
  let claimed = false
  let edits = 0
  const checkpoint = {
    action: 'remove_and_redecorate', delivery_status: 'stage_1_completed', free_space_path: 'private/free-space.jpg',
    stages: [{ kind: 'free_space', label: 'Espaço livre', output_path: 'private/free-space.jpg', width: 1536, height: 1024, mime_type: 'image/jpeg', size_bytes: 100 }],
  }
  const shared = dependencies({
    recoverEconomy: async () => ({
      request: { transformation_type: 'remove_and_redecorate', decoration_style: 'cozy' },
      items: [{ item_index: 0, stage_state: 'free_space_completed', result: checkpoint }],
    }),
    claimStage: async ({ stage }) => {
      assert.equal(stage, 'redecorate')
      if (claimed) return { item: { id: 'item', status: 'processing', stage_state: 'redecorating', result: checkpoint }, claimed: false, claimToken: null }
      claimed = true
      return { item: { id: 'item', status: 'processing', stage_state: 'redecorating', result: checkpoint, transformation_type: 'remove_and_redecorate', decoration_style: 'cozy', stage1_usage: { total_tokens: 10 } }, claimed: true, claimToken: '44444444-4444-4444-8444-444444444444' }
    },
    download: async () => ({ bytes: png(), contentType: 'image/png' }),
    openAI: { editImage: async input => { edits += 1; return { bytes: jpegForSize(input.size), usage: { total_tokens: 12 } } } },
  })
  const resumeBody = { action: 'resume', client_request_id: requestId, item_index: 0 }
  const [first, second] = await Promise.all([
    handleVirtualStagingImageTest(request(resumeBody), shared),
    handleVirtualStagingImageTest(request(resumeBody), shared),
  ])
  assert.equal(edits, 1)
  assert.deepEqual([first.status, second.status].sort(), [200, 202])
})

test('refresh antes da etapa 1 retoma usando o input persistido sem duplicar claim', async () => {
  let claimed = false
  let edits = 0
  const deps = dependencies({
    recoverEconomy: async () => ({
      request: { transformation_type: 'furnish', decoration_style: 'cozy' },
      items: [{ item_index: 0, stage_state: 'awaiting_processing', result: {} }],
    }),
    claimStage: async ({ stage }) => {
      assert.equal(stage, 'single')
      if (claimed) return { item: { id: 'item', status: 'processing', stage_state: 'removing', result: {} }, claimed: false, claimToken: null }
      claimed = true
      return { item: { id: 'item', status: 'processing', stage_state: 'removing', transformation_type: 'furnish', decoration_style: 'cozy', result: {} }, claimed: true, claimToken: '55555555-5555-4555-8555-555555555555' }
    },
    openAI: { editImage: async input => { edits += 1; return { bytes: jpegForSize(input.size) } } },
  })
  const body = { action: 'resume', client_request_id: requestId, item_index: 0, input_path: validPath }
  const [first, second] = await Promise.all([
    handleVirtualStagingImageTest(request(body), deps),
    handleVirtualStagingImageTest(request(body), deps),
  ])
  assert.equal(edits, 1)
  assert.deepEqual([first.status, second.status].sort(), [200, 202])
})
