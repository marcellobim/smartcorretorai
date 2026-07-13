import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCommercialTypographyFilters,
  createCommercialTypographyLayout,
} from './commercial-typography.ts'

test('preserva frases únicas sem interpretação ou divisão automática', () => {
  assert.deepEqual(createCommercialTypographyLayout('Fale comigo'), {
    lines: ['FALE COMIGO'],
  })
  assert.deepEqual(createCommercialTypographyLayout('Varanda gourmet'), {
    lines: ['VARANDA GOURMET'],
  })
})

test('aceita somente as duas linhas fornecidas explicitamente', () => {
  assert.deepEqual(createCommercialTypographyLayout(['Apartamento', 'À venda']), {
    lines: ['APARTAMENTO', 'À VENDA'],
  })
  assert.deepEqual(createCommercialTypographyLayout('Agende sua\nvisita'), {
    lines: ['AGENDE SUA', 'VISITA'],
  })
})

test('reproduz os valores visuais exatos da Proposta 1 original', () => {
  const filters = buildCommercialTypographyFilters({
    layout: createCommercialTypographyLayout(['Apartamento', 'À venda']),
    lineFiles: ['line-1.txt', 'line-2.txt'],
    fontFile: 'font.ttf',
    startSeconds: 0.8,
    endSeconds: 5,
  })
  const filter = filters.join(',')

  assert.equal((filter.match(/drawtext=/g) || []).length, 2)
  assert.match(filter, /fontcolor=white:fontsize=106:borderw=5:bordercolor=black@0\.78/)
  assert.match(filter, /shadowx=8:shadowy=10:shadowcolor=black@0\.55/)
  assert.match(filter, /fontcolor=0x101010:fontsize=124:box=1:boxcolor=0x61D6FF@0\.96:boxborderw=18:borderw=0/)
  assert.match(filter, /y=1250/)
  assert.match(filter, /y=1395/)
  assert.match(filter, /0\.46/)
  assert.match(filter, /0\.52/)
  assert.match(filter, /0\.42/)
  assert.match(filter, /0\.36/)
  assert.match(filter, /0\.38/)
  assert.match(filter, /drawbox=x=82:y=1571/)
  assert.match(filter, /min\(640/)
  assert.match(filter, /\*960/)
  assert.match(filter, /h=8:color=white@0\.96/)
})

test('mantém frase única inteira dentro do bloco azul', () => {
  const filters = buildCommercialTypographyFilters({
    layout: createCommercialTypographyLayout('Fale comigo'),
    lineFiles: ['line-1.txt'],
    fontFile: 'font.ttf',
    startSeconds: 0,
    endSeconds: 4,
  })
  const filter = filters.join(',')

  assert.equal((filter.match(/drawtext=/g) || []).length, 1)
  assert.match(filter, /textfile='line-1\.txt'/)
  assert.match(filter, /fontsize=124/)
  assert.match(filter, /boxcolor=0x61D6FF@0\.96/)
  assert.doesNotMatch(filter, /fontsize=106/)
})

test('mantém frase longa inteira e reduz somente o tamanho necessário para caber', () => {
  const filters = buildCommercialTypographyFilters({
    layout: createCommercialTypographyLayout('Apartamento à venda'),
    lineFiles: ['line-1.txt'],
    fontFile: 'font.ttf',
    startSeconds: 0,
    endSeconds: 4,
  })
  const filter = filters.join(',')

  assert.equal((filter.match(/drawtext=/g) || []).length, 1)
  assert.match(filter, /textfile='line-1\.txt'/)
  assert.match(filter, /fontsize=64/)
  assert.doesNotMatch(filter, /fontsize=106/)
})
