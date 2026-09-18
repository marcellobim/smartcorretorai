import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

test('guest metrics recover from unavailable backend and ignore stale period responses', async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import Metrics from './src/components/AdminGuestBannerMetrics.jsx';
        const root = createRoot(document.getElementById('root')); window.renderMetrics = (period, revision = 0) => root.render(<Metrics period={period} revision={revision} />);`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx',
    },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    plugins: [{ name: 'admin-request-fixture', setup(builder) {
      builder.onResolve({ filter: /lib\/admin-api$/ }, () => ({ path: 'admin-api', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const adminRequest = (...args) => new Promise((resolve, reject) => window.requests.push({args, resolve, reject}));` }))
    } }],
  })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent('<div id="root"></div>')
    await page.evaluate(() => { window.requests = [] })
    await page.addScriptTag({ content: result.outputFiles[0].text })
    await page.evaluate(() => window.renderMetrics(30))
    await page.waitForFunction(() => window.requests.length === 1)
    assert.equal(await page.getByText('Carregando…', { exact: true }).count(), 9)
    await page.evaluate(() => window.requests[0].reject(new Error('backend unavailable')))
    await page.getByRole('button', { name: 'Tentar novamente' }).waitFor()
    assert.equal(await page.getByText('Indisponível', { exact: true }).count(), 9)
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await page.waitForFunction(() => window.requests.length === 2)
    await page.evaluate(() => window.renderMetrics(7))
    await page.waitForFunction(() => window.requests.length === 3)
    await page.evaluate(() => window.requests[1].resolve({ metrics: { requests: 999 } }))
    assert.equal(await page.getByText('999', { exact: true }).count(), 0)
    await page.evaluate(() => window.requests[2].resolve({ metrics: { requests: 0, completed: 2 } }))
    await page.getByText('0', { exact: true }).waitFor()
    assert.equal(await page.getByText('2', { exact: true }).count(), 1)
    assert.equal(await page.getByText('Indisponível', { exact: true }).count(), 7)
    await page.evaluate(() => window.renderMetrics(7, 1))
    await page.waitForFunction(() => window.requests.length === 4)
    assert.deepEqual(await page.evaluate(() => window.requests[3].args), ['guest_banner_metrics', { period: 7 }])
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})

test('Admin metrics and client activity remain usable at mobile and desktop widths', async () => {
  const source = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8')
  const component = readFileSync(new URL('../src/components/AdminGuestBannerMetrics.jsx', import.meta.url), 'utf8')
  const css = await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: source + component, extension: 'jsx' }] })])
    .process(readFileSync(new URL('../src/index.css', import.meta.url), 'utf8'), { from: undefined })
  const result = await build({
    stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import Admin from './src/pages/AdminDashboard.jsx'; createRoot(document.getElementById('root')).render(<Admin />);`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    plugins: [{ name: 'admin-fixture', setup(builder) {
      builder.onResolve({ filter: /lib\/admin-api$/ }, () => ({ path: 'admin-api', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export async function adminRequest(action, input) {
        window.calls.push({action,input});
        if (action === 'overview') throw new Error('isolated failure');
        if (action === 'guest_banner_metrics') return {metrics:{landingStarts:5,bannerStarts:4,requests:3,completed:2,failed:1,reserved:0,dispatching:0,unknown:0,cancelled:0}};
        if (action === 'list_clients') return {clients:[{id:'fixture',name:'Cliente de teste',email:'teste@example.invalid',plan:'FREE',subscriptionStatus:'sem_assinatura',catalogAccess:'trial',smartTokenBalance:0}],pagination:{page:1,total:1,totalPages:1}};
        if (action === 'get_client') return new Promise(() => {});
      }` }))
    } }],
  })
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('http://localhost/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }))
      await page.goto('http://localhost/admin')
      await page.evaluate(() => { window.calls = [] })
      await page.addStyleTag({ content: css.css })
      await page.addScriptTag({ content: result.outputFiles[0].text })
      await page.getByText('Concluídos', { exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelector('[aria-busy="false"]'))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.getByRole('button', { name: 'Clientes', exact: true }).click()
      const button = page.getByRole('button', { name: 'Ver atividades de Cliente de teste' })
      await button.waitFor()
      const box = await button.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width, 'activity action visible without horizontal scroll')
      await button.click()
      assert.ok(await page.evaluate(() => window.calls.some(call => call.action === 'get_client' && call.input.userId === 'fixture')))
      assert.deepEqual(errors, [])
      await page.close()
    }
  } finally { await browser.close() }
})
