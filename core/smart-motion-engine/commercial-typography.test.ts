import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCommercialTypographyFilters,
  createCommercialTypographyLayout,
} from './commercial-typography.ts'

test('separa número, característica e complemento sem alterar a mensagem', () => {
  assert.deepEqual(createCommercialTypographyLayout('145 m²'), {
    focus: '145',
    support: 'M²',
    focusFirst: true,
    accentEligible: true,
  })
  assert.deepEqual(createCommercialTypographyLayout('Varanda gourmet'), {
    focus: 'VARANDA',
    support: 'GOURMET',
    focusFirst: true,
    accentEligible: true,
  })
})

test('mantém a finalidade como único foco mesmo quando ela vem no fim', () => {
  assert.deepEqual(createCommercialTypographyLayout('Apartamento à venda'), {
    focus: 'À VENDA',
    support: 'APARTAMENTO',
    focusFirst: false,
    accentEligible: true,
  })
})

test('mantém CTA e complemento em camadas separadas', () => {
  assert.deepEqual(createCommercialTypographyLayout('Agende sua visita'), {
    focus: 'AGENDE',
    support: 'SUA VISITA',
    focusFirst: true,
    accentEligible: true,
  })
})

test('escolhe o diferencial comercial mesmo quando ele vem no fim', () => {
  assert.deepEqual(createCommercialTypographyLayout('Próximo ao metrô'), {
    focus: 'METRÔ',
    support: 'PRÓXIMO AO',
    focusFirst: false,
    accentEligible: true,
  })
})

test('aplica um único bloco azul apenas na camada de foco', () => {
  const layout = createCommercialTypographyLayout('3 dormitórios')
  const filters = buildCommercialTypographyFilters({
    layout,
    focusFile: 'focus.txt',
    supportFile: 'support.txt',
    fontFile: 'font.ttf',
    startSeconds: 0,
    endSeconds: 4,
    useAccent: true,
  })
  const filter = filters.join(',')

  assert.equal((filter.match(/boxcolor=0x61D6FF/g) || []).length, 1)
  assert.match(filter, /fontsize=108/)
  assert.match(filter, /fontsize=82/)
})

test('preserva hierarquia sem bloco azul quando o ritmo visual não pede acento', () => {
  const layout = createCommercialTypographyLayout('Varanda gourmet')
  const filter = buildCommercialTypographyFilters({
    layout,
    focusFile: 'focus.txt',
    supportFile: 'support.txt',
    fontFile: 'font.ttf',
    startSeconds: 0,
    endSeconds: 4,
    useAccent: false,
  }).join(',')

  assert.doesNotMatch(filter, /boxcolor=0x61D6FF/)
  assert.match(filter, /borderw=4/)
})
