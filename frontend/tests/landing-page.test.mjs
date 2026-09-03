import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const landing = readFileSync(path.join(frontendRoot, 'src/pages/LandingPage.jsx'), 'utf8')
const html = readFileSync(path.join(frontendRoot, 'index.html'), 'utf8')
const textCampaignContract = readFileSync(path.join(frontendRoot, '../supabase/functions/generate-text-campaign/contract.ts'), 'utf8')
const slice = (start, end) => landing.slice(landing.indexOf(start), landing.indexOf(end))
const heroSource = slice('function Hero()', 'function PositioningStrip')
const videoGroup = slice("id: 'videos'", "id: 'imagens-campanhas'")
const imageGroup = slice("id: 'imagens-campanhas'", "id: 'textos-campanhas'")
const textPreview = slice('function TextCampaignPreview()', 'function ProductMedia')
const virtualStagingSpotlight = slice('function VirtualStagingPhone', 'function HowItWorks')
const usesSource = slice('function BenefitsSection()', 'function TokensSection')
const howSource = slice('function HowItWorks()', 'function BenefitsSection')
const faqSource = landing.match(/const FAQ_ITEMS = \[([\s\S]*?)\n\]/)?.[1] || ''

test('preserves SEO, the approved Hero and removes every visual overlay', () => {
  assert.match(html, /SmartCorretorAI \| Marketing Imobiliário com Inteligência Artificial/)
  assert.match(html, /rel="canonical" href="https:\/\/www\.smartcorretorai\.com\/"/)
  assert.match(heroSource, /Crie vídeos, imagens e campanhas para/)
  assert.match(heroSource, /vender, alugar e captar imóveis ou profissionais\./)
  assert.match(heroSource, /publique diretamente[\s\S]*?no Instagram e Facebook, em poucos passos\./)
  assert.match(heroSource, /HERO_PRODUCT_SLIDES\.map/)
  assert.doesNotMatch(heroSource, /BeforeAfter|accentBanner|HERO_BANNERS/)
})

test('rotates the approved Hero products automatically with synchronized media', () => {
  const heroSlides = slice('const HERO_PRODUCT_SLIDES', 'const PRODUCT_FAMILIES')
  const expectedProducts = ['Vídeo Imobiliário', 'Smart Space', 'Banner Imobiliário', 'Banners Rápidos', 'Studio IA']
  for (const product of expectedProducts) assert.ok(heroSlides.includes(`name: '${product}'`), product)
  assert.equal((heroSlides.match(/ id: '/g) || []).length, expectedProducts.length)
  assert.match(landing, /const HERO_ROTATION_INTERVAL_MS = 5200/)
  assert.match(heroSource, /setActiveIndex\(index => \(index \+ 1\) % HERO_PRODUCT_SLIDES\.length\)/)
  assert.match(heroSource, /activeSlide = HERO_PRODUCT_SLIDES\[activeIndex\]/)
  assert.match(heroSource, /\{activeSlide\.name\}/)
  assert.match(heroSource, /HERO_PRODUCT_SLIDES\.map\(\(slide, index\)/)
  assert.match(heroSource, /const active = activeIndex === index/)
  assert.match(heroSource, /<HeroMedia slide=\{slide\} active=\{active\}/)
  assert.match(heroSource, /if \(reducedMotion \|\| HERO_PRODUCT_SLIDES\.length < 2\) return undefined/)
  assert.match(heroSource, /transition-opacity duration-700 motion-reduce:transition-none/)
  assert.doesNotMatch(heroSource, /matchMedia\('\(min-width|innerWidth/)
})

test('positions the Raio-X as the strategic starting point and uses only Smart Space publicly', () => {
  assert.match(landing, /Não sabe por onde começar\?/)
  assert.match(landing, /to="\/raio-x-anuncio"/)
  assert.match(landing, /Smart Space/)
  assert.doesNotMatch(landing, /Virtual Staging/)
})

test('keeps inactive Hero videos unloaded and uses only approved local assets', () => {
  const heroMedia = slice('function HeroMedia', 'function Hero()')
  assert.match(heroMedia, /preload=\{active \? 'metadata' : 'none'\}/)
  assert.match(heroMedia, /if \(active\) void video\.play\(\)\.catch/)
  assert.match(heroMedia, /else video\.pause\(\)/)
  assert.match(heroMedia, /loading=\{active \? 'eager' : 'lazy'\}/)
  for (const source of [
    'demos-videos/video-campanha.mp4',
    'landing/virtual-staging-after.webp',
    'showcase/hero/hero-18semimagem.jpg',
    'previews/produto3/anuncio-premium-preview-1x1.jpg',
    'showcase/smart-studio-gallery/venda1lapa.mp4',
  ]) assert.equal(existsSync(path.join(frontendRoot, 'public', source)), true, source)
})

test('uses the final starting scenarios and tighter platform transition', () => {
  for (const copy of [
    'Com imagens ou sem imagens, você pode começar a criar.',
    'Use o material que você já tem para criar novas formas de apresentar e divulgar seus imóveis.',
    'Ainda não tem imagens? Tudo bem. Comece pelas informações e crie materiais para venda, locação, lançamentos, captação de imóveis ou captação de profissionais.',
    'Uma plataforma. Muitas formas de divulgar.',
    'transformar suas informações e materiais em novas formas de apresentar, divulgar e manter suas oportunidades presentes.',
  ]) assert.ok(landing.includes(copy), copy)
})

test('presents two independent internal-style video previews with the original item ordering', () => {
  assert.match(videoGroup, /eyebrow: 'Criações em vídeo'/)
  assert.match(videoGroup, /title: 'Veja tudo o que você pode criar\.'/)
  assert.match(videoGroup, /Carrossel de Anúncios/)
  for (const module of ['Fotos em Movimento', 'Legendas na Tela', 'Narração Profissional', 'Corretor Virtual IA', 'Short Videos', 'Comercial Imobiliário', 'Vídeo Criativo', 'Vida no Imóvel', 'Apresentação pelo Corretor']) assert.ok(videoGroup.includes(module), module)
  assert.match(videoGroup, /Carrossel de Anúncios[\s\S]*?orientation: 'vertical'/)
  assert.match(landing, /function DeliveryVideo/)
  assert.match(landing, /function VideoCreationGroup/)
  assert.match(landing, /aspect-\[9\/16\]/)
  assert.match(landing, /const groups = \[group\.items\.slice\(0, 5\), group\.items\.slice\(5\)\]/)
  assert.match(landing, /groups\.map\(\(items, index\) => <VideoCreationGroup/)
  assert.match(landing, /playingVideoRef\.current[\s\S]*?\.pause\(\)/)
  assert.match(landing, /onPlay=\{event => onPlay\(event\.currentTarget\)\}/)
  assert.doesNotMatch(slice('function DeliveryVideo', 'function ProductMedia'), /object-contain/)
  assert.match(landing, /onClick=\{\(\) => setActiveIndex\(index\)\}/)
  assert.ok(videoGroup.indexOf('Short Videos') < videoGroup.indexOf('Comercial Imobiliário'))
  assert.ok(videoGroup.indexOf('Apresentação pelo Corretor') < videoGroup.indexOf('Carrossel de Anúncios'))
})

test('keeps Short Videos presentation exactly as it was before this package', () => {
  assert.match(landing, /id: 'shorts'[\s\S]*?title: 'Short Videos'[\s\S]*?src: '\/demos-videos\/short-video-1\.mp4'/)
  assert.match(videoGroup, /id: 'short-videos'[\s\S]*?description: 'Crie vídeos curtos para manter seus imóveis presentes em formatos rápidos de divulgação\.'/)
  assert.doesNotMatch(landing, /SHORT_VIDEOS_AVAILABILITY|comingSoon|hidden: true|EM BREVE|Conhecer a plataforma/)
  assert.match(landing, /const groups = \[group\.items\.slice\(0, 5\), group\.items\.slice\(5\)\]/)
})

test('shows only the two approved image creations without duplicating Smart Space', () => {
  assert.match(imageGroup, /eyebrow: 'Criações em imagens'/)
  assert.match(imageGroup, /title: 'Veja tudo o que você pode criar\.'/)
  for (const module of ['Banner Imobiliário', 'Banners Rápidos']) assert.ok(imageGroup.includes(module), module)
  assert.doesNotMatch(imageGroup, /Smart Space|id: 'virtual-staging'/)
  assert.doesNotMatch(imageGroup, /Carrossel de Anúncios/)
  assert.match(slice('function ImageShowcase', 'function TextCampaignSection'), /max-w-5xl grid-cols-2/)
  assert.match(landing, /function ImagePreviewCard/)
  assert.match(landing, /BeforeAfter beforeSrc=\{item\.beforeSrc\} afterSrc=\{item\.src\} compact contain/)
  assert.match(slice('function ImagePreviewCard', 'function ImageShowcase'), /object-contain/)
  assert.match(landing, /'banners-rapidos': \[[\s\S]*?anuncio-premium-preview-1x1\.jpg[\s\S]*?video-tour-preview-1x1\.mp4[\s\S]*?imovel-detalhes-preview-1x1\.mp4/)
  assert.match(slice('function ImagePreviewCard', 'function ImageShowcase'), /example\.type === 'video'[\s\S]*?autoPlay muted loop playsInline preload="auto"/)
  assert.doesNotMatch(slice('const IMAGE_SHOWCASE_EXAMPLES', 'const TEXT_CAMPAIGN_CHANNELS'), /banner-story\.webp|banner-card\.webp/)
  assert.doesNotMatch(slice('function ImagePreviewCard', 'function ImageShowcase'), /border-\[6px\]|h-7 items-center justify-center/)
  assert.match(landing, /md:hidden/)
  assert.doesNotMatch(landing, /Inclui materiais para apoiar a divulgação/i)
})

test('highlights seven real Smart Space pairs across three independently rotating phones', () => {
  assert.match(virtualStagingSpotlight, /data-virtual-staging-phone=\{slot \+ 1\}/)
  assert.match(virtualStagingSpotlight, /VIRTUAL_STAGING_PHONE_SEQUENCES\.map/)
  assert.equal((landing.match(/before: '\/virtual-staging\//g) || []).length, 7)
  assert.equal((landing.match(/after: '\/virtual-staging\//g) || []).length, 7)
  for (const asset of [
    'virtual-staging-before.jpg', 'virtual-staging-after.png',
    ...Array.from({ length: 6 }, (_, index) => `example-${String(index + 1).padStart(2, '0')}-before.jpg`),
    ...Array.from({ length: 6 }, (_, index) => `example-${String(index + 1).padStart(2, '0')}-after.jpg`),
  ]) assert.equal(existsSync(path.join(frontendRoot, 'public/virtual-staging', asset)), true, asset)
  assert.match(virtualStagingSpotlight, /Pare de anunciar ambientes sem graça\./)
  assert.match(virtualStagingSpotlight, /Mostre o potencial do seu imóvel\./)
  assert.match(virtualStagingSpotlight, /to="\/virtual-staging"/)
  assert.match(virtualStagingSpotlight, /Transformar espaço/)
  assert.match(virtualStagingSpotlight, /Imagens geradas com inteligência artificial\. O resultado representa uma possibilidade visual de ambientação\./)
  assert.match(virtualStagingSpotlight, /3600 \+ slot \* 650/)
  assert.match(virtualStagingSpotlight, /reducedMotion \? <>/)
  assert.match(virtualStagingSpotlight, /loading=\{slot === 0 && frame === 0 \? 'eager' : 'lazy'\}/)
  assert.match(virtualStagingSpotlight, /lg:max-w-\[300px\]/)
  assert.match(virtualStagingSpotlight, /border-\[5px\]/)
  assert.doesNotMatch(virtualStagingSpotlight, /(?:^|:)rotate-|translate-y-|scale-\[/)
})

test('implements the clean five-channel text campaign with Hashtags first and production-shaped previews', () => {
  assert.match(landing, /Criar campanha de textos\./)
  assert.match(landing, /Converse com nossa IA e receba textos preparados para diferentes canais\./)
  assert.match(landing, /const TEXT_CAMPAIGN_CHANNELS = \[[\s\S]*?id: 'hashtags', title: 'Hashtags'/)
  assert.equal((textPreview.match(/TEXT_CAMPAIGN_CHANNELS\.map/g) || []).length, 1)
  for (const channel of ['Hashtags', 'Portal', 'Redes sociais', 'WhatsApp', 'Google Ads']) assert.ok(landing.includes(channel), channel)
  for (const removed of ['Entrega selecionada', 'Dados fictícios', 'Residencial Horizonte', 'Da imagem ao texto']) assert.doesNotMatch(textPreview + slice('function TextCampaignSection()', 'function DeliveryShowcase'), new RegExp(removed))
  assert.match(textPreview, /onClick=\{\(\) => setActiveIndex\(index\)\}/)
  for (const label of ['Título do anúncio', 'Descrição para portal', 'Anúncio curto', 'Instagram — comercial', 'Instagram — emocional', 'Instagram — oportunidade', 'Facebook — comercial', 'Facebook — emocional', 'Facebook — oportunidade', 'WhatsApp individual', 'WhatsApp carteira/lista', 'WhatsApp curto', 'Títulos curtos — 3 opções', 'Título longo', 'Descrições — 2 opções', 'Chamada', 'Palavras-chave sugeridas']) assert.ok(landing.includes(label), label)
  assert.match(textCampaignContract, /hashtags: \{ type: 'array', minItems: 12, maxItems: 15/)
  assert.match(textCampaignContract, /Google Ads deve conter uma única entrega estruturada: 2 a 6 headlines[\s\S]*?2 a 4 descriptions[\s\S]*?3 a 8 suggested_keywords/)
})

test('keeps campaign eligibility internal without rendering promotional badges', () => {
  assert.match(videoGroup, /campaignIncluded: true/)
  assert.match(imageGroup, /banner-imobiliario[\s\S]*?campaignIncluded: true/)
  assert.match(imageGroup, /banners-rapidos[\s\S]*?campaignIncluded: true/)
  assert.doesNotMatch(imageGroup, /id: 'virtual-staging'/)
  assert.doesNotMatch(landing, /Inclui materiais para apoiar a divulgação/i)
})

test('removes ranking numbers from real uses and applies the approved volume copy', () => {
  for (const use of ['Venda', 'Locação', 'Lançamentos', 'Captação de imóveis', 'Captação de profissionais']) assert.ok(landing.includes(use), use)
  assert.doesNotMatch(usesSource, /0\{index \+ 1\}/)
  assert.match(usesSource, /Antes de divulgar o imóvel, mostre ao proprietário como você pretende divulgá-lo\./)
  assert.match(usesSource, /Do corretor autônomo às equipes, gerentes e imobiliárias: crie materiais para diferentes imóveis, oportunidades e campanhas com a mesma facilidade\./)
})

test('uses Escolha, Informe and Receba without decorative step icons', () => {
  for (const copy of [
    'Você escolhe o que precisa. A gente simplifica o caminho.',
    'Sem prompts complicados, sem escolher modelos e sem descobrir qual ferramenta usar.',
    'Defina o que vamos criar juntos.',
    'Converse com nossa IA e vamos montar sua campanha.',
    'O SmartCorretorAI prepara sua criação e entrega o material pronto para você divulgar.',
  ]) assert.ok(howSource.includes(copy), copy)
  assert.match(howSource, /'01', 'Escolha'/)
  assert.match(howSource, /'02', 'Informe'/)
  assert.match(howSource, /'03', 'Receba'/)
  assert.doesNotMatch(howSource, /<Icon|LayoutTemplate|UploadCloud|Wand2/)
})

test('positions Smart Tokens around entry freedom rather than operational details', () => {
  for (const copy of [
    'Comece grátis, escolha um plano quando fizer sentido ou adicione Smart Tokens quando precisar.',
    'Teste grátis', 'Sem precisar assinar', 'Tudo em um só lugar', 'Ver planos e Smart Tokens',
  ]) assert.ok(landing.includes(copy), copy)
  const tokenSource = slice('function TokensSection()', 'function SocialProof')
  assert.doesNotMatch(tokenSource, /Saldo sempre visível|Consumo informado antes de criar/)
  assert.doesNotMatch(tokenSource, /R\$|SMART15/)
})

test('keeps social proof internally demo while removing technical labels from the public UI', () => {
  const socialSource = slice('function SocialProof()', 'function FaqSection')
  assert.match(socialSource, /Por que os corretores escolhem o SmartCorretorAI/)
  assert.doesNotMatch(socialSource, /A experiência de quem já experimentou\./)
  assert.match(socialSource, /data-demo-placeholder="true"/)
  assert.doesNotMatch(socialSource, /Prévia visual|Conteúdo ilustrativo|Nome ilustrativo|conteúdo demo/)
  assert.equal((socialSource.match(/<blockquote/g) || []).length, 1)
})

test('preserves the approved FAQ and adds transparent review guidance', () => {
  assert.equal((faqSource.match(/^\s*\['/gm) || []).length, 17)
  assert.match(landing, /Perguntas frequentes/)
  for (const question of ['As imagens e vídeos gerados são sempre fiéis ao imóvel?', 'Quem é responsável pelas informações e materiais divulgados?', 'Preciso revisar o conteúdo antes de publicar?']) assert.ok(faqSource.includes(question), question)
  assert.match(faqSource, /Smart Space, a imagem representa uma proposta visual do ambiente e pode incluir mobiliário, decoração ou elementos que não existem fisicamente no imóvel/)
  assert.match(faqSource, /O usuário é responsável por revisar e confirmar as informações, imagens, vídeos e textos antes da publicação/)
  assert.match(faqSource, /a revisão final continua sendo importante/)
  assert.doesNotMatch(faqSource, /a IA pode errar/i)
  assert.match(landing, />Redes sociais<\/h2>/)
  assert.equal((landing.match(/Inteligência que vende/g) || []).length, 1)
  assert.match(landing, /href="https:\/\/www\.instagram\.com\/smartcorretorai\/" target="_blank" rel="noopener noreferrer" aria-label="Instagram oficial do SmartCorretorAI"/)
  assert.doesNotMatch(landing, /Instagram — perfil oficial ainda não configurado/)
  assert.match(landing, /href="https:\/\/www\.facebook\.com\/profile\.php\?id=61589717755129" target="_blank" rel="noopener noreferrer" aria-label="Facebook oficial do SmartCorretorAI"/)
  assert.doesNotMatch(landing, /Facebook — perfil oficial ainda não configurado/)
})

test('contains no unsupported offer, price, payment, timing or result claims', () => {
  for (const forbidden of ['SMART15', '24 horas', 'Pix', 'Boleto', 'Apple Pay', 'Google Pay', 'venda garantida', 'mais vendas', 'mais clientes', 'mais leads', 'fechamento garantido']) assert.doesNotMatch(landing, new RegExp(forbidden, 'i'), forbidden)
  assert.match(landing, /200 Smart Tokens[^.]*Sem cartão/i)
  assert.doesNotMatch(landing, /R\$|6\.350|10\.850|26\.350/)
})

test('preserves accessible media, controls and local assets', () => {
  assert.match(landing, /loading="lazy"/)
  assert.match(landing, /poster=\{VIDEO_POSTERS\[item\.src\]\}/)
  assert.match(landing, /muted playsInline controls/)
  assert.match(landing, /aria-expanded=\{open\}/)
  assert.match(landing, /overflow-x-hidden/)
  for (const poster of ['animar-imagens.webp', 'video-campanha.webp', 'video-narrado.webp', 'corretor-virtual.webp', 'short-video-1.webp', 'studio-comercial.webp', 'studio-criativo.webp', 'studio-carrossel.webp', 'vida-no-imovel.webp', 'apresentacao-corretor.webp']) assert.equal(existsSync(path.join(frontendRoot, 'public/landing/posters', poster)), true, poster)
  assert.equal(existsSync(path.join(frontendRoot, 'public/landing/virtual-staging-after.webp')), true)
})
