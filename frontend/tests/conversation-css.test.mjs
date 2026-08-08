import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(frontendRoot, 'src/index.css')
const source = await readFile(sourcePath, 'utf8')
const isolatedTailwindConfig = {
  ...tailwindConfig,
  content: [{ raw: '<div class="font-sans"></div>', extension: 'html' }],
}
const result = await postcss([tailwindcss(isolatedTailwindConfig)]).process(source, { from: sourcePath })
const compiled = result.root

const findRule = selector => {
  let match
  compiled.walkRules(rule => {
    if (rule.selector === selector) match = rule
  })
  assert.ok(match, `Expected compiled selector: ${selector}`)
  return match
}

const declarations = rule => Object.fromEntries(rule.nodes
  .filter(node => node.type === 'decl')
  .map(node => [node.prop, node.value]))

const fieldSelector = "[data-smart-conversation] :where(input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='range']):not([type='color']):not([type='hidden']), textarea, select)"

test('compiles the shared conversation scope without product pages', () => {
  const scope = declarations(findRule('[data-smart-conversation]'))
  assert.equal(scope['min-width'], '0px')
  assert.match(scope['font-family'], /Inter, system-ui, sans-serif/)
})

test('styles only applicable conversation fields and keeps specialized inputs excluded', () => {
  const fields = declarations(findRule(fieldSelector))
  assert.equal(fields['min-height'], '2.75rem')
  assert.equal(fields.width, '100%')
  assert.match(fieldSelector, /textarea, select/)

  for (const type of ['checkbox', 'radio', 'file', 'range', 'color', 'hidden']) {
    assert.match(fieldSelector, new RegExp(`:not\\(\\[type='${type}'\\]\\)`))
  }

  const disabled = declarations(findRule(`${fieldSelector}:disabled`))
  assert.equal(disabled.cursor, 'not-allowed')
  assert.ok(disabled['background-color'])
  assert.ok(disabled.color)

  const focus = declarations(findRule(`${fieldSelector}:focus`))
  assert.ok(focus['border-color'])
  assert.ok(focus['box-shadow'])

  const behavioralDeclarations = []
  compiled.walkRules(rule => {
    if (!rule.selector.includes('[data-smart-conversation]')) return
    rule.walkDecls('pointer-events', declaration => behavioralDeclarations.push(declaration.value))
  })
  assert.deepEqual(behavioralDeclarations, [])
})

test('compiles keyboard focus for native and role buttons', () => {
  const selector = "[data-smart-conversation] :where(button, [role='button']):focus-visible"
  const focusVisible = declarations(findRule(selector))
  assert.equal(focusVisible.outline, '2px solid transparent')
  assert.ok(focusVisible['box-shadow'])
  assert.equal(focusVisible['--tw-ring-offset-width'], '2px')
})

test('compiles reduced motion only inside the conversation scope', () => {
  let media
  compiled.walkAtRules('media', rule => {
    if (rule.params === '(prefers-reduced-motion: reduce)') media = rule
  })
  assert.ok(media, 'Expected prefers-reduced-motion media query')

  const expectedSelectors = [
    '[data-smart-conversation] *',
    '[data-smart-conversation] *::before',
    '[data-smart-conversation] *::after',
  ]
  const scopedRule = media.nodes.find(node => node.type === 'rule')
  assert.deepEqual(scopedRule.selectors, expectedSelectors)

  const reducedMotion = declarations(scopedRule)
  assert.equal(reducedMotion['scroll-behavior'], 'auto')
  assert.equal(reducedMotion['animation-duration'], '0.01ms')
  assert.equal(reducedMotion['animation-iteration-count'], '1')
  assert.equal(reducedMotion['transition-duration'], '0.01ms')
  scopedRule.walkDecls(declaration => assert.equal(declaration.important, true))
})
