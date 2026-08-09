import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SMART_DESIGN_TOKENS, SMART_UI } from '../src/design-system/tokens.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const virtualStaging = read('src/pages/VirtualStaging.jsx')
const conversation = read('src/components/conversation/GuidedConversation.jsx')

test('defines the shared SmartCorretorAI visual foundation as reusable semantic tokens', () => {
  assert.equal(SMART_DESIGN_TOKENS.typography.family, 'Inter, system-ui, sans-serif')
  assert.equal(SMART_DESIGN_TOKENS.grid.maxWidth, '80rem')
  assert.equal(SMART_DESIGN_TOKENS.radius.card, '1.5rem')
  assert.equal(SMART_DESIGN_TOKENS.radius.hero, '2rem')
  assert.match(SMART_UI.page, /max-w-smart/)
  assert.match(read('src/index.css'), /--smart-canvas:[\s\S]*--smart-brand-strong:/)
  assert.match(read('tailwind.config.js'), /maxWidth:[\s\S]*smart: '80rem'/)
})

test('provides reusable Hero, card, progress, grid, heading and summary components', () => {
  for (const component of ['ProductHero', 'ProductButton', 'ProductCard', 'ProductSteps', 'ProductFlowLayout', 'ProductSectionHeading', 'ProductSummary']) {
    assert.match(read('src/components/design-system/index.js'), new RegExp(component))
  }
  assert.match(read('src/components/design-system/ProductHero.jsx'), /lg:min-h-\[305px\][\s\S]*lg:grid-cols-\[\.96fr_1\.04fr\]/)
  assert.match(read('src/components/design-system/ProductSteps.jsx'), /sm:grid-cols-5[\s\S]*aria-current=\{current \? 'step'/)
  assert.match(read('src/components/design-system/ProductFlowLayout.jsx'), /lg:grid-cols-\[minmax\(0,1fr\)_240px\]/)
  assert.match(read('src/components/design-system/ProductSummary.jsx'), /Resumo da criação/)
})

test('applies the official foundation to Virtual Staging de imagens and Vídeo Imobiliário', () => {
  assert.match(virtualStaging, /<ProductHero[\s\S]*visual=\{<VirtualSpaceHeroVisual \/>\}/)
  assert.match(virtualStaging, /designSystem=\{isFurnishRenovate\}/)
  assert.match(conversation, /designSystem = false/)
  assert.match(conversation, /designSystem \? <ProductFlowLayout/)
})

test('keeps the Virtual Staging image comparison integrated into the light Hero', () => {
  assert.match(virtualStaging, /VIRTUAL_STAGING_COMPARISON_SLIDES/)
  assert.match(virtualStaging, /VirtualStagingBeforeAfterPhone/)
  assert.doesNotMatch(virtualStaging, /reimagine-1\.mp4/)
  assert.match(read('src/components/design-system/ProductHero.jsx'), /gap-10[\s\S]*leading-\[1\.06\][\s\S]*tracking-\[-0\.04em\]/)
})
