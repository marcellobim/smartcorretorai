import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../src/pages/StudioHero.jsx', import.meta.url), 'utf8')
const en = readFileSync(new URL('../src/i18n/messages/en-US.js', import.meta.url), 'utf8')

test('US Studio routes upload, recovery, errors, review and loading copy through the English catalog', () => {
  for (const key of [
    "t('studio.recovery.resuming')", "t('studio.recovery.resumed')", "t('studio.errors.unavailable')",
    "t('studio.errors.access')", "t('studio.status.checking')", "t('studio.upload.instruction')", "t('studio.upload.helper')",
  ]) assert.match(page, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  for (const value of ['Resuming your creation...', 'We could not prepare the commercial right now.', 'Upload the best property image. {brand} automatically adds the professional video ending.']) {
    assert.match(en, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('US Studio does not retain known Portuguese hard-coded text in its active upload and property-facts controls', () => {
  for (const forbidden of [
    'Envie a melhor imagem do imovel. O ${BRAND.name}',
    'Escolha a foto que melhor representa o imovel.',
    'Criando seu comercial livre...',
    'Preparando seu comercial...',
    'Nao foi possivel preparar o comercial neste momento.',
    'Percentual de comissao',
    'Outros beneficios',
    'Qual outro beneficio?',
  ]) assert.doesNotMatch(page, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(page, /market === 'US' \? 'Bathrooms' : 'Suítes'/)
  assert.match(page, /market === 'US' \? 'sqft' : 'm²'/)
})

test('US Studio resolves saved enum IDs in the same catalog used by questions and delivery chips', () => {
  for (const value of ["EXCLUSIVO: 'Exclusive'", "LANCAMENTO: 'New release'", "CONTRATAMOS: 'We are hiring'", "linkedin: 'LinkedIn when applicable'"]) {
    assert.match(en, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(page, /optionLabel\('propertyTypes', answers\.propertyType\)/)
  assert.match(page, /optionLabel\('profiles', answers\.profile\)/)
  assert.match(page, /optionLabel\('visualStyle', answers\.visualStyle\)/)
  assert.match(page, /t\(`studio\.delivery\.items\.\$\{item\}`\)/)
})
