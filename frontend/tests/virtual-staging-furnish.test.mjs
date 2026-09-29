import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingNextQuestion, getVirtualStagingReviewEditNext } from '../src/config/virtualStagingConversation.js'
import {
  buildFurnishRenovateReviewItems,
  canAddFurnishRenovateImages,
  FURNISH_RENOVATE_AI_NOTICE,
  FURNISH_RENOVATE_COPY,
  FURNISH_RENOVATE_JOURNEY_ID,
  FURNISH_RENOVATE_MAX_IMAGES,
  FURNISH_RENOVATE_QUESTIONS,
  FURNISH_RENOVATE_STYLE_OPTIONS,
  FURNISH_RENOVATE_TRANSFORMATION_OPTIONS,
  furnishRenovateRequiresStyle,
  getFurnishRenovateTransformationLabel,
  getSmartSpaceQuote,
  getSmartSpaceUnitCost,
  isAvailableFurnishRenovateTransformation,
  VIRTUAL_STAGING_CHAT_INTRO,
} from '../src/config/virtualStagingFurnish.js'
import { getVirtualStagingJourney } from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const page = read('frontend/src/pages/VirtualStaging.jsx')

test('uses Smart Space as the public name while preserving the internal id', () => {
  assert.equal(FURNISH_RENOVATE_JOURNEY_ID, 'furnish-renovate')
  assert.equal(getVirtualStagingJourney(FURNISH_RENOVATE_JOURNEY_ID)?.title, 'Smart Space')
  assert.deepEqual(VIRTUAL_STAGING_CHAT_INTRO, {
    title: 'Smart Space',
    description: 'Transforme ambientes e mostre novas possibilidades para cada espaço.',
    action: 'Começar',
  })
  assert.match(page, /<Header title=\{VIRTUAL_STAGING_PRODUCT_NAME\}/)
  assert.doesNotMatch(read('frontend/src/config/virtualStagingJourneys.js'), /Reimagine AI/)
})

test('defines only the approved local Virtual Staging conversation sequence', () => {
  const expected = ['transformation_type', 'decoration_style', 'images', 'review']
  assert.deepEqual(FURNISH_RENOVATE_QUESTIONS.map(([id]) => id), expected)
  const sequence = ['transformation_type']
  while (sequence.at(-1) !== 'review') sequence.push(getVirtualStagingNextQuestion({ questionId: sequence.at(-1), answerId: sequence.at(-1) === 'transformation_type' ? 'furnish' : '', journeyId: FURNISH_RENOVATE_JOURNEY_ID }))
  assert.deepEqual(sequence, expected)
  for (const removed of ['purpose', 'type', 'bedrooms', 'suites', 'parkingSpaces', 'area', 'location', 'highlights', 'narration', 'captions', 'cta', 'phone', 'campaign', 'hashtags']) {
    assert.equal(expected.includes(removed), false)
  }
  assert.match(page, /initialQuestionId: isBrokerPresentation \? 'presenter_reference' : isFurnishRenovate \? 'transformation_type' : 'images'/)
  assert.match(page, /const furnishProject = useMemo\(\(\) => \(\{[\s\S]*transformation_type: transformationType,[\s\S]*decoration_style: decorationStyle,[\s\S]*property_images: images/)
  assert.doesNotMatch(page, /Onde você pretende usar estas imagens\?|imageDestinations|setImageDestinations/)
  assert.match(page, /journeyQuestions\.filter\(\(\[questionId\]\) => questionId !== 'decoration_style'\)/)
})

test('offers only the three official Smart Space actions and clear_area cannot return to the UI', () => {
  assert.deepEqual(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS, [
    { id: 'furnish', label: 'Mobiliar um ambiente vazio', description: 'Para espaços sem móveis ou quase vazios.' },
    { id: 'remove_and_redecorate', label: 'Criar uma decoração completamente nova', description: 'Remove os móveis atuais e cria uma nova decoração.' },
    { id: 'remove_furniture', label: 'Remover os móveis', description: 'Deixa o ambiente livre para visualizar melhor o espaço.' },
  ])
  assert.equal(furnishRenovateRequiresStyle('furnish'), true)
  assert.equal(furnishRenovateRequiresStyle('remove_and_redecorate'), true)
  assert.equal(furnishRenovateRequiresStyle('remove_furniture'), false)
  assert.equal(furnishRenovateRequiresStyle('clear_area'), false)
  assert.equal(isAvailableFurnishRenovateTransformation('furnish'), true)
  assert.equal(isAvailableFurnishRenovateTransformation('remove_and_redecorate'), true)
  assert.equal(isAvailableFurnishRenovateTransformation('remove_furniture'), true)
  assert.equal(isAvailableFurnishRenovateTransformation('clear_area'), false)
  assert.equal(getFurnishRenovateTransformationLabel('clear_area'), 'Limpar um terreno ou uma área para visualizar melhor o espaço')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'transformation_type', answerId: 'remove_furniture', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'images')
  assert.match(page, /\.\.\.\(furnishHasStyleStep \? \[\{ title: 'Estilo', subtitle: 'Decoração' \}\] : \[\]\)/)
  assert.match(page, /furnishHasStyleStep[\s\S]*images: 2, review: 3/)
  assert.match(page, /if \(id === 'transformation_type' && isFurnishRenovate\) return choices/)
  assert.doesNotMatch(JSON.stringify(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS), /Deixar a IA decidir/)
})

test('offers only Aconchegante and Contemporâneo as explained single-choice styles', () => {
  assert.deepEqual(FURNISH_RENOVATE_STYLE_OPTIONS, [
    { id: 'cozy', label: 'Aconchegante', description: 'Ambientes acolhedores, claros e convidativos.' },
    { id: 'contemporary', label: 'Contemporâneo', description: 'Visual atual, elegante e com presença mais marcante.' },
  ])
  assert.match(page, /if \(id === 'decoration_style' && isFurnishRenovate\) return choices/)
  assert.doesNotMatch(page, /style_gallery|Selecionar estilo/)
})

test('accepts one to five ordered images and prevents advancing without one', () => {
  assert.equal(FURNISH_RENOVATE_MAX_IMAGES, 5)
  assert.equal(canAddFurnishRenovateImages(0, 0), true)
  assert.equal(canAddFurnishRenovateImages(0, 1), true)
  assert.equal(canAddFurnishRenovateImages(4, 1), true)
  assert.equal(canAddFurnishRenovateImages(5, 1), false)
  assert.equal(canAddFurnishRenovateImages(0, 6), false)
  assert.equal(FURNISH_RENOVATE_COPY.uploadQuestion, 'Envie as fotos do imóvel')
  assert.equal(FURNISH_RENOVATE_COPY.uploadDescription, 'Adicione de 1 a 5 fotos. Cada imagem será analisada e transformada individualmente.')
  assert.match(page, /accept="image\/jpeg,image\/png"/)
  assert.match(page, /!\['image\/jpeg', 'image\/png'\]\.includes\(file\.type\)/)
  assert.match(page, /file\.size > 15 \* 1024 \* 1024/)
  assert.match(page, /\{images\.length\} de \{imageLimit\} imagens adicionadas/)
  assert.match(page, /\{images\.length > 0 && cont/)
  assert.match(page, /images\.length >= 1/)
  assert.match(page, /images\.length <= FURNISH_RENOVATE_MAX_IMAGES/)
  assert.match(page, /move\(position, offset\)/)
  assert.match(page, /remove\(position\)/)
})

test('removes generation destinations while preserving publication actions in results', () => {
  assert.doesNotMatch(FURNISH_RENOVATE_QUESTIONS.join(' '), /image_destinations|Onde você pretende usar estas imagens/)
  assert.doesNotMatch(page, /DestinationBrandIcon|destinationsHint|Destino das imagens/)
  assert.match(page, /Publicar \{stage\.label\.toLocaleLowerCase/)
  assert.match(page, /Publicar vídeo da transformação/)
})

test('shows the approved AI notice in review without an extra conversational step', () => {
  assert.equal(FURNISH_RENOVATE_AI_NOTICE, 'Como o resultado é criado por inteligência artificial, alguns detalhes do ambiente podem ser alterados para melhorar a composição visual.')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'images', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.doesNotMatch(page, /id === 'ai_notice'/)
  assert.match(page, /FURNISH_RENOVATE_COPY\.reviewNotice/)
})

test('reviews transformation, style and ordered thumbnails without generation destinations', () => {
  const review = buildFurnishRenovateReviewItems({
    imagesCount: 3,
    transformationType: 'mixed',
    decorationStyle: 'cozy',
  })
  assert.deepEqual(review.map(item => item.id), ['transformation_type', 'decoration_style', 'images'])
  assert.equal(review[0].label, 'Tenho ambientes vazios e mobiliados')
  assert.equal(review[1].label, 'Aconchegante')
  assert.equal(review[2].label, '3 imagens')
  assert.match(page, /Revise seu projeto/)
  assert.match(page, /Imagem \$\{index \+ 1\} na ordem do projeto/)
  for (const id of ['transformation_type', 'decoration_style', 'images']) {
    assert.equal(getVirtualStagingReviewEditNext({ originQuestionId: id, questionId: id, journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  }
})

test('keeps legacy transformation and style labels readable without exposing them as new choices', () => {
  const review = buildFurnishRenovateReviewItems({
    imagesCount: 1,
    transformationType: 'furnished',
    decorationStyle: 'scandinavian',
  })
  assert.equal(review[0].label, 'Criar uma nova decoração em ambientes já mobiliados')
  assert.equal(review[1].label, 'Escandinavo')
  assert.equal(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS.some(option => option.id === 'furnished'), false)
  assert.equal(FURNISH_RENOVATE_STYLE_OPTIONS.some(option => ['modern', 'scandinavian', 'sophisticated'].includes(option.id)), false)
  assert.match(page, /activeQuestionId: restoredJourneyDraft\.conversation\.activeQuestionId === 'image_destinations' \? 'review'/)
  assert.match(page, /filter\(turn => turn\.questionId !== 'image_destinations'\)/)
})

test('habilita a geração integrada com uma a cinco imagens e estilo somente quando aplicável', () => {
  assert.match(page, /const canGenerateFurnish = isFurnishRenovate[\s\S]*images\.length >= 1[\s\S]*images\.length <= FURNISH_RENOVATE_MAX_IMAGES[\s\S]*isAvailableFurnishRenovateTransformation\(transformationType\)[\s\S]*furnishRenovateRequiresStyle\(transformationType\)[\s\S]*Boolean\(decorationStyle\)/)
  assert.match(page, /disabled=\{!canGenerateFurnish \|\| furnishGenerationBusy\}/)
  assert.doesNotMatch(page, /Esta primeira versão de validação processa uma imagem por vez\./)
  assert.match(page, /if \(!canGenerateFurnish\)/)
})

test('envia ao backend somente o contrato permitido do furnish-renovate', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.match(integration, /supabase\.auth\.getUser\(\)/)
  assert.match(integration, /`\$\{authenticatedUser\.id\}\/virtual-staging-images\/inputs\/\$\{sessionId\}\/\$\{String\(imageIndex \+ 1\)\.padStart\(2, '0'\)\}\.\$\{extension\}`/)
  assert.doesNotMatch(integration, /`\$\{authenticatedUser\.id\}\/virtual-staging\/\$\{sessionId\}/)
  assert.match(integration, /storage\.from\(BUCKET\)\.upload\(inputPath, file/)
  assert.match(integration, /functions\.invoke\('virtual-staging-image-test'/)
  for (const field of ['module:', 'input_path:', 'transformation_type:', 'decoration_style:', 'expected_count:', "action: 'prepare'", "action: 'generate'", 'client_request_id:', 'item_index:']) assert.match(integration, new RegExp(field))
  for (const forbidden of ['prompt:', 'model:', 'quality:', 'size:', 'output_format:', 'image_destinations:']) assert.doesNotMatch(integration, new RegExp(forbidden))
  assert.doesNotMatch(integration, /service.?role|unit_cost:|quoted_tokens:/i)
  assert.doesNotMatch(read('frontend/src/config/virtualStagingFurnish.js'), /supabase|fetch\(|invoke\(/)
})

test('processa a coleção sequencialmente, bloqueia clique duplicado e não executa retry automático', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const retryFurnishResultMaterialization'))
  assert.match(integration, /furnishGenerationInFlightRef\.current\) return/)
  assert.match(integration, /furnishGenerationInFlightRef\.current = true/)
  assert.ok((integration.match(/functions\.invoke\('virtual-staging-image-test'/g) || []).length >= 3)
  assert.match(integration, /for \(let imageIndex = 0; imageIndex < orderedImages\.length; imageIndex \+= 1\)/)
  assert.doesNotMatch(integration, /Promise\.all\(|setTimeout|setInterval|retry|while\s*\(/i)
  assert.doesNotMatch(integration, /finalize_session|creation_id/)
})

test('calcula 30 ou 60 ST por imagem conforme a transformação e atualiza o perfil ao concluir', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.match(integration, /action: 'prepare'[\s\S]*image_count: orderedImages\.length/)
  assert.match(integration, /action: 'generate'[\s\S]*client_request_id: sessionId[\s\S]*item_index: imageIndex/)
  assert.match(integration, /action: 'fail_item'/)
  assert.match(integration, /await reloadProfile\(\)/)
  assert.equal(getSmartSpaceUnitCost('furnish'), 30)
  assert.equal(getSmartSpaceUnitCost('remove_furniture'), 30)
  assert.equal(getSmartSpaceUnitCost('clear_area'), 30)
  assert.equal(getSmartSpaceUnitCost('remove_and_redecorate'), 60)
  assert.equal(getSmartSpaceQuote('remove_and_redecorate', 5), 300)
  assert.match(page, /getSmartSpaceUnitCost\(transformationType\).*getSmartSpaceQuote\(transformationType, images\.length\)/)
})

test('mostra progresso real, comparação de duas ou três etapas e downloads individuais', () => {
  assert.match(page, /Criando seu Smart Space/)
  assert.match(page, /Estamos analisando e transformando cada ambiente\./)
  assert.match(page, /Processando imagem \{Math\.min\(activeIndex \+ 1, results\.length\)\} de \{results\.length\}/)
  for (const stage of ['Aguardando', 'Enviando', 'Criando', 'Pronta', 'Não concluída']) assert.match(page, new RegExp(stage))
  assert.match(page, /Seu Smart Space está pronto/)
  assert.match(page, /label: 'Original'[\s\S]*\.\.\.result\.stages/)
  assert.match(page, /xl:grid-cols-3/)
  assert.match(page, /downloadFileFromPrivateUrl\(stage\.url, fallbackName\)/)
  assert.match(page, /Baixar \{stage\.label\.toLocaleLowerCase/)
  assert.match(page, /Criar novo projeto/)
})

test('persiste somente identificadores e caminhos para recovery idempotente do Smart Space', () => {
  assert.match(page, /recoveredJourneyId === FURNISH_RENOVATE_JOURNEY_ID \? '' : recoveredJourneyId/)
  assert.match(page, /if \(isFurnishRenovate\) return[\s\S]*parseVirtualStagingJobRecord/)
  assert.match(page, /getSmartSpaceRecoveryKey/)
  assert.match(page, /setTransformationType\(''\)[\s\S]*setDecorationStyle\(''\)/)
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.doesNotMatch(integration, /localStorage|video_jobs|virtual-staging-status/)
  assert.match(integration, /sessionStorage\.setItem\(furnishRecoveryKey/)
  assert.match(page, /action: 'recover'/)
  assert.match(page, /\['awaiting_processing', 'free_space_completed'\]\.includes\(item\.stage_state\)/)
  assert.match(page, /action: 'resume'/)
  assert.match(page, /materializeSmartSpaceResult/)
  assert.match(page, /Criar novo projeto/)
  assert.match(page, /setFurnishResults\(\[\]\)/)
  assert.match(page, /setHasAttemptedFurnishGeneration\(false\)/)
  assert.doesNotMatch(page, /furnish(?:Gallery|History)|virtualStaging(?:Gallery|History)/i)
})

test('opens Smart Space directly on transformation without the internal start card', () => {
  assert.doesNotMatch(page, /virtual-staging-chat-intro-title/)
  assert.doesNotMatch(page, /VIRTUAL_STAGING_CHAT_INTRO\.action/)
  assert.match(page, /initialQuestionId: isBrokerPresentation \? 'presenter_reference' : isFurnishRenovate \? 'transformation_type' : 'images'/)
})

test('mantém resultado concluído separado de falha real quando a URL assinada não materializa', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.match(integration, /status: 'result_unavailable', rawResult: data\.result/)
  assert.doesNotMatch(integration, /status: 'failed', outputPath: data\?\.result\?\.output_path \|\| '', error: 'result_unavailable'/)
  assert.match(page, /const retryFurnishResultMaterialization = async id =>/)
  assert.match(page, /rawResult: pendingResult\.rawResult/)
  assert.doesNotMatch(page.slice(page.indexOf('const retryFurnishResultMaterialization'), page.indexOf('const createTour')), /functions\.invoke\('virtual-staging-image-test'/)
  assert.match(page, /result\.status === 'result_unavailable'/)
  assert.match(page, /A transformação foi concluída, mas o resultado ainda não pôde ser carregado\./)
})

test('recovery mantém item concluído com URL indisponível recuperável sem reclassificá-lo como falha de geração', () => {
  const recovery = page.slice(page.indexOf('const recover = async'), page.indexOf('const addImages = files'))
  assert.match(recovery, /status: 'result_unavailable', rawResult: item\.result, error: 'result_unavailable'/)
  assert.match(recovery, /item\?\.status === 'failed' \? \{ \.\.\.base, status: 'failed'/)
  assert.match(recovery, /action: 'resume'/)
  assert.doesNotMatch(recovery, /client_request_id: crypto\.randomUUID/)
})

test('preserva contrato singular, ordem explícita, falha parcial e metadados de recovery', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  for (const field of ['originalIndex', 'key:', 'originalPreview', 'inputPath', 'outputPath', 'afterUrl', 'status:', 'width:', 'height:', 'mimeType:', 'sizeBytes:', 'error:']) assert.match(integration, new RegExp(field))
  for (const status of ['pending', 'uploading', 'generating', 'completed', 'failed']) assert.match(page, new RegExp(`'${status}'`))
  assert.match(integration, /current\.map\(result => result\.id === id/)
  assert.match(integration, /continue/)
  assert.doesNotMatch(integration, /input_paths|image_destinations|localStorage|video_jobs/i)
})

test('keeps Vida no Imóvel and Apresentação pelo Corretor isolated', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'life-in-property' }), 'life_scene')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'broker-presentation' }), 'captions')
  assert.doesNotMatch(read('frontend/src/config/virtualStagingLife.js'), /transformation_type|decoration_style|image_destinations/)
  assert.doesNotMatch(read('frontend/src/config/virtualStagingBroker.js'), /transformation_type|decoration_style|image_destinations/)
})

test('uses the same real Before and After mini carousel in the two separate Virtual Staging phones', () => {
  assert.match(page, /const VIRTUAL_STAGING_BEFORE_IMAGE = '\/virtual-staging\/virtual-staging-before\.jpg'/)
  assert.match(page, /const VIRTUAL_STAGING_AFTER_IMAGE = '\/virtual-staging\/virtual-staging-after\.png'/)
  assert.match(page, /alt: 'Ambiente antes do Smart Space'/)
  assert.match(page, /alt: 'Ambiente depois do Smart Space'/)
  assert.equal((page.match(/<VirtualStagingBeforeAfterPhone initialIndex=/g) || []).length, 2)
  const upperPhone = page.slice(page.indexOf('function VirtualSpaceHeroVisual'), page.indexOf('function usePrefersReducedMotion'))
  const lowerPhone = page.slice(page.indexOf('function VirtualStagingModules'), page.indexOf('function Question'))
  assert.match(upperPhone, /journey\.id === FURNISH_RENOVATE_JOURNEY_ID[\s\S]*<VirtualStagingBeforeAfterPhone initialIndex=\{0\}/)
  assert.match(lowerPhone, /isVirtualStagingDemo = journey\.id === FURNISH_RENOVATE_JOURNEY_ID[\s\S]*<VirtualStagingBeforeAfterPhone initialIndex=\{1\}/)
  assert.doesNotMatch(upperPhone, /grid-cols-2|sm:grid-cols-2/)
  assert.doesNotMatch(lowerPhone, /VirtualStagingBeforeAfterPhone initialIndex=\{0\}[\s\S]*VirtualStagingBeforeAfterPhone initialIndex=\{1\}/)
})

test('auto-advances every 2.5 seconds, remains clickable and respects reduced motion', () => {
  const carousel = page.slice(page.indexOf('function VirtualStagingBeforeAfterPhone'), page.indexOf('function VirtualStagingModules'))
  assert.match(carousel, /window\.setInterval\(advance, 2500\)/)
  assert.match(carousel, /if \(prefersReducedMotion\) return undefined/)
  assert.match(carousel, /type="button" onClick=\{advance\}/)
  assert.match(carousel, /focus-visible:ring-2/)
  assert.match(carousel, /object-cover object-center/)
  assert.match(carousel, /transition-none/)
  assert.match(carousel, /transition-opacity duration-500/)
  assert.match(carousel, />\{activeSlide\.label\}<\/span>/)
  assert.doesNotMatch(carousel, /<video|<img[^>]+object-fill|modal|download|navigate|supabase|invoke\(/i)
})
