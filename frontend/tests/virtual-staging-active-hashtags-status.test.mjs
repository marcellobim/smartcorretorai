import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalizeOfficialHashtags } from '../../supabase/functions/_shared/official-hashtags.ts'
import { mergeVirtualStagingCampaignHashtags } from '../src/components/campaign/buildVirtualStagingCampaignPackage.js'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const generateSource = read('supabase/functions/virtual-staging-generate/index.ts')
const statusSource = read('supabase/functions/virtual-staging-status/index.ts')
const pageSource = read('frontend/src/pages/VirtualStaging.jsx')
const alternateProvider = String.fromCharCode(86, 101, 111)
const alternateProviderPattern = new RegExp(`start${alternateProvider}Video|${alternateProvider}Client|${alternateProvider}_`, 'i')
const imageProductPattern = new RegExp([
  ['virtual', 'staging', 'image', 'test'].join('-'),
  ['virtual', 'staging', 'images', 'inputs'].join('[-/]'),
  ['virtual', 'staging', 'images', 'results'].join('[-/]'),
].join('|'))

const campaignPackage = {
  purpose: 'sale',
  propertyType: 'Apartamento',
  city: 'Recife',
  district: 'Boa Viagem',
  state: 'PE',
  cta: 'Agende sua visita',
  aiCampaigns: [
    { id: 'one', hashtags: ['#Anterior'] },
    { id: 'two', hashtags: ['#Anterior'] },
  ],
}

test('hashtags ficam restritas a Vida no Imovel e Apresentacao pelo Corretor', () => {
  assert.match(generateSource, /const activeVerticalVideo = Boolean\(input\.generation\.life_scene\) \|\| input\.module === 'broker-presentation'/)
  assert.match(generateSource, /const fallbackHashtags = activeVerticalVideo \? buildOfficialHashtags\(hashtagContext\) : \[\]/)
  assert.match(generateSource, /const hashtags = activeVerticalVideo \? await generateStrategicHashtags/)
})

test('fallback oficial e complemento estrategico sao persistidos e retornados', () => {
  assert.match(generateSource, /marketing_hashtags:fallbackHashtags/)
  assert.match(generateSource, /update\(\{marketing_hashtags:hashtags\}\).*?eq\('user_id',user\.id\)/)
  assert.match(generateSource, /return json\(\{ok:true,jobId:input\.clientRequestId,status:'generating',hashtags\}\)/)
  assert.match(generateSource, /select\('id,status,marketing_hashtags'\)/)
})

test('normalizacao remove entradas invalidas e duplicadas', () => {
  const hashtags = normalizeOfficialHashtags([
    '', null, '#BoaViagem', '#BoaViagem', '###', '#ApartamentoAVenda', '#SmartCorretorAI',
  ], { purpose: 'sale', propertyType: 'Apartamento', city: 'Recife', district: 'Boa Viagem' })
  assert.equal(hashtags.filter(value => value === '#BoaViagem').length, 1)
  assert.equal(hashtags.some(value => !/^#[A-Za-z0-9]+$/.test(value)), false)
  assert.equal(new Set(hashtags.map(value => value.toLowerCase())).size, hashtags.length)
})

test('frontend preserva pacote para array ausente vazio ou invalido', () => {
  assert.equal(mergeVirtualStagingCampaignHashtags(campaignPackage), campaignPackage)
  assert.equal(mergeVirtualStagingCampaignHashtags(campaignPackage, []), campaignPackage)
  assert.equal(mergeVirtualStagingCampaignHashtags(campaignPackage, [null, '', 'sem-marcador']), campaignPackage)
})

test('frontend mescla hashtags validas em todas as campanhas sem perder campos', () => {
  const merged = mergeVirtualStagingCampaignHashtags(campaignPackage, ['#BoaViagem', '#BoaViagem', '#ApartamentoAVenda'])
  assert.notEqual(merged, campaignPackage)
  assert.equal(merged.city, campaignPackage.city)
  assert.equal(merged.aiCampaigns.length, 2)
  assert.ok(merged.aiCampaigns.every(campaign => campaign.hashtags.includes('#BoaViagem')))
  assert.ok(merged.aiCampaigns.every(campaign => new Set(campaign.hashtags).size === campaign.hashtags.length))
})

test('status preserva ownership e devolve hashtags em todos os completed', () => {
  assert.match(statusSource, /select\('id,status,provider_job_id,output_video_path,error_message,prompt_final,marketing_hashtags'\)/)
  assert.match(statusSource, /\.eq\('id', jobId\)[\s\S]*?\.eq\('user_id', user\.id\)[\s\S]*?\.eq\('mode', 'virtual_staging_gemini_omni'\)/)
  const completedResponses = statusSource.match(/return json\(\{ ok: true, status: 'completed',[^\r\n]+/g) || []
  assert.equal(completedResponses.length, 3)
  assert.ok(completedResponses.every(response => response.includes("hashtags: job.marketing_hashtags || []")))
})

test('status mantem processing e failed sem mudar seus contratos', () => {
  assert.match(statusSource, /remote\.status === 'processing'[\s\S]*?status: 'generating'/)
  assert.match(statusSource, /job\.status === 'failed'[\s\S]*?status: 'failed'/)
  assert.match(statusSource, /remote\.status === 'failed'[\s\S]*?update\(\{ status: 'failed'/)
})

test('briefing antigo invalido ignora somente o compositor e entrega o video bruto', () => {
  assert.match(statusSource, /let briefing = null[\s\S]*?parseSmartTourStructuredBriefing\(job\.prompt_final\)[\s\S]*?smart_tour_caption_briefing_invalid/)
  assert.match(statusSource, /if \(briefing && hasDeterministicSmartTourText\(briefing\)\)/)
  assert.match(statusSource, /const outputPath = `\$\{user\.id\}\/\$\{jobId\}\/virtual-staging\.mp4`/)
})

test('frontend usa hashtags da geracao e do status inclusive no recovery', () => {
  assert.match(pageSource, /buildVirtualStagingCampaignPackage\([^)]*hashtags:data\.hashtags/)
  assert.match(pageSource, /mergeVirtualStagingCampaignHashtags\(stored\.campaignPackage \|\| \{\}, data\.hashtags\)/)
  assert.match(pageSource, /parseVirtualStagingJobRecord\(sessionStorage\.getItem\(activeJobKey\)\)/)
})

test('provider de video permanece Gemini e isolado do produto novo de imagens', () => {
  assert.match(generateSource, /startGeminiOmniVideo/)
  assert.match(generateSource, /mode:'virtual_staging_gemini_omni'/)
  assert.doesNotMatch(generateSource, alternateProviderPattern)
  assert.doesNotMatch(generateSource, imageProductPattern)
})
