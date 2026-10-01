import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SMART_CAROUSEL_CTA_SCENE_DURATION_SECONDS,
  SMART_CAROUSEL_NARRATION_CTA_GAP_SECONDS,
  calculateNarrationWordTargets,
  calculateSmartCarouselTiming,
  countNarrationWords,
  normalizeNarrationToMaximum,
  resolveNarrationTiming,
} from './narration-timing.ts'

const candidate = (narration: string) => ({ narration, narrationHighlights: [] })
const words = (count: number) => Array.from({ length: count }, (_, index) => `palavra${index + 1}`).join(' ')
const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const timingSource = readFileSync(new URL('./narration-timing.ts', import.meta.url), 'utf8')

function extractBuildPresentationPlan() {
  const start = indexSource.indexOf('async function buildPresentationPlan(')
  assert.ok(start >= 0, 'buildPresentationPlan precisa existir')
  const bodyStart = indexSource.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let index = bodyStart; index < indexSource.length; index += 1) {
    if (indexSource[index] === '{') depth += 1
    if (indexSource[index] === '}') {
      depth -= 1
      if (depth === 0) { end = index + 1; break }
    }
  }
  assert.ok(end > bodyStart, 'corpo completo de buildPresentationPlan precisa ser extraido')
  return indexSource
    .slice(start, end)
    .replace(
      /async function buildPresentationPlan\([\s\S]*?\) \{/,
      "async function buildPresentationPlan(imageUrls, ctaUrl, answers, phone, cta, openaiApiKey, jobId, locale = { language: 'pt-BR', market: 'BR' }) {",
    )
}

function compileBuildPresentationPlan(dependencies: Record<string, unknown>) {
  const names = Object.keys(dependencies)
  const values = Object.values(dependencies)
  return new Function(...names, `return (${extractBuildPresentationPlan()})`)(...values) as (
    imageUrls: string[], ctaUrl: string, answers: Record<string, unknown>, phone: string,
    cta: string, openaiApiKey: string, jobId: string,
  ) => Promise<Record<string, any>>
}

test('calcula duracao e faixa para todas as quantidades normais de 5 a 20 imagens', () => {
  for (let imageCount = 5; imageCount <= 20; imageCount += 1) {
    const timing = calculateSmartCarouselTiming(imageCount)
    const expectedPhotoSeconds = imageCount * 3.5 - (imageCount - 1) * 0.45

    assert.equal(timing.photoSequenceSeconds, expectedPhotoSeconds)
    assert.equal(timing.narrationSeconds, expectedPhotoSeconds - 1.5)
    assert.equal(timing.totalSeconds, expectedPhotoSeconds + 3.5)

    const targets = calculateNarrationWordTargets(timing.narrationSeconds)
    assert.equal(targets.minimumWords, Math.ceil(timing.narrationSeconds * 1.70))
    assert.equal(targets.maximumWords, Math.floor(timing.narrationSeconds * 2.20))
    assert.equal(targets.targetWords, Math.round((targets.minimumWords + targets.maximumWords) / 2))
  }
})

test('script posiciona o CTA exatamente depois das fotos para 5, 12 e 20 imagens', () => {
  for (const imageCount of [5, 12, 20]) {
    const timing = calculateSmartCarouselTiming(imageCount)
    const renderScript = {
      duration: timing.totalSeconds,
      narrationDuration: timing.narrationSeconds,
      elements: [
        ...Array.from({ length: imageCount }, (_, index) => ({ type: 'image', track: 1, index })),
        { type: 'image', track: 3, role: 'cta', time: timing.photoSequenceSeconds },
      ],
    }
    const ctaElement = renderScript.elements.find(element => element.role === 'cta')

    assert.equal(ctaElement?.time, timing.photoSequenceSeconds)
    assert.equal(renderScript.duration, timing.photoSequenceSeconds + SMART_CAROUSEL_CTA_SCENE_DURATION_SECONDS)
    assert.equal(renderScript.narrationDuration, timing.photoSequenceSeconds - SMART_CAROUSEL_NARRATION_CTA_GAP_SECONDS)
  }

  assert.match(indexSource, /const ctaTime = timing\.photoSequenceSeconds/)
  assert.doesNotMatch(indexSource, /\bphotoSequenceDuration\b/)
})

test('buildPresentationPlan completo preenche metadata e fica pronto para o Creatomate', async () => {
  assert.match(
    indexSource,
    /import\s*\{[^}]*\bcountNarrationWords\b[^}]*\}\s*from '\.\/narration-timing\.ts'/,
  )
  let marketingCalls = 0
  let revisionCalls = 0
  let wordCountCalls = 0
  let renderBuildCalls = 0
  const buildPresentationPlan = compileBuildPresentationPlan({
    calculateSmartCarouselTiming,
    SMART_CAROUSEL_NARRATION_CTA_GAP_SECONDS,
    generateMarketingIntelligence: async (
      _apiKey: string, _jobId: string, _answers: Record<string, unknown>, cta: string,
      _phone: string, _imageCount: number, availableSeconds: number,
    ) => {
      marketingCalls += 1
      const targets = calculateNarrationWordTargets(availableSeconds)
      const resolved = await resolveNarrationTiming({
        initial: candidate(words(Math.max(2, targets.minimumWords - 3))),
        minimumWords: targets.minimumWords,
        maximumWords: targets.maximumWords,
        fallbackInvitation: cta,
        reviseOnce: async targetWords => {
          revisionCalls += 1
          return candidate(words(targetWords))
        },
      })
      return {
        narration: resolved.narration,
        narrationHighlights: ['varanda'],
        campaigns: [{ id: 'campaign-1' }],
        googleAds: { headlines: ['Imovel em destaque'] },
      }
    },
    selectNarrationVoice: () => ({ id: 'voice-test', provider: 'openai model=tts-1 voice=test' }),
    buildRenderScript: (imageUrls: string[]) => {
      renderBuildCalls += 1
      const timing = calculateSmartCarouselTiming(imageUrls.length)
      return {
        duration: timing.totalSeconds,
        ctaTime: timing.photoSequenceSeconds,
        narrationDuration: timing.narrationSeconds,
      }
    },
    countNarrationWords: (value: string) => {
      wordCountCalls += 1
      return countNarrationWords(value)
    },
  })

  for (const imageCount of [5, 12, 20]) {
    const imageUrls = Array.from({ length: imageCount }, (_, index) => `https://example.test/${index}.jpg`)
    const timing = calculateSmartCarouselTiming(imageCount)
    const targets = calculateNarrationWordTargets(timing.narrationSeconds)
    const plan = await buildPresentationPlan(
      imageUrls,
      'https://example.test/cta.png',
      { purpose: 'Venda' },
      '',
      'Saiba Mais',
      'test-api-key-not-used',
      '11111111-1111-4111-8111-111111111111',
    )

    assert.equal(plan.narration.timing.words, targets.targetWords)
    assert.equal(plan.narration.timing.available_seconds, timing.narrationSeconds)
    assert.equal(plan.renderScript.ctaTime, timing.photoSequenceSeconds)
    assert.equal(plan.renderScript.duration, timing.totalSeconds)
    assert.equal(plan.renderScript.narrationDuration, timing.narrationSeconds)
    assert.ok(plan.renderScript, 'plano precisa estar pronto para a chamada do Creatomate')
  }

  assert.equal(marketingCalls, 3)
  assert.equal(revisionCalls, 3)
  assert.equal(renderBuildCalls, 3)
  assert.equal(wordCountCalls, 3)
})

test('calcula alvo central de 28 palavras para a faixa de 25 a 31', () => {
  assert.deepEqual(calculateNarrationWordTargets(14.2), {
    minimumWords: 25,
    maximumWords: 31,
    targetWords: 28,
  })
})

test('aceita narracao dentro da faixa sem revisao', async () => {
  let revisions = 0
  const result = await resolveNarrationTiming({
    initial: candidate(words(28)),
    minimumWords: 25,
    maximumWords: 31,
    fallbackInvitation: 'Agende sua visita',
    reviseOnce: async () => { revisions += 1; return candidate(words(28)) },
  })

  assert.equal(countNarrationWords(result.narration), 28)
  assert.equal(result.revisionAttempts, 0)
  assert.equal(revisions, 0)
})

test('revisa uma unica vez uma narracao inicial fora da faixa e informa o alvo central', async () => {
  let revisions = 0
  let receivedTarget = 0
  const result = await resolveNarrationTiming({
    initial: candidate(words(20)),
    minimumWords: 25,
    maximumWords: 31,
    fallbackInvitation: 'Agende sua visita',
    reviseOnce: async (targetWords) => {
      revisions += 1
      receivedTarget = targetWords
      return candidate(words(28))
    },
  })

  assert.equal(receivedTarget, 28)
  assert.equal(result.revisionAttempts, 1)
  assert.equal(revisions, 1)
})

test('aceita revisao semanticamente valida com 23 palavras para a faixa de 25 a 31', async () => {
  const result = await resolveNarrationTiming({
    initial: candidate(words(20)),
    minimumWords: 25,
    maximumWords: 31,
    fallbackInvitation: 'Agende sua visita',
    reviseOnce: async () => candidate(words(23)),
  })

  assert.equal(countNarrationWords(result.narration), 23)
  assert.equal(result.revisionAttempts, 1)
})

test('aceita revisao exatamente no maximo', async () => {
  const result = await resolveNarrationTiming({
    initial: candidate(words(20)),
    minimumWords: 25,
    maximumWords: 31,
    fallbackInvitation: 'Agende sua visita',
    reviseOnce: async () => candidate(words(31)),
  })

  assert.equal(countNarrationWords(result.narration), 31)
})

test('normaliza excesso localmente, remove trechos secundarios e preserva a frase final', () => {
  const narration = [
    'Conheca um imovel preparado para uma nova historia.',
    'A apresentacao destaca detalhes secundarios que podem ser removidos com seguranca.',
    'Os ambientes convidam voce a imaginar novas possibilidades todos os dias.',
    'Entre em contato e agende sua visita.',
  ].join(' ')
  const normalized = normalizeNarrationToMaximum(narration, 18, 'Agende sua visita')

  assert.ok(countNarrationWords(normalized) <= 18)
  assert.match(normalized, /Entre em contato e agende sua visita\.$/)
  assert.doesNotMatch(normalized, /detalhes secundarios/)
  for (const sentence of normalized.split(/(?<=[.!?…])\s+/)) assert.match(sentence, /[.!?…]$/)
})

test('uma revisao acima do maximo e normalizada sem nova revisao ou loop', async () => {
  let revisions = 0
  const result = await resolveNarrationTiming({
    initial: candidate(words(20)),
    minimumWords: 25,
    maximumWords: 31,
    fallbackInvitation: 'Entre em contato agora',
    reviseOnce: async () => {
      revisions += 1
      return candidate('Descubra uma oportunidade preparada para voce. Este trecho secundario apresenta detalhes adicionais do imovel. Outro trecho secundario reforca a apresentacao comercial com informacoes complementares. Entre em contato agora e conheca todos os detalhes.')
    },
  })

  assert.ok(countNarrationWords(result.narration) <= 31)
  assert.match(result.narration, /Entre em contato agora e conheca todos os detalhes\.$/)
  assert.equal(revisions, 1)
  assert.equal(result.revisionAttempts, 1)
  assert.ok(1 + revisions <= 2, 'geracao inicial mais no maximo uma revisao')
})

test('usa convite seguro completo quando uma unica frase excede o maximo', () => {
  const normalized = normalizeNarrationToMaximum(
    `${words(40)}.`,
    31,
    'Saiba Mais',
  )

  assert.equal(normalized, 'Saiba Mais.')
  assert.ok(countNarrationWords(normalized) <= 31)
  assert.match(normalized, /[.!?…]$/)
})

test('testes usam apenas callbacks locais e nao acessam provedores pagos', async () => {
  let localRevisionCalls = 0
  await resolveNarrationTiming({
    initial: candidate(words(20)),
    minimumWords: 25,
    maximumWords: 31,
    fallbackInvitation: 'Agende sua visita',
    reviseOnce: async () => {
      localRevisionCalls += 1
      return candidate(words(28))
    },
  })

  assert.equal(localRevisionCalls, 1)
  assert.equal(indexSource.match(/api\.openai\.com\/v1\/chat\/completions/g)?.length, 2)
  assert.match(indexSource, /target_words: targetNarrationWords/)
  assert.match(indexSource, /temperature: 0,/)
  assert.doesNotMatch(timingSource, /\bfetch\s*\(/)
})
