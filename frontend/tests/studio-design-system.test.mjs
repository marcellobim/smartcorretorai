import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')

test('ProductHero centralizes the official product hierarchy and supports the premium dark tone', () => {
  const hero = read('src/components/design-system/ProductHero.jsx')

  assert.match(hero, /productName, headline/)
  assert.match(hero, /usesOfficialHierarchy = Boolean\(productName\)/)
  assert.match(hero, /tone = 'light'/)
  assert.match(hero, /tone === 'dark'/)
  assert.match(hero, /usesOfficialHierarchy \? productName : title/)
  assert.match(hero, /usesOfficialHierarchy && headline/)
})

test('Banner and Video Imobiliario use ProductHero with the official hierarchy', () => {
  const banner = read('src/pages/HeroNext.jsx')
  const video = read('src/pages/SmartTourAI.jsx')

  assert.match(banner, /<ProductHero[\s\S]*?productName="Banner Imobiliário"[\s\S]*?headline="Sua campanha, criada com"/)
  assert.match(video, /<ProductHero[\s\S]*?productName="Vídeo Imobiliário"[\s\S]*?headline="Transforme as fotos dos seus imóveis em comerciais profissionais\."/)
  assert.doesNotMatch(banner, /<ProductHero[\s\S]*?eyebrow="SmartCorretorAI"/)
  assert.doesNotMatch(video, /<ProductHero[\s\S]*?eyebrow="SmartCorretorAI"/)
})

test('Studio IA reuses the shared Design System across its landing and internal flow', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const sharedComponents = [
    'ProductHero',
    'ProductButton',
    'ProductCard',
    'ProductSectionHeading',
    'ProductSteps',
    'ProductFlowLayout',
    'ProductSummary',
  ]

  for (const component of sharedComponents) {
    assert.match(studio, new RegExp(`<${component}`), `Studio IA should use ${component}`)
  }
  assert.equal(studio.match(/<ProductHero/g)?.length, 2)
  assert.equal(studio.match(/tone="dark"/g)?.length || 0, 0)
  assert.match(studio, /productName=\{<span>Studio IA<\/span>\}/)
  assert.doesNotMatch(studio, /eyebrow=\{isFreeAiMode \? 'Vídeo Criativo' : 'Comercial Imobiliário'\}/)
  assert.match(studio, /productName=\{isFreeAiMode \? 'Vídeo Criativo' : 'Comercial Imobiliário'\}/)
  assert.match(studio, /headline=\{isFreeAiMode \? 'Vamos transformar sua ideia em um vídeo\.' : 'Vamos criar seu comercial\.'\}/)
  assert.doesNotMatch(studio, /id="studio-ia-flow-title"[\s\S]*?productName="Studio IA"/)
  assert.match(studio, /mediaPresentation="mobile"/)
})

test('Studio IA internal hero hierarchy identifies each module without repeating the Studio title', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const carousel = read('src/pages/SmartCarrossel.jsx')
  const internalHero = studio.slice(studio.indexOf('id="studio-ia-flow-title"'), studio.indexOf('<StudioPossibilitiesShowcase />'))

  assert.doesNotMatch(internalHero, /eyebrow=/)
  assert.match(internalHero, /productName=\{isFreeAiMode \? 'Vídeo Criativo' : 'Comercial Imobiliário'\}/)
  assert.match(internalHero, /headline=\{isFreeAiMode \? 'Vamos transformar sua ideia em um vídeo\.' : 'Vamos criar seu comercial\.'\}/)
  assert.doesNotMatch(internalHero, /productName="Studio IA"/)
  assert.doesNotMatch(carousel, /eyebrow="Carrossel de Anúncios"/)
  assert.match(carousel, /productName="Carrossel de Anúncios"/)
  assert.match(carousel, /headline="Apresentação Profissional"/)
})

test('Studio IA preserves every declared module and example while sharing internal controls', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const carousel = read('src/pages/SmartCarrossel.jsx')
  const creationModes = studio.slice(studio.indexOf('const STUDIO_CREATION_MODES'), studio.indexOf('const STUDIO_MODE_EXAMPLES'))
  const modeExamples = studio.slice(studio.indexOf('const STUDIO_MODE_EXAMPLES'), studio.indexOf('const VISIBLE_STUDIO_CREATION_MODES'))
  const possibilityExamples = studio.slice(studio.indexOf('const STUDIO_POSSIBILITY_EXAMPLES'), studio.indexOf('const STUDIO_MODE_ACCENTS'))

  assert.equal(creationModes.match(/\bid: '/g)?.length, 5)
  assert.equal(modeExamples.match(/\bid: '/g)?.length, 5)
  assert.equal(possibilityExamples.match(/\bid: '/g)?.length, 4)
  assert.doesNotMatch(studio, /<button|<article|object-contain/)
  assert.doesNotMatch(carousel, /<button|object-contain/)
  assert.match(studio, /function UserReply[\s\S]*?<ConversationUserBubble/)
  assert.match(studio, /function ChipButton[\s\S]*?<ProductButton/)
  assert.match(studio, /function FilePicker[\s\S]*?<ProductCard[\s\S]*?as="label"/)
  assert.match(studio, /function LoadingCard[\s\S]*?<ProductCard/)
  assert.match(studio, /function ErrorCard[\s\S]*?<ProductCard/)
})

test('Studio IA keeps a spacious light landing Hero and uses minimal markers instead of emoji lists', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const landingHero = studio.slice(studio.indexOf('id="studio-ia-title"'), studio.indexOf('/>', studio.indexOf('id="studio-ia-title"')))

  assert.doesNotMatch(landingHero, /tone="dark"/)
  assert.match(studio, /bg-\[linear-gradient\(135deg,#ffffff_0%,#f0f7ff_52%,#ecfeff_100%\)\] text-slate-900/)
  assert.match(landingHero, /visual={<StudioHeroRepresentativePhone/)
  assert.match(studio, /STUDIO_HERO_REPRESENTATIVE_VIDEO = '\/showcase\/studio\/showcase-captacao-corretores\.mp4'/)
  assert.match(studio, /function StudioHeroRepresentativePhone[\s\S]*?<video[\s\S]*?src=\{STUDIO_HERO_REPRESENTATIVE_VIDEO\}[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline[\s\S]*?controls=\{false\}/)
  assert.doesNotMatch(studio, /O que voce pode criar/)
  assert.doesNotMatch(studio, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  assert.match(studio, /Você conversa com a IA e envia:/)
  assert.match(studio, /h-px w-4 bg-slate-400/)
  assert.match(studio, /h-1 w-1 shrink-0 rounded-full bg-slate-400/)
})

test('Studio IA internal heroes use the approved light color language without changing shared components', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const carousel = read('src/pages/SmartCarrossel.jsx')
  const gallery = read('src/pages/StudioGallery.jsx')

  assert.match(studio, /#ffffff_0%,#f0f7ff_52%,#ecfeff_100%/)
  assert.match(studio, /#ffffff_0%,#faf5ff_52%,#eef7ff_100%/)
  assert.match(studio, /border-blue-100 bg-white\/80 p-5 text-slate-950/)
  assert.equal(studio.match(/tone="dark"/g)?.length || 0, 0)
  assert.match(carousel, /#ffffff_0%,#ecfdf5_52%,#ecfeff_100%/)
  assert.doesNotMatch(carousel, /tone="dark"/)
  assert.match(gallery, /#ffffff_0%,#f0f7ff_52%,#faf5ff_100%/)
  assert.doesNotMatch(gallery, /tone="dark"/)
})

test('Studio IA phone mockups and expanded presentations inherit the official media classes', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const gallery = read('src/pages/StudioGallery.jsx')

  assert.equal(studio.match(/smart-phone-media/g)?.length, 3)
  assert.doesNotMatch(studio, /object-contain/)
  assert.match(gallery, /smart-phone-media absolute inset-0/)
  assert.match(gallery, /<ProductCard[\s\S]*?as="button"[\s\S]*?aria-label=\{`Abrir exemplo/)
  assert.match(gallery, /grid-cols-2[\s\S]*?sm:grid-cols-3[\s\S]*?xl:grid-cols-4[\s\S]*?2xl:grid-cols-5/)
  assert.match(gallery, /smart-presentation-media/)
  assert.match(gallery, /aspect-\[9\/16\]/)
  assert.match(gallery, /controlsList="nodownload noremoteplayback"/)
  assert.match(gallery, /disablePictureInPicture/)
  assert.match(gallery, /aria-label="Vídeo ampliado da galeria"/)
  assert.match(gallery, /<ProductButton[\s\S]*?aria-label="Fechar vídeo"[\s\S]*?autoFocus/)
  assert.match(gallery, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(gallery, /lastTriggerRef\.current\?\.focus\(\)/)
})

test('Studio IA keeps the complete example gallery available from the landing page', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const gallery = read('src/pages/StudioGallery.jsx')

  assert.equal(studio.match(/<StudioGalleryInvitation \/>/g)?.length, 2)
  assert.match(studio, /onClick=\{\(\) => navigate\('\/studio-galeria'\)\}/)
  assert.match(gallery, /title: 'Criadas a partir das imagens do imóvel'/)
  assert.match(gallery, /title: 'Criadas apenas com IA'/)
  assert.match(gallery, /title: 'Carrossel de Anúncios'/)
  assert.match(gallery, /SMART_CAROUSEL_GALLERY_VIDEO = '\/showcase\/smartcarrossel\/showcase-carrossel\.mp4'/)
  assert.equal((gallery.match(/'[^']+\.mp4'/g) || []).length, 32)
})

test('Carrossel de Anúncios inherits the Studio Design System and the official vertical media presentation', () => {
  const studio = read('src/pages/StudioHero.jsx')
  const carousel = read('src/pages/SmartCarrossel.jsx')
  const heroVideo = '/showcase/smartcarrossel/showcase-carrossel.mp4'

  assert.match(studio, new RegExp(heroVideo.replaceAll('/', '\\/')))
  assert.match(carousel, new RegExp(heroVideo.replaceAll('/', '\\/')))
  assert.match(carousel, /<ProductHero/)
  assert.match(carousel, /<ProductSteps[\s\S]*?accent="emerald"/)
  assert.match(carousel, /<ProductSectionHeading/)
  assert.match(carousel, /<ProductCard/)
  assert.match(carousel, /<ProductButton/)
  assert.match(carousel, /<GuidedConversation[\s\S]*?designSystem[\s\S]*?accent="emerald"/)
  assert.match(carousel, /smart-phone-media pointer-events-none absolute inset-0/)
  assert.match(carousel, /autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline/)
  assert.match(carousel, /mediaPresentation="mobile"/)
  assert.doesNotMatch(carousel, /banners-rapidos\/hero-imovel\.jpg|object-contain/)
})
