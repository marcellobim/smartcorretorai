import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  clearHeroNextRecovery,
  materializeHeroNextResult,
  normalizeHeroNextRecoveryPayload,
  readHeroNextRecovery,
  writeHeroNextRecovery,
} from '../src/lib/hero-next-recovery.js'

const page = readFileSync(new URL('../src/pages/HeroNext.jsx', import.meta.url), 'utf8')
const economy = readFileSync(new URL('../../supabase/functions/gerar-hero-ia/economy.ts', import.meta.url), 'utf8')
const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const GENERATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function storage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    dump: () => [...values.values()].join('\n'),
  }
}

test('recovery reference is minimal, UUID validated and isolated by user', () => {
  const local = storage()
  assert.equal(writeHeroNextRecovery(local, 'user-a', 'invalid'), false)
  assert.equal(writeHeroNextRecovery(local, 'user-a', CLIENT_ID, 'processing'), true)
  assert.deepEqual(readHeroNextRecovery(local, 'user-a'), {
    userId: 'user-a',
    clientRequestId: CLIENT_ID,
    status: 'processing',
  })
  assert.equal(readHeroNextRecovery(local, 'user-b'), null)
  const raw = local.dump()
  assert.doesNotMatch(raw, /Bearer|jwt|access_token|refresh_token|signed/i)
})

test('refresh and a new mount reuse the exact same client_request_id', () => {
  const local = storage()
  writeHeroNextRecovery(local, 'user-a', CLIENT_ID, 'processing')
  const firstMount = readHeroNextRecovery(local, 'user-a')
  const secondMount = readHeroNextRecovery(local, 'user-a')
  assert.equal(firstMount.clientRequestId, CLIENT_ID)
  assert.equal(secondMount.clientRequestId, CLIENT_ID)
  assert.deepEqual(firstMount, secondMount)
})

test('completed incident materializes the existing generation and image', () => {
  const recovered = normalizeHeroNextRecoveryPayload({
    success: true,
    recovery_only: true,
    found: true,
    status: 'completed',
    request_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    client_request_id: CLIENT_ID,
    items: [{
      piece_id: 'idea-1-instagram_feed',
      format_id: 'instagram_feed',
      creation_option: 1,
      generation_id: GENERATION_ID,
      status: 'completed',
      image_url: 'https://signed.example/existing.jpg',
      texts: { instagram: 'Texto existente' },
    }],
  })
  const result = materializeHeroNextResult(recovered.jobs, [], { sourceId: recovered.clientRequestId })
  assert.equal(result.sourceId, CLIENT_ID)
  assert.equal(result.jobs[0].generationId, GENERATION_ID)
  assert.equal(result.imageUrl, 'https://signed.example/existing.jpg')
})

test('normal flow persists recovery before economic preparation', () => {
  const normal = page.slice(page.indexOf('const handleGenerate = async (event) => {'), page.indexOf('\n  const persistedCampaignCopy'))
  const persist = normal.indexOf("writeHeroNextRecovery(window.localStorage, user?.id, clientRequestId, 'processing')")
  const prepare = normal.indexOf("action: 'prepare_batch'")
  assert.ok(persist > -1 && prepare > persist)
  assert.match(normal, /const clientRequestId = economicRequestIdRef\.current \|\| crypto\.randomUUID\(\)/)
})

test('mount recovery and manual refresh use only recover_batch and existing status polling', () => {
  const recovery = page.slice(page.indexOf('const recoverGenerationBatch'), page.indexOf('const startGenerationJob'))
  assert.match(recovery, /buildHeroNextRecoveryRequest\(storedRecovery\)/)
  assert.match(recovery, /client_request_id: recoveryRequest\.client_request_id/)
  assert.match(recovery, /pollGenerationJob\(job\.generationId/)
  assert.doesNotMatch(recovery, /crypto\.randomUUID|prepare_batch|startGenerationJob|discover_recoverable_batch/)
  assert.match(page, /recoveryStartedRef\.current/)
  assert.match(page, /recoverGenerationBatch\(\{ resumePolling: true \}\)/)
  const mount = page.slice(page.indexOf('recoveryStartedRef.current = true'), page.indexOf('const startGenerationJob'))
  assert.match(mount, /recoverGenerationBatch\(\{ resumePolling: false \}\)/)
  assert.doesNotMatch(mount, /recoverGenerationBatch\(\{ resumePolling: true \}\)/)
  const recoveryMount = page.slice(page.indexOf('useEffect(() => {', page.indexOf('const recoverGenerationBatch')), page.indexOf('const startGenerationJob'))
  assert.doesNotMatch(recoveryMount, /generationResult\) return/)
})

test('recovery interactions stay read-only until the final explicit generate handler', () => {
  const recovery = page.slice(page.indexOf('const recoverGenerationBatch'), page.indexOf('const startGenerationJob'))
  assert.doesNotMatch(recovery, /prepare_batch|startGenerationJob|randomUUID|trackGenerationClicked/)
  const currentGenerate = page.slice(page.indexOf('const handleGenerate = async (event) => {'), page.indexOf('\n  const persistedCampaignCopy'))
  assert.match(currentGenerate, /if \(!isExplicitGenerationActivation\(event\)\) return/)
  assert.match(currentGenerate, /if \(generationStartRef\.current\) return/)
  assert.match(currentGenerate, /generationStartRef\.current = true[\s\S]*trackGenerationClicked\(\)/)
  assert.match(currentGenerate, /finally \{[\s\S]*generationStartRef\.current = false/)
})

test('US ZIP is optional, but a supplied ZIP is validated and reaches the request unchanged', () => {
  assert.match(page, /ZIP Code \(optional\)[\s\S]*optional: true/)
  assert.match(page, /questionId === 'zipCode' && normalizedValue && !isValidUsZipCode\(normalizedValue\)/)
  assert.match(page, /zip_code: answers\.zipCode \|\| ''/)
  assert.match(page, /if \(questionId === 'county'\) \{ delete updatedAnswers\.city; delete updatedAnswers\.zipCode \}/)
})

test('found false clears only obsolete local recovery and never generates', () => {
  const recovery = page.slice(page.indexOf('const recoverGenerationBatch'), page.indexOf('const startGenerationJob'))
  const notFound = recovery.slice(recovery.indexOf('if (data?.found === false)'), recovery.indexOf('const recovered ='))
  assert.match(notFound, /clearHeroNextRecovery/)
  assert.match(notFound, /setPhase\(goal \? 'images' : 'intro'\)/)
  assert.doesNotMatch(notFound, /startGenerationJob|prepare_batch|crypto\.randomUUID/)
})

test('processing reuses generation ids and failed or transient states leave processing', () => {
  const recovery = page.slice(page.indexOf('const recoverGenerationBatch'), page.indexOf('const startGenerationJob'))
  assert.match(recovery, /job\.status === 'processing' && job\.generationId/)
  assert.match(recovery, /recovered\.status === 'failed' \|\| recovered\.status === 'cancelled'/)
  assert.match(recovery, /setPhase\('recovery'\)/)
  assert.match(recovery, /A referência foi preservada/)
  const generationCatch = page.slice(page.indexOf('} catch (error) {', page.indexOf('const handleGenerate')), page.indexOf('\n    } finally {', page.indexOf('const handleGenerate')))
  assert.match(generationCatch, /setPhase\('recovery'\)/)
})

test('completed result is applied before recovery is marked completed', () => {
  const commit = page.slice(page.indexOf('const commitGenerationResult'), page.indexOf('const recoverGenerationBatch'))
  const apply = commit.indexOf('setGenerationResult(result)')
  const phase = commit.indexOf("setPhase('result')")
  const persist = commit.indexOf("writeHeroNextRecovery(window.localStorage, user.id, sourceId, 'completed')")
  assert.ok(apply > -1 && phase > apply && persist > phase)
})

test('Atualizar status, Sair e Recomeçar have explicit safe behavior', () => {
  assert.match(page, />\s*Atualizar status\s*</)
  assert.match(page, />\s*Sair desta criação\s*</)
  assert.match(page, />\s*Recomeçar\s*</)
  assert.doesNotMatch(page, />\s*Cancelar geração\s*</)
  const leave = page.slice(page.indexOf('const leaveCurrentCreation'), page.indexOf('\n\n  const campaignPackageBuild'))
  assert.match(leave, /generationViewActiveRef\.current = false/)
  assert.doesNotMatch(leave, /clearHeroNextRecovery|functions\.invoke|prepare_batch/)
  const reset = page.slice(page.indexOf('const resetCampaign'), page.indexOf('const leaveCurrentCreation'))
  assert.match(reset, /clearHeroNextRecovery/)
  assert.match(reset, /bannerDraft\.clear\(\)/)
  assert.doesNotMatch(reset, /functions\.invoke|prepare_batch|startGenerationJob/)
})

test('normal Banner price remains 75 ST and recovery adds no economic action', () => {
  assert.match(economy, /export const REAL_ESTATE_BANNER_UNIT_COST = 75/)
  const recovery = page.slice(page.indexOf('const recoverGenerationBatch'), page.indexOf('const startGenerationJob'))
  assert.doesNotMatch(recovery, /prepare_batch|claim_token|\.reserve\(|\.consume\(|\.refund\(|\.settle\(/i)
})

test('explicit reset clears the reference without starting a new operation', () => {
  const local = storage()
  writeHeroNextRecovery(local, 'user-a', CLIENT_ID, 'processing')
  clearHeroNextRecovery(local, 'user-a')
  assert.equal(readHeroNextRecovery(local, 'user-a'), null)
  const reset = page.slice(page.indexOf('const resetCampaign'), page.indexOf('const leaveCurrentCreation'))
  assert.doesNotMatch(reset, /randomUUID|functions\.invoke|handleGenerate\(/)
})
