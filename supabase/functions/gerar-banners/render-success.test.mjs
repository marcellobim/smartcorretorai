import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(testDir, 'index.ts'), 'utf8')
const successLoopStart = source.indexOf('for (const item of items) {')
const successPushStart = source.indexOf('renders.push({', successLoopStart)
const successSetup = source.slice(successLoopStart, successPushStart)
const successDeclarations = [
  successSetup.match(/const initialStatus[^\r\n]+/)?.[0],
  successSetup.match(/const initialReady[^\r\n]+/)?.[0],
  successSetup.match(/const initialFinalUrl[^\r\n]+/)?.[0],
].filter(Boolean).join('\n')
const failedResponseBlock = source.slice(source.indexOf('if (!createRes.ok) {'), source.indexOf('const body = await createRes.json()'))

test('resposta válida do Creatomate prepara o render sem ReferenceError ou failed artificial', () => {
  assert.ok(successLoopStart > -1)
  assert.ok(successPushStart > successLoopStart)
  assert.match(successSetup, /const initialStatus = String\(item\.status \|\| 'planned'\)\.toLocaleLowerCase\('pt-BR'\)/)
  assert.match(successSetup, /const initialReady = initialStatus === 'succeeded' \|\| initialStatus === 'completed'/)
  assert.match(successSetup, /const initialFinalUrl = initialReady && typeof item\.url === 'string' \? item\.url : null/)
  assert.doesNotMatch(failedResponseBlock, /initialStatus|initialReady|initialFinalUrl/)

  assert.equal(successDeclarations.split('\n').length, 3)
  const processValidItem = new Function('item', `
    ${successDeclarations}
    return { render_id: item.id, status: initialStatus, url: initialFinalUrl }
  `)
  const render = processValidItem({
    id: 'render-valid-123',
    status: 'succeeded',
    url: 'https://example.test/render.jpg',
  })

  assert.deepEqual(render, {
    render_id: 'render-valid-123',
    status: 'succeeded',
    url: 'https://example.test/render.jpg',
  })
  assert.notEqual(render.status, 'failed')
})
