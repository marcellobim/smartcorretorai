import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSmartCarouselMessageQueue } from './smart-carousel-message-queue.ts'

const completeCommercial = {
  objective: 'Venda',
  propertyType: 'Apartamento',
  uf: 'SP',
  neighborhood: 'Moema',
  bedrooms: '3',
  suites: '2',
  parking: '2',
  area: '120',
  highlights: ['Varanda gourmet', 'Lazer completo', 'Pronto para morar'],
  situation: 'Pronto para morar',
  commercialCondition: 'Aceita financiamento',
  phone: '(11) 99999-0000',
  cta: 'Agende sua visita',
}

function assertQueue(
  queue: ReturnType<typeof buildSmartCarouselMessageQueue>,
  imageCount: number,
  expectedCta = 'AGENDE SUA VISITA - (11) 99999-0000',
) {
  assert.equal(queue.captions.length, imageCount)
  assert.equal(queue.captions.at(-1), expectedCta)
  assert.equal(queue.captions.slice(0, -1).includes(expectedCta), false)
  assert.equal(queue.captions.slice(0, -1).includes('(11) 99999-0000'), false)
  assert.equal(queue.captions.includes('SP'), false)
  const nonEmpty = queue.captions.filter(Boolean)
  assert.equal(new Set(nonEmpty).size, nonEmpty.length)
}

test('3 imagens recebem 2 mensagens e CTA', () => {
  const queue = buildSmartCarouselMessageQueue(completeCommercial, 3)
  assert.deepEqual(queue.captions, ['MOEMA', 'APARTAMENTO À VENDA', 'AGENDE SUA VISITA - (11) 99999-0000'])
  assertQueue(queue, 3)
})

test('5 imagens recebem 4 mensagens e CTA', () => {
  const queue = buildSmartCarouselMessageQueue(completeCommercial, 5)
  assert.deepEqual(queue.captions, ['MOEMA', 'APARTAMENTO À VENDA', '3 DORMS', '2 SUÍTES', 'AGENDE SUA VISITA - (11) 99999-0000'])
  assertQueue(queue, 5)
})

test('10 imagens recebem até 9 mensagens e CTA', () => {
  const queue = buildSmartCarouselMessageQueue(completeCommercial, 10)
  assert.deepEqual(queue.captions, [
    'MOEMA',
    'APARTAMENTO À VENDA',
    '3 DORMS',
    '2 SUÍTES',
    '2 VAGAS',
    '120 M²',
    'VARANDA GOURMET',
    'LAZER COMPLETO',
    'PRONTO PARA MORAR',
    'AGENDE SUA VISITA - (11) 99999-0000',
  ])
  assertQueue(queue, 10)
})

test('20 imagens usam todos os dados reais sem repetir', () => {
  const queue = buildSmartCarouselMessageQueue(completeCommercial, 20)
  assertQueue(queue, 20)
  assert.deepEqual(queue.messages, [
    'MOEMA',
    'APARTAMENTO À VENDA',
    '3 DORMS',
    '2 SUÍTES',
    '2 VAGAS',
    '120 M²',
    'VARANDA GOURMET',
    'LAZER COMPLETO',
    'PRONTO PARA MORAR',
    'ACEITA FINANCIAMENTO',
    'AGENDE SUA VISITA - (11) 99999-0000',
  ])
  assert.equal(queue.breathingSceneIndexes.length, 9)
})

test('poucos dados produzem apenas mensagens reais e respiros', () => {
  const queue = buildSmartCarouselMessageQueue({ neighborhood: 'Moema', cta: 'Agende sua visita' }, 10)
  assert.deepEqual(queue.messages, ['MOEMA', 'AGENDE SUA VISITA'])
  assert.equal(queue.breathingSceneIndexes.length, 8)
  assertQueue(queue, 10, 'AGENDE SUA VISITA')
})

test('destaques, situação e condições duplicadas aparecem uma única vez', () => {
  const queue = buildSmartCarouselMessageQueue({
    ...completeCommercial,
    typology: 'Apartamento',
    highlights: ['Pronto para morar', 'Pronto para morar', 'Lazer completo'],
    situation: 'Pronto para morar',
    conditions: ['Aceita financiamento', 'Aceita financiamento'],
  }, 20)
  const messages = queue.messages.filter((item) => item === 'PRONTO PARA MORAR')
  const conditions = queue.messages.filter((item) => item === 'ACEITA FINANCIAMENTO')
  assert.equal(messages.length, 1)
  assert.equal(conditions.length, 1)
  assert.equal(queue.messages.includes('APARTAMENTO'), false)
  assertQueue(queue, 20)
})
