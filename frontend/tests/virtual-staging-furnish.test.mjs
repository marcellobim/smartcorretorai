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
  FURNISH_RENOVATE_DESTINATION_OPTIONS,
  FURNISH_RENOVATE_JOURNEY_ID,
  FURNISH_RENOVATE_MAX_IMAGES,
  FURNISH_RENOVATE_QUESTIONS,
  FURNISH_RENOVATE_STYLE_OPTIONS,
  FURNISH_RENOVATE_TRANSFORMATION_OPTIONS,
  VIRTUAL_STAGING_CHAT_INTRO,
} from '../src/config/virtualStagingFurnish.js'
import { getVirtualStagingJourney } from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const page = read('frontend/src/pages/VirtualStaging.jsx')

test('uses Virtual Staging as the public name while preserving the internal id', () => {
  assert.equal(FURNISH_RENOVATE_JOURNEY_ID, 'furnish-renovate')
  assert.equal(getVirtualStagingJourney(FURNISH_RENOVATE_JOURNEY_ID)?.title, 'Virtual Staging')
  assert.deepEqual(VIRTUAL_STAGING_CHAT_INTRO, {
    title: 'Virtual Staging',
    description: 'Transforme fotos de ambientes vazios, quase vazios ou já mobiliados em novas apresentações visuais criadas por inteligência artificial.',
    action: 'Começar',
  })
  assert.match(page, /selectedJourneyId === FURNISH_RENOVATE_JOURNEY_ID \? 'Virtual Staging'/)
  assert.doesNotMatch(read('frontend/src/config/virtualStagingJourneys.js'), /Reimagine AI/)
})

test('defines only the approved local Virtual Staging conversation sequence', () => {
  const expected = ['transformation_type', 'decoration_style', 'images', 'image_destinations', 'ai_notice', 'review']
  assert.deepEqual(FURNISH_RENOVATE_QUESTIONS.map(([id]) => id), expected)
  const sequence = ['transformation_type']
  while (sequence.at(-1) !== 'review') sequence.push(getVirtualStagingNextQuestion({ questionId: sequence.at(-1), journeyId: FURNISH_RENOVATE_JOURNEY_ID }))
  assert.deepEqual(sequence, expected)
  for (const removed of ['purpose', 'type', 'bedrooms', 'suites', 'parkingSpaces', 'area', 'location', 'highlights', 'narration', 'captions', 'cta', 'phone', 'campaign', 'hashtags']) {
    assert.equal(expected.includes(removed), false)
  }
  assert.match(page, /initialQuestionId: isBrokerPresentation \? 'presenter_reference' : isFurnishRenovate \? 'transformation_type' : 'images'/)
  assert.match(page, /const furnishProject = useMemo\(\(\) => \(\{[\s\S]*transformation_type: transformationType,[\s\S]*decoration_style: decorationStyle,[\s\S]*property_images: images,[\s\S]*image_destinations: imageDestinations/)
})

test('offers three required single-choice transformation modes with approved copy', () => {
  assert.deepEqual(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS, [
    { id: 'empty_or_nearly_empty', label: 'Mobiliar ambientes vazios ou quase vazios', description: 'Completa os espaços com móveis, eletrodomésticos e decoração.' },
    { id: 'furnished', label: 'Criar uma nova decoração em ambientes já mobiliados', description: 'Moderniza os móveis soltos e os elementos decorativos no mesmo ambiente.' },
    { id: 'mixed', label: 'Tenho ambientes vazios e mobiliados', description: 'A inteligência artificial analisa cada imagem e aplica o tratamento mais adequado.' },
  ])
  assert.match(page, /if \(id === 'transformation_type' && isFurnishRenovate\) return choices/)
  assert.doesNotMatch(JSON.stringify(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS), /Deixar a IA decidir/)
})

test('offers Moderno, Escandinavo and Sofisticado as explained single-choice styles', () => {
  assert.deepEqual(FURNISH_RENOVATE_STYLE_OPTIONS, [
    { id: 'modern', label: 'Moderno', description: 'Linhas limpas, móveis atuais, cores neutras e sensação de amplitude.' },
    { id: 'scandinavian', label: 'Escandinavo', description: 'Madeira clara, tons suaves, iluminação natural e ambiente acolhedor.' },
    { id: 'sophisticated', label: 'Sofisticado', description: 'Mobiliário elegante, materiais refinados e composição mais premium.' },
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

test('supports all approved image destinations as a required multiple selection', () => {
  assert.deepEqual(FURNISH_RENOVATE_DESTINATION_OPTIONS.map(({ id, label }) => ({ id, label })), [
    { id: 'instagram', label: 'Instagram' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'real_estate_portals', label: 'Portais imobiliários' },
    { id: 'google_ads', label: 'Google Ads' },
    { id: 'meta_ads', label: 'Meta Ads' },
  ])
  assert.match(page, /setImageDestinations\(current => current\.includes\(value\)/)
  assert.match(page, /aria-pressed=\{selected\}/)
  assert.match(page, /cont\(imageDestinations\.length === 0, answer\)/)
  for (const accessibleName of ['Logo do Instagram', 'Logo do Facebook', 'Logo do WhatsApp', 'Logo do Google Ads', 'Logo da Meta', 'Ícone neutro de portais imobiliários']) assert.ok(page.includes(accessibleName))
  assert.match(page, /<Building2 className=\{iconClass\}/)
})

test('shows the approved AI notice before review', () => {
  assert.equal(FURNISH_RENOVATE_AI_NOTICE, 'Como o resultado é criado por inteligência artificial, alguns detalhes do ambiente podem ser alterados para melhorar a composição visual.')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'image_destinations', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'ai_notice')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'ai_notice', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.match(page, /if \(id === 'ai_notice' && isFurnishRenovate\)/)
})

test('reviews transformation, style, ordered thumbnails and branded destinations', () => {
  const review = buildFurnishRenovateReviewItems({
    imagesCount: 3,
    transformationType: 'mixed',
    decorationStyle: 'scandinavian',
    imageDestinations: ['instagram', 'real_estate_portals', 'meta_ads'],
  })
  assert.deepEqual(review.map(item => item.id), ['transformation_type', 'decoration_style', 'images', 'image_destinations'])
  assert.equal(review[0].label, 'Tenho ambientes vazios e mobiliados')
  assert.equal(review[1].label, 'Escandinavo')
  assert.equal(review[2].label, '3 imagens')
  assert.equal(review[3].label, 'Instagram · Portais imobiliários · Meta Ads')
  assert.match(page, /Revise seu projeto/)
  assert.match(page, /Imagem \$\{index \+ 1\} na ordem do projeto/)
  assert.match(page, /DestinationBrandIcon destination=\{option\} compact/)
  for (const id of ['transformation_type', 'decoration_style', 'images', 'image_destinations']) {
    assert.equal(getVirtualStagingReviewEditNext({ originQuestionId: id, questionId: id, journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  }
})

test('habilita a geração integrada com uma a cinco imagens e respostas obrigatórias', () => {
  assert.match(page, /const canGenerateFurnish = isFurnishRenovate[\s\S]*images\.length >= 1[\s\S]*images\.length <= FURNISH_RENOVATE_MAX_IMAGES[\s\S]*Boolean\(transformationType\)[\s\S]*Boolean\(decorationStyle\)[\s\S]*imageDestinations\.length > 0/)
  assert.match(page, /disabled=\{!canGenerateFurnish \|\| furnishGenerationBusy\}/)
  assert.doesNotMatch(page, /Esta primeira versão de validação processa uma imagem por vez\./)
  assert.match(page, /if \(!canGenerateFurnish\)/)
})

test('envia ao backend somente o contrato permitido do furnish-renovate', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.match(integration, /supabase\.auth\.getUser\(\)/)
  assert.match(integration, /storage\.from\(BUCKET\)\.upload\(inputPath, file/)
  assert.match(integration, /functions\.invoke\('virtual-staging-image-test'/)
  for (const field of ['module:', 'input_path:', 'transformation_type:', 'decoration_style:']) assert.match(integration, new RegExp(field))
  for (const forbidden of ['prompt:', 'model:', 'quality:', 'size:', 'output_format:', 'image_destinations:']) assert.doesNotMatch(integration, new RegExp(forbidden))
  assert.doesNotMatch(integration, /service.?role|smart.?tokens?/i)
  assert.doesNotMatch(read('frontend/src/config/virtualStagingFurnish.js'), /supabase|fetch\(|invoke\(/)
})

test('processa a coleção sequencialmente, bloqueia clique duplicado e não executa retry automático', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.match(integration, /furnishGenerationInFlightRef\.current\) return/)
  assert.match(integration, /furnishGenerationInFlightRef\.current = true/)
  assert.equal((integration.match(/functions\.invoke\('virtual-staging-image-test'/g) || []).length, 1)
  assert.match(integration, /for \(let imageIndex = 0; imageIndex < orderedImages\.length; imageIndex \+= 1\)/)
  assert.doesNotMatch(integration, /Promise\.all|setTimeout|setInterval|retry|while\s*\(/i)
})

test('mostra progresso real, resultado Antes e Depois e downloads individuais', () => {
  assert.match(page, /Criando seu Virtual Staging/)
  assert.match(page, /Estamos analisando e transformando cada ambiente\./)
  assert.match(page, /Processando imagem \{Math\.min\(activeIndex \+ 1, results\.length\)\} de \{results\.length\}/)
  for (const stage of ['Aguardando', 'Enviando', 'Criando', 'Pronta', 'Não concluída']) assert.match(page, new RegExp(stage))
  assert.match(page, /Seu Virtual Staging está pronto/)
  assert.match(page, /label: 'Antes'[\s\S]*label: 'Depois'/)
  assert.match(page, /downloadFileFromPrivateUrl\(result\.afterUrl, `virtual-staging-\$\{String\(result\.originalIndex \+ 1\)\.padStart\(2, '0'\)\}\.jpg`\)/)
  assert.match(page, /Baixar imagem transformada/)
  assert.match(page, /Criar novo projeto/)
})

test('mantém resultado somente em memória e desativa recuperação antiga apenas no furnish-renovate', () => {
  assert.match(page, /recoveredJourneyId === FURNISH_RENOVATE_JOURNEY_ID \? '' : recoveredJourneyId/)
  assert.match(page, /if \(isFurnishRenovate\) return[\s\S]*parseVirtualStagingJobRecord/)
  assert.match(page, /setFurnishResults\(\[\]\)/)
  assert.match(page, /setTransformationType\(''\)[\s\S]*setDecorationStyle\(''\)[\s\S]*setImageDestinations\(\[\]\)/)
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.doesNotMatch(integration, /localStorage|sessionStorage|video_jobs|virtual-staging-status/)
  assert.match(integration, /createSignedUrl\(outputPath, 600\)/)
  assert.match(page, /Criar novo projeto/)
  assert.match(page, /setFurnishResults\(\[\]\)/)
  assert.match(page, /setHasAttemptedFurnishGeneration\(false\)/)
  assert.doesNotMatch(page, /furnish(?:Gallery|History)|virtualStaging(?:Gallery|History)/i)
})

test('preserva contrato singular, ordem explícita, falha parcial e metadados somente em memória', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  for (const field of ['originalIndex', 'key:', 'originalPreview', 'inputPath', 'outputPath', 'afterUrl', 'status:', 'width:', 'height:', 'mimeType:', 'sizeBytes:', 'error:']) assert.match(integration, new RegExp(field))
  for (const status of ['pending', 'uploading', 'generating', 'completed', 'failed']) assert.match(page, new RegExp(`'${status}'`))
  assert.match(integration, /current\.map\(result => result\.id === id/)
  assert.match(integration, /continue/)
  assert.doesNotMatch(integration, /input_paths|image_destinations|localStorage|sessionStorage|video_jobs|smart.?tokens?/i)
})

test('keeps Vida no Imóvel and Apresentação pelo Corretor isolated', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'life-in-property' }), 'life_scene')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'broker-presentation' }), 'captions')
  assert.doesNotMatch(read('frontend/src/config/virtualStagingLife.js'), /transformation_type|decoration_style|image_destinations/)
  assert.doesNotMatch(read('frontend/src/config/virtualStagingBroker.js'), /transformation_type|decoration_style|image_destinations/)
})

test('uses the same real Before and After mini carousel in the two separate Virtual Staging phones', () => {
  assert.match(page, /import VIRTUAL_STAGING_BEFORE_IMAGE from '\.\.\/\.\.\/\.\.\/assets-imoveis\/apartamento-vazio-02\/virtual-staging-antes\.jpg'/)
  assert.match(page, /import VIRTUAL_STAGING_AFTER_IMAGE from '\.\.\/\.\.\/\.\.\/assets-imoveis\/apartamento-vazio-02\/virtual-staging-pos\.png'/)
  assert.match(page, /alt: 'Ambiente antes do Virtual Staging'/)
  assert.match(page, /alt: 'Ambiente depois do Virtual Staging'/)
  assert.equal((page.match(/<VirtualStagingBeforeAfterPhone initialIndex=/g) || []).length, 2)
  const upperPhone = page.slice(page.indexOf('function VirtualSpaceHeroVisual'), page.indexOf('function FurnishReimagineComparison'))
  const lowerPhone = page.slice(page.indexOf('function VirtualStagingModules'), page.indexOf('function DestinationBrandIcon'))
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
