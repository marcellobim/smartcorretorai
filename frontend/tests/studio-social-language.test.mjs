import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildPublicationPackage } from '../../core/copy-engine/index.ts'
import { buildStudioPublicationOptions } from '../src/lib/studio-publication-content.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const studio = readFileSync(path.join(frontendRoot, 'src/pages/StudioHero.jsx'), 'utf8')
const createVideo = readFileSync(path.join(repositoryRoot, 'supabase/functions/criar-video-ia/index.ts'), 'utf8')
const status = readFileSync(path.join(repositoryRoot, 'supabase/functions/get-video-job-status/index.ts'), 'utf8')

const commercial = {
  objective: 'sale', propertyType: 'APARTAMENTO', city: 'São Paulo', district: 'Moema',
  bedrooms: '2 DORMITORIOS', suites: '1 SUITE', parking: '1 VAGA', area: '50 A 100 M2',
  features: ['VARANDA / AREA EXTERNA', 'LAZER'], cta: 'AGENDE SUA VISITA',
}
const creative = {
  objective: 'broker_capture', propertyType: 'CORRETORES', profile: 'CORRETORES', city: 'Miami', district: 'Brickell',
  bedrooms: '3', suites: '1', parking: '2', area: '120', features: ['LEADS QUALIFICADOS', 'TREINAMENTO'], cta: 'QUERO CONVERSAR',
}

test('Studio social PT-BR keeps the existing shared publication package byte-for-byte', () => {
  assert.deepEqual(buildStudioPublicationOptions({ ...commercial, language: 'pt-BR' }), buildPublicationPackage(commercial))
  assert.deepEqual(buildStudioPublicationOptions(commercial), buildPublicationPackage(commercial))
})

test('Commercial EN-US uses English captions, presentation labels, CTA, and hashtags without changing internal values', () => {
  const options = buildStudioPublicationOptions({ ...commercial, language: 'en-US' })
  const content = options.map(option => option.text).join('\n')
  assert.equal(options.length, 3)
  assert.ok(options.every(option => /Instagram\/Facebook (Commercial|Emotional|Direct)/.test(option.label)))
  assert.match(content, /Apartment for sale in Moema, São Paulo/i)
  assert.match(content, /Schedule Your Visit/)
  assert.match(content, /#ApartmentForSale/)
  assert.equal(/dormit|venda|visita|varanda|lazer/i.test(content), false)
  assert.equal(commercial.objective, 'sale')
  assert.equal(commercial.propertyType, 'APARTAMENTO')
  assert.equal(commercial.cta, 'AGENDE SUA VISITA')
})

test('Creative EN-US uses English social content and social hashtags while preserving the free_ai input values', () => {
  const options = buildStudioPublicationOptions({ ...creative, language: 'en-US' })
  const content = options.map(option => option.text).join('\n')
  assert.equal(options.length, 3)
  assert.match(content, /real estate agents/i)
  assert.match(content, /Let's Talk/)
  assert.match(content, /#RealEstateCareers/)
  assert.doesNotMatch(content, /dormit|suite|vaga|m2/i)
  assert.equal(/corretores|quero conversar|captacao/i.test(content), false)
  assert.equal(creative.objective, 'broker_capture')
  assert.equal(creative.profile, 'CORRETORES')
  assert.equal(creative.cta, 'QUERO CONVERSAR')
})

test('Studio sends localized publication options with the creation language and recovery uses persisted options', () => {
  assert.match(studio, /publicationOptions: buildDeliveryTexts\(\{ answers, districtValue, cityValue, language \}\)/)
  assert.match(studio, /function buildDeliveryInput\(\{ answers, districtValue, cityValue, language = 'pt-BR' \}\)/)
  assert.match(studio, /publicationOptions\.length === 3 \? publicationOptions : buildDeliveryTexts\(deliveryInput\)/)
  assert.match(studio, /language=\{activeJobRef\.current\?\.language \|\| 'pt-BR'\}/)
  assert.match(createVideo, /const publicationOptions = normalizeStudioPublicationOptions\(body\.publicationOptions\)/)
  assert.match(createVideo, /publication_options: publicationOptions,/)
  assert.match(status, /publicationOptions: job\.publication_options/)
})

test('social publication handlers, VEO generation boundaries, and Studio economy remain untouched', () => {
  assert.match(studio, /onPublish: \(intent, destinations\) => publishStudioPublication\(supabase, intent, destinations\)/)
  assert.match(studio, /onRecover: \(intent, destinations\) => recoverStudioPublication\(supabase, intent, destinations\)/)
  assert.match(createVideo, /const jobMode = isFreeAiRequest \? 'free_ai' : 'dynamic_reel'/)
  assert.match(createVideo, /const ctaFrame = isFreeAiRequest \? null : resolveStudioHeroCtaFrame\(briefing\)/)
  assert.match(createVideo, /const productCode = productCodeForVeoMode\(jobMode\)/)
})
