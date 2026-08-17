import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const testDir = dirname(fileURLToPath(import.meta.url))
const frontendDir = join(testDir, '..')
const repositoryDir = join(frontendDir, '..')
const novaCampanha = readFileSync(join(frontendDir, 'src/pages/NovaCampanha.jsx'), 'utf8')
const gerarBanners = readFileSync(join(repositoryDir, 'supabase/functions/gerar-banners/index.ts'), 'utf8')
const renderStatus = readFileSync(join(repositoryDir, 'supabase/functions/get-render-status/index.ts'), 'utf8')
const gerarAnuncios = novaCampanha.slice(
  novaCampanha.indexOf('const gerarAnuncios = async () => {'),
  novaCampanha.indexOf('\n  const copiar =', novaCampanha.indexOf('const gerarAnuncios = async () => {')),
)
const generationCatch = gerarAnuncios.slice(gerarAnuncios.lastIndexOf('} catch'))

test('falha de sessão acontece antes de upload ou Edge Functions', () => {
  const sessionGuard = gerarAnuncios.indexOf('if (!userId || !token)')
  assert.ok(sessionGuard > -1)
  assert.ok(sessionGuard < gerarAnuncios.indexOf('uploadComTimeout'))
  assert.ok(sessionGuard < gerarAnuncios.indexOf("functions.invoke('gerar-campanha'"))
})

test('falha de upload mantém o contrato existente de no máximo duas tentativas e segue o fluxo', () => {
  assert.match(gerarAnuncios, /tentativa = 1; tentativa <= 2; tentativa\+\+/)
  assert.match(gerarAnuncios, /if \(url\) fotos_urls\.push\(url\)/)
})

test('falha em gerar-campanha impede a execução visual após a preparação econômica', () => {
  const economicPreparation = gerarAnuncios.indexOf("invokeBanners('prepare')")
  const campaignInvoke = gerarAnuncios.indexOf("functions.invoke('gerar-campanha'")
  const campaignValidation = gerarAnuncios.indexOf("if (!campaignData) throw new Error")
  const bannerExecution = gerarAnuncios.indexOf("await Promise.allSettled([invokeBanners('execute', economyClaimToken)])")
  assert.ok(economicPreparation > -1 && campaignInvoke > economicPreparation && campaignValidation > campaignInvoke)
  assert.ok(bannerExecution > campaignValidation)
})

test('falha em gerar-banners preserva o resultado textual já exibido', () => {
  const result = gerarAnuncios.indexOf('setResultado(camp)')
  const bannerExecution = gerarAnuncios.indexOf("await Promise.allSettled([invokeBanners('execute', economyClaimToken)])")
  const bannerFailureNotice = gerarAnuncios.indexOf('Textos IA gerados. Materiais visuais não foram iniciados agora')
  assert.ok(result > -1 && bannerExecution > result && bannerFailureNotice > bannerExecution)
})

test('falhas depois da reserva de Smart Tokens possuem rotas explícitas de cancelamento', () => {
  const reserve = gerarBanners.indexOf("rpc('reserve_credits'")
  for (const reason of [
    'creatomate_create_failed',
    'creatomate_empty_response',
    'creatomate_missing_render_id',
    'creatomate_create_error',
    'nenhum_render_criado',
    'erro_inesperado',
  ]) {
    assert.ok(gerarBanners.indexOf(`cancelPieceReservations`, reserve) > reserve)
    assert.match(gerarBanners, new RegExp(reason))
  }
})

test('estorno usa a RPC de cancelamento e sucesso usa consumo da reserva', () => {
  assert.match(gerarBanners, /rpc\('cancel_credit_reservation'/)
  assert.match(renderStatus, /rpc\('cancel_credit_reservation'/)
  assert.match(renderStatus, /rpc\('consume_reserved_credits'/)
})

test('erro de geração preserva dados preenchidos e imagens selecionadas', () => {
  assert.doesNotMatch(generationCatch, /setFotos\(|resetCampaignState\(|setResultado\(null\)/)
  assert.match(generationCatch, /setGenerationError\(CAMPAIGN_GENERATION_ERROR\)/)
})

test('erro de geração não retorna automaticamente para fase form', () => {
  assert.doesNotMatch(generationCatch, /setFase\('form'\)/)
  assert.match(novaCampanha, /Voltar e revisar dados/)
})

test('ref síncrona e estado visual protegem contra duplo clique', () => {
  assert.match(gerarAnuncios, /if \(generationInFlightRef\.current\) return/)
  assert.match(gerarAnuncios, /generationInFlightRef\.current = true/)
  assert.match(generationCatch, /generationInFlightRef\.current = false/)
  assert.match(novaCampanha, /onClick=\{gerarAnuncios\} disabled=\{generationInFlight\}/)
})

test('erro não agenda uma segunda chamada automática', () => {
  assert.doesNotMatch(generationCatch, /gerarAnuncios\(|invokeBanners\(|functions\.invoke\(/)
  assert.doesNotMatch(generationCatch, /setTimeout\(|setInterval\(/)
})

test('fluxo de sucesso continua publicando resultado e fase resultado', () => {
  assert.match(gerarAnuncios, /setResultado\(camp\)/)
  assert.match(gerarAnuncios, /setCampanhaId\(camp\.id \|\| null\)/)
  assert.match(gerarAnuncios, /setFase\('resultado'\)/)
})

test('banners solicitados permanecem pending enquanto a resposta visual ainda não chegou', () => {
  const resultView = novaCampanha.slice(novaCampanha.indexOf("{fase === 'resultado'"))
  const statusExpression = resultView.match(/const missingVisualPieceStatus = (.+)/)?.[1]

  assert.ok(statusExpression)
  const resolveStatus = new Function('gerandoBanners', 'renders', `return ${statusExpression}`)
  assert.equal(resolveStatus(true, null), 'pending')
  assert.equal(resolveStatus(false, null), 'pending')
  assert.equal(resolveStatus(false, []), 'failed')
  assert.match(resultView, /missingStatus: missingVisualPieceStatus/)
})

test('teste é somente textual e não contém clientes ou chamadas reais de provedores', () => {
  const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const imports = ownSource.match(/^import .*$/gm) || []
  assert.ok(imports.length > 0)
  assert.ok(imports.every(line => line.includes("from 'node:")))
})
