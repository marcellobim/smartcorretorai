import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  getRecoverableVirtualStagingJourneyId,
  getVirtualStagingJourneySessionKey,
  isUsableVirtualStagingVideoUrl,
  parseVirtualStagingJobRecord,
} from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const page = read('frontend/src/pages/VirtualStaging.jsx')
const campaignPackage = read('frontend/src/components/campaign/CampaignPackage.jsx')
const smartTour = read('frontend/src/pages/SmartTourAI.jsx')

const memoryStorage = entries => ({
  getItem(key) { return Object.hasOwn(entries, key) ? entries[key] : null },
})

test('restores Module 3 from its known active-job key after reload', () => {
  const key = getVirtualStagingJourneySessionKey('broker-presentation')
  const storage = memoryStorage({ [key]: JSON.stringify({ jobId: 'job-module-3', updatedAt: 30 }) })

  assert.equal(getRecoverableVirtualStagingJourneyId(storage), 'broker-presentation')
  assert.match(page, /const recoveredJourneyId = getRecoverableVirtualStagingJourneyId\(globalThis\.sessionStorage\)/)
  assert.match(page, /return recoveredJourneyId === FURNISH_RENOVATE_JOURNEY_ID \? '' : recoveredJourneyId/)
  assert.match(page, /useState\(getInitialVirtualStagingJourneyId\)/)
})

test('restored journey mounts and resumes polling with the saved job id', () => {
  assert.match(page, /selectedJourney && <div[\s\S]*?<VirtualStagingJourney/)
  assert.match(page, /const storedValue = sessionStorage\.getItem\(activeJobKey\)[\s\S]*?parseVirtualStagingJobRecord\(storedValue\)[\s\S]*?poll\(stored\.jobId\)/)
})

test('completed accepts only an assignable signed video URL and renders CampaignPackage', () => {
  assert.equal(isUsableVirtualStagingVideoUrl('https://example.test/storage/video.mp4?token=masked'), true)
  assert.equal(isUsableVirtualStagingVideoUrl('http://localhost/video.mp4'), true)
  assert.match(page, /data\.status === 'completed'/)
  assert.match(page, /isUsableVirtualStagingVideoUrl\(data\.signedVideoUrl\)/)
  assert.match(page, /previewUrl: result\.signedVideoUrl, downloadUrl: result\.signedVideoUrl/)
})

test('completed result is not recoverable across another reload', () => {
  const stored = parseVirtualStagingJobRecord(JSON.stringify({
    jobId: 'completed-job',
    campaignPackage: { sourceProduct: 'Virtual Space' },
    result: { status: 'completed', signedVideoUrl: 'https://example.test/video.mp4' },
    updatedAt: 50,
  }))

  assert.equal(stored.jobId, 'completed-job')
  assert.equal(stored.result.status, 'completed')
  assert.equal(getRecoverableVirtualStagingJourneyId(memoryStorage({
    [getVirtualStagingJourneySessionKey('broker-presentation')]: JSON.stringify(stored),
  })), null)
})

test('completed clears recovery while preserving the result in current React state', () => {
  const completedBranch = page.slice(page.indexOf("if (data.status === 'completed')"), page.indexOf("if (data.status === 'failed')"))
  assert.match(completedBranch, /sessionStorage\.removeItem\(activeJobKey\)/)
  assert.doesNotMatch(completedBranch, /sessionStorage\.setItem\(activeJobKey/)
  assert.match(completedBranch, /setResult\(completedResult\)/)
  assert.match(completedBranch, /setStatus\('completed'\)/)
})

test('Create new project clears the recoverable job explicitly', () => {
  assert.match(page, /const reset = \(\) => \{ sessionStorage\.removeItem\(activeJobKey\)/)
  assert.match(page, /createNewLabel="Criar novo projeto"/)
})

test('completed without signedVideoUrl clears recovery and exposes a current-session status retry', () => {
  assert.equal(isUsableVirtualStagingVideoUrl(''), false)
  assert.equal(isUsableVirtualStagingVideoUrl('   '), false)
  assert.match(page, /setStatus\('result_unavailable'\)/)
  assert.match(page, /vídeo está temporariamente indisponível/)
  assert.match(page, /Consultar resultado novamente/)
  assert.match(page, /if \(status === 'result_unavailable'\) return <section role="alert"/)
  assert.match(page, /onClick=\{retryResultStatus\}>Consultar resultado novamente/)
  assert.match(page, /activeJobIdRef\.current \|\| stored\?\.jobId/)
})

test('invalid URL cannot restore a completed job after reload', () => {
  assert.equal(isUsableVirtualStagingVideoUrl('not-a-url'), false)
  assert.equal(isUsableVirtualStagingVideoUrl('javascript:alert(1)'), false)
  const invalidUrlBranch = page.slice(page.indexOf('if (!isUsableVirtualStagingVideoUrl'), page.indexOf('const campaignPackage = '))
  assert.doesNotMatch(invalidUrlBranch, /createTour/)
  assert.match(page, /const retryResultStatus = \(\) =>[\s\S]*?poll\(jobId\)/)
})

test('failed terminal jobs are not recoverable and clear their session key', () => {
  const key = getVirtualStagingJourneySessionKey('life-in-property')
  assert.equal(getRecoverableVirtualStagingJourneyId(memoryStorage({
    [key]: JSON.stringify({ jobId: 'failed-job', status: 'failed', updatedAt: 60 }),
  })), null)
  assert.match(page, /if \(data\.status === 'failed'\) \{[\s\S]*?sessionStorage\.removeItem\(activeJobKey\)/)
})

test('legacy furnish processing jobs are ignored by recovery selection and by the page', () => {
  const key = getVirtualStagingJourneySessionKey('furnish-renovate')
  assert.equal(getRecoverableVirtualStagingJourneyId(memoryStorage({
    [key]: JSON.stringify({ jobId: 'processing-job', status: 'generating', updatedAt: 70 }),
  })), null)
  assert.match(page, /return recoveredJourneyId === FURNISH_RENOVATE_JOURNEY_ID \? '' : recoveredJourneyId/)
  assert.match(page, /useEffect\(\(\) => \{\s*if \(isFurnishRenovate\) return\s*const storedValue = sessionStorage\.getItem/)
})

test('secondary preview errors stay local and video remains the result only for the other modules', () => {
  assert.match(campaignPackage, /onError=\{\(\) => setFailed\(true\)\}/)
  assert.match(campaignPackage, /onError=\{\(\) => setStatus\('error'\)\}/)
  assert.match(page, /if \(isFurnishRenovate && status === 'completed' && furnishResults\.length > 0\) return <FurnishRenovateDelivery/)
  assert.match(page, /if \(result\) return <section[\s\S]*?<CampaignPackage/)
  assert.doesNotMatch(campaignPackage, /setResult|sessionStorage\.removeItem/)
})

test('furnish-renovate uses the private image result while other modules keep CampaignPackage', () => {
  const delivery = page.slice(page.indexOf('function FurnishRenovateResultCard'), page.indexOf('function FurnishRenovateProcessing'))
  assert.match(delivery, /label: 'Antes'[\s\S]*label: 'Depois'/)
  assert.match(page, /const fallbackName = `virtual-staging-\$\{String\(result\.originalIndex \+ 1\)\.padStart\(2, '0'\)\}\.jpg`/)
  assert.match(page, /downloadFurnishRenovateResult[\s\S]*downloadFileFromPrivateUrl\(result\.afterUrl, fallbackName\)/)
  assert.match(delivery, /downloadFurnishRenovateResult\(result\)/)
  assert.match(delivery, /Baixar imagem transformada/)
  assert.match(delivery, /Criar novo projeto/)
  assert.doesNotMatch(delivery, /CampaignPackage|Textos para divulgação|Hashtags|Instagram|WhatsApp|Facebook|LinkedIn|Próximos passos/)
  assert.match(page, /if \(isFurnishRenovate && status === 'completed' && furnishResults\.length > 0\) return <FurnishRenovateDelivery[\s\S]*if \(result\) return <section[\s\S]*?<CampaignPackage/)
})

test('empty CampaignPackage preview displays a controlled unavailable result', () => {
  assert.match(campaignPackage, /if \(!campaign\.previewUrl\)/)
  assert.match(campaignPackage, /role="alert"/)
  assert.match(campaignPackage, /Resultado temporariamente indisponível\./)
  assert.doesNotMatch(campaignPackage, /if \(!campaign\.previewUrl\) return null/)
})

test('Module 2 recovery remains isolated and smart-tour stays untouched', () => {
  const lifeKey = getVirtualStagingJourneySessionKey('life-in-property')
  const brokerKey = getVirtualStagingJourneySessionKey('broker-presentation')
  const storage = memoryStorage({
    [lifeKey]: JSON.stringify({ jobId: 'life-job', updatedAt: 100 }),
    [brokerKey]: JSON.stringify({ jobId: 'broker-job', updatedAt: 90 }),
  })

  assert.equal(getRecoverableVirtualStagingJourneyId(storage), 'life-in-property')
  assert.doesNotMatch(smartTour, /getRecoverableVirtualStagingJourneyId|result_unavailable|virtual-staging/)
  assert.match(smartTour, /functions\.invoke\('smart-tour-status'/)
})
