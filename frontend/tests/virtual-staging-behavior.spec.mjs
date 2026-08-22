import { test, expect } from '@playwright/test'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const mocksRoot = path.join(frontendRoot, 'tests', 'virtual-staging-behavior')
let server
let baseUrl

function testModuleMocks() {
  const replacements = new Map([
    ['supabase', path.join(mocksRoot, 'mock-supabase.js')],
    ['auth-context', path.join(mocksRoot, 'mock-auth-context.js')],
    ['download-file', path.join(mocksRoot, 'mock-download-file.js')],
  ])
  return {
    name: 'virtual-staging-test-module-mocks',
    enforce: 'pre',
    resolveId(source) {
      for (const [name, replacement] of replacements) {
        if (source.replaceAll('\\', '/').endsWith(`/lib/${name}`)) return replacement
      }
      return null
    },
  }
}

test.beforeAll(async () => {
  server = await createServer({
    root: frontendRoot,
    configFile: false,
    plugins: [testModuleMocks(), react()],
    server: { host: '127.0.0.1', port: 0, strictPort: false, fs: { allow: [repositoryRoot] } },
  })
  await server.listen()
  const address = server.httpServer.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  await server?.close()
})

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${baseUrl}/tests/virtual-staging-behavior/`)
  await page.evaluate(() => globalThis.__virtualStagingMocks.reset())
})

async function chooseModule(page, position) {
  await page.getByRole('button', { name: 'Escolher módulo' }).nth(position).click()
}

async function openFurnishFlow(page) {
  await chooseModule(page, 0)
  await page.getByRole('button', { name: 'Começar' }).click()
  await page.getByRole('button', { name: 'Mobiliar ambientes vazios ou quase vazios' }).click()
  await page.getByRole('button', { name: 'Escandinavo' }).click()
}

function imageFile(name = 'ambiente.jpg') {
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }
}

async function reachReview(page, files = [imageFile()]) {
  await openFurnishFlow(page)
  await page.locator('input[type="file"][multiple]').setInputFiles(files)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Instagram' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('Revise seu projeto')).toBeVisible()
}

async function mockCounts(page) {
  return await page.evaluate(() => ({
    uploads: globalThis.__virtualStagingMocks.uploads.length,
    invocations: globalThis.__virtualStagingMocks.invocations.length,
    signedUrls: globalThis.__virtualStagingMocks.signedUrls.length,
    downloads: globalThis.__virtualStagingMocks.downloads.length,
  }))
}

test('zero imagens permanece no upload sem permitir revisão ou geração', async ({ page }) => {
  await openFurnishFlow(page)
  await expect(page.getByText('Envie as fotos do imóvel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0)
  await expect(page.getByText('Revise seu projeto')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Gerar Virtual Staging' })).toHaveCount(0)
  expect(await mockCounts(page)).toEqual({ uploads: 0, invocations: 0, signedUrls: 0, downloads: 0 })
})

test('uma imagem habilita a geração sem mensagem temporária', async ({ page }) => {
  await reachReview(page)
  await expect(page.getByRole('button', { name: 'Gerar Virtual Staging' })).toBeEnabled()
  await expect(page.getByText('Esta primeira versão de validação processa uma imagem por vez.')).toHaveCount(0)
})

test('clique duplo gera um upload, uma invocação e payload mínimo', async ({ page }) => {
  await reachReview(page)
  await page.evaluate(() => { globalThis.__virtualStagingMocks.invokeMode = 'pending' })
  const generate = page.getByRole('button', { name: 'Gerar Virtual Staging' })
  await generate.evaluate(button => { button.click(); button.click() })

  await expect(page.getByText('Criando seu Virtual Staging')).toBeVisible()
  await expect(page.getByText('Estamos analisando e transformando cada ambiente.')).toBeVisible()
  await expect(page.getByText('Processando imagem 1 de 1')).toBeVisible()
  await expect(page.getByText(/\d+%/)).toHaveCount(0)

  const state = await page.evaluate(() => ({
    uploads: globalThis.__virtualStagingMocks.uploads,
    invocations: globalThis.__virtualStagingMocks.invocations,
  }))
  expect(state.uploads).toHaveLength(1)
  expect(state.invocations).toHaveLength(1)
  expect(state.uploads[0].bucket).toBe('studio-videos')
  expect(state.uploads[0].path).toMatch(/^11111111-1111-4111-8111-111111111111\/virtual-staging-images\/inputs\/[0-9a-f-]{36}\/01\.jpg$/)
  expect(state.uploads[0].path).not.toContain('/virtual-staging/')
  expect(state.invocations[0].name).toBe('virtual-staging-image-test')
  expect(state.invocations[0].options.body).toEqual({
    module: 'furnish-renovate',
    input_path: state.uploads[0].path,
    transformation_type: 'empty_or_nearly_empty',
    decoration_style: 'scandinavian',
  })
  expect(Object.keys(state.invocations[0].options.body).sort()).toEqual(['decoration_style', 'input_path', 'module', 'transformation_type'])
})

test('sucesso cria URL temporária, mostra Antes/Depois, baixa somente a transformada e limpa o projeto', async ({ page }) => {
  await reachReview(page)
  await page.getByRole('button', { name: 'Gerar Virtual Staging' }).click()

  const result = page.locator('section[aria-labelledby="virtual-staging-result-title"]')
  await expect(result.getByText('Seu Virtual Staging está pronto')).toBeVisible()
  await expect(result.getByText('Antes', { exact: true })).toBeVisible()
  await expect(result.getByText('Depois', { exact: true })).toBeVisible()
  await expect(result.getByAltText('Imagem original 1')).toBeVisible()
  await expect(result.getByAltText('Imagem transformada 1')).toHaveAttribute('src', 'https://signed.test/generated-01.jpg?token=temporary')
  expect((await mockCounts(page)).signedUrls).toBe(1)
  const [signedResult] = await page.evaluate(() => globalThis.__virtualStagingMocks.signedUrls)
  expect(signedResult).toEqual({
    bucket: 'studio-videos',
    path: '11111111-1111-4111-8111-111111111111/virtual-staging-images/results/22222222-2222-4222-8222-222222222222/generated-01.jpg',
    expiresIn: 600,
  })
  expect(signedResult.path).not.toContain('/virtual-staging/')

  await page.getByRole('button', { name: 'Baixar imagem transformada' }).click()
  const downloads = await page.evaluate(() => globalThis.__virtualStagingMocks.downloads)
  expect(downloads).toEqual([{ url: 'https://signed.test/generated-01.jpg?token=temporary', filename: 'virtual-staging-01.jpg' }])

  await page.getByRole('button', { name: 'Criar novo projeto' }).click()
  await expect(page.getByRole('button', { name: 'Começar' })).toBeVisible()
  await expect(page.getByText('Seu Virtual Staging está pronto')).toHaveCount(0)
})

test('falha única é amigável, não expõe detalhes e não possui retry automático', async ({ page }) => {
  await reachReview(page)
  await page.evaluate(() => { globalThis.__virtualStagingMocks.invokeMode = 'error' })
  await page.getByRole('button', { name: 'Gerar Virtual Staging' }).click()

  await expect(page.getByText('Algumas imagens não puderam ser concluídas.')).toBeVisible()
  await expect(page.getByText('Não foi possível transformar esta imagem.')).toBeVisible()
  await expect(page.getByText(/external_secret_error_body|technical_remote_failure/)).toHaveCount(0)
  await page.waitForTimeout(200)
  expect(await mockCounts(page)).toEqual({ uploads: 1, invocations: 1, signedUrls: 0, downloads: 0 })
})

test('três imagens geram três uploads e três invocações estritamente sequenciais', async ({ page }) => {
  await reachReview(page, [imageFile('sala.jpg'), imageFile('quarto.jpg'), imageFile('cozinha.jpg')])
  await page.evaluate(() => { globalThis.__virtualStagingMocks.invokeDelayMs = 10 })
  await page.getByRole('button', { name: 'Gerar Virtual Staging' }).click()
  await expect(page.getByText('Seu Virtual Staging está pronto')).toBeVisible()

  const state = await page.evaluate(() => ({
    uploads: globalThis.__virtualStagingMocks.uploads,
    invocations: globalThis.__virtualStagingMocks.invocations,
    events: globalThis.__virtualStagingMocks.events,
    maxConcurrentInvocations: globalThis.__virtualStagingMocks.maxConcurrentInvocations,
  }))
  expect(state.uploads).toHaveLength(3)
  expect(state.invocations).toHaveLength(3)
  expect(state.maxConcurrentInvocations).toBe(1)
  expect(state.events).toEqual([
    'upload:01', 'invoke-start:01', 'invoke-end:01', 'signed:01',
    'upload:02', 'invoke-start:02', 'invoke-end:02', 'signed:02',
    'upload:03', 'invoke-start:03', 'invoke-end:03', 'signed:03',
  ])
  expect(state.invocations.map(item => item.options.body.input_path.match(/\/(\d{2})\./)[1])).toEqual(['01', '02', '03'])
  for (const invocation of state.invocations) {
    expect(invocation.name).toBe('virtual-staging-image-test')
    expect(Object.keys(invocation.options.body).sort()).toEqual(['decoration_style', 'input_path', 'module', 'transformation_type'])
  }
})

test('cinco imagens geram exatamente cinco uploads, invocações e URLs assinadas sem concorrência', async ({ page }) => {
  await reachReview(page, Array.from({ length: 5 }, (_, index) => imageFile(`foto-${index + 1}.jpg`)))
  await page.getByRole('button', { name: 'Gerar Virtual Staging' }).click()
  await expect(page.getByText('Seu Virtual Staging está pronto')).toBeVisible()
  const state = await page.evaluate(() => ({
    uploads: globalThis.__virtualStagingMocks.uploads.length,
    invocations: globalThis.__virtualStagingMocks.invocations.length,
    signedUrls: globalThis.__virtualStagingMocks.signedUrls.length,
    maxConcurrentInvocations: globalThis.__virtualStagingMocks.maxConcurrentInvocations,
  }))
  expect(state).toEqual({ uploads: 5, invocations: 5, signedUrls: 5, maxConcurrentInvocations: 1 })
  const resultCards = page.locator('article[aria-label^="Resultado da imagem"]')
  await expect(resultCards).toHaveCount(5)
  for (let index = 0; index < 5; index += 1) await resultCards.nth(index).getByRole('button', { name: 'Baixar imagem transformada' }).click()
  expect(await page.evaluate(() => globalThis.__virtualStagingMocks.downloads)).toEqual(Array.from({ length: 5 }, (_, index) => ({
    url: `https://signed.test/generated-${String(index + 1).padStart(2, '0')}.jpg?token=temporary`,
    filename: `virtual-staging-${String(index + 1).padStart(2, '0')}.jpg`,
  })))
  expect((await mockCounts(page)).invocations).toBe(5)
})

test('sexta imagem é rejeitada sem alterar as cinco já selecionadas ou chamar backend', async ({ page }) => {
  await openFurnishFlow(page)
  await page.locator('input[type="file"][multiple]').setInputFiles(Array.from({ length: 5 }, (_, index) => imageFile(`foto-${index + 1}.jpg`)))
  await expect(page.getByText('5 de 5 imagens adicionadas')).toBeVisible()

  await page.locator('input[type="file"][multiple]').setInputFiles(imageFile('sexta.jpg'))
  await expect(page.getByText('Você pode enviar no máximo 5 imagens.')).toBeVisible()
  await expect(page.getByText('5 de 5 imagens adicionadas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remover foto 5' })).toBeVisible()
  expect(await mockCounts(page)).toEqual({ uploads: 0, invocations: 0, signedUrls: 0, downloads: 0 })
})

test('falha da imagem 2 não repete cobrança, preserva 1 e processa 3 uma vez', async ({ page }) => {
  await reachReview(page, [imageFile('um.jpg'), imageFile('dois.jpg'), imageFile('tres.jpg')])
  await page.evaluate(() => { globalThis.__virtualStagingMocks.failedInvocationIndexes = [2] })
  await page.getByRole('button', { name: 'Gerar Virtual Staging' }).click()

  await expect(page.getByText('Algumas imagens não puderam ser concluídas.')).toBeVisible()
  await expect(page.locator('article[aria-label^="Resultado da imagem"]')).toHaveCount(2)
  await expect(page.getByLabel('Falha na imagem 2')).toBeVisible()
  const state = await page.evaluate(() => ({
    paths: globalThis.__virtualStagingMocks.invocations.map(item => item.options.body.input_path),
    signedUrls: globalThis.__virtualStagingMocks.signedUrls.length,
    maxConcurrentInvocations: globalThis.__virtualStagingMocks.maxConcurrentInvocations,
  }))
  expect(state.paths).toHaveLength(3)
  expect(state.paths.filter(path => /\/02\./.test(path))).toHaveLength(1)
  expect(state.signedUrls).toBe(2)
  expect(state.maxConcurrentInvocations).toBe(1)
})

test('ordem visual e downloads permanecem associados ao índice original', async ({ page }) => {
  await reachReview(page, [imageFile('primeira.jpg'), imageFile('segunda.jpg'), imageFile('terceira.jpg')])
  await page.getByRole('button', { name: 'Gerar Virtual Staging' }).click()
  await expect(page.getByText('Seu Virtual Staging está pronto')).toBeVisible()

  const cards = page.locator('article[aria-label^="Resultado da imagem"]')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toHaveAttribute('aria-label', 'Resultado da imagem 1')
  await expect(cards.nth(1)).toHaveAttribute('aria-label', 'Resultado da imagem 2')
  await expect(cards.nth(2)).toHaveAttribute('aria-label', 'Resultado da imagem 3')
  for (let index = 0; index < 3; index += 1) await cards.nth(index).getByRole('button', { name: 'Baixar imagem transformada' }).click()
  expect(await page.evaluate(() => globalThis.__virtualStagingMocks.downloads)).toEqual([
    { url: 'https://signed.test/generated-01.jpg?token=temporary', filename: 'virtual-staging-01.jpg' },
    { url: 'https://signed.test/generated-02.jpg?token=temporary', filename: 'virtual-staging-02.jpg' },
    { url: 'https://signed.test/generated-03.jpg?token=temporary', filename: 'virtual-staging-03.jpg' },
  ])
  expect((await mockCounts(page)).invocations).toBe(3)
})

test('refresh não restaura resultado nem job de vídeo do furnish-renovate', async ({ page }) => {
  await reachReview(page)
  await page.getByRole('button', { name: 'Gerar Virtual Staging' }).click()
  await expect(page.getByText('Seu Virtual Staging está pronto')).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('smartcorretorai:virtual-staging:furnish-renovate:active-job', JSON.stringify({ jobId: 'legacy-video-job', status: 'generating', updatedAt: Date.now() })))

  await page.reload()
  await expect(page.getByText('Seu Virtual Staging está pronto')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Começar' })).toHaveCount(0)
  expect((await mockCounts(page)).invocations).toBe(0)
})

test('Vida no Imóvel e Apresentação pelo Corretor permanecem fora da função de imagem', async ({ page }) => {
  await chooseModule(page, 1)
  await expect(page.getByText('Envie até 5 fotos na ordem em que deseja apresentá-las.')).toBeVisible()
  expect((await mockCounts(page)).invocations).toBe(0)

  await page.getByRole('button', { name: 'Escolher outro módulo' }).click()
  await chooseModule(page, 2)
  await expect(page.getByText('Deseja utilizar sua própria imagem como referência para apresentar o imóvel?')).toBeVisible()
  expect((await mockCounts(page)).invocations).toBe(0)
})

test('mini carrossel mantém os assets Antes/Depois e continua interativo', async ({ page }) => {
  const sources = await page.locator('img[alt="Ambiente antes do Virtual Staging"], img[alt="Ambiente depois do Virtual Staging"]').evaluateAll(images => images.map(image => image.getAttribute('src')))
  expect(sources.some(source => source.includes('virtual-staging-before'))).toBe(true)
  expect(sources.some(source => source.includes('virtual-staging-after'))).toBe(true)
  const carousel = page.getByRole('button', { name: 'Exibir Depois no Virtual Staging' }).first()
  await carousel.click()
  await expect(page.getByRole('button', { name: 'Exibir Antes no Virtual Staging' }).first()).toBeVisible()
})
