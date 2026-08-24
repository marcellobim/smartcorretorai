import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const terms = read('src/pages/TermosDeUso.jsx')
const privacy = read('src/pages/Privacidade.jsx')
const landing = read('src/pages/LandingPage.jsx')
const dashboard = read('src/pages/Dashboard.jsx')
const plans = read('src/pages/Planos.jsx')
const app = read('src/App.jsx')
const register = read('src/pages/RegisterPage.jsx')

test('documents the current one-time 200 ST trial and exact product allowlist', () => {
  for (const source of [terms, landing]) {
    assert.match(source, /200 Smart Tokens/)
    for (const product of ['Campanha de Textos', 'Banners Rápidos', 'Smart Carrossel']) assert.ok(source.includes(product), product)
  }
  assert.match(terms, /única concessão/)
  assert.match(terms, /Após confirmar o e-mail/)
  assert.match(terms, /sem necessidade de cartão/)
  assert.match(terms, /O benefício não expira/)
  assert.match(terms, /resultados entregues podem ser copiados, baixados e utilizados normalmente/)
  assert.doesNotMatch(`${terms}\n${landing}`, /uma campanha demonstrativa|trial.{0,40}25 ST|vídeos e apresentações|banners e imagens geradas por IA/i)
})

test('discloses the 30-day recharge validity consistently before purchase', () => {
  assert.match(dashboard, /comprados em recargas têm validade de 30 dias/)
  assert.match(plans, /Validade: 30 dias/)
  assert.match(plans, /Cada recarga tem validade de 30 dias a partir da compra/)
  assert.match(terms, /Smart Tokens comprados em recargas expiram em 30 dias/)
  assert.doesNotMatch(dashboard, /comprados separadamente, fora do plano, não expiram/)
})

test('uses the current download-and-save policy without a public 24-hour promise', () => {
  for (const source of [terms, privacy, dashboard]) {
    assert.match(source, /não oferece galeria ou armazenamento permanente/i)
    assert.doesNotMatch(source, /até 24 horas|disponíveis por 24 horas|disponibilidade.{0,20}24h/i)
  }
  assert.match(terms, /baixar[\s\S]*conservar em seu computador ou celular/)
  assert.match(privacy, /baixar[\s\S]*guardar os resultados/)
})

test('describes current privacy, testimonials and manual social sharing', () => {
  assert.match(privacy, /não utiliza Google Analytics, GA4 ou[\s\S]*Google Tag Manager/)
  assert.match(privacy, /não oferece login com Google nesta versão/)
  assert.match(privacy, /envio de depoimento é voluntário/)
  assert.match(privacy, /autorização para publicar o texto é separada da autorização para exibir nome e profissão/)
  assert.match(privacy, /500 Smart Tokens/)
  assert.match(privacy, /sem que[\s\S]*o benefício dependa de avaliação positiva e sem obrigação de publicação/)
  assert.match(privacy, /publicação em redes sociais é realizada atualmente pelo próprio usuário/)
  assert.doesNotMatch(privacy, /Integrações com Redes Sociais|ferramentas de analytics|Meta, Google e redes sociais/)
})

test('keeps age, rights, review and acceptance protections explicit', () => {
  assert.match(terms, /ter no mínimo 18 anos/)
  assert.match(privacy, /não é destinada a menores de 18 anos/)
  assert.match(terms, /direitos, licenças ou autorizações necessários/)
  assert.match(terms, /Todo resultado deve ser revisado pelo usuário antes da publicação ou uso/)
  assert.match(register, /Aceite os termos para continuar/)
  assert.match(register, /Termos de Uso/)
  assert.match(register, /Política de Privacidade/)
})

test('removes obsolete public contacts, product names and experimental routes', () => {
  const active = `${terms}\n${privacy}\n${landing}\n${dashboard}\n${plans}`
  assert.doesNotMatch(active, /suporte@smartcorretorai\.com\.br|\bVirtual Space\b|app\.smartcorretor\.ai|maio de 2026/)
  assert.match(active, /suporte@smartcorretorai\.com/)
  assert.doesNotMatch(app, /home-frankenstein|home-opus|HomeFrankenstein|HomeOpusExperiment/)
})
