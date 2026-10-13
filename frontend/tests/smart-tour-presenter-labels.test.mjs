import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import enUs from '../src/i18n/messages/en-US.js'
import ptBr from '../src/i18n/messages/pt-BR.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')

test('Real Estate Video keeps stable presenter IDs while localizing clear labels', () => {
  assert.match(page, /\{id:'female',label:t\('smartTour\.presenter\.female'\)\},\{id:'male',label:t\('smartTour\.presenter\.male'\)\},\{id:'none',label:t\('smartTour\.presenter\.none'\)\}/)
  assert.deepEqual(enUs.smartTour.presenter, {
    description: 'A virtual agent can present the property naturally while keeping each room as the main focus.',
    female: 'Female presenter', male: 'Male presenter', none: 'No presenter',
  })
  assert.deepEqual(ptBr.smartTour.presenter, {
    description: 'Um corretor ou corretora virtual poderá apresentar o imóvel de forma natural, mantendo os ambientes como o principal destaque.',
    female: 'Apresentadora', male: 'Apresentador', none: 'Sem apresentador',
  })
})
