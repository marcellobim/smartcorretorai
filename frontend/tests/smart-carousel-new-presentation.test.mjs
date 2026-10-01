import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  clearProductDraft,
  readProductDraft,
  writeProductDraft,
} from '../src/lib/product-draft.js'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const carousel = readFileSync(new URL('../src/pages/SmartCarrossel.jsx', import.meta.url), 'utf8')
const mediaOptions = { productKey: 'smart-carousel:media', schemaVersion: 1, userId: 'user-a' }
const flowOptions = { productKey: 'smart-carousel:flow', schemaVersion: 1, userId: 'user-a' }

function getOuterResetSource() {
  const start = carousel.indexOf('  const createNewPresentation = () => {')
  const end = carousel.indexOf('\n  const movePhoto', start)
  assert.ok(start >= 0 && end > start, 'reset consciente do componente pai não encontrado')
  return carousel.slice(start, end)
}

test('reload, remount and navigation keep both Smart Carousel drafts', () => {
  const storage = new MemoryStorage()
  const media = { photoMetadata: [{ name: 'imovel.jpg', size: 42, type: 'image/jpeg', lastModified: 7, order: 0 }], informationStarted: true, generationStage: 2 }
  const flow = { purpose: 'sale', city: 'São Paulo', cta: 'Saiba Mais', conversation: { activeQuestionId: 8, history: [], phase: 'question' } }

  assert.equal(writeProductDraft(storage, { ...mediaOptions, data: media, now: 1000 }), true)
  assert.equal(writeProductDraft(storage, { ...flowOptions, data: flow, now: 1000 }), true)

  for (const lifecycle of ['reload', 'remount', 'navigation-return']) {
    assert.deepEqual(readProductDraft(storage, { ...mediaOptions, now: 2000 }), media, lifecycle)
    assert.deepEqual(readProductDraft(storage, { ...flowOptions, now: 2000 }), flow, lifecycle)
  }
})

test('Nova apresentação clears media, briefing and local image collection', () => {
  const reset = getOuterResetSource()
  assert.match(reset, /mediaDraft\.clear\(\)/)
  assert.match(reset, /flowDraft\.clear\(\)/)
  assert.match(reset, /photosRef\.current = \[\]/)
  assert.match(reset, /currentPhotos\.forEach\(\(photo\) => URL\.revokeObjectURL\(photo\.previewUrl\)\)/)
  assert.match(reset, /setPhotos\(\[\]\)/)
  assert.match(reset, /setMissingPhotoMetadata\(\[\]\)/)
  assert.match(reset, /setInformationStarted\(false\)/)
  assert.match(reset, /setGenerationStage\(1\)/)
  assert.match(reset, /setPhotoSelectionMessage\(''\)/)
  assert.match(reset, /setConversationGenerationStatus\('idle'\)/)

  const storage = new MemoryStorage()
  writeProductDraft(storage, { ...mediaOptions, data: { photoMetadata: [{ name: 'antiga.jpg', size: 1, type: 'image/jpeg', lastModified: 1, order: 0 }] } })
  writeProductDraft(storage, { ...flowOptions, data: { purpose: 'sale', cta: 'Saiba Mais' } })
  clearProductDraft(storage, mediaOptions)
  clearProductDraft(storage, flowOptions)
  assert.equal(readProductDraft(storage, mediaOptions), null)
  assert.equal(readProductDraft(storage, flowOptions), null)
})

test('new files after conscious reset start from an empty ref', () => {
  const reset = getOuterResetSource()
  assert.ok(reset.indexOf('photosRef.current = []') < reset.indexOf('setPhotos([])'))
  assert.match(carousel, /const current = photosRef\.current[\s\S]*const nextPhotos = \[\.\.\.current, \.\.\.newPhotos\]/)
  assert.match(reset, /photoIdRef\.current = 0/)
})

test('reset does not create a job, reserve tokens or call the provider', () => {
  const reset = getOuterResetSource()
  assert.doesNotMatch(reset, /createPresentation|randomUUID|uploadSmartCarousel|invokeSmartCarouselFunction|reserve|consume|receipt|Creatomate/i)
  assert.match(carousel, /cost=\{SMART_TOKEN_COSTS\.smartCarousel\}/)
})

test('retry remains distinct and preserves the current briefing and files', () => {
  assert.match(carousel, /onClick=\{receipt \|\| activeJobId \? resumeStatus : createPresentation\}[\s\S]{0,180}>Tentar novamente</)
  assert.doesNotMatch(carousel, /Tentar novamente[\s\S]{0,180}createNewPresentation/)
  assert.match(carousel, /onCreateNew=\{createNewPresentation\}[\s\S]*createNewLabel="Criar nova apresentação"/)
})

test('global draft helper remains the only persistence mechanism used by this reset', () => {
  const reset = getOuterResetSource()
  assert.match(carousel, /useProductDraft\(\{ productKey: 'smart-carousel:media'/)
  assert.match(carousel, /useProductDraft\(\{ productKey: 'smart-carousel:flow'/)
  assert.doesNotMatch(reset, /sessionStorage|localStorage/)
})

test('recovery notice uses a dynamic, customer-friendly photo count', () => {
  assert.match(carousel, /return `Seu progresso foi recuperado\. Selecione novamente \$\{count\} \$\{count === 1 \? 'foto' : 'fotos'\} para continuar\.`/)
  assert.match(carousel, /getRecoveredPhotosMessage\(missingPhotoMetadata\.length\)/)

  const message = count => `Seu progresso foi recuperado. Selecione novamente ${count} ${count === 1 ? 'foto' : 'fotos'} para continuar.`
  assert.equal(message(1), 'Seu progresso foi recuperado. Selecione novamente 1 foto para continuar.')
  assert.equal(message(7), 'Seu progresso foi recuperado. Selecione novamente 7 fotos para continuar.')
})

test('recovery notice does not expose implementation details', () => {
  const noticeStart = carousel.indexOf('function getRecoveredPhotosMessage')
  const noticeEnd = carousel.indexOf('\n}', noticeStart) + 2
  const notice = carousel.slice(noticeStart, noticeEnd)
  assert.doesNotMatch(notice, /rascunho foi restaurado|arquivos físicos|não ficam salvas no navegador|sessionStorage|\bFile\b|\bBlob\b/i)
})

test('F5 with an active receipt mounts recovery without requiring local photo files', () => {
  assert.match(carousel, /const hasRestoredActiveJob = isValidSmartCarouselReceipt\(restoredFlowDraft\.receipt\)[\s\S]*isValidSmartCarouselJobId\(restoredFlowDraft\.activeJobId\)/)
  assert.match(carousel, /const informationUnlocked = hasRestoredActiveJob[\s\S]*\|\| \(informationStarted && photos\.length >= SMART_CAROUSEL_MIN_IMAGES\)/)
  assert.match(carousel, /const hasRecoverableActiveJob = isValidSmartCarouselReceipt\(receipt\) && isValidSmartCarouselJobId\(activeJobId\)/)
  assert.match(carousel, /if \(!hasRecoverableActiveJob \|\| generationInFlightRef\.current\) return[\s\S]*resumeStatus\(\)/)
  const recoveryEffect = carousel.slice(carousel.indexOf('const hasRecoverableActiveJob'), carousel.indexOf('const createPresentation'))
  assert.doesNotMatch(recoveryEffect, /randomUUID|uploadSmartCarouselFiles|action: 'create'|claimSmartCarouselEconomy|creatomate/i)
})

test('recovery defensively resumes the existing job before any new UUID, upload or creation call', () => {
  const createStart = carousel.indexOf('const createPresentation = async () => {')
  const uuidAt = carousel.indexOf('crypto.randomUUID()', createStart)
  const recoveryGuardAt = carousel.indexOf('if (hasRecoverableActiveJob) {', createStart)
  const uploadAt = carousel.indexOf('uploadSmartCarouselFilesWithTimeout', createStart)
  const createCallAt = carousel.indexOf("action: 'create'", createStart)
  assert.ok(createStart >= 0 && recoveryGuardAt > createStart)
  assert.ok(uuidAt > recoveryGuardAt && uploadAt > recoveryGuardAt && createCallAt > recoveryGuardAt)
  const guard = carousel.slice(recoveryGuardAt, uuidAt)
  assert.match(guard, /resumeStatus\(\)/)
  assert.doesNotMatch(guard, /randomUUID|uploadSmartCarouselFiles|action: 'create'/)
})

test('restored completed and terminal jobs render their existing terminal state without a new job', () => {
  assert.match(carousel, /const hasRestoredCompletedJob = isValidSmartCarouselJobId\(restoredFlowDraft\.completedJobId\)[\s\S]*restoredFlowDraft\.videoUrl\.startsWith\('https:\/\/'\)/)
  assert.match(carousel, /const hasRestoredTerminalJob = \['failed', 'cancelled'\]\.includes\(restoredFlowDraft\.terminalStatus\)/)
  assert.match(carousel, /restoredFlow\.completedJobId && restoredFlow\.videoUrl[\s\S]*'succeeded'[\s\S]*restoredFlow\.terminalStatus/)
  assert.match(carousel, /const terminalStatus = \['failed', 'cancelled'\]\.includes\(generationStatus\) \? generationStatus : ''/)
  assert.match(carousel, /campaignPackage, terminalStatus, terminalError: terminalStatus \? generationError : ''/)
  assert.match(carousel, /\['failed', 'cancelled'\]\.includes\(data\.status\)[\s\S]*stopWithError\([\s\S]*data\.status\)/)
})
