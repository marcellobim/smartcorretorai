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
const smartTourConfig = read('src/config/smartTour.js')
const bannerShowcase = read('src/components/hero/HeroShowcase.jsx')
const studio = read('src/pages/StudioHero.jsx')
const virtualSpace = read('src/pages/VirtualStaging.jsx')
const quickBanners = read('src/data/templateCatalog.js')
const actionSource = dashboard.match(/const mainActions = \[([\s\S]*?)\n\]/)?.[1] || ''
const benefitsSource = dashboard.match(/const benefits = \[([\s\S]*?)\n\]/)?.[1] || ''
const faqSource = dashboard.match(/const faqItems = \[([\s\S]*?)\n\]/)?.[1] || ''

const expectedProducts = [
  ['smart-tour-ai', 'Vídeo Imobiliário', '/smart-tour-ai'],
  ['hero-ia', 'Banner Imobiliário', '/hero'],
  ['comercial-imobiliario', 'Comercial Imobiliário', '/studio-hero'],
  ['video-criativo', 'Vídeo Criativo', '/studio-hero'],
  ['smart-carrossel', 'Smart Carrossel', '/smart-carrossel'],
  ['banners-rapidos', 'Banners Rápidos', '/nova-campanha'],
  ['campanha-de-textos', 'Campanha de Textos', '/campanha-de-textos'],
  ['apresentacao-corretor', 'Apresentação pelo Corretor', '/virtual-staging'],
  ['vida-no-imovel', 'Vida no Imóvel', '/virtual-staging'],
  ['smart-space', 'Smart Space', '/virtual-staging'],
]

test('removes the old Home history, resume and profile blocks', () => {
  assert.doesNotMatch(dashboard, /Continue de onde parou|Criações recentes/i)
  assert.doesNotMatch(dashboard, /function ProfileCard|<ProfileCard|useCampaigns|useAuth|recentCampaigns/)
  assert.doesNotMatch(dashboard, /\/pacotes-gerados|function TokenCard|<TokenCard|Search|Bell/)
})

test('starts with the approved title and a real product-media carousel', () => {
  assert.doesNotMatch(dashboard, /Criação guiada com IA|Sparkles/)
  assert.doesNotMatch(dashboard, /eyebrow="Produtos"|Ativo agora/)
  assert.match(dashboard, /data-home-hero[\s\S]*lg:grid-cols-\[minmax\(350px,0\.9fr\)_minmax\(480px,1\.1fr\)\]/)
  assert.match(dashboard, /O que vamos criar para o seu imóvel hoje\?/)
  assert.match(dashboard, /Crie vídeos, imagens e campanhas profissionais para apresentar e divulgar seus imóveis\./)
  for (const asset of [
    '/demos-videos/animar-imagens.mp4',
    '/showcase/hero/hero-principal 1.jpg',
    '/showcase/smartcarrossel/showcase-carrossel.mp4',
    '/previews/produto3/anuncio-premium-preview-1x1.jpg',
  ]) assert.ok(dashboard.includes(asset), asset)
  assert.match(dashboard, /VIRTUAL_STAGING_BEFORE_IMAGE/)
  assert.match(dashboard, /VIRTUAL_STAGING_AFTER_IMAGE/)
  assert.match(dashboard, /data-home-hero-carousel/)
  assert.match(dashboard, /muted loop autoPlay=\{shouldPlay\} playsInline preload=\{isActive \? 'metadata' : 'none'\}/)
})

test('maps every hero medium to a source already used by its real product', () => {
  assert.match(smartTourConfig, /video: '\/demos-videos\/animar-imagens\.mp4'/)
  assert.match(bannerShowcase, /hero-principal%201\.jpg/)
  assert.match(studio, /media: '\/showcase\/smartcarrossel\/showcase-carrossel\.mp4'/)
  assert.match(virtualSpace, /virtual-staging-before\.jpg/)
  assert.match(virtualSpace, /virtual-staging-after\.png/)
  assert.match(quickBanners, /previewAssetUrl: '\/previews\/produto3\/anuncio-premium-preview-1x1\.jpg'/)
  assert.doesNotMatch(dashboard, /video-tour-preview-1x1|\/banners-rapidos\/hero-imovel\.jpg/)
})

test('provides a lightweight accessible carousel with manual, automatic and touch controls', () => {
  assert.match(dashboard, /useState\(1\)/)
  assert.match(dashboard, /window\.setTimeout[\s\S]*5200/)
  assert.match(dashboard, /prefers-reduced-motion: reduce/)
  assert.match(dashboard, /aria-roledescription="carrossel"/)
  assert.match(dashboard, /Mostrar exemplo anterior/)
  assert.match(dashboard, /Mostrar próximo exemplo/)
  assert.match(dashboard, /Pausar carrossel/)
  assert.match(dashboard, /Retomar carrossel/)
  assert.match(dashboard, /handleTouchStart/)
  assert.match(dashboard, /Math\.abs\(distance\) >= 42/)
  assert.match(dashboard, /ArrowLeft/)
  assert.match(dashboard, /ArrowRight/)
  assert.match(dashboard, /motion-reduce:transition-none/)
  assert.doesNotMatch(dashboard, /from ['"](?:swiper|slick-carousel|embla-carousel)/)
})

test('keeps one featured medium and partially visible neighbors without turning the carousel into navigation', () => {
  assert.match(dashboard, /carouselPositionClasses/)
  assert.match(dashboard, /lg:w-\[46%\]/)
  assert.match(dashboard, /lg:w-\[42%\]/)
  assert.match(dashboard, /lg:scale-\[0\.94\]/)
  assert.match(dashboard, /lg:opacity-90/)
  assert.match(dashboard, /bottom-8[\s\S]*origin-bottom/)
  assert.match(dashboard, /object-contain/)
  assert.match(dashboard, /h-\[19rem\][\s\S]*sm:h-\[21rem\][\s\S]*lg:h-\[19rem\]/)
  assert.doesNotMatch(dashboard.match(/function HeroMediaShowcase\(\) \{([\s\S]*?)\n\}\n\nconst carouselPositionClasses/)?.[1] || '', /<Link|<ProductButton|Criar agora/)
})

test('renders all ten active product options without inventing unavailable products', () => {
  const ids = [...actionSource.matchAll(/id: '([^']+)'/g)].map(match => match[1])
  assert.deepEqual(ids, expectedProducts.map(([id]) => id))

  for (const [id, title, route] of expectedProducts) {
    assert.match(actionSource, new RegExp(`id: '${id}'[\\s\\S]*?title: '${title}'[\\s\\S]*?to: '${route}'`))
  }
  assert.doesNotMatch(actionSource, /id: 'short-videos'|title: 'Short Videos'/)
  assert.doesNotMatch(actionSource, /Virtual Staging/)
  assert.deepEqual([...actionSource.matchAll(/icon: ([A-Za-z0-9]+)/g)].map(match => match[1]), [
    'Video', 'ImageIcon', 'Film', 'Wand2', 'ImagePlus', 'Zap', 'FileText', 'UserRound', 'Heart', 'Box',
  ])
})

test('puts the Raio-X in a wide strategic card before the product grid', () => {
  const xrayPosition = dashboard.indexOf('Descubra o que pode melhorar na divulgação do seu imóvel.')
  const gridPosition = dashboard.indexOf('data-home-product-grid')
  assert.ok(xrayPosition >= 0 && gridPosition > xrayPosition)
  assert.match(dashboard, /Analise seu anúncio, veja onde existe oportunidade e receba sugestões práticas para melhorar e ampliar sua divulgação\./)
  assert.match(dashboard, /to="\/raio-x-anuncio"[\s\S]*Analisar meu anúncio/)
})

test('uses a scannable three-column desktop grid across four rows', () => {
  assert.match(dashboard, /data-home-product-grid[\s\S]*auto-rows-fr[\s\S]*sm:grid-cols-2[\s\S]*lg:grid-cols-3/)
  assert.doesNotMatch(dashboard, /xl:grid-cols-6/)
  assert.match(dashboard, /mainActions\.map/)
  assert.match(dashboard, /O que você quer criar hoje\?/)
  assert.match(dashboard, /min-w-0/)
  assert.doesNotMatch(dashboard, /overflow-x-auto|min-w-\[[4-9][0-9]{2}px\]/)
})

test('uses subtle product accents on otherwise neutral white cards', () => {
  assert.match(actionSource, /icon: Video/)
  assert.match(dashboard, /const Icon = action\.icon/)
  assert.match(dashboard, /min-h-\[250px\][\s\S]*border border-slate-200 bg-white p-5/)
  assert.match(dashboard, /<Icon className="h-8 w-8 stroke-\[1\.65\]/)
  assert.deepEqual([...actionSource.matchAll(/tone: '([^']+)'/g)].map(match => match[1]), [
    'violet', 'mint', 'blue', 'cyan', 'violet', 'peach', 'gold', 'blue', 'peach', 'cyan',
  ])
  assert.match(dashboard, /absolute inset-x-0 bottom-0 h-1/)
  assert.match(dashboard, /productTones\[action\.tone\]/)
  assert.doesNotMatch(dashboard, /bg-(?:violet|emerald|blue|cyan|orange|amber)-50'|shadow-(?:violet|emerald|blue|cyan|orange|amber)/)
})

test('keeps product cards equal-height, scannable and fully clickable', () => {
  assert.match(dashboard, /data-home-product-grid[^>]*auto-rows-fr/)
  assert.match(dashboard, /className="group relative flex h-full min-h-\[250px\]/)
  assert.match(dashboard, /className={`block h-full min-w-0 rounded-3xl/)
  assert.match(dashboard, /group-hover:translate-x-1/)
})

test('adds the compact truthful four-benefit strip', () => {
  assert.match(dashboard, /data-home-benefits/)
  for (const text of [
    'Agilidade com qualidade',
    'Seguro e privado',
    'Economia inteligente',
    'Materiais prontos para divulgar',
  ]) assert.ok(benefitsSource.includes(text), text)
  assert.doesNotMatch(benefitsSource, /armazenamento permanente|publicação automática/i)
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

test('adds the thirteen practical FAQ questions with contact as the final item', () => {
  assert.match(dashboard, /Perguntas frequentes/)
  assert.doesNotMatch(dashboard, /Tire suas principais dúvidas sobre o SmartCorretorAI\./)
  const literalQuestions = [
    'Qual produto devo usar para o que preciso criar?',
    'Quais são os planos do SmartCorretorAI?',
    'Posso cancelar minha assinatura quando quiser?',
    'Como publico minhas criações nas redes sociais?',
    'Onde altero meu e-mail de acesso ou minha senha?',
    'Minhas criações ficam salvas?',
    'O SmartCorretorAI altera meus dados profissionais automaticamente?',
    'Quem é responsável pelas imagens, vídeos e materiais que eu envio?',
    'A inteligência artificial pode cometer erros ou alterar algum detalhe?',
    'Ainda ficou com alguma dúvida ou quer falar com a gente?',
  ]
  for (const question of literalQuestions) assert.ok(faqSource.includes(`question: '${question}'`), question)
  assert.match(faqSource, /question: `Preciso assinar um plano ou posso comprar \$\{SMART_TOKENS_LABEL\}/)
  assert.match(faqSource, /question: `Como funcionam os \$\{SMART_TOKENS_LABEL\}\? E se uma geração der erro\?`/)
  assert.match(faqSource, /question: `Meus \$\{SMART_TOKENS_LABEL\} expiram\?`/)
  assert.equal((faqSource.match(/question:/g) || []).length, 13)
  assert.match(faqSource, /mailto:suporte@smartcorretorai\.com/)
  assert.match(faqSource, /Falar com o SmartCorretorAI/)
  assert.ok(faqSource.lastIndexOf('Ainda ficou com alguma dúvida') > faqSource.lastIndexOf('A inteligência artificial pode cometer erros'))
})

test('answers product choice, plans and cancellation before offering shortcuts', () => {
  assert.match(faqSource, /Para vídeos do imóvel, use Vídeo Imobiliário[\s\S]*Banner Imobiliário[\s\S]*Banners Rápidos[\s\S]*Comercial Imobiliário[\s\S]*Vídeo Criativo[\s\S]*Smart Carrossel[\s\S]*Smart Space[\s\S]*Campanha de Textos/)
  assert.match(faqSource, /conteúdo textual preparado para uso manual no Google Ads/)
  assert.match(faqSource, /planos são indicados principalmente para quem cria com frequência/)
  assert.match(faqSource, /Gerenciar assinatura[\s\S]*portal seguro da Stripe/)
  assert.match(faqSource, /cancelamento tem efeito ao final do período vigente/)
})

test('documents confirmed Smart Token behavior for failures and separate purchases', () => {
  assert.match(faqSource, /geração falha ou não é concluída corretamente[\s\S]*reserva é cancelada[\s\S]*não são consumidos/)
  assert.match(faqSource, /comprados em recargas têm validade de 30 dias/)
  assert.match(faqSource, /incluídos em assinaturas seguem as condições do ciclo e da oferta contratada/)
})

test('documents manual publishing and requires immediate local download without a public retention promise', () => {
  assert.match(faqSource, /baixe o material[\s\S]*copie o texto preparado[\s\S]*anexe a imagem ou o vídeo[\s\S]*publique manualmente/i)
  assert.doesNotMatch(faqSource, /compartilhamento nativo|publica(?:ção|r) automática|OAuth/i)
  assert.match(faqSource, /não oferece galeria ou armazenamento permanente/)
  assert.match(faqSource, /Baixe e salve sua criação assim que ela estiver pronta/)
  assert.match(faqSource, /não há promessa de recuperação posterior pela interface/)
  assert.doesNotMatch(faqSource, /até 24 horas|24h/)
})

test('points account guidance to the final Configurações architecture', () => {
  assert.match(faqSource, /Onde altero meu e-mail de acesso ou minha senha\?/)
  assert.match(faqSource, /Configurações → Cadastro/)
  assert.match(faqSource, /Configurações → Acesso e Senha/)
  assert.match(faqSource, /Configurações → Plano e Assinatura/)
  assert.match(faqSource, /Smart Tokens na Sidebar/)
  assert.doesNotMatch(faqSource, /Perfil Profissional/)
})

test('explains user responsibility and the need to review AI output', () => {
  assert.match(faqSource, /Você é responsável pelo conteúdo enviado[\s\S]*autorizações ou os direitos necessários/)
  assert.match(faqSource, /IA podem apresentar erros, imprecisões ou variações[\s\S]*Revise as informações do imóvel/)
})

test('keeps native keyboard-accessible FAQ disclosures with reduced motion', () => {
  assert.match(dashboard, /<details/)
  assert.match(dashboard, /<summary/)
  assert.match(dashboard, /<details name="home-faq"/)
  assert.match(dashboard, /SMART_UI\.focus/)
  assert.match(dashboard, /motion-reduce:transition-none/)
  assert.match(dashboard, /as=\{item\.link\.href \? 'a' : Link\}/)
  assert.doesNotMatch(dashboard, /defaultOpen|open=\{/)
})

test('loads the entire FAQ section collapsed and reveals thirteen closed questions on demand', () => {
  assert.equal((faqSource.match(/question:/g) || []).length, 13)
  assert.match(dashboard, /<ProductCard as="details" onToggle=\{handleFaqSectionToggle\}[^>]*data-home-faq>/)
  assert.match(dashboard, /<summary onKeyDown=\{handleFaqSectionSummaryKeyDown\}[^>]*>[\s\S]*?Perguntas frequentes[\s\S]*?<Plus[^>]*group-open\/faq-section:hidden[\s\S]*?<Minus[^>]*group-open\/faq-section:block/)
  assert.match(dashboard, /<div className="border-t border-slate-200">[\s\S]*?faqItems\.map\(item =>[\s\S]*?<FaqItem key=\{item\.question\} item=\{item\} \/>/)
  assert.match(dashboard, /<details name="home-faq"[\s\S]*?<summary/)
  assert.match(dashboard, /function handleFaqSummaryKeyDown[\s\S]*event\.key !== 'Enter'[\s\S]*event\.key !== ' '[\s\S]*details\.open = shouldOpen/)
  assert.match(dashboard, /<summary onKeyDown=\{handleFaqSummaryKeyDown\}/)
  assert.match(dashboard, /<Plus[\s\S]*group-open:hidden/)
  assert.match(dashboard, /<Minus[\s\S]*group-open:block/)
  assert.doesNotMatch(dashboard, /<details[^>]*\sopen(?:=|\s|>)/)
})

test('closing the main FAQ section hides its questions and resets any open answer', () => {
  assert.match(dashboard, /function handleFaqSectionToggle\(event\)[\s\S]*if \(event\.currentTarget\.open\) return/)
  assert.match(dashboard, /event\.currentTarget\.querySelectorAll\('details\[name="home-faq"\]\[open\]'\)[\s\S]*item\.open = false/)
  assert.match(dashboard, /function handleFaqSectionSummaryKeyDown\(event\)[\s\S]*event\.key !== 'Enter'[\s\S]*event\.key !== ' '[\s\S]*details\.open = !details\.open/)
})

test('uses only real application routes in Home and footer shortcuts', () => {
  const sources = [dashboard, footer]
  const literalLinks = sources.flatMap(source => [...source.matchAll(/(?:to|to:)[:=]\s*['"]([^'"]+)['"]/g)].map(match => match[1]))
  const baseRoutes = [...new Set([...literalLinks.map(route => route.split('?')[0]), '/planos'])]
  for (const route of baseRoutes) {
    assert.match(app, new RegExp(`path=["']${route.replaceAll('/', '\\/')}["']`), route)
  }
  assert.match(faqSource, /to: '\/configuracoes\?tab=plano'/)
  assert.match(faqSource, /to: '\/configuracoes\?tab=acesso'/)
  assert.match(faqSource, /to: '\/configuracoes\?tab=cadastro'/)
  assert.doesNotMatch(faqSource, /tab=(?:assinatura|senha|perfil)/)
  assert.match(faqSource, /to: '\/termos'/)
})

test('renders the compact essential footer aligned with the Home grid', () => {
  assert.match(dashboard, /import AppFooter from '\.\.\/components\/layout\/AppFooter'/)
  assert.match(dashboard, /<AppFooter \/>/)
  assert.match(footer, /data-app-footer/)
  assert.match(footer, /© 2026 SmartCorretorAI\./)
  assert.match(footer, /to: '\/termos'/)
  assert.match(footer, /to: '\/privacidade'/)
  assert.match(footer, /Política de Privacidade/)
  assert.match(footer, /max-w-\[92rem\]/)
  assert.match(footer, /sm:flex-row/)
  assert.doesNotMatch(footer, /Planos|Smart Tokens|Conteúdos gerados com inteligência artificial|Instagram|Facebook|TikTok|YouTube|WhatsApp|Admin|CNPJ/)
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
