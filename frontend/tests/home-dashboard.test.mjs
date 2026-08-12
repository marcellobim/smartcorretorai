import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const dashboard = read('src/pages/Dashboard.jsx')
const footer = read('src/components/layout/AppFooter.jsx')
const app = read('src/App.jsx')
const privacy = read('src/pages/Privacidade.jsx')
const terms = read('src/pages/TermosDeUso.jsx')
const actionSource = dashboard.match(/const mainActions = \[([\s\S]*?)\n\]/)?.[1] || ''
const faqSource = dashboard.match(/const faqItems = \[([\s\S]*?)\n\]/)?.[1] || ''

const expectedProducts = [
  ['smart-tour-ai', 'Vídeo Imobiliário', '/smart-tour-ai'],
  ['hero-ia', 'Banner Imobiliário', '/hero'],
  ['studio-hero', 'Studio IA', '/studio-hero'],
  ['virtual-staging', 'Virtual Space', '/virtual-staging'],
  ['banners-rapidos', 'Banners Rápidos', '/nova-campanha'],
  ['campanha-de-textos', 'Campanha de Textos', '/campanha-de-textos'],
]

test('removes the old Home history, resume and profile blocks', () => {
  assert.doesNotMatch(dashboard, /Continue de onde parou|Criações recentes/i)
  assert.doesNotMatch(dashboard, /function ProfileCard|<ProfileCard|useCampaigns|useAuth|recentCampaigns/)
})

test('starts the soft hero directly with the approved title and support copy', () => {
  assert.doesNotMatch(dashboard, /Criação guiada com IA|Sparkles/)
  assert.match(dashboard, /border-violet-200 bg-gradient-to-br from-violet-100 via-blue-50 to-cyan-100\/90/)
  assert.match(dashboard, /O que vamos criar para o seu imóvel hoje\?/)
  assert.match(dashboard, /vídeos, imagens ou textos, do briefing ao material pronto, sem termos técnicos/)
})

test('renders exactly the six approved primary product cards and routes', () => {
  const ids = [...actionSource.matchAll(/id: '([^']+)'/g)].map(match => match[1])
  assert.deepEqual(ids, expectedProducts.map(([id]) => id))

  for (const [id, title, route] of expectedProducts) {
    assert.match(actionSource, new RegExp(`id: '${id}'[\\s\\S]*?title: '${title}'[\\s\\S]*?to: '${route}'`))
  }
  assert.doesNotMatch(actionSource, /id: 'short-videos'|title: 'Short Videos'|title: 'Virtual Staging'/)
})

test('uses a responsive 3x2 desktop grid and one-column mobile base', () => {
  assert.match(dashboard, /data-home-product-grid[\s\S]*grid[\s\S]*auto-rows-fr[\s\S]*sm:grid-cols-2 xl:grid-cols-3/)
  assert.match(dashboard, /min-w-0/)
  assert.match(dashboard, /w-full[\s\S]*sm:w-fit/)
})

test('removes product icons and differentiates every card with a visible pastel surface', () => {
  assert.doesNotMatch(actionSource, /icon:/)
  assert.doesNotMatch(dashboard, /action\.icon|const Icon = action\.icon/)
  assert.deepEqual([...actionSource.matchAll(/tone: '([^']+)'/g)].map(match => match[1]), [
    'violet', 'mint', 'blue', 'cyan', 'peach', 'gold',
  ])
  for (const tone of ['violet', 'mint', 'blue', 'cyan', 'peach', 'gold']) {
    assert.match(dashboard, new RegExp(`${tone}: '[^']*bg-gradient-to-br[^']*'`))
  }
  assert.match(dashboard, /peach: '[^']*from-orange-50[^']*via-orange-50\/80[^']*to-amber-100\/55/)
  assert.match(dashboard, /gold: '[^']*from-amber-50[^']*via-amber-50\/85[^']*to-yellow-100\/55/)
  assert.match(dashboard, /productTones\[action\.tone\]/)
})

test('keeps every product card equal-height with bottom-aligned actions', () => {
  assert.match(dashboard, /data-home-product-grid[^>]*auto-rows-fr/)
  assert.match(dashboard, /className={`group flex h-full min-w-0 flex-col/)
  assert.match(dashboard, /className={`block h-full min-w-0 rounded-3xl/)
  assert.match(dashboard, /<div className="flex-1">/)
  assert.match(dashboard, /<div className="mt-6 inline-flex min-h-11/)
})

test('widens only the Home and its reusable footer to the approved 92rem maximum', () => {
  assert.match(dashboard, /HOME_PAGE_CLASS = 'mx-auto w-full max-w-\[92rem\]/)
  assert.match(dashboard, /<main className={`\$\{HOME_PAGE_CLASS\} min-w-0`}>/)
  assert.match(footer, /max-w-\[92rem\]/)
})

test('keeps the shared Design System throughout the Home', () => {
  assert.match(dashboard, /ProductCard/)
  assert.match(dashboard, /ProductButton/)
  assert.match(dashboard, /ProductSectionHeading/)
  assert.match(dashboard, /SMART_UI/)
})

test('adds the final twelve practical FAQ questions', () => {
  assert.match(dashboard, /Dúvidas frequentes e uso/)
  const literalQuestions = [
    'Qual produto devo usar para o que preciso criar?',
    'Quais são os planos do SmartCorretorAI?',
    'Posso cancelar minha assinatura quando quiser?',
    'Como publico minhas criações nas redes sociais?',
    'Posso usar minhas criações no WhatsApp, redes sociais e portais imobiliários?',
    'Minhas criações ficam salvas?',
    'O SmartCorretorAI altera meus dados profissionais automaticamente?',
    'Quem é responsável pelas imagens, vídeos e materiais que eu envio?',
    'A inteligência artificial pode cometer erros ou alterar algum detalhe?',
  ]
  for (const question of literalQuestions) assert.ok(faqSource.includes(`question: '${question}'`), question)
  assert.match(faqSource, /question: `Preciso assinar um plano ou posso comprar \$\{SMART_TOKENS_LABEL\}/)
  assert.match(faqSource, /question: `Como funcionam os \$\{SMART_TOKENS_LABEL\}\? E se uma geração der erro\?`/)
  assert.match(faqSource, /question: `Meus \$\{SMART_TOKENS_LABEL\} expiram\?`/)
  assert.equal((faqSource.match(/question:/g) || []).length, 12)
})

test('answers product choice, plans and cancellation before offering shortcuts', () => {
  assert.match(faqSource, /Para vídeos do imóvel, use Vídeo Imobiliário[\s\S]*Banner Imobiliário[\s\S]*Banners Rápidos[\s\S]*Studio IA[\s\S]*Virtual Space[\s\S]*Campanha de Textos/)
  assert.match(faqSource, /planos são indicados principalmente para quem cria com frequência/)
  assert.match(faqSource, /cancelamento pode ser solicitado a qualquer momento, com efeito ao final do período vigente/)
})

test('documents confirmed Smart Token behavior for failures and separate purchases', () => {
  assert.match(faqSource, /geração falha ou não é concluída corretamente[\s\S]*reserva é cancelada[\s\S]*não são consumidos/)
  assert.match(faqSource, /comprados separadamente, fora do plano, não expiram/)
  assert.match(faqSource, /incluídos em assinaturas seguem as condições do ciclo e da oferta contratada/)
})

test('documents manual publishing, compatible channels and the 24-hour retention contract', () => {
  assert.match(faqSource, /baixe a mídia[\s\S]*copie o texto preparado[\s\S]*anexe a imagem ou o vídeo[\s\S]*revise novamente e publique/i)
  assert.match(faqSource, /formato, as dimensões e os requisitos específicos/)
  assert.match(faqSource, /disponível temporariamente por até 24 horas[\s\S]*removida automaticamente/)
  assert.match(faqSource, /Baixe tudo o que deseja guardar[\s\S]*não funciona como galeria ou armazenamento permanente/)
  assert.doesNotMatch(faqSource, /mudar de produto, página ou sessão/)
})

test('explains user responsibility and the need to review AI output', () => {
  assert.match(faqSource, /Você é responsável pelo conteúdo enviado[\s\S]*autorizações ou os direitos necessários/)
  assert.match(faqSource, /IA podem apresentar erros, imprecisões ou variações[\s\S]*Revise as informações do imóvel/)
})

test('keeps native keyboard-accessible FAQ disclosures with reduced motion', () => {
  assert.match(dashboard, /<details/)
  assert.match(dashboard, /<summary/)
  assert.match(dashboard, /SMART_UI\.focus/)
  assert.match(dashboard, /motion-reduce:transition-none/)
})

test('uses only real application routes in Home and footer shortcuts', () => {
  const sources = [dashboard, footer]
  const literalLinks = sources.flatMap(source => [...source.matchAll(/(?:to|to:)[:=]\s*['"]([^'"]+)['"]/g)].map(match => match[1]))
  const baseRoutes = [...new Set([...literalLinks.map(route => route.split('?')[0]), '/planos'])]
  for (const route of baseRoutes) {
    assert.match(app, new RegExp(`path=["']${route.replaceAll('/', '\\/')}["']`), route)
  }
  assert.match(faqSource, /to: '\/configuracoes\?tab=assinatura'/)
  assert.match(faqSource, /to: '\/configuracoes\?tab=perfil'/)
  assert.match(faqSource, /to: '\/termos'/)
})

test('renders the reusable lightweight SaaS footer with legal links and AI warning', () => {
  assert.match(dashboard, /import AppFooter from '\.\.\/components\/layout\/AppFooter'/)
  assert.match(dashboard, /<AppFooter \/>/)
  assert.match(footer, /data-app-footer/)
  assert.match(footer, /SmartCorretorAI/)
  assert.match(footer, /Planos/)
  assert.match(footer, /Smart Tokens/)
  assert.match(footer, /to: '\/termos'/)
  assert.match(footer, /to: '\/privacidade'/)
  assert.match(footer, /Conteúdos gerados com inteligência artificial podem conter erros ou imprecisões/)
  assert.match(footer, /© 2026 SmartCorretorAI\. Todos os direitos reservados\./)
  assert.doesNotMatch(footer, /Instagram|Facebook|TikTok|YouTube|WhatsApp|Admin|CNPJ/)
})

test('uses the single official support email across active frontend legal content', () => {
  const activeContactContent = `${footer}\n${privacy}\n${terms}`
  assert.match(footer, /href="mailto:suporte@smartcorretorai\.com"/)
  assert.match(privacy, /suporte@smartcorretorai\.com/)
  assert.match(terms, /suporte@smartcorretorai\.com/)
  assert.doesNotMatch(activeContactContent, /(?:contato|privacidade|financeiro|legal)@smartcorretorai\.com\.br/i)
})

test('does not reintroduce automatic Instagram publishing', () => {
  assert.doesNotMatch(`${dashboard}\n${footer}`, /instagram-publish|instagram-connection|Conectar Instagram|Publicar no Instagram|OAuth/)
})

test('preserves every approved product route in the application router', () => {
  for (const [, , route] of expectedProducts) {
    assert.match(app, new RegExp(`path=["']${route.replaceAll('/', '\\/')}["']`), route)
  }
})
