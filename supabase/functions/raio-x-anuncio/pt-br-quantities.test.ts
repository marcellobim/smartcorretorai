import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPtBrQuantity, normalizePtBrQuantities, normalizePtBrQuantityText } from './pt-br-quantities.ts'

test('formata singular, zero explícito e plural em PT-BR', () => {
  assert.equal(formatPtBrQuantity(1, 'dormitório'), '1 dormitório')
  assert.equal(formatPtBrQuantity(0, 'suíte'), '0 suítes')
  assert.equal(formatPtBrQuantity(2, 'banheiro'), '2 banheiros')
  assert.equal(formatPtBrQuantity(1, 'vaga'), '1 vaga')
  assert.equal(formatPtBrQuantity(2, 'imagem'), '2 imagens')
  assert.equal(formatPtBrQuantity(1, 'quarto'), '1 quarto')
})

test('normaliza múltiplos campos sem alterar números confirmados', () => {
  const text = normalizePtBrQuantityText('30 m², 1 dormitório(s), 1 suíte(s), 2 banheiro(s), 0 vaga(s)')
  assert.equal(text, '30 m², 1 dormitório, 1 suíte, 2 banheiros, 0 vagas')
})

test('normaliza textos públicos aninhados e elimina marcadores artificiais', () => {
  const result = normalizePtBrQuantities({
    summary: '1 quarto(s), 2 suíte(s)',
    sections: [{ copy_text: '1 imagem(ns) e 2 imagem(ns)' }],
  })
  const serialized = JSON.stringify(result)
  assert.equal(result.summary, '1 quarto, 2 suítes')
  assert.equal(result.sections[0].copy_text, '1 imagem e 2 imagens')
  assert.doesNotMatch(serialized, /\(s\)|\(ns\)|imagemns/i)
})
