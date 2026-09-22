import test from 'node:test'
import { TRIAL_OFFERED_PRODUCTS } from '../src/config/productAvailability.js'
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

test('documents the one-time 200 ST trial and separates offered products from economic eligibility', () => {
  assert.deepEqual(TRIAL_OFFERED_PRODUCTS, ['Campanha de Textos', 'Smart Carrossel'])
  assert.match(landing, /TRIAL_OFFERED_LABEL/)
  assert.match(terms, /QUICK_BANNERS_AVAILABLE && <li>Banners Rápidos/)
  for (const source of [terms, landing]) {
    assert.match(source, /200 Smart Tokens/)
    for (const product of ['Campanha de Textos', 'Smart Carrossel']) assert.ok((source === landing ? TRIAL_OFFERED_PRODUCTS.join(', ') : source).includes(product), product)
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

test('describes privacy, testimonials and optional direct social publishing', () => {
  assert.match(privacy, /Google Analytics 4[\s\S]*Cookies analíticos permanecem desativados até sua autorização/)
  assert.match(privacy, /Não utilizamos[\s\S]*Google Tag Manager, Google Signals, remarketing ou personalização de anúncios/)
  assert.match(privacy, /Autenticação com Google, quando escolhida/)
  assert.match(privacy, /Google OAuth, quando habilitado, é usado somente para autenticação/)
  assert.match(privacy, /envio de depoimento é voluntário/)
  assert.match(privacy, /autorização para publicar o texto é separada da autorização para exibir nome e profissão/)
  assert.match(privacy, /500 Smart Tokens/)
  assert.match(privacy, /sem que[\s\S]*o benefício dependa de avaliação positiva e sem obrigação de publicação/)
  assert.match(privacy, /Integração e publicação em redes sociais/)
  assert.match(privacy, /conexão com contas compatíveis do Instagram ou Facebook é opcional/)
  assert.match(privacy, /simples conexão não inicia nem autoriza uma publicação/)
  assert.match(privacy, /identificadores da conta e da Página[\s\S]*autorizações ou tokens de acesso protegidos/)
  assert.match(privacy, /mídia selecionada[\s\S]*legenda final[\s\S]*destino escolhido/)
  assert.match(privacy, /prevenção de duplicidade, segurança e suporte/)
  assert.match(privacy, /compartilhamos[\s\S]*tecnicamente com a Meta apenas os[\s\S]*dados necessários/)
  assert.match(privacy, /revogar as permissões[\s\S]*solicitar a[\s\S]*desconexão[\s\S]*exigir[\s\S]*uma reconexão posterior/)
  assert.doesNotMatch(privacy, /publicação em redes sociais é realizada atualmente pelo próprio usuário/)
})

test('terms govern direct publishing, user responsibility and third-party dependency', () => {
  assert.match(terms, /permitir sua publicação direta no Instagram ou Facebook/)
  assert.match(terms, /Publicação direta em redes sociais/)
  assert.match(terms, /simples conexão da conta não inicia nem autoriza qualquer[\s\S]*publicação/i)
  assert.match(terms, /Cada publicação depende da escolha do conteúdo e do destino e da confirmação do usuário/)
  assert.match(terms, /revisar, editar, substituir ou apagar a legenda/)
  assert.match(terms, /responsável pelo conteúdo final confirmado/)
  assert.match(terms, /autorização para conectar,[\s\S]*contas e Páginas selecionadas/)
  assert.match(terms, /APIs, permissões, regras e disponibilidade da Meta/)
  assert.match(terms, /alterar requisitos[\s\S]*atrasar ou rejeitar publicações[\s\S]*exigir reconexão/)
  assert.match(terms, /não garante a[\s\S]*disponibilidade contínua da integração[\s\S]*permanência da publicação/)
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
