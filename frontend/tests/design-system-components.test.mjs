import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const element = React.createElement
let vite
let ProductButton
let ProductHero
let ProductSteps
let ProductSummary

before(async () => {
  vite = await createServer({
    root: frontendRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;[
    { default: ProductButton },
    { default: ProductHero },
    { default: ProductSteps },
    { default: ProductSummary },
  ] = await Promise.all([
    vite.ssrLoadModule('/src/components/design-system/ProductButton.jsx'),
    vite.ssrLoadModule('/src/components/design-system/ProductHero.jsx'),
    vite.ssrLoadModule('/src/components/design-system/ProductSteps.jsx'),
    vite.ssrLoadModule('/src/components/design-system/ProductSummary.jsx'),
  ])
})

after(async () => {
  await vite?.close()
})

test('ProductButton renders every variant and keeps the primary fallback', () => {
  const variants = {
    primary: 'bg-primary-800',
    secondary: 'bg-white',
    success: 'bg-emerald-700',
    danger: 'text-rose-700',
    inverse: 'bg-white/10',
    ghost: 'bg-transparent',
    unknown: 'bg-primary-800',
  }

  for (const [variant, expectedClass] of Object.entries(variants)) {
    const markup = renderToStaticMarkup(element(ProductButton, { variant }, variant))
    assert.match(markup, new RegExp(expectedClass.replace('/', '\\/')))
  }
})

test('ProductButton keeps native button semantics while loading or disabled', () => {
  const loadingMarkup = renderToStaticMarkup(element(
    ProductButton,
    { loading: true, 'aria-busy': false },
    element('span', null, 'Gerar campanha'),
  ))
  assert.match(loadingMarkup, /^<button/)
  assert.match(loadingMarkup, /disabled=""/)
  assert.match(loadingMarkup, /aria-busy="true"/)
  assert.match(loadingMarkup, /animate-spin/)
  assert.match(loadingMarkup, /<span>Gerar campanha<\/span>/)

  const disabledMarkup = renderToStaticMarkup(element(ProductButton, { disabled: true }, 'Continuar'))
  assert.match(disabledMarkup, /disabled=""/)
  assert.doesNotMatch(disabledMarkup, /aria-busy=/)

  const callerBusyMarkup = renderToStaticMarkup(element(ProductButton, { 'aria-busy': true }, 'Processando'))
  assert.match(callerBusyMarkup, /aria-busy="true"/)
})

test('ProductButton prevents disabled and loading links from activating', () => {
  for (const state of [{ disabled: true }, { loading: true }]) {
    let receivedProps
    let consumerClicks = 0
    const CaptureLink = props => {
      receivedProps = props
      const { children, to, ...anchorProps } = props
      return element('a', { ...anchorProps, href: to }, children)
    }

    const markup = renderToStaticMarkup(element(
      ProductButton,
      { as: CaptureLink, to: '/destino', onClick: () => { consumerClicks += 1 }, ...state },
      'Abrir destino',
    ))
    assert.equal(receivedProps.disabled, undefined)
    assert.equal(receivedProps['aria-disabled'], true)
    assert.equal(receivedProps.tabIndex, -1)
    assert.match(markup, /aria-disabled="true"/)
    assert.match(markup, /tabindex="-1"/)
    assert.match(markup, /Abrir destino/)

    const event = {
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true },
      stopPropagation() { this.propagationStopped = true },
    }
    receivedProps.onClick(event)
    assert.equal(event.defaultPrevented, true)
    assert.equal(event.propagationStopped, true)
    assert.equal(consumerClicks, 0)
  }

  const anchorMarkup = renderToStaticMarkup(element(ProductButton, {
    as: 'a',
    href: '/destino',
    disabled: true,
  }, 'Link nativo'))
  assert.match(anchorMarkup, /^<a/)
  assert.match(anchorMarkup, /aria-disabled="true"/)
  assert.match(anchorMarkup, /tabindex="-1"/)
  assert.match(anchorMarkup, /cursor-not-allowed opacity-50/)
  assert.doesNotMatch(anchorMarkup, /\sdisabled=/)
})

test('ProductButton preserves active link navigation handlers', () => {
  let receivedProps
  let consumerClicks = 0
  const CaptureLink = props => {
    receivedProps = props
    const { children, to, ...anchorProps } = props
    return element('a', { ...anchorProps, href: to }, children)
  }
  renderToStaticMarkup(element(ProductButton, {
    as: CaptureLink,
    to: '/destino',
    tabIndex: 2,
    onClick: () => { consumerClicks += 1 },
  }, 'Abrir destino'))

  const event = { preventDefault() {}, stopPropagation() {} }
  receivedProps.onClick(event)
  assert.equal(receivedProps['aria-disabled'], undefined)
  assert.equal(receivedProps.tabIndex, 2)
  assert.equal(consumerClicks, 1)
})

test('ProductHero preserves the legacy title and highlight hierarchy', () => {
  const markup = renderToStaticMarkup(element(ProductHero, {
    id: 'legacy-title',
    eyebrow: 'SmartCorretorAI',
    title: 'Título legado',
    highlight: 'Destaque legado',
    description: 'Descrição legada',
  }))
  assert.match(markup, /<h1 id="legacy-title"[^>]*>Título legado<span[^>]*>Destaque legado<\/span><\/h1>/)
  assert.doesNotMatch(markup, /<h2/)
  assert.match(markup, /text-slate-950/)
})

test('ProductHero renders the official hierarchy, actions and dark tone', () => {
  const markup = renderToStaticMarkup(element(ProductHero, {
    id: 'official-title',
    productName: 'Studio IA',
    headline: 'Crie apresentações',
    highlight: 'com inteligência artificial',
    tone: 'dark',
    actions: element('button', { type: 'button' }, 'Começar'),
  }))
  assert.match(markup, /<h1 id="official-title"[^>]*>Studio IA<\/h1>/)
  assert.match(markup, /<h2[^>]*>Crie apresentações<span[^>]*>com inteligência artificial<\/span><\/h2>/)
  assert.match(markup, /<button type="button">Começar<\/button>/)
  assert.match(markup, /text-white/)
  assert.match(markup, /text-cyan-300/)
})

test('ProductSteps renders responsive columns for two through five steps', () => {
  for (const count of [2, 3, 4, 5]) {
    const steps = Array.from({ length: count }, (_, index) => `Etapa ${index + 1}`)
    const markup = renderToStaticMarkup(element(ProductSteps, { steps, activeStep: 1 }))
    assert.match(markup, new RegExp(`sm:grid-cols-${count}`))
  }
})

test('ProductSteps applies accents and preserves the unexpected-count fallback', () => {
  const accents = {
    primary: 'bg-primary-700',
    emerald: 'bg-emerald-700',
    violet: 'bg-violet-700',
    unknown: 'bg-primary-700',
  }
  for (const [accent, expectedClass] of Object.entries(accents)) {
    const markup = renderToStaticMarkup(element(ProductSteps, {
      steps: ['Primeira', 'Segunda'],
      activeStep: 1,
      accent,
    }))
    assert.match(markup, new RegExp(expectedClass))
  }

  const fallbackMarkup = renderToStaticMarkup(element(ProductSteps, { steps: ['Única'], activeStep: 1 }))
  assert.match(fallbackMarkup, /sm:grid-cols-5/)
})

test('ProductSummary applies accents, fallback and existing edit semantics', () => {
  const accents = {
    primary: 'text-primary-600',
    emerald: 'text-emerald-600',
    violet: 'text-violet-600',
    unknown: 'text-primary-600',
  }
  for (const [accent, expectedClass] of Object.entries(accents)) {
    const markup = renderToStaticMarkup(element(ProductSummary, {
      accent,
      items: [{ id: 'item-1', label: 'Uma escolha' }],
    }))
    assert.match(markup, new RegExp(expectedClass))
    assert.match(markup, /Uma escolha/)
  }

  const editableMarkup = renderToStaticMarkup(element(ProductSummary, {
    items: [{ id: 'item-1', label: 'Editar escolha' }],
    onEdit: () => {},
    editDisabled: true,
  }))
  assert.match(editableMarkup, /<button[^>]*type="button"[^>]*disabled=""/)

  const emptyMarkup = renderToStaticMarkup(element(ProductSummary, {}))
  assert.match(emptyMarkup, /Resumo da criação/)
  assert.match(emptyMarkup, /Suas escolhas aparecerão aqui durante a criação\./)
})
